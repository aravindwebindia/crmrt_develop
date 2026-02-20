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

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $proforma_invoice_detail_id = $_GET['detail_id'] ?? null;

        if (!$proforma_invoice_detail_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Detail ID is required']);
            exit;
        }

        // Get the original detail to find the sale_order_detail_id
        $originalQuery = "SELECT 
                            pid.sale_order_detail_id,
                            pid.bill_cycle_id,
                            pid.bill_followup,
                            bc.cycle_name,
                            bc.cycle_terms,
                            pi.invoice_no
                         FROM proforma_invoice_details pid
                         LEFT JOIN bill_cycles bc ON pid.bill_cycle_id = bc.id
                         LEFT JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
                         WHERE pid.id = ?";
        
        $originalStmt = $pdo->prepare($originalQuery);
        $originalStmt->execute([$proforma_invoice_detail_id]);
        $originalDetail = $originalStmt->fetch(PDO::FETCH_ASSOC);

        if (!$originalDetail) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Detail not found']);
            exit;
        }

        // Count all recurring invoices for this service (same sale_order_detail_id)
        $countQuery = "SELECT 
                        COUNT(*) as total_followups,
                        MAX(pid.bill_followup) as max_followup_number,
                        GROUP_CONCAT(pi.invoice_no ORDER BY pi.inv_date) as invoice_numbers,
                        GROUP_CONCAT(pid.bill_followup ORDER BY pi.inv_date) as followup_numbers,
                        GROUP_CONCAT(pid.bill_to_date ORDER BY pi.inv_date) as due_dates
                       FROM proforma_invoice_details pid
                       LEFT JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
                       WHERE pid.sale_order_detail_id = ?";
        
        $countStmt = $pdo->prepare($countQuery);
        $countStmt->execute([$originalDetail['sale_order_detail_id']]);
        $followupData = $countStmt->fetch(PDO::FETCH_ASSOC);

        // Get all followup details
        $detailsQuery = "SELECT 
                           pi.invoice_no,
                           pi.inv_date,
                           pid.bill_followup,
                           pid.bill_from_date,
                           pid.bill_to_date,
                           pid.inv_bill_amount,
                           pid.inv_total_amount,
                           pid.status,
                           bc.cycle_name
                         FROM proforma_invoice_details pid
                         LEFT JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
                         LEFT JOIN bill_cycles bc ON pid.bill_cycle_id = bc.id
                         WHERE pid.sale_order_detail_id = ?
                         ORDER BY pi.inv_date ASC";
        
        $detailsStmt = $pdo->prepare($detailsQuery);
        $detailsStmt->execute([$originalDetail['sale_order_detail_id']]);
        $allFollowups = $detailsStmt->fetchAll(PDO::FETCH_ASSOC);

        $totalFollowups = (int)$followupData['total_followups'];
        $cycleTerms = (int)$originalDetail['cycle_terms'];
        $isComplete = $totalFollowups >= $cycleTerms;
        $remainingFollowups = max(0, $cycleTerms - $totalFollowups);
        
        // Check if any followup is marked as completed
        $hasCompletedFollowup = false;
        foreach ($allFollowups as $followup) {
            if ($followup['status'] === 'completed') {
                $hasCompletedFollowup = true;
                break;
            }
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'service_info' => [
                    'cycle_name' => $originalDetail['cycle_name'],
                    'cycle_terms' => $cycleTerms,
                    'current_followup' => (int)$originalDetail['bill_followup']
                ],
                'followup_summary' => [
                    'total_followups' => $totalFollowups,
                    'max_followup_number' => (int)$followupData['max_followup_number'],
                    'is_complete' => $isComplete,
                    'has_completed_followup' => $hasCompletedFollowup,
                    'remaining_followups' => $remainingFollowups,
                    'completion_percentage' => round(($totalFollowups / $cycleTerms) * 100, 2)
                ],
                'all_followups' => $allFollowups,
                'invoice_numbers' => explode(',', $followupData['invoice_numbers']),
                'followup_numbers' => array_map('intval', explode(',', $followupData['followup_numbers'])),
                'due_dates' => explode(',', $followupData['due_dates'])
            ]
        ]);

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}
?>
