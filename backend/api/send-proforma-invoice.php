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
    
    // to_emails is now optional
    
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
        
        // Get proforma invoice details
        $query = "SELECT 
                    pi.id,
                    pi.invoice_no,
                    pi.inv_date,
                    pi.inv_grand_total,
                    pi.status,
                    c.company as company_name,
                    c.first_name,
                    c.last_name,
                    cp.contact_person,
                    cp.contact_email,
                    bc.bc_name as billing_company,
                    u.username as created_by_name,
                    u.email as created_by_email
                  FROM proforma_invoices pi
                  LEFT JOIN sale_orders so ON pi.sale_order_id = so.id
                  LEFT JOIN contacts c ON so.contact_id = c.ld_id
                  LEFT JOIN contact_persons cp ON so.contact_id = cp.contact_id
                  LEFT JOIN bill_company bc ON pi.bc_id = bc.bc_id
                  LEFT JOIN users u ON pi.created_by = u.id
                  WHERE pi.id = ? AND pi.is_deleted = 0";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$input['proforma_invoice_id']]);
        $proformaInvoice = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$proformaInvoice) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Proforma invoice not found']);
            exit();
        }
        
        // Get proforma invoice details (services)
        $detailsQuery = "SELECT 
                          pid.service_name,
                          pid.description,
                          pid.quantity,
                          pid.rate,
                          pid.amount,
                          pid.igst_amount,
                          pid.cgst_amount,
                          pid.sgst_amount,
                          pid.total_amount
                        FROM proforma_invoice_details pid
                        WHERE pid.proforma_invoice_id = ? AND pid.is_deleted = 0
                        ORDER BY pid.id";
        
        $detailsStmt = $pdo->prepare($detailsQuery);
        $detailsStmt->execute([$input['proforma_invoice_id']]);
        $proformaInvoiceDetails = $detailsStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Calculate totals
        $subTotal = 0;
        $totalTax = 0;
        $grandTotal = 0;
        
        foreach ($proformaInvoiceDetails as $detail) {
            $subTotal += $detail['amount'];
            $totalTax += ($detail['igst_amount'] + $detail['cgst_amount'] + $detail['sgst_amount']);
            $grandTotal += $detail['total_amount'];
        }
        
        // Prepare data for email
        $proformaData = [
            'proforma_invoice' => $proformaInvoice,
            'proforma_invoice_details' => $proformaInvoiceDetails,
            'totals' => [
                'sub_total' => $subTotal,
                'total_tax' => $totalTax,
                'grand_total' => $grandTotal
            ]
        ];
        
        // Get contact person details
        $contactPerson = [
            'contact_person' => $proformaInvoice['contact_person'],
            'contact_email' => $proformaInvoice['contact_email']
        ];
        
        // Get company details
        $company = [
            'company_name' => $proformaInvoice['company_name'],
            'first_name' => $proformaInvoice['first_name'],
            'last_name' => $proformaInvoice['last_name']
        ];
        
        // Get billing company details
        $billingCompany = [
            'bc_name' => $proformaInvoice['billing_company']
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
            error_log("Auto-CC Error (Proforma) - Failed to fetch admin emails: " . $e->getMessage());
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
            error_log("Auto-CC Error (Proforma) - Failed to fetch logged user email: " . $e->getMessage());
        }
        
        // Parse email addresses from payload
        $toEmails = !empty($input['to_emails']) ? array_unique(array_filter(array_map('trim', explode(',', $input['to_emails'])))) : [];
        $payloadCcEmails = !empty($input['cc_emails']) ? array_unique(array_filter(array_map('trim', explode(',', $input['cc_emails'])))) : [];
        
        // Ensure all arrays are properly initialized
        $adminEmails = is_array($adminEmails) ? $adminEmails : [];
        $payloadCcEmails = is_array($payloadCcEmails) ? $payloadCcEmails : [];
        
        // Debug logging
        error_log("Auto-CC Debug (Proforma) - Admin emails: " . json_encode($adminEmails));
        error_log("Auto-CC Debug (Proforma) - Payload CC emails: " . json_encode($payloadCcEmails));
        error_log("Auto-CC Debug (Proforma) - Logged user email: " . $loggedUserEmail);
        
        // Merge admin emails, logged user email, and payload CC emails
        $ccEmails = array_merge($adminEmails, $payloadCcEmails);
        if (!empty($loggedUserEmail)) {
            $ccEmails[] = $loggedUserEmail;
        }
        
        // Remove duplicates and empty values
        $ccEmails = array_unique(array_filter($ccEmails));
        
        // Debug final result
        error_log("Auto-CC Debug (Proforma) - Final CC emails: " . json_encode($ccEmails));
        
        // Fallback: If no CC emails found, at least add admin emails
        if (empty($ccEmails)) {
            error_log("Auto-CC Warning (Proforma) - No CC emails found, adding fallback admin emails");
            $ccEmails = $adminEmails;
        }
        
        // Send email
        $emailService = new EmailService();
        $emailResult = $emailService->sendProformaInvoiceEmailWithCustomMessage(
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
                    error_log("Proforma invoice PDF file deleted successfully: " . $emailResult['pdf_path']);
                }
            } catch (Exception $e) {
                error_log("Failed to delete proforma invoice PDF file: " . $e->getMessage());
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
                'message' => 'Proforma invoice sent successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to send proforma invoice: ' . $emailResult['message']
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
