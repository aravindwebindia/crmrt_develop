<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';

// Initialize JWT and Database
$jwt = new JWT();
$database = new Database();
$pdo = $database->getConnection();

if (!$pdo) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    
    // Get token from Authorization header
    $auth_header = '';
    $token = null;

    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['HTTP_authorization'])) {
        $auth_header = $_SERVER['HTTP_authorization'];
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $auth_header = $headers['Authorization'];
        } elseif (isset($headers['authorization'])) {
            $auth_header = $headers['authorization'];
        }
    }

    if (!empty($auth_header)) {
        if (preg_match('/Bearer\s(\S+)/i', $auth_header, $matches)) {
            $token = $matches[1];
        }
    }

    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authorization header missing or invalid']);
        exit;
    }

    $decoded = $jwt->validate($token);
    
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }
    
    $user_id = $decoded['user_id'];
    
    // Get request data
    $raw_input = file_get_contents('php://input');
    $input = json_decode($raw_input, true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON data']);
        exit;
    }
    
    // Validate required fields
    $required_fields = ['contact_id', 'quotation_id', 'bc_id', 'sub_total', 'grand_total', 'services'];
    foreach ($required_fields as $field) {
        if (!isset($input[$field])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
            exit;
        }
    }
    
    // Generate sale order number (format: SO-YYYY-XXX, supports unlimited numbers)
    // Same logic as quotation number generation - use COUNT instead of MAX
    $year = date('Y');
    
    // Count only valid SO-YYYY-XXX format numbers (supports any number of digits: 001, 1000, 10000, 100000, etc.)
    $sql = "SELECT COUNT(*) as count FROM sale_orders 
            WHERE saleorder_no REGEXP ? 
            AND YEAR(created_at) = ?";
    
    $stmt = $pdo->prepare($sql);
    $pattern = "^SO-$year-[0-9]+$"; // SO-YYYY-XXX format (supports any number of digits)
    $stmt->execute([$pattern, $year]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $nextNumber = ($result['count'] ?? 0) + 1;
    
    // Supports unlimited numbers: pads 1-999 to 3 digits, then uses full number for 1000+
    $paddedNum = $nextNumber < 1000 ? str_pad($nextNumber, 3, '0', STR_PAD_LEFT) : (string)$nextNumber;
    $saleorder_no = 'SO-' . $year . '-' . $paddedNum;
    
    // Get current date
    $current_date = date('Y-m-d');
    
    // Start transaction
    $pdo->beginTransaction();
    
    try {
        // Calculate overall amounts from quotation services
        $overall_amt = 0;
        $overall_gst = 0;
        $overall_total_amt = 0;

        foreach ($input['services'] as $index => $services) {
            $qt_service = "SELECT * FROM quotation_services
                          WHERE id = :quotation_service_id";
        
        $qt_serviceStmt = $pdo->prepare($qt_service);
        $qt_serviceStmt->execute(['quotation_service_id' => $services['quotation_service_id']]);
        $qtDetail = $qt_serviceStmt->fetch(PDO::FETCH_ASSOC);

        $tax_service = "SELECT * FROM tax
                          WHERE tax_id = :tax_id";
        
        $tax_serviceStmt = $pdo->prepare($tax_service);
        $tax_serviceStmt->execute(['tax_id' => $services['tax_id']]);
        $taxDetail = $tax_serviceStmt->fetch(PDO::FETCH_ASSOC);
        

            $overall_amt += $qtDetail['amount'] ?? 0;
            // Use igst_amount from frontend as overall_gst
            $overall_gst += number_format(($qtDetail['amount'] * $taxDetail['igst'] / 100) ?? 0, 2, '.', '');
            
            
            
        }
        $overall_total_amt = $overall_amt + $overall_gst;
        // Insert into sale_orders table
        
        $stmt = $pdo->prepare("
            INSERT INTO sale_orders (
                saleorder_no, 
                contact_id, 
                quotation_id, 
                bc_id, 
                sub_total, 
                grand_total, 
                overall_amt,
                overall_gst,
                overall_total_amt,
                date, 
                created_by, 
                is_invoiced, 
                status, 
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
        ");
        
        $stmt->execute([
            $saleorder_no,
            $input['contact_id'],
            $input['quotation_id'],
            $input['bc_id'],
            $input['sub_total'],
            $input['grand_total'],
            $overall_amt,
            $overall_gst,
            $overall_total_amt,
            $current_date,
            $user_id,
            $input['is_invoiced']
        ]);
        
        $sale_order_id = $pdo->lastInsertId();
        
        // Insert into sale_order_details table
        $stmt = $pdo->prepare("
            INSERT INTO sale_order_details (
                sale_order_id,
                quotation_service_id,
                service_name,
                service_id,
                qty,
                rate,
                amount,
                bill_amount,
                tax_id,
                igst,
                cgst,
                sgst,
                igst_amount,
                cgst_amount,
                sgst_amount,
                total_amount,
                bill_cycle_id,
                bill_cycle_terms,
                from_date,
                to_date,
                duration,
                is_invoiced,
                bo_gst_amt,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        
        foreach ($input['services'] as $service) {
            // Get tax percentages from tax table
            $tax_stmt = $pdo->prepare("SELECT igst, cgst, sgst FROM tax WHERE tax_id = ?");
            $tax_stmt->execute([$service['tax_id']]);
            $tax_data = $tax_stmt->fetch(PDO::FETCH_ASSOC);
            
            // Get bill cycle terms
            $cycle_stmt = $pdo->prepare("SELECT cycle_terms FROM bill_cycles WHERE id = ?");
            $cycle_stmt->execute([$service['bill_cycle_id']]);
            $cycle_data = $cycle_stmt->fetch(PDO::FETCH_ASSOC);
            
            // Get tax percentages
            $igst_percentage = $tax_data['igst'] ?? 0;
            $cgst_percentage = $tax_data['cgst'] ?? 0;
            $sgst_percentage = $tax_data['sgst'] ?? 0;
            
           
            
            // Use frontend calculated tax_amount as igst_amount
            $igst_amount = $service['tax_amount'] ?? 0;
            
            // Calculate CGST and SGST amounts based on their percentages
            $bill_amount = $service['bill_amount'] ?? 0;
            $cgst_amount = ($bill_amount * $cgst_percentage) / 100;
            $sgst_amount = ($bill_amount * $sgst_percentage) / 100;
            
            $ser_amt=$service['amount'];
            $bo_gst_amt=($service['amount'] * $igst_percentage) / 100;
            
            $stmt->execute([
                $sale_order_id,
                $service['quotation_service_id'],
                $service['service_name'],
                $service['service_id'],
                $service['quantity'],
                $service['rate'],
                $service['amount'],
                $service['bill_amount'],
                $service['tax_id'],
                $igst_percentage,
                $cgst_percentage,
                $sgst_percentage,
                $igst_amount,
                $cgst_amount,
                $sgst_amount,
                $service['total_amount'],
                $service['bill_cycle_id'],
                $cycle_data['cycle_terms'],
                $service['from_date'],
                $service['to_date'],
                $service['duration'] ?? null, // Insert duration if present, null otherwise
                $input['is_invoiced'],
                $bo_gst_amt
            ]);
        }
        
        // Update quotation_services table to mark services as moved to sale order
        $update_stmt = $pdo->prepare("
            UPDATE quotation_services 
            SET is_moved_so = 1 
            WHERE id = ?
        ");
        
        foreach ($input['services'] as $service) {
            $update_stmt->execute([$service['quotation_service_id']]);
        }
        
        // Check if is_invoiced = 1, then insert to proforma_invoices table
        $is_invoiced = intval($input['is_invoiced'] ?? 0);
        $proforma_invoice_generated = false;
        $proforma_invoice_no = null;
        
        if ($is_invoiced === 1) {
            // Generate proforma invoice number (format: PI-{BC_PREFIX}-YYYY-XXX)
            $current_year = date('Y');
            
            // Get billing company prefix
            $bc_query = "SELECT bc_prefix FROM bill_company WHERE bc_id = ?";
            $bc_stmt = $pdo->prepare($bc_query);
            $bc_stmt->execute([$input['bc_id']]);
            $bc_result = $bc_stmt->fetch(PDO::FETCH_ASSOC);
            $bc_prefix = $bc_result['bc_prefix'] ?? 'XX'; // Default to 'XX' if no prefix
            
            // Get the highest number for the current year and billing company prefix.
            // Only non-deleted invoices count, so a deleted invoice's number becomes
            // reusable when it was the most recently issued one (the sequence tail).
            $invoice_no_query = "SELECT MAX(CAST(SUBSTRING(invoice_no, LENGTH('PI-{$bc_prefix}-{$current_year}-') + 1) AS UNSIGNED)) as max_num
                                FROM proforma_invoices
                                WHERE invoice_no LIKE 'PI-{$bc_prefix}-{$current_year}-%'
                                  AND is_deleted = 0";
            $invoice_no_stmt = $pdo->prepare($invoice_no_query);
            $invoice_no_stmt->execute();
            $result = $invoice_no_stmt->fetch(PDO::FETCH_ASSOC);
            
            $next_num = ($result['max_num'] ?? 0) + 1;
            $proforma_invoice_no = 'PI-' . $bc_prefix . '-' . $current_year . '-' . str_pad($next_num, 3, '0', STR_PAD_LEFT);
            
            // Debug logging
            
            // Insert into proforma_invoices table
            $proforma_invoice_query = "INSERT INTO proforma_invoices 
                                     (sale_order_id, contact_id, bc_id, inv_sub_total, inv_grand_total, invoice_no, inv_date, created_by, created_at) 
                                     VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, NOW())";
            
            $proforma_invoice_stmt = $pdo->prepare($proforma_invoice_query);
            $proforma_invoice_stmt->execute([
                $sale_order_id,
                $input['contact_id'],
                $input['bc_id'],
                $input['sub_total'], // Use sub_total
                $input['grand_total'], // Use grand_total
                $proforma_invoice_no,
                $user_id
            ]);
            
            $proforma_invoice_id = $pdo->lastInsertId();
            
            // Insert into proforma_invoice_details table
            $proforma_invoice_details_query = "INSERT INTO proforma_invoice_details 
                                             (p_inv_id, sale_order_detail_id, service_id, service_name, qty, inv_rate, inv_amount, 
                                              tax_id, igst, cgst, sgst, igst_amount, cgst_amount, sgst_amount, inv_bill_amount, 
                                              inv_total_amount, bill_cycle_id, bill_from_date, bill_to_date, bill_followup, created_at) 
                                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
            
            $proforma_invoice_details_stmt = $pdo->prepare($proforma_invoice_details_query);
            
            // Get the sale_order_details that were just inserted with bill_cycle_terms
            $sale_order_details_query = "SELECT sod.id, sod.service_id, sod.service_name, sod.qty, sod.rate, sod.amount, sod.bill_amount, 
                                               sod.tax_id, sod.igst, sod.cgst, sod.sgst, sod.igst_amount, sod.cgst_amount, sod.sgst_amount, 
                                               sod.total_amount, sod.bill_cycle_id, sod.from_date, sod.to_date, bc.cycle_terms
                                        FROM sale_order_details sod
                                        LEFT JOIN bill_cycles bc ON sod.bill_cycle_id = bc.id
                                        WHERE sod.sale_order_id = ?";
            
            $sale_order_details_stmt = $pdo->prepare($sale_order_details_query);
            $sale_order_details_stmt->execute([$sale_order_id]);
            $sale_order_details = $sale_order_details_stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($sale_order_details as $detail) {
                // Calculate bill_followup based on cycle_terms
                $bill_followup = 1; // Default to 1
                $cycle_terms = intval($detail['cycle_terms'] ?? 1);
                
                // For half yearly (2 payments per year), cycle_terms = 2
                // For quarterly (4 payments per year), cycle_terms = 4
                // For monthly (12 payments per year), cycle_terms = 12
                // For yearly (1 payment per year), cycle_terms = 1
                
                // For now, we'll set bill_followup = 1 for the first payment
                // In the future, this could be calculated based on the date range or other logic
                $bill_followup = 1;
                
                $proforma_invoice_details_stmt->execute([
                    $proforma_invoice_id,
                    $detail['id'], // This is the actual sale_order_detail_id
                    $detail['service_id'],
                    $detail['service_name'],
                    $detail['qty'],
                    $detail['rate'],
                    $detail['amount'],
                    $detail['tax_id'],
                    $detail['igst'],
                    $detail['cgst'],
                    $detail['sgst'],
                    $detail['igst_amount'],
                    $detail['cgst_amount'],
                    $detail['sgst_amount'],
                    $detail['bill_amount'],
                    $detail['total_amount'],
                    $detail['bill_cycle_id'],
                    $detail['from_date'],
                    $detail['to_date'],
                    $bill_followup
                ]);
            }
            
            
            $proforma_invoice_generated = true;
        }
        
        // Commit transaction
        $pdo->commit();
        
        $response = [
            'success' => true,
            'message' => 'Sale order created successfully',
            'sale_order_id' => $sale_order_id,
            'saleorder_no' => $saleorder_no,
            'overall_amounts' => [
                'overall_amt' => $overall_amt,
                'overall_gst' => $overall_gst,
                'overall_total_amt' => $overall_total_amt
            ]
        ];
        
        if ($proforma_invoice_generated) {
            $response['proforma_invoice_generated'] = true;
            $response['proforma_invoice_no'] = $proforma_invoice_no;
            $response['message'] = 'Sale order and proforma invoice created successfully';
        }
        
        echo json_encode($response);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error creating sale order: ' . $e->getMessage()
    ]);
}
?>
