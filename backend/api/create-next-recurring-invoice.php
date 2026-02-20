<?php
header('Content-Type: application/json');
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/jwt.php';

try {
    $jwt = new JWT();
    $database = new Database();
    $pdo = $database->getConnection();

    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }

    // Get JWT token from header
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']);
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $token = str_replace('Bearer ', '', $_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }

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

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $proforma_invoice_detail_id = $input['proforma_invoice_detail_id'] ?? null;
        $proforma_invoice_id = $input['proforma_invoice_id'] ?? null;
        $sale_order_id = $input['sale_order_id'] ?? null; // Sale order ID to find all related invoices
        $bill_to_date = $input['bill_to_date'] ?? null; // Specific end date to filter services
        $inv_date = $input['inv_date'] ?? null;

        // Support multiple modes: single detail, grouped by invoice, or grouped by sale order
        if (!$proforma_invoice_detail_id && !$proforma_invoice_id && !$sale_order_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Either proforma invoice detail ID, proforma invoice ID, or sale order ID is required']);
            exit;
        }

        if (!$inv_date || empty($inv_date)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Proforma invoice date is required']);
            exit;
        }

        // Validate date format
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $inv_date)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid date format. Please use YYYY-MM-DD format']);
            exit;
        }

        $pdo->beginTransaction();

        try {
            // If proforma_invoice_id is provided, group by end date
            if ($proforma_invoice_id || $sale_order_id) {
                // Get all details that need recurring invoices
                // Group by sale_order_id + bill_to_date (not just proforma_invoice_id)
                // This handles services from multiple invoices linked to the same sale order
                $detailsQuery = "SELECT 
                                    pid.*,
                                    pi.sale_order_id,
                                    pi.contact_id,
                                    pi.bc_id,
                                    so.saleorder_no
                                 FROM proforma_invoice_details pid
                                 LEFT JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
                                 LEFT JOIN sale_orders so ON pi.sale_order_id = so.id
                                 WHERE pid.status = 'invoiced' 
                                   AND pid.bill_cycle_id IN (2, 3, 4)
                                   AND pid.bill_to_date <= CURDATE()";
                
                $queryParams = [];
                
                // If sale_order_id is provided, filter by sale order (preferred method)
                if ($sale_order_id) {
                    $detailsQuery .= " AND pi.sale_order_id = ?";
                    $queryParams[] = $sale_order_id;
                } elseif ($proforma_invoice_id) {
                    // Fallback: Get sale_order_id from the proforma invoice, then find all related services
                    $soQuery = "SELECT sale_order_id FROM proforma_invoices WHERE id = ?";
                    $soStmt = $pdo->prepare($soQuery);
                    $soStmt->execute([$proforma_invoice_id]);
                    $soResult = $soStmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($soResult && $soResult['sale_order_id']) {
                        $detailsQuery .= " AND pi.sale_order_id = ?";
                        $queryParams[] = $soResult['sale_order_id'];
                    } else {
                        // If no sale order found, use original invoice_id filter as fallback
                        $detailsQuery .= " AND pid.p_inv_id = ?";
                        $queryParams[] = $proforma_invoice_id;
                    }
                }
                
                // If bill_to_date is provided, only include services with that specific end date
                if ($bill_to_date && preg_match('/^\d{4}-\d{2}-\d{2}$/', $bill_to_date)) {
                    $detailsQuery .= " AND pid.bill_to_date = ?";
                    $queryParams[] = $bill_to_date;
                }
                
                $detailsQuery .= " ORDER BY pid.bill_to_date ASC";
                
                $detailsStmt = $pdo->prepare($detailsQuery);
                $detailsStmt->execute($queryParams);
                $allDetails = $detailsStmt->fetchAll(PDO::FETCH_ASSOC);

                if (empty($allDetails)) {
                    throw new Exception('No recurring invoice details found for this proforma invoice');
                }

                // Get first detail's base info for invoice generation
                $firstDetail = $allDetails[0];
                
                // Group details by bill_to_date (end date)
                $groupedByEndDate = [];
                foreach ($allDetails as $detail) {
                    $endDate = $detail['bill_to_date'];
                    if (!isset($groupedByEndDate[$endDate])) {
                        $groupedByEndDate[$endDate] = [];
                    }
                    $groupedByEndDate[$endDate][] = $detail;
                }

                $createdInvoices = [];
                
                // Get billing company prefix once (same for all invoices in same proforma)
                $current_year = date('Y');
                $bc_query = "SELECT bc_prefix FROM bill_company WHERE bc_id = ?";
                $bc_stmt = $pdo->prepare($bc_query);
                $bc_stmt->execute([$firstDetail['bc_id']]);
                $bc_result = $bc_stmt->fetch(PDO::FETCH_ASSOC);
                $bc_prefix = $bc_result['bc_prefix'] ?? 'XX';
                
                // Get the starting number (will be incremented for each invoice)
                $invoiceNumberQuery = "SELECT MAX(CAST(SUBSTRING(invoice_no, LENGTH('PI-{$bc_prefix}-{$current_year}-') + 1) AS UNSIGNED)) as max_num 
                                      FROM proforma_invoices 
                                      WHERE invoice_no LIKE 'PI-{$bc_prefix}-{$current_year}-%'";
                $invoiceNumberStmt = $pdo->prepare($invoiceNumberQuery);
                $invoiceNumberStmt->execute();
                $result = $invoiceNumberStmt->fetch(PDO::FETCH_ASSOC);
                $start_num = ($result['max_num'] ?? 0) + 1;
                
                // Process each group (same end date)
                $invoiceCounter = 0;
                foreach ($groupedByEndDate as $endDate => $details) {
                    // Generate unique invoice number for this group
                    $next_num = $start_num + $invoiceCounter;
                    $newInvoiceNumber = 'PI-' . $bc_prefix . '-' . $current_year . '-' . str_pad($next_num, 3, '0', STR_PAD_LEFT);
                    $invoiceCounter++;

                    // Calculate totals for this group
                    $subTotal = 0;
                    $grandTotal = 0;
                    foreach ($details as $detail) {
                        $subTotal += floatval($detail['inv_bill_amount']);
                        $grandTotal += floatval($detail['inv_total_amount']);
                    }

                    // Create new proforma invoice for this group
                    $newInvoiceQuery = "INSERT INTO proforma_invoices 
                                        (sale_order_id, contact_id, bc_id, invoice_no, inv_date, inv_sub_total, inv_grand_total, created_by, status) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                    
                    $newInvoiceStmt = $pdo->prepare($newInvoiceQuery);
                    $newInvoiceStmt->execute([
                        $firstDetail['sale_order_id'],
                        $firstDetail['contact_id'],
                        $firstDetail['bc_id'],
                        $newInvoiceNumber,
                        $inv_date,
                        $subTotal,
                        $grandTotal,
                        $user_id,
                        'active'
                    ]);

                    $newInvoiceId = $pdo->lastInsertId();

                    // Create invoice details for all services in this group
                    $newDetailQuery = "INSERT INTO proforma_invoice_details 
                                       (p_inv_id, sale_order_detail_id, service_id, service_name, qty, inv_rate, inv_amount, 
                                        tax_id, igst, cgst, sgst, igst_amount, cgst_amount, sgst_amount, 
                                        inv_bill_amount, inv_total_amount, bill_cycle_id, bill_from_date, bill_to_date, bill_followup, status) 
                                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                    
                    $newDetailStmt = $pdo->prepare($newDetailQuery);
                    
                    foreach ($details as $detail) {
                        // Calculate new dates based on bill cycle
                        $billCycleId = $detail['bill_cycle_id'];
                        $cycleQuery = "SELECT cycle_terms FROM bill_cycles WHERE id = ?";
                        $cycleStmt = $pdo->prepare($cycleQuery);
                        $cycleStmt->execute([$billCycleId]);
                        $cycleData = $cycleStmt->fetch(PDO::FETCH_ASSOC);
                        
                        $cycleTerms = $cycleData['cycle_terms'] ?? 1;
                        $monthsToAdd = 12 / $cycleTerms; // For quarterly: 3 months, half yearly: 6 months, etc.
                        
                        // Calculate new dates
                        $oldFromDate = new DateTime($detail['bill_from_date']);
                        $oldToDate = new DateTime($detail['bill_to_date']);
                        
                        $newFromDate = clone $oldToDate;
                        $newFromDate->add(new DateInterval('P1D')); // Start from day after old end date
                        
                        // Use proper month addition (handles variable month lengths correctly)
                        // For quarterly: add 3 months, for half yearly: add 6 months, etc.
                        $monthsToAddInt = (int)round($monthsToAdd);
                        $newToDate = clone $newFromDate;
                        $newToDate->add(new DateInterval('P' . $monthsToAddInt . 'M'));
                        $newToDate->sub(new DateInterval('P1D')); // Subtract 1 day to get the end date (inclusive)
                        
                        // Special handling: If the original end date was the last day of its month,
                        // ensure the new end date is also the last day of its month
                        // This ensures January always shows 31, not 30
                        $lastDayOfOldMonth = (int)$oldToDate->format('t'); // Total days in old month
                        $dayOfOldMonth = (int)$oldToDate->format('d');
                        
                        if ($dayOfOldMonth === $lastDayOfOldMonth) {
                            // Original was last day of month, so new should also be last day of month
                            $newToDate->modify('last day of this month');
                        }
                        
                        // Increment recurring invoice followup number
                        $newRecurringInvoiceFollowup = ($detail['bill_followup'] ?? 1) + 1;

                        // Check if this is the final recurring invoice followup
                        $isFinalFollowup = ($newRecurringInvoiceFollowup >= $cycleTerms);
                        $status = $isFinalFollowup ? 'completed' : 'invoiced';

                        // Insert new detail
                        $newDetailStmt->execute([
                            $newInvoiceId,
                            $detail['sale_order_detail_id'],
                            $detail['service_id'],
                            $detail['service_name'],
                            $detail['qty'],
                            $detail['inv_rate'],
                            $detail['inv_amount'],
                            $detail['tax_id'],
                            $detail['igst'],
                            $detail['cgst'],
                            $detail['sgst'],
                            $detail['igst_amount'],
                            $detail['cgst_amount'],
                            $detail['sgst_amount'],
                            $detail['inv_bill_amount'],
                            $detail['inv_total_amount'],
                            $detail['bill_cycle_id'],
                            $newFromDate->format('Y-m-d'),
                            $newToDate->format('Y-m-d'),
                            $newRecurringInvoiceFollowup,
                            $status
                        ]);

                        // Update the old proforma_invoice_details record status to 'followed'
                        $updateOldDetailQuery = "UPDATE proforma_invoice_details 
                                                 SET status = 'followed' 
                                                 WHERE id = ?";
                        
                        $updateOldDetailStmt = $pdo->prepare($updateOldDetailQuery);
                        $updateOldDetailStmt->execute([$detail['id']]);
                    }

                    $createdInvoices[] = [
                        'invoice_id' => $newInvoiceId,
                        'invoice_number' => $newInvoiceNumber,
                        'end_date' => $endDate,
                        'service_count' => count($details),
                        'sub_total' => $subTotal,
                        'grand_total' => $grandTotal
                    ];
                }

                $pdo->commit();

                echo json_encode([
                    'success' => true,
                    'message' => count($createdInvoices) . ' recurring invoice(s) created successfully, grouped by end date',
                    'data' => [
                        'created_invoices' => $createdInvoices,
                        'total_invoices' => count($createdInvoices)
                    ]
                ]);
                
            } else {
                // Original single detail logic
                // Get the specific proforma invoice detail and related data
                // Only include services that are due or overdue (bill_to_date <= CURDATE())
                $detailQuery = "SELECT 
                                    pid.*,
                                    pi.sale_order_id,
                                    pi.contact_id,
                                    pi.bc_id,
                                    pi.inv_sub_total,
                                    pi.inv_grand_total,
                                    so.saleorder_no
                                 FROM proforma_invoice_details pid
                                 LEFT JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
                                 LEFT JOIN sale_orders so ON pi.sale_order_id = so.id
                                 WHERE pid.id = ? AND pid.bill_to_date <= CURDATE()";
                
                $detailStmt = $pdo->prepare($detailQuery);
                $detailStmt->execute([$proforma_invoice_detail_id]);
                $originalDetail = $detailStmt->fetch(PDO::FETCH_ASSOC);

                if (!$originalDetail) {
                    throw new Exception('Proforma invoice detail not found or not yet due. Only overdue or due services can create next recurring invoice.');
                }

            // Generate new invoice number (format: PI-{BC_PREFIX}-YYYY-XXX)
            $current_year = date('Y');
            
            // Get billing company prefix
            $bc_query = "SELECT bc_prefix FROM bill_company WHERE bc_id = ?";
            $bc_stmt = $pdo->prepare($bc_query);
            $bc_stmt->execute([$originalDetail['bc_id']]);
            $bc_result = $bc_stmt->fetch(PDO::FETCH_ASSOC);
            $bc_prefix = $bc_result['bc_prefix'] ?? 'XX'; // Default to 'XX' if no prefix
            
            // Get the highest number for the current year and billing company prefix
            $invoiceNumberQuery = "SELECT MAX(CAST(SUBSTRING(invoice_no, LENGTH('PI-{$bc_prefix}-{$current_year}-') + 1) AS UNSIGNED)) as max_num 
                                  FROM proforma_invoices 
                                  WHERE invoice_no LIKE 'PI-{$bc_prefix}-{$current_year}-%'";
            $invoiceNumberStmt = $pdo->prepare($invoiceNumberQuery);
            $invoiceNumberStmt->execute();
            $result = $invoiceNumberStmt->fetch(PDO::FETCH_ASSOC);
            
            $next_num = ($result['max_num'] ?? 0) + 1;
            $newInvoiceNumber = 'PI-' . $bc_prefix . '-' . $current_year . '-' . str_pad($next_num, 3, '0', STR_PAD_LEFT);
            
            // Debug logging

            // Create new proforma invoice with amounts from the current detail
            $newInvoiceQuery = "INSERT INTO proforma_invoices 
                                (sale_order_id, contact_id, bc_id, invoice_no, inv_date, inv_sub_total, inv_grand_total, created_by, status) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $newInvoiceStmt = $pdo->prepare($newInvoiceQuery);
            $newInvoiceStmt->execute([
                $originalDetail['sale_order_id'],
                $originalDetail['contact_id'],
                $originalDetail['bc_id'],
                $newInvoiceNumber,
                $inv_date,
                $originalDetail['inv_bill_amount'], // Use inv_bill_amount as sub_total
                $originalDetail['inv_total_amount'], // Use inv_total_amount as grand_total
                $user_id,
                'active'
            ]);

            $newInvoiceId = $pdo->lastInsertId();

            // Calculate new dates based on bill cycle
            $billCycleId = $originalDetail['bill_cycle_id'];
            $cycleQuery = "SELECT cycle_terms FROM bill_cycles WHERE id = ?";
            $cycleStmt = $pdo->prepare($cycleQuery);
            $cycleStmt->execute([$billCycleId]);
            $cycleData = $cycleStmt->fetch(PDO::FETCH_ASSOC);
            
            $cycleTerms = $cycleData['cycle_terms'] ?? 1;
            $monthsToAdd = 12 / $cycleTerms; // For quarterly: 3 months, half yearly: 6 months, etc.
            
            // Calculate new dates
            $oldFromDate = new DateTime($originalDetail['bill_from_date']);
            $oldToDate = new DateTime($originalDetail['bill_to_date']);
            
            $newFromDate = clone $oldToDate;
            $newFromDate->add(new DateInterval('P1D')); // Start from day after old end date
            
            // Use proper month addition (handles variable month lengths correctly)
            // For quarterly: add 3 months, for half yearly: add 6 months, etc.
            $monthsToAddInt = (int)round($monthsToAdd);
            $newToDate = clone $newFromDate;
            $newToDate->add(new DateInterval('P' . $monthsToAddInt . 'M'));
            $newToDate->sub(new DateInterval('P1D')); // Subtract 1 day to get the end date (inclusive)
            
            // Special handling: If the original end date was the last day of its month,
            // ensure the new end date is also the last day of its month
            // This ensures January always shows 31, not 30
            $lastDayOfOldMonth = (int)$oldToDate->format('t'); // Total days in old month
            $dayOfOldMonth = (int)$oldToDate->format('d');
            
            if ($dayOfOldMonth === $lastDayOfOldMonth) {
                // Original was last day of month, so new should also be last day of month
                $newToDate->modify('last day of this month');
            }
            
            // Increment recurring invoice followup number
            $newRecurringInvoiceFollowup = ($originalDetail['bill_followup'] ?? 1) + 1;

            // Check if this is the final recurring invoice followup (bill_followup equals cycle_terms)
            $isFinalFollowup = ($newRecurringInvoiceFollowup >= $cycleTerms);
            $status = $isFinalFollowup ? 'completed' : 'invoiced';

            // Create new proforma invoice detail
            $newDetailQuery = "INSERT INTO proforma_invoice_details 
                               (p_inv_id, sale_order_detail_id, service_id, service_name, qty, inv_rate, inv_amount, 
                                tax_id, igst, cgst, sgst, igst_amount, cgst_amount, sgst_amount, 
                                inv_bill_amount, inv_total_amount, bill_cycle_id, bill_from_date, bill_to_date, bill_followup, status) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $newDetailStmt = $pdo->prepare($newDetailQuery);
            $newDetailStmt->execute([
                $newInvoiceId,
                $originalDetail['sale_order_detail_id'],
                $originalDetail['service_id'],
                $originalDetail['service_name'],
                $originalDetail['qty'],
                $originalDetail['inv_rate'],
                $originalDetail['inv_amount'],
                $originalDetail['tax_id'],
                $originalDetail['igst'],
                $originalDetail['cgst'],
                $originalDetail['sgst'],
                $originalDetail['igst_amount'],
                $originalDetail['cgst_amount'],
                $originalDetail['sgst_amount'],
                $originalDetail['inv_bill_amount'],
                $originalDetail['inv_total_amount'],
                $originalDetail['bill_cycle_id'],
                $newFromDate->format('Y-m-d'),
                $newToDate->format('Y-m-d'),
                $newRecurringInvoiceFollowup,
                $status
            ]);

                // Update the old proforma_invoice_details record status to 'followed'
                $updateOldDetailQuery = "UPDATE proforma_invoice_details 
                                         SET status = 'followed' 
                                         WHERE id = ?";
                
                $updateOldDetailStmt = $pdo->prepare($updateOldDetailQuery);
                $updateOldDetailStmt->execute([$proforma_invoice_detail_id]);

                $pdo->commit();

                echo json_encode([
                    'success' => true,
                    'message' => $isFinalFollowup ? 
                        'Final recurring invoice created successfully and billing cycle completed' : 
                        'Next recurring invoice created successfully and old record marked as followed',
                    'data' => [
                        'new_invoice_id' => $newInvoiceId,
                        'new_invoice_number' => $newInvoiceNumber,
                        'new_recurring_invoice_followup' => $newRecurringInvoiceFollowup,
                        'cycle_terms' => $cycleTerms,
                        'is_final_followup' => $isFinalFollowup,
                        'status' => $status,
                        'old_detail_id' => $proforma_invoice_detail_id,
                        'old_status_updated' => 'followed'
                    ]
                ]);
            }

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}
?>

