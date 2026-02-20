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
        $proforma_invoice_id = $_GET['id'] ?? null;

        if (!$proforma_invoice_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Proforma invoice ID is required']);
            exit;
        }

        // Get proforma invoice details with all related data
        $query = "SELECT 
                    pi.*,
                    so.saleorder_no,
                    so.date as so_date,
                    c.company as company_name,
                    c.c_address as company_address,
                    c.city as company_city,
                    c.state as company_state,
                    c.zip as company_pincode,
                    c.company_gst,
                    c.first_name,
                    c.last_name,
                    c.email,
                    c.mobile,
                    bc.bc_name as billing_company,
                    bc.bc_address as billing_address,
                    bc.bc_gst as billing_gst,
                    bc.bc_logo,
                    bc.bc_seal,
                    bc.bc_bank_name,                    
                    bc.bc_bank_acc_no,
                    bc.bc_bank_ifsc,
                    bc.bc_bank_branch,
                    bc.bc_bank_address,
                    s.name as place_of_supply
                  FROM proforma_invoices pi
                  LEFT JOIN sale_orders so ON pi.sale_order_id = so.id
                  LEFT JOIN quotations qu ON so.quotation_id = qu.id
                  LEFT JOIN contacts c ON so.contact_id = c.ld_id
                  LEFT JOIN bill_company bc ON pi.bc_id = bc.bc_id
                  LEFT JOIN tbl_states s ON qu.state_id = s.id
                  WHERE pi.id = ?";

        $stmt = $pdo->prepare($query);
        $stmt->execute([$proforma_invoice_id]);
        $proforma_invoice = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$proforma_invoice) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Proforma invoice not found']);
            exit;
        }

        // Get proforma invoice details (items)
        $details_query = "SELECT 
                            pid.*,
                            s.service_name,
                            s.hsn_sac,
                            t.igst,
                            t.cgst,
                            t.sgst,
                            bc.cycle_name,
                            bc.cycle_terms,
                            pid.bill_followup,
                            pid.status,
                            quotation_services.description as quotation_service_description,
                            sale_order_details.duration
                          FROM proforma_invoice_details pid
                          JOIN sale_order_details ON sale_order_details.id=pid.sale_order_detail_id
						  JOIN quotation_services ON quotation_services.id=sale_order_details.quotation_service_id
                          LEFT JOIN services s ON pid.service_id = s.id
                          LEFT JOIN tax t ON pid.tax_id = t.tax_id
                          LEFT JOIN bill_cycles bc ON pid.bill_cycle_id = bc.id
                          WHERE pid.p_inv_id = ?
                          ORDER BY pid.id";

        $details_stmt = $pdo->prepare($details_query);
        $details_stmt->execute([$proforma_invoice_id]);
        $proforma_invoice_details = $details_stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get backend URL from config
        require_once '../config/common.php';
        $backendUrl = CommonConfig::getBackendUrl();
        
        // Convert relative image paths to full URLs
        if (!empty($proforma_invoice['bc_logo'])) {
            $proforma_invoice['bc_logo'] = $backendUrl . '/' . $proforma_invoice['bc_logo'];
        }
        if (!empty($proforma_invoice['bc_seal'])) {
            $proforma_invoice['bc_seal'] = $backendUrl . '/' . $proforma_invoice['bc_seal'];
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'proforma_invoice' => $proforma_invoice,
                'proforma_invoice_details' => $proforma_invoice_details
            ]
        ]);

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>
