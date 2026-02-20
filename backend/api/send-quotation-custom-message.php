<?php
// Example API endpoint for sending quotation with custom message
// This would be called from your frontend form

require_once __DIR__ . '/../config/common.php';
require_once __DIR__ . '/../models/EmailService.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    $requiredFields = ['quotation_id', 'contact_person_id', 'company_id', 'bill_company_id', 'custom_message', 'logged_user_name'];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }
    
    // Extract data
    $quotationId = $input['quotation_id'];
    $contactPersonId = $input['contact_person_id'];
    $companyId = $input['company_id'];
    $billCompanyId = $input['bill_company_id'];
    $customMessage = $input['custom_message'];
    $loggedUserName = $input['logged_user_name'];
    
    // Additional recipients (optional)
    $toEmails = isset($input['to_emails']) ? $input['to_emails'] : [];
    $ccEmails = isset($input['cc_emails']) ? $input['cc_emails'] : [];
    
    // Here you would fetch the actual data from your database
    // For example:
    // $quotation = getQuotationById($quotationId);
    // $contactPerson = getContactPersonById($contactPersonId);
    // $company = getCompanyById($companyId);
    // $billCompany = getBillCompanyById($billCompanyId);
    
    // For demo purposes, using sample data
    $quotation = [
        'quotation_no' => 'QT-2025-010',
        'contract_name' => 'Web Development Services',
        'contract_from_date' => '2024-01-01',
        'contract_to_date' => '2024-12-31',
        'grand_total' => 50000,
        'services' => [
            [
                'service_name' => 'Website Development',
                'description' => 'Custom website development',
                'quantity' => 1,
                'rate' => 30000,
                'amount' => 30000,
                'hsn_sac' => '998314',
                'igst' => 18,
                'cgst' => 9,
                'sgst' => 9,
                'igst_amount' => 5400,
                'cgst_amount' => 2700,
                'sgst_amount' => 2700
            ]
        ]
    ];
    
    $contactPerson = [
        'contact_person' => 'John Doe',
        'contact_email' => 'john@example.com'
    ];
    
    $company = [
        'company_name' => 'ABC Company Ltd',
        'company_address' => '123 Business Street, City',
        'state' => 'Maharashtra',
        'country' => 'India'
    ];
    
    $billCompany = [
        'bc_name' => 'WebIndia Solutions',
        'bc_address' => '456 Tech Park, Mumbai',
        'bc_gst' => '27ABCDE1234F1Z5',
        'bc_logo' => 'uploads/default/webindia.png',
        'bc_seal' => 'uploads/default/wi-seal-sign.jpg',
        'bc_bank_name' => 'State Bank of India',
        'bc_bank_acc_no' => '1234567890',
        'bc_bank_ifsc' => 'SBIN0001234',
        'bc_bank_branch' => 'Mumbai Main Branch',
        'bc_bank_address' => 'Mumbai, Maharashtra'
    ];
    
    // Send email with custom message
    $emailService = new EmailService();
    $result = $emailService->sendQuotationEmailWithCustomMessage(
        $quotation,
        $contactPerson,
        $company,
        $billCompany,
        $customMessage,
        $loggedUserName,
        $toEmails,
        $ccEmails
    );
    
    echo json_encode($result);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
