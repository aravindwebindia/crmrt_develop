<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/email.php';
require_once __DIR__ . '/../models/EmailService.php';
require_once __DIR__ . '/../models/Quotation.php';
require_once __DIR__ . '/../models/QuotationService.php';

try {
    $jwt = new JWT();
    $database = new Database();
    $pdo = $database->getConnection();

    if (!$pdo) {
        throw new Exception('Database connection failed');
    }

    // Get JWT token from header
    $auth_header = '';
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

    if (empty($auth_header)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Access token required']);
        exit;
    }

    // Extract token
    if (preg_match('/Bearer\s(\S+)/i', $auth_header, $matches)) {
        $token = $matches[1];
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid token format']);
        exit;
    }

    // Verify token
    $decoded = $jwt->decode($token);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }

    // Get quotation ID from query parameter
    $quotation_id = isset($_GET['id']) ? intval($_GET['id']) : 0;

    if (!$quotation_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Quotation ID is required']);
        exit;
    }

    // Get billing company ID from query parameter (optional, defaults to first active billing company)
    $bill_company_id = isset($_GET['bill_company_id']) ? intval($_GET['bill_company_id']) : 0;

    // Get quotation details
    $quotationModel = new Quotation($pdo);
    $quotation = $quotationModel->getById($quotation_id);

    if (!$quotation) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Quotation not found']);
        exit;
    }

    // Get quotation services
    $quotationServiceModel = new QuotationService();
    $services = $quotationServiceModel->getAllByQuotationId($quotation_id);
    $quotation['services'] = $services;

    // Get contact person
    $contactPersonStmt = $pdo->prepare("SELECT cp.* FROM contact_persons cp WHERE cp.cp_id = ?");
    $contactPersonStmt->execute([$quotation['cp_id']]);
    $contactPerson = $contactPersonStmt->fetch(PDO::FETCH_ASSOC);

    if (!$contactPerson) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Contact person not found']);
        exit;
    }

    // Get company details
    $companyStmt = $pdo->prepare("SELECT c.* FROM contacts c WHERE c.ld_id = ?");
    $companyStmt->execute([$contactPerson['contact_id']]);
    $company = $companyStmt->fetch(PDO::FETCH_ASSOC);

    if (!$company) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Company not found']);
        exit;
    }

    // Get billing company
    if ($bill_company_id) {
        $billCompanyStmt = $pdo->prepare("SELECT * FROM bill_company WHERE bc_id = ? AND status = 'active' AND is_deleted = FALSE");
        $billCompanyStmt->execute([$bill_company_id]);
        $billCompany = $billCompanyStmt->fetch(PDO::FETCH_ASSOC);
    } else {
        // Get first active billing company
        $billCompanyStmt = $pdo->prepare("SELECT * FROM bill_company WHERE status = 'active' AND is_deleted = FALSE ORDER BY bc_name ASC LIMIT 1");
        $billCompanyStmt->execute();
        $billCompany = $billCompanyStmt->fetch(PDO::FETCH_ASSOC);
    }

    if (!$billCompany) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Billing company not found']);
        exit;
    }

    // Prepare contact person data
    $contactPersonData = [
        'contact_person' => $contactPerson['contact_person'],
        'contact_email' => $contactPerson['contact_email'] ?? ''
    ];

    // Prepare company data
    $companyData = [
        'company_name' => $company['company'],
        'company_address' => $quotation['contact_address'] ?? $company['c_address'] ?? '',
        'state' => $quotation['state'] ?? '',
        'country' => $quotation['country'] ?? ''
    ];

    // Mark quotation for PDF generation
    $quotation['_for_pdf'] = true;

    // Generate HTML for PDF using the email template
    $html = EmailConfig::getQuotationEmailTemplateWithBillCompany($quotation, $contactPersonData, $companyData, $billCompany);

    // Generate PDF using dompdf
    if (!class_exists('Dompdf\Dompdf')) {
        throw new Exception('Dompdf library not available');
    }

    $dompdf = new \Dompdf\Dompdf();
    $dompdf->loadHtml($html);
    $dompdf->setPaper('A4', 'portrait');
    
    // Enable remote file access for local images
    $dompdf->getOptions()->setIsRemoteEnabled(true);
    $dompdf->getOptions()->setIsHtml5ParserEnabled(true);
    
    // Set default font for better Unicode support
    $dompdf->getOptions()->setDefaultFont('DejaVu Sans');
    
    $dompdf->render();

    // Output PDF directly with proper filename format
    $filename = 'Quotation_' . $quotation['quotation_no'] . '.pdf';
    $dompdf->stream($filename, ['Attachment' => true]);
    exit;

} catch (Exception $e) {
    error_log("Quotation PDF Generation Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to generate PDF: ' . $e->getMessage()]);
}
?>

