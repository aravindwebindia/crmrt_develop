<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/Quotation.php';
require_once __DIR__ . '/../models/QuotationService.php';
require_once __DIR__ . '/../models/EmailService.php';

// Initialize JWT
$jwt = new JWT();

// Get token from Authorization header
$auth_header = '';

// Use getallheaders() as the primary method since we know it works
if (function_exists('getallheaders')) {
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $auth_header = $headers['Authorization'];
    } elseif (isset($headers['authorization'])) {
        $auth_header = $headers['authorization'];
    }
}

// Fallback methods
if (!$auth_header) {
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['Authorization'])) {
        $auth_header = $_SERVER['Authorization'];
    }
}

if (!$auth_header || !preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authorization token required']);
    exit;
}

$token = $matches[1];

try {
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
        $quotation_id = $input['quotation_id'] ?? null;
        
        if (!$quotation_id) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Quotation ID is required.'
            ]);
            exit;
        }
        
        // Get custom message (mandatory)
        $customMessage = $input['mail_body'] ?? $input['custom_message'] ?? '';
        
        // Clean and validate mandatory custom message
        $customMessage = trim($customMessage);
        
        // Validate mandatory custom message (check if empty after trimming)
        if (empty($customMessage)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Mail body message is required.'
            ]);
            exit;
        }
        
        // Get additional recipients (optional)
        $toEmails = isset($input['to_emails']) ? array_unique(array_filter(explode(',', $input['to_emails']))) : [];
        $payloadCcEmails = isset($input['cc_emails']) ? array_unique(array_filter(explode(',', $input['cc_emails']))) : [];
        $sendToCustomer = isset($input['send_to_customer']) ? (bool)$input['send_to_customer'] : false;

        $quotation = new Quotation();
        $quotationService = new QuotationService();
        $emailService = new EmailService();
        
        // Get database connection
        $database = new Database();
        $db = $database->getConnection();
        
        // Get admin users' emails for auto-CC
        $adminEmails = [];
        try {
            $adminQuery = "SELECT email FROM users WHERE role = 'admin'";
            $adminStmt = $db->prepare($adminQuery);
            $adminStmt->execute();
            while ($adminRow = $adminStmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($adminRow['email'])) {
                    $adminEmails[] = trim($adminRow['email']);
                }
            }
        } catch (Exception $e) {
            error_log("Auto-CC Error - Failed to fetch admin emails: " . $e->getMessage());
        }
        
        // Get logged-in user's email
        $loggedUserEmail = '';
        try {
            $userQuery = "SELECT email FROM users WHERE id = ?";
            $userStmt = $db->prepare($userQuery);
            $userStmt->execute([$user_id]);
            $userRow = $userStmt->fetch(PDO::FETCH_ASSOC);
            if ($userRow && !empty($userRow['email'])) {
                $loggedUserEmail = trim($userRow['email']);
            }
        } catch (Exception $e) {
            error_log("Auto-CC Error - Failed to fetch logged user email: " . $e->getMessage());
        }
        
        // Ensure all arrays are properly initialized
        $adminEmails = is_array($adminEmails) ? $adminEmails : [];
        $payloadCcEmails = is_array($payloadCcEmails) ? $payloadCcEmails : [];
        
        // Debug logging
        error_log("Auto-CC Debug - Admin emails: " . json_encode($adminEmails));
        error_log("Auto-CC Debug - Payload CC emails: " . json_encode($payloadCcEmails));
        error_log("Auto-CC Debug - Logged user email: " . $loggedUserEmail);
        
        // Merge admin emails, logged user email, and payload CC emails
        $ccEmails = array_merge($adminEmails, $payloadCcEmails);
        if (!empty($loggedUserEmail)) {
            $ccEmails[] = $loggedUserEmail;
        }
        
        // Remove duplicates and empty values
        $ccEmails = array_unique(array_filter($ccEmails));
        
        // Debug final result
        error_log("Auto-CC Debug - Final CC emails: " . json_encode($ccEmails));
        
        // Fallback: If no CC emails found, at least add admin emails
        if (empty($ccEmails)) {
            error_log("Auto-CC Warning - No CC emails found, adding fallback admin emails");
            $ccEmails = $adminEmails;
        }
        
        // Get logged user name from JWT token
        $loggedUserName = 'Team'; // Default fallback
        try {
            $userStmt = $db->prepare("SELECT first_name, last_name, username FROM users WHERE id = ?");
            $userStmt->execute([$user_id]);
            $userData = $userStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($userData) {
                $firstName = trim($userData['first_name'] ?? '');
                $lastName = trim($userData['last_name'] ?? '');
                $username = trim($userData['username'] ?? '');
                
                // Try first_name + last_name first
                $fullName = trim($firstName . ' ' . $lastName);
                
                if (!empty($fullName)) {
                    $loggedUserName = $fullName;
                } elseif (!empty($username)) {
                    // Fallback to username if full name is empty
                    $loggedUserName = $username;
                } else {
                    // Final fallback
                    $loggedUserName = 'Team';
                }
            }
        } catch (Exception $e) {
            // Keep default 'Team' if user lookup fails
            error_log('User lookup error: ' . $e->getMessage());
        }
        
        // Get quotation details
        $quotationData = $quotation->getById($quotation_id);
        if (!$quotationData) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Quotation not found.'
            ]);
            exit;
        }

        // Get billing company details if provided
        $billCompany = null;
        if (isset($input['bill_company_id']) && $input['bill_company_id']) {
            $billCompanyStmt = $db->prepare("SELECT * FROM bill_company WHERE bc_id = ? AND status = 'active' AND is_deleted = FALSE");
            $billCompanyStmt->execute([$input['bill_company_id']]);
            $billCompany = $billCompanyStmt->fetch(PDO::FETCH_ASSOC);
        }

        // Get contact person details
        $contactPerson = [
            'contact_person' => $quotationData['contact_person'],
            'contact_email' => $quotationData['contact_email']
        ];

        // Get company details (to company)
        $company = [
            'company_name' => $quotationData['company_name'],
            'company_address' => $quotationData['contact_address'] ?? '',
            'state' => $quotationData['state'] ?? '',
            'country' => $quotationData['country'] ?? ''
        ];

        // Get quotation services
        $services = $quotationService->getByQuotationId($quotation_id);
        $quotationData['services'] = $services;

        // Create billing company quotation details if billing company is provided
        if (isset($input['bill_company_id']) && !empty($input['bill_company_id'])) {
            try {
                $bill_company_id = (int)$input['bill_company_id'];
                
                // Check if combination already exists
                $existingCheck = $db->prepare("SELECT id FROM billing_com_quot_details WHERE quotation_id = ? AND bill_company_id = ?");
                $existingCheck->execute([$quotation_id, $bill_company_id]);
                
                if (!$existingCheck->fetch()) {
                    // Insert new billing company quotation details
                    $billingDetailsSql = "INSERT INTO billing_com_quot_details (quotation_id, bill_company_id, created_by) VALUES (?, ?, ?)";
                    $billingDetailsStmt = $db->prepare($billingDetailsSql);
                    $result = $billingDetailsStmt->execute([$quotation_id, $bill_company_id, $user_id]);
                    
                }
            } catch (Exception $e) {
                // Continue with email sending even if billing details creation fails
            }
        }

        // Send email with custom message format (mandatory)
        $emailResult = $emailService->sendQuotationEmailWithCustomMessage(
            $quotationData, 
            $contactPerson, 
            $company, 
            $billCompany,
            $customMessage,
            $loggedUserName ?: 'Team', // Default to 'Team' if not provided
            $toEmails,
            $ccEmails,
            $sendToCustomer
        );

        
        
        if ($emailResult['success']) {
            // Only move the quotation into the client-send status workflow when
            // "Send to Client" was selected. A manual To/CC-only send must leave
            // the quotation status untouched (e.g. remains Draft).
            $updateResult = $sendToCustomer ? $quotation->updateStatus($quotation_id, 'sent') : true;

            // Delete PDF file after successful email send
            if (isset($emailResult['pdf_path']) && !empty($emailResult['pdf_path'])) {
                try {
                    if (file_exists($emailResult['pdf_path'])) {
                        unlink($emailResult['pdf_path']);
                        error_log("PDF file deleted successfully: " . $emailResult['pdf_path']);
                    }
                } catch (Exception $e) {
                    error_log("Failed to delete PDF file: " . $e->getMessage());
                }
            }

            if ($updateResult) {
                echo json_encode([
                    'success' => true,
                    'message' => $emailResult['message']
                ]);
            } else {
                echo json_encode([
                    'success' => true,
                    'message' => $emailResult['message'] . ' (Note: Email sent but status update failed)'
                ]);
            }
        } else {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => $emailResult['message']
            ]);
        }
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error'
    ]);
}
?>
