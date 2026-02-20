<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/email.php';
require_once __DIR__ . '/../models/EmailService.php';

try {
    error_log("PDF Generation Started - Proforma Invoice ID: " . (isset($_GET['id']) ? $_GET['id'] : 'none'));
    
    $jwt = new JWT();
    $database = new Database();
    $pdo = $database->getConnection();

    if (!$pdo) {
        error_log("Database connection failed");
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

    $user_id = $decoded['user_id'];

    // Get proforma invoice ID from query parameter
    $proforma_invoice_id = isset($_GET['id']) ? intval($_GET['id']) : 0;

    if (!$proforma_invoice_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Proforma invoice ID is required']);
        exit;
    }

    // Get proforma invoice details (same query as proforma-invoice-details.php)
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
                      ORDER BY pid.id ASC";
    
    $details_stmt = $pdo->prepare($details_query);
    $details_stmt->execute([$proforma_invoice_id]);
    $details = $details_stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get billing company logo and seal
    $logoPath = '../uploads/' . str_replace('uploads/', '', $proforma_invoice['bc_logo']);
    $sealPath = '../uploads/' . str_replace('uploads/', '', $proforma_invoice['bc_seal']);

    $proformaInvoice = $proforma_invoice;
    $proformaInvoiceDetails = $details;

    // Convert logo to base64 for PDF
    $logoBase64 = '';
    if (file_exists($logoPath)) {
        $logoData = file_get_contents($logoPath);
        $logoBase64 = 'data:image/' . pathinfo($logoPath, PATHINFO_EXTENSION) . ';base64,' . base64_encode($logoData);
    }

    $sealBase64 = '';
    if (file_exists($sealPath)) {
        $sealData = file_get_contents($sealPath);
        $sealBase64 = 'data:image/' . pathinfo($sealPath, PATHINFO_EXTENSION) . ';base64,' . base64_encode($sealData);
    }

    // Prepare data for PDF generation
    $proformaData = [
        'proforma_invoice' => $proformaInvoice,
        'proforma_invoice_details' => $proformaInvoiceDetails
    ];

    // Generate HTML for PDF using the email template
    error_log("Generating HTML template...");
    $html = EmailConfig::getProformaInvoiceViewEmailTemplateWithBillCompany($proformaData, null, null, $proformaInvoice);
    error_log("HTML generated, length: " . strlen($html));

    // Generate PDF using dompdf directly
    error_log("Checking dompdf availability...");
    if (!class_exists('Dompdf\Dompdf')) {
        error_log("Dompdf library not available");
        throw new Exception('Dompdf library not available');
    }
    
    error_log("Creating dompdf instance...");

    $dompdf = new \Dompdf\Dompdf();
    $dompdf->loadHtml($html);
    $dompdf->setPaper('A4', 'portrait');
    
    // Enable remote file access for local images
    $dompdf->getOptions()->setIsRemoteEnabled(true);
    $dompdf->getOptions()->setIsHtml5ParserEnabled(true);
    
    // Set default font for better Unicode support
    $dompdf->getOptions()->setDefaultFont('DejaVu Sans');
    
    error_log("Rendering PDF...");
    $dompdf->render();
    error_log("PDF rendered successfully");

    // Output PDF directly
    error_log("Streaming PDF to browser...");
    $dompdf->stream($proformaInvoice['invoice_no'] . '.pdf', ['Attachment' => true]);
    exit;

} catch (Exception $e) {
    error_log("PDF Generation Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to generate PDF: ' . $e->getMessage()]);
}
?>

