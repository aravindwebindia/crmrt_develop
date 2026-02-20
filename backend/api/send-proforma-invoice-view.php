<?php
header('Content-Type: application/json');
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/jwt.php';
require_once '../models/EmailService.php';

// Get JWT token from header
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : null;

if (!$token) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No token provided']);
    exit();
}

// Verify JWT token
$jwt = new JWT();
$decoded = $jwt->validate($token);

if (!$decoded) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid token']);
    exit();
}

$user_id = $decoded['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (empty($input['proforma_invoice_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Proforma invoice ID is required']);
        exit();
    }
    
    if (empty($input['mail_body'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Mail body is required']);
        exit();
    }
    
    $proforma_invoice_id = $input['proforma_invoice_id'];
    $send_to_customer = isset($input['send_to_customer']) ? (bool)$input['send_to_customer'] : false; // Default to false
    
    try {
        $database = new Database();
        $pdo = $database->getConnection();
        
        if (!$pdo) {
            throw new Exception('Database connection failed');
        }

        // Get proforma invoice details with all related data (copied from proforma-invoice-details.php)
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
        $stmt->execute([$input['proforma_invoice_id']]);
        $proforma_invoice = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$proforma_invoice) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Proforma invoice not found']);
            exit();
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
        $details_stmt->execute([$input['proforma_invoice_id']]);
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

        // Prepare data for email
        $proformaData = [
            'proforma_invoice' => $proforma_invoice,
            'proforma_invoice_details' => $proforma_invoice_details
        ];
        
        // Get contact person details
        $contactPerson = [
            'contact_person' => $proforma_invoice['first_name'] . ' ' . $proforma_invoice['last_name'],
            'contact_email' => $proforma_invoice['email']
        ];
        
        // Get company details
        $company = [
            'company_name' => $proforma_invoice['company_name'],
            'first_name' => $proforma_invoice['first_name'],
            'last_name' => $proforma_invoice['last_name']
        ];
        
        // Get billing company details
        $billingCompany = [
            'bc_name' => $proforma_invoice['billing_company'],
            'bc_logo' => $proforma_invoice['bc_logo'],
            'bc_seal' => $proforma_invoice['bc_seal'],
            'bc_address' => $proforma_invoice['billing_address'],
            'bc_gst' => $proforma_invoice['billing_gst'],
            'bc_bank_name' => $proforma_invoice['bc_bank_name'],
            'bc_bank_acc_no' => $proforma_invoice['bc_bank_acc_no'],
            'bc_bank_ifsc' => $proforma_invoice['bc_bank_ifsc'],
            'bc_bank_branch' => $proforma_invoice['bc_bank_branch'],
            'bc_bank_address' => $proforma_invoice['bc_bank_address']
        ];
        
        // Get logged user name
        $userQuery = "SELECT first_name, last_name, username FROM users WHERE id = ?";
        $userStmt = $pdo->prepare($userQuery);
        $userStmt->execute([$user_id]);
        $userData = $userStmt->fetch(PDO::FETCH_ASSOC);
        
        $loggedUserName = trim($userData['first_name'] . ' ' . $userData['last_name']);
        if (empty($loggedUserName)) {
            $loggedUserName = $userData['username'] ?: 'Team';
        }
        
        // Get admin users' emails for auto-CC
        $adminEmails = [];
        try {
            $adminQuery = "SELECT email FROM users WHERE role = 'admin'";
            $adminStmt = $pdo->prepare($adminQuery);
            $adminStmt->execute();
            while ($adminRow = $adminStmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($adminRow['email'])) {
                    $adminEmails[] = trim($adminRow['email']);
                }
            }
        } catch (Exception $e) {
            error_log("Auto-CC Error (Proforma View) - Failed to fetch admin emails: " . $e->getMessage());
        }
        
        // Get logged-in user's email
        $loggedUserEmail = '';
        try {
            $userEmailQuery = "SELECT email FROM users WHERE id = ?";
            $userEmailStmt = $pdo->prepare($userEmailQuery);
            $userEmailStmt->execute([$user_id]);
            $userEmailRow = $userEmailStmt->fetch(PDO::FETCH_ASSOC);
            if ($userEmailRow && !empty($userEmailRow['email'])) {
                $loggedUserEmail = trim($userEmailRow['email']);
            }
        } catch (Exception $e) {
            error_log("Auto-CC Error (Proforma View) - Failed to fetch logged user email: " . $e->getMessage());
        }
        
        // Parse email addresses from payload
        $toEmails = !empty($input['to_emails']) ? array_unique(array_filter(array_map('trim', explode(',', $input['to_emails'])))) : [];
        $payloadCcEmails = !empty($input['cc_emails']) ? array_unique(array_filter(array_map('trim', explode(',', $input['cc_emails'])))) : [];
        
        // Ensure all arrays are properly initialized
        $adminEmails = is_array($adminEmails) ? $adminEmails : [];
        $payloadCcEmails = is_array($payloadCcEmails) ? $payloadCcEmails : [];
        
        // Debug logging
        error_log("Auto-CC Debug (Proforma View) - Admin emails: " . json_encode($adminEmails));
        error_log("Auto-CC Debug (Proforma View) - Payload CC emails: " . json_encode($payloadCcEmails));
        error_log("Auto-CC Debug (Proforma View) - Logged user email: " . $loggedUserEmail);
        
        // Merge admin emails, logged user email, and payload CC emails
        $ccEmails = array_merge($adminEmails, $payloadCcEmails);
        if (!empty($loggedUserEmail)) {
            $ccEmails[] = $loggedUserEmail;
        }
        
        // Remove duplicates and empty values
        $ccEmails = array_unique(array_filter($ccEmails));
        
        // Debug final result
        error_log("Auto-CC Debug (Proforma View) - Final CC emails: " . json_encode($ccEmails));
        
        // Fallback: If no CC emails found, at least add admin emails
        if (empty($ccEmails)) {
            error_log("Auto-CC Warning (Proforma View) - No CC emails found, adding fallback admin emails");
            $ccEmails = $adminEmails;
        }
        
        // Send email using the new detailed proforma invoice email function
        $emailService = new EmailService();
        $emailResult = $emailService->sendProformaInvoiceViewEmailWithCustomMessage(
            $proformaData,
            $contactPerson,
            $company,
            $billingCompany,
            $input['mail_body'],
            $loggedUserName,
            $toEmails,
            $ccEmails,
            $send_to_customer
        );
        
        
        // Delete PDF file after email sending (both success and failure)
        if (isset($emailResult['pdf_path']) && !empty($emailResult['pdf_path'])) {
            try {
                if (file_exists($emailResult['pdf_path'])) {
                    unlink($emailResult['pdf_path']);
                    error_log("Proforma invoice view PDF file deleted successfully: " . $emailResult['pdf_path']);
                }
            } catch (Exception $e) {
                error_log("Failed to delete proforma invoice view PDF file: " . $e->getMessage());
            }
        }
        
        if ($emailResult['success']) {
            // Update mail_status to 1 (sent) in proforma_invoices table only if send_to_customer is true
            if ($send_to_customer) {
                try {
                    $updateSql = "UPDATE proforma_invoices SET mail_status = 1 WHERE id = ?";
                    $updateStmt = $pdo->prepare($updateSql);
                    $updateStmt->execute([$proforma_invoice_id]);
                } catch (Exception $e) {
                    error_log("Failed to update mail_status: " . $e->getMessage());
                }
            }
            
            echo json_encode([
                'success' => true,
                'message' => 'Proforma invoice view sent successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => $emailResult['message']
            ]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error: ' . $e->getMessage()
        ]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>
