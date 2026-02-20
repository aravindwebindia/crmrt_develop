<?php
require_once __DIR__ . '/../config/cors.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';

// Initialize JWT
$jwt = new JWT();

// Get JWT token from header
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : null;

if (!$token) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No token provided']);
    exit();
}

// Validate token first
$decoded = $jwt->validate($token);

if (!$decoded) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid token - validation failed']);
    exit();
}

$user_id = $decoded['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid JSON input']);
            exit;
        }
        
        $sale_order_id = $input['sale_order_id'] ?? null;
        $billing_company_id = $input['billing_company_id'] ?? null;
        $services = $input['services'] ?? [];
        
        // Debug logging
        
               
        if (!$sale_order_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Sale order ID is required']);
            exit;
        }
        
        if (!$billing_company_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Billing company is required']);
            exit;
        }
        
        if (empty($services)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'At least one service is required']);
            exit;
        }
        
        $database = new Database();
        $pdo = $database->getConnection();
        
        if (!$pdo) {
            throw new Exception('Database connection failed');
        }
        
        $pdo->beginTransaction();
        
        try {
            // Calculate overall amounts
            $overall_amt = 0;
            $overall_gst = 0;
            $overall_total_amt = 0;
            $overall_service_amount=0;
            $overall_service_igst=0;
            $overall_service_total_amt=0;

            foreach ($services as $service) {

                $tax_service = "SELECT * FROM tax
                          WHERE tax_id = :tax_id";
                
                $tax_serviceStmt = $pdo->prepare($tax_service);
                $tax_serviceStmt->execute(['tax_id' => $service['tax_id']]);
                $taxDetail = $tax_serviceStmt->fetch(PDO::FETCH_ASSOC);


                $service_amount = floatval($service['bill_amount'] ?? 0);
                $service_igst = floatval($service['igst_amount'] ?? 0);


                
                $overall_service_amount += $service_amount;
                $overall_service_igst += $service_igst;

                $overall_amt += $service['amount'] ?? 0;
                // Use igst_amount from frontend as overall_gst
                $overall_gst += number_format(($service['amount'] * $taxDetail['igst'] / 100) ?? 0, 2, '.', '');
               
            }
            $overall_service_total_amt = $overall_service_amount + $overall_service_igst;
            $overall_total_amt = $overall_amt + $overall_gst;
            
            // Update sale_orders table
            $updateSaleOrderQuery = "UPDATE sale_orders 
                                    SET bc_id = :billing_company_id,
                                        sub_total = :sub_total,
                                        grand_total = :grand_total,
                                        overall_amt= :overall_amt,
                                        overall_gst= :overall_gst,
                                        overall_total_amt= :overall_total_amt,
                                        updated_at = NOW()
                                    WHERE id = :sale_order_id";
            
            $updateSaleOrderStmt = $pdo->prepare($updateSaleOrderQuery);
            $updateSaleOrderStmt->execute([
                'billing_company_id' => $billing_company_id,
                'sub_total' => $overall_service_amount,
                'grand_total' => $overall_service_total_amt,
                'sale_order_id' => $sale_order_id,
                'overall_amt' =>$overall_amt,
                'overall_gst' =>$overall_gst,
                'overall_total_amt' =>$overall_total_amt
            ]);
            
            // First, mark all existing services as deleted (soft delete)
            $markAllDeletedQuery = "UPDATE sale_order_details SET is_deleted = 1 WHERE sale_order_id = :sale_order_id";
            $markAllDeletedStmt = $pdo->prepare($markAllDeletedQuery);
            $markAllDeletedStmt->execute(['sale_order_id' => $sale_order_id]);
            
            // Reset all quotation services is_moved_so to 0 for this sale order
            $resetAllQuotationServicesQuery = "UPDATE quotation_services qs 
                                              INNER JOIN sale_order_details sod ON qs.id = sod.quotation_service_id 
                                              SET qs.is_moved_so = 0 
                                              WHERE sod.sale_order_id = :sale_order_id";
            $resetAllQuotationServicesStmt = $pdo->prepare($resetAllQuotationServicesQuery);
            $resetAllQuotationServicesStmt->execute(['sale_order_id' => $sale_order_id]);
            
            // Update sale_order_details table
            foreach ($services as $serviceIndex => $service) {
                // Validate required fields
                if (!isset($service['id']) || !isset($service['bill_cycle_id'])) {
                    continue;
                }
                // Validate and format dates
                $from_date = null;
                $to_date = null;
                
                if (!empty($service['from_date']) && $service['from_date'] !== '1' && $service['from_date'] !== '0') {
                    // Check if it's a valid date format
                    $date_check = DateTime::createFromFormat('Y-m-d', $service['from_date']);
                    if ($date_check && $date_check->format('Y-m-d') === $service['from_date']) {
                        $from_date = $service['from_date'];
                    }
                }
                
                if (!empty($service['to_date']) && $service['to_date'] !== '1' && $service['to_date'] !== '0') {
                    // Check if it's a valid date format
                    $date_check = DateTime::createFromFormat('Y-m-d', $service['to_date']);
                    if ($date_check && $date_check->format('Y-m-d') === $service['to_date']) {
                        $to_date = $service['to_date'];
                    }
                }
                
                // Get cycle_terms from bill_cycles table
                $bill_cycle_terms = null;
                if ($service['bill_cycle_id']) {
                    $cycleQuery = "SELECT cycle_terms FROM bill_cycles WHERE id = :bill_cycle_id";
                    $cycleStmt = $pdo->prepare($cycleQuery);
                    $cycleStmt->execute(['bill_cycle_id' => $service['bill_cycle_id']]);
                    $cycleData = $cycleStmt->fetch(PDO::FETCH_ASSOC);
                    if ($cycleData) {
                        $bill_cycle_terms = $cycleData['cycle_terms'];
                    } else {
                    }
                }

                $tax_stmt = $pdo->prepare("SELECT igst, cgst, sgst FROM tax WHERE tax_id = ?");
                $tax_stmt->execute([$service['tax_id']]);
                $tax_data = $tax_stmt->fetch(PDO::FETCH_ASSOC);

                 $igst_percentage = $tax_data['igst'] ?? 0;
                 $cgst_percentage = $tax_data['cgst'] ?? 0;
                 $sgst_percentage = $tax_data['sgst'] ?? 0;

                 $ser_amt=$service['amount'];
                 $bo_gst_amt=($service['amount'] * $igst_percentage) / 100;
                
                $updateDetailsQuery = "UPDATE sale_order_details 
                                      SET bill_cycle_id = :bill_cycle_id,
                                          bill_cycle_terms = :bill_cycle_terms,
                                          from_date = :from_date,
                                          to_date = :to_date,
                                          duration = :duration,
                                          tax_id = :tax_id,
                                          igst = :igst,
                                          cgst = :cgst,
                                          sgst = :sgst,
                                          amount = :amount,
                                          bo_gst_amt = :bo_gst_amt,
                                          igst_amount = :igst_amount,
                                          cgst_amount = :cgst_amount,
                                          sgst_amount = :sgst_amount,
                                          bill_amount = :bill_amount,
                                          total_amount = :total_amount,
                                          is_deleted = :is_deleted,
                                          updated_at = NOW()
                                      WHERE id = :detail_id";
                
                $updateDetailsStmt = $pdo->prepare($updateDetailsQuery);
                
                $executeParams = [
                    'bill_cycle_id' => $service['bill_cycle_id'] ?? null,
                    'bill_cycle_terms' => $bill_cycle_terms,
                    'from_date' => $from_date,
                    'to_date' => $to_date,
                    'duration' => (isset($service['duration']) && $service['duration'] !== '' && $service['duration'] !== null) ? intval($service['duration']) : null, // Add duration field with proper handling
                    'tax_id' => $service['tax_id'] ?? null,
                    'igst' => $igst_percentage,
                    'cgst' => $cgst_percentage,
                    'sgst' => $sgst_percentage,
                    'amount' => $service['amount'] ?? 0,
                    'bo_gst_amt' =>$bo_gst_amt,
                    'igst_amount' => $service['igst_amount'] ?? 0,
                    'cgst_amount' => $service['cgst_amount'] ?? 0,
                    'sgst_amount' => $service['sgst_amount'] ?? 0,
                    'bill_amount' => $service['bill_amount'] ?? 0,
                    'total_amount' => $service['total_amount'] ?? 0,
                    'is_deleted' => 0,
                    'detail_id' => $service['id']
                ];
                
                // Validate parameter count
                if (count($executeParams) !== 18) {
                    throw new Exception("Parameter count mismatch for service {$service['id']}. Expected 18, got " . count($executeParams));
                }
                
                $updateDetailsStmt->execute($executeParams);
            }
            
            // Update quotation services is_moved_so to 1 for selected services
            foreach ($services as $service) {
                if (isset($service['quotation_service_id']) && !empty($service['quotation_service_id'])) {
                    $updateQuotationServiceQuery = "UPDATE quotation_services SET is_moved_so = 1 WHERE id = :quotation_service_id";
                    $updateQuotationServiceStmt = $pdo->prepare($updateQuotationServiceQuery);
                    $updateQuotationServiceStmt->execute(['quotation_service_id' => $service['quotation_service_id']]);
                }
            }
            
            $pdo->commit();
            
            echo json_encode([
                'success' => true,
                'message' => 'Sale order updated successfully',
                'data' => [
                    'sale_order_id' => $sale_order_id,
                    'overall_amt' => $overall_amt,
                    'overall_gst' => $overall_gst,
                    'overall_total_amt' => $overall_total_amt
                ]
            ]);
            
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
    }
        
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>
