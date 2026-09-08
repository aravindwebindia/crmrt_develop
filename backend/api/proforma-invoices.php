<?php
header('Content-Type: application/json');
require_once '../config/cors.php';
require_once '../config/jwt.php';
require_once '../config/database.php';

try {
    $jwt = new JWT();
    $database = new Database();
    $pdo = $database->getConnection();

    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }

    // Function to generate proforma invoice number based on billing company
    function generateProformaInvoiceNumber($pdo, $bc_id) {
        try {
            // Get billing company details
            $bcQuery = "SELECT bc_prefix FROM bill_company WHERE bc_id = ?";
            $bcStmt = $pdo->prepare($bcQuery);
            $bcStmt->execute([$bc_id]);
            $billingCompany = $bcStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$billingCompany) {
                return null;
            }
            
            $PIName = 'PI-';
            $shortName = $billingCompany['bc_prefix'];
            $currentYear = date('Y');
            
            // Find the last invoice number for this billing company in current year
            $lastInvoiceQuery = "SELECT invoice_no FROM proforma_invoices 
                                WHERE bc_id = ? AND invoice_no LIKE ? 
                                ORDER BY invoice_no DESC LIMIT 1";
            $lastInvoiceStmt = $pdo->prepare($lastInvoiceQuery);
            $pattern = $PIName . $shortName . '-' . $currentYear . '-%';
            $lastInvoiceStmt->execute([$bc_id, $pattern]);
            $lastInvoice = $lastInvoiceStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($lastInvoice) {
                // Extract the number from the last invoice
                $lastNumber = (int) substr($lastInvoice['invoice_no'], -3);
                $newNumber = $lastNumber + 1;
            } else {
                // First invoice for this billing company this year
                $newNumber = 1;
            }
            
            // Format the new invoice number
            $newInvoiceNo = $PIName . $shortName . '-' . $currentYear . '-' . str_pad($newNumber, 3, '0', STR_PAD_LEFT);
            
            return $newInvoiceNo;
            
        } catch (Exception $e) {
            error_log("Error generating proforma invoice number: " . $e->getMessage());
            return null;
        }
    }

    // Get JWT token from header
    $headers = getallheaders();
    $token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : null;

    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'No token provided']);
        exit();
    }

    // Verify token
    $decoded = $jwt->validate($token);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }

    $user_id = $decoded['user_id'];

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Get pagination parameters
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $search = isset($_GET['search']) ? $_GET['search'] : '';
        $sortBy = isset($_GET['sortBy']) ? $_GET['sortBy'] : 'created_at';
        $sortOrder = isset($_GET['sortOrder']) ? $_GET['sortOrder'] : 'DESC';
        $status = isset($_GET['status']) ? $_GET['status'] : '';

        $offset = ($page - 1) * $limit;

        // Build query
        $query = "SELECT 
                    pi.id,
                    pi.invoice_no as pi_number,
                    pi.bc_id,
                    so.saleorder_no,
                    c.company as company_name,
                    cp.contact_email as contact_email,
                    cp.contact_person as contact_name,
                    bc.bc_name as billing_company,
                    pi.inv_date as pi_date,
                    pi.inv_grand_total as grand_total,
                    pi.tax_invoice_no,
                    pi.tax_received_amt,
                    pi.status,
                    pi.mail_status,
                    pi.created_at,
                    u.username as created_by_name,
                    u.email as created_by_email
                  FROM proforma_invoices pi
                  LEFT JOIN sale_orders so ON pi.sale_order_id = so.id
                  LEFT JOIN quotations q ON so.quotation_id=q.id
                  LEFT JOIN contact_persons cp ON q.cp_id = cp.cp_id
                  LEFT JOIN contacts c ON cp.contact_id = c.ld_id                  
                  LEFT JOIN bill_company bc ON pi.bc_id = bc.bc_id
                  LEFT JOIN users u ON pi.created_by = u.id
                  WHERE pi.is_deleted = 0";

        $params = [];

        // Add search condition
        if (!empty($search)) {
            $query .= " AND (pi.invoice_no LIKE :search OR c.company LIKE :search OR so.saleorder_no LIKE :search)";
            $params['search'] = "%$search%";
        }

        // Add status filter
        if (!empty($status)) {
            $query .= " AND pi.status = :status";
            $params['status'] = $status;
        }

        // Add sorting
        $allowedSortFields = ['created_at', 'pi_number', 'company_name', 'billing_company', 'pi_date', 'grand_total', 'status', 'created_by_name'];
        if (in_array($sortBy, $allowedSortFields)) {
            if ($sortBy === 'created_at') {
                $query .= " ORDER BY pi.created_at $sortOrder";
            } elseif ($sortBy === 'created_by_name') {
                $query .= " ORDER BY u.username $sortOrder";
            } else {
                $query .= " ORDER BY $sortBy $sortOrder";
            }
        } else {
            $query .= " ORDER BY pi.created_at DESC";
        }

        // Get total count
        $countQuery = "SELECT COUNT(*) as total FROM proforma_invoices pi
                      LEFT JOIN sale_orders so ON pi.sale_order_id = so.id
                      LEFT JOIN contacts c ON so.contact_id = c.ld_id
                      LEFT JOIN users u ON pi.created_by = u.id
                      WHERE pi.is_deleted = 0";
        
        if (!empty($search)) {
            $countQuery .= " AND (pi.invoice_no LIKE :search OR c.company LIKE :search OR so.saleorder_no LIKE :search)";
        }
        if (!empty($status)) {
            $countQuery .= " AND pi.status = :status";
        }

        $countStmt = $pdo->prepare($countQuery);
        $countStmt->execute($params);
        $totalItems = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
        $totalPages = ceil($totalItems / $limit);

        // Add pagination
        $query .= " LIMIT $limit OFFSET $offset";

        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $proformaInvoices = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $proformaInvoices,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => $totalPages,
                'total_items' => $totalItems,
                'items_per_page' => $limit
            ]
        ]);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        // Handle proforma invoice updates (both tax invoice and general updates)
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID is required']);
            exit;
        }

        $id = (int)$input['id'];

        // Check if this is a tax invoice update or general update
        if (isset($input['tax_invoice_no'])) {
            // Handle tax invoice update
            $tax_invoice_no = trim($input['tax_invoice_no']);
            $tax_received_amt = isset($input['tax_received_amt']) ? (float)$input['tax_received_amt'] : 0;

            if (empty($tax_invoice_no)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Tax invoice number cannot be empty']);
                exit;
            }
        } else {
            // Handle general proforma invoice update (billing company and date)
            if (!isset($input['bc_id']) || !isset($input['inv_date'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Billing company ID and invoice date are required']);
                exit;
            }

            $bc_id = (int)$input['bc_id'];
            $inv_date = trim($input['inv_date']);

            if (empty($inv_date)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invoice date cannot be empty']);
                exit;
            }

            // Validate date format
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $inv_date)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid date format. Please use YYYY-MM-DD format']);
                exit;
            }
        }

        try {
            $pdo->beginTransaction();

            // Check if proforma invoice exists
            $checkQuery = "SELECT id, sale_order_id, bc_id FROM proforma_invoices WHERE id = :id";
            $checkStmt = $pdo->prepare($checkQuery);
            $checkStmt->execute(['id' => $id]);
            $proformaInvoice = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$proformaInvoice) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Proforma invoice not found']);
                exit;
            }

            $sale_order_id = $proformaInvoice['sale_order_id'];

            // Update proforma invoice based on type
            if (isset($input['tax_invoice_no'])) {
                // Tax invoice update
                $updateQuery = "UPDATE proforma_invoices 
                               SET tax_invoice_no = :tax_invoice_no, 
                                   tax_received_amt = :tax_received_amt,
                                   status = 'completed',
                                   updated_at = NOW()
                               WHERE id = :id";
                
                $stmt = $pdo->prepare($updateQuery);
                $result = $stmt->execute([
                    'tax_invoice_no' => $tax_invoice_no,
                    'tax_received_amt' => $tax_received_amt,
                    'id' => $id
                ]);
            } else {
                // General update (billing company and date)
                // Check if billing company is changing
                $currentBcId = $proformaInvoice['bc_id'];
                $newInvoiceNo = null;
                
                // Debug logging
                if ($bc_id != $currentBcId) {
                    // Billing company is changing, generate new invoice number
                    $newInvoiceNo = generateProformaInvoiceNumber($pdo, $bc_id);
                } 
                
                if ($newInvoiceNo) {
                    // Update with new invoice number
                    $updateQuery = "UPDATE proforma_invoices 
                                   SET bc_id = :bc_id, 
                                       inv_date = :inv_date,
                                       invoice_no = :invoice_no,
                                       mail_status = 0,
                                       updated_at = NOW()
                                   WHERE id = :id";
                    
                    $stmt = $pdo->prepare($updateQuery);
                    $result = $stmt->execute([
                        'bc_id' => $bc_id,
                        'inv_date' => $inv_date,
                        'invoice_no' => $newInvoiceNo,
                        'id' => $id
                    ]);
                } else {
                    // No billing company change, regular update
                    $updateQuery = "UPDATE proforma_invoices 
                                   SET bc_id = :bc_id, 
                                       inv_date = :inv_date,
                                       mail_status = 0,
                                       updated_at = NOW()
                                   WHERE id = :id";
                    
                    $stmt = $pdo->prepare($updateQuery);
                    $result = $stmt->execute([
                        'bc_id' => $bc_id,
                        'inv_date' => $inv_date,
                        'id' => $id
                    ]);
                }
            }

            if ($result && $stmt->rowCount() > 0) {
                if (isset($input['tax_invoice_no'])) {
                    // Only check outstanding amounts for tax invoice updates
                    $outstandingQuery = "SELECT 
                                            so.overall_total_amt as total_amount,
                                            COALESCE(SUM(pi.tax_received_amt), 0) as total_invoiced_amount
                                         FROM sale_orders so
                                         LEFT JOIN proforma_invoices pi ON so.id = pi.sale_order_id 
                                         WHERE so.id = :sale_order_id 
                                         AND pi.tax_invoice_no IS NOT NULL
                                         GROUP BY so.id, so.overall_total_amt";
                    
                    $outstandingStmt = $pdo->prepare($outstandingQuery);
                    $outstandingStmt->execute(['sale_order_id' => $sale_order_id]);
                    $outstandingData = $outstandingStmt->fetch(PDO::FETCH_ASSOC);
                    
                    $total_amount = (float)$outstandingData['total_amount'];
                    $total_invoiced = (float)$outstandingData['total_invoiced_amount'];
                    $outstanding_amount = $total_amount - $total_invoiced;
                    
                    // If outstanding amount is 0 or less, update sale order status to closed
                    if ($outstanding_amount <= 0) {
                        $updateSaleOrderQuery = "UPDATE sale_orders 
                                               SET status = 'closed', 
                                                   updated_at = NOW()
                                               WHERE id = :sale_order_id";
                        
                        $saleOrderUpdateStmt = $pdo->prepare($updateSaleOrderQuery);
                        $saleOrderUpdateStmt->execute(['sale_order_id' => $sale_order_id]);
                    }

                    $pdo->commit();
                    
                    $responseMessage = 'Tax invoice updated successfully and status changed to completed';
                    if ($outstanding_amount <= 0) {
                        $responseMessage .= '. Sale order status changed to closed as outstanding amount is now 0';
                    }
                    
                    echo json_encode([
                        'success' => true,
                        'message' => $responseMessage,
                        'data' => [
                            'id' => $id,
                            'tax_invoice_no' => $tax_invoice_no,
                            'tax_received_amt' => $tax_received_amt,
                            'status' => 'completed',
                            'sale_order_status' => $outstanding_amount <= 0 ? 'closed' : 'active',
                            'outstanding_amount' => $outstanding_amount
                        ]
                    ]);
                } else {
                    // General update response
                    $pdo->commit();
                    $responseData = [
                        'id' => $id,
                        'bc_id' => $bc_id,
                        'inv_date' => $inv_date
                    ];
                    
                    // Include new invoice number if it was generated
                    if ($newInvoiceNo) {
                        $responseData['invoice_no'] = $newInvoiceNo;
                    }
                    
                    echo json_encode([
                        'success' => true,
                        'message' => $newInvoiceNo ? 'Proforma invoice updated successfully with new invoice number' : 'Proforma invoice updated successfully',
                        'data' => $responseData
                    ]);
                }
            } else {
                $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update proforma invoice']);
            }

        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to update tax invoice']);
        }

    } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        // Handle proforma invoice deletion
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Proforma invoice ID is required']);
            exit;
        }

        $id = (int)$input['id'];

        $pdo->beginTransaction();

        try {
            // Get proforma invoice details to check conditions
            $proformaQuery = "SELECT pi.*, so.id as sale_order_id, so.contact_id, so.bc_id,
                                    (SELECT COUNT(*) FROM proforma_invoices pi2
                                     WHERE pi2.sale_order_id = pi.sale_order_id
                                     AND pi2.is_deleted = 0) as total_invoices_for_sale_order,
                                    (SELECT MAX(pi3.id) FROM proforma_invoices pi3
                                     WHERE pi3.sale_order_id = pi.sale_order_id
                                     AND pi3.is_deleted = 0) as latest_invoice_id_for_sale_order
                            FROM proforma_invoices pi
                            LEFT JOIN sale_orders so ON pi.sale_order_id = so.id
                            WHERE pi.id = :id AND pi.is_deleted = 0";

            $proformaStmt = $pdo->prepare($proformaQuery);
            $proformaStmt->execute(['id' => $id]);
            $proformaInvoice = $proformaStmt->fetch(PDO::FETCH_ASSOC);

            if (!$proformaInvoice) {
                throw new Exception('Proforma invoice not found');
            }

            // Check if tax_invoice_no is already set
            if (!empty($proformaInvoice['tax_invoice_no'])) {
                throw new Exception('Cannot delete proforma invoice that has been invoiced (tax invoice number exists)');
            }

            // Only the most recent proforma invoice for the sale order can be deleted.
            // This keeps the recurring chain intact: deleting a wrongly generated invoice
            // must never remove/modify the parent recurring configuration, and must not
            // strand an older invoice that has already been superseded.
            $isFirstInvoice = intval($proformaInvoice['total_invoices_for_sale_order']) <= 1;
            if (intval($proformaInvoice['latest_invoice_id_for_sale_order']) !== $id) {
                throw new Exception('Cannot delete this proforma invoice. A newer proforma invoice already exists for this sale order; only the most recently generated proforma invoice can be deleted.');
            }

            // Get this invoice's line items so the recurring chain can be restored
            $ownDetailsQuery = "SELECT id, sale_order_detail_id FROM proforma_invoice_details
                            WHERE p_inv_id = :proforma_invoice_id";
            $ownDetailsStmt = $pdo->prepare($ownDetailsQuery);
            $ownDetailsStmt->execute(['proforma_invoice_id' => $id]);
            $ownDetails = $ownDetailsStmt->fetchAll(PDO::FETCH_ASSOC);

            // Soft delete proforma invoice
            $deleteProformaQuery = "UPDATE proforma_invoices
                                   SET is_deleted = 1, updated_at = NOW()
                                   WHERE id = :id";
            $deleteProformaStmt = $pdo->prepare($deleteProformaQuery);
            $deleteProformaStmt->execute(['id' => $id]);

            if ($isFirstInvoice) {
                // No prior invoice exists yet, so simply reopen the sale order for a
                // fresh initial proforma invoice (existing behavior, unchanged).
                $saleOrderDetailIds = array_column($ownDetails, 'sale_order_detail_id');
                if (!empty($saleOrderDetailIds)) {
                    $placeholders = str_repeat('?,', count($saleOrderDetailIds) - 1) . '?';
                    $updateDetailsQuery = "UPDATE sale_order_details
                                          SET is_invoiced = 0, updated_at = NOW()
                                          WHERE id IN ($placeholders)";
                    $updateDetailsStmt = $pdo->prepare($updateDetailsQuery);
                    $updateDetailsStmt->execute($saleOrderDetailIds);

                    $updateSaleOrderQuery = "UPDATE sale_orders
                                            SET is_invoiced = 0, updated_at = NOW()
                                            WHERE id = :sale_order_id";
                    $updateSaleOrderStmt = $pdo->prepare($updateSaleOrderQuery);
                    $updateSaleOrderStmt->execute(['sale_order_id' => $proformaInvoice['sale_order_id']]);
                }
            } else {
                // A prior invoice in the recurring chain exists for this sale order.
                // Revert each service line's previous ("followed") record back to
                // "invoiced" so the existing recurring/duplicate-prevention logic
                // picks it up again for the next generation, exactly as if this
                // invoice had never been generated. Sale order invoiced flags are
                // left untouched since the sale order was already correctly marked
                // invoiced by the earlier cycle.
                $revertPredecessorStmt = $pdo->prepare("UPDATE proforma_invoice_details
                    SET status = 'invoiced'
                    WHERE sale_order_detail_id = :sale_order_detail_id
                      AND status = 'followed'
                      AND id = (
                          SELECT id FROM (
                              SELECT MAX(id) as id FROM proforma_invoice_details
                              WHERE sale_order_detail_id = :sale_order_detail_id2
                                AND status = 'followed'
                                AND id < :own_id
                          ) as prev
                      )");

                foreach ($ownDetails as $ownDetail) {
                    if (empty($ownDetail['sale_order_detail_id'])) {
                        continue;
                    }
                    $revertPredecessorStmt->execute([
                        'sale_order_detail_id' => $ownDetail['sale_order_detail_id'],
                        'sale_order_detail_id2' => $ownDetail['sale_order_detail_id'],
                        'own_id' => $ownDetail['id']
                    ]);
                }
            }

            $pdo->commit();

            echo json_encode([
                'success' => true,
                'message' => 'Proforma invoice deleted successfully.' . ($isFirstInvoice ? ' Sale order is now available for new proforma invoice creation.' : ' Future recurring generation will continue from the prior invoice.')
            ]);

        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>
