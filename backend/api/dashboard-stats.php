<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../config/database.php';

try {
    $jwt = new JWT();
    $database = new Database();
    $pdo = $database->getConnection();

    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }

    // Get token
    $auth_header = '';
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) $auth_header = $headers['Authorization'];
        elseif (isset($headers['authorization'])) $auth_header = $headers['authorization'];
    }
    if (empty($auth_header) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (empty($auth_header) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (empty($auth_header) && isset($_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (empty($auth_header) && isset($_SERVER['Authorization'])) {
        $auth_header = $_SERVER['Authorization'];
    }
    $token = null;
    if (preg_match('/Bearer\s(\S+)/i', $auth_header, $m)) {
        $token = $m[1];
    }
    // Fallbacks for local testing: query param or cookie
    if (!$token && isset($_GET['token']) && $_GET['token']) {
        $token = $_GET['token'];
    }
    if (!$token && isset($_COOKIE['token']) && $_COOKIE['token']) {
        $token = $_COOKIE['token'];
    }
    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Access token required']);
        exit;
    }

    $decoded = $jwt->validate($token);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }


    $role = is_array($decoded) ? ($decoded['role'] ?? '') : ($decoded->role ?? '');

    // Debug switch
    $debug = isset($_GET['debug']) && ($_GET['debug'] === '1' || strtolower($_GET['debug']) === 'true');

    // Helpers
    $errors = [];
    $stats = [];
    $safeScalar = function($pdo, $sql, $label) use (&$errors, $debug) {
        try {
            $stmt = $pdo->query($sql);
            return $stmt ? $stmt->fetchColumn() : 0;
        } catch (Throwable $e) {
            if ($debug) {
                $errors[] = $label . ': ' . $e->getMessage();
            } else {
                error_log('dashboard-stats error in ' . $label . ': ' . $e->getMessage());
            }
            return 0;
        }
    };

    // Users count - show only for admin
    if ($role == 'admin') {
        $stats['users_count'] = (int)($safeScalar($pdo, "SELECT COUNT(*) FROM users", 'users_count') ?: 0);
    }

    // Services count
    $stats['services_count'] = (int)($safeScalar($pdo, "SELECT COUNT(*) FROM services WHERE COALESCE(is_deleted, 0) = 0", 'services_count') ?: 0);

    // Quotations count (exclude deleted and edited)
    $stats['quotations_count'] = (int)($safeScalar($pdo, "SELECT COUNT(*) FROM quotations WHERE COALESCE(is_deleted, 0) = 0 AND status <> 'edited'", 'quotations_count') ?: 0);

    // Sale orders count
    $stats['sale_orders_count'] = (int)($safeScalar($pdo, "SELECT COUNT(*) FROM sale_orders WHERE COALESCE(is_deleted, 0) = 0", 'sale_orders_count') ?: 0);

    // Proforma invoices count
    $stats['proforma_invoices_count'] = (int)($safeScalar($pdo, "SELECT COUNT(*) FROM proforma_invoices WHERE COALESCE(is_deleted, 0) = 0", 'proforma_invoices_count') ?: 0);

    // Amounts from proforma invoice details
    // Total amount
    $stats['proforma_total_amount'] = (float)($safeScalar($pdo, "SELECT COALESCE(SUM(pid.inv_total_amount),0)
                         FROM proforma_invoice_details pid
                         LEFT JOIN proforma_invoices pi ON pi.id = pid.p_inv_id
                         WHERE COALESCE(pi.is_deleted, 0) = 0", 'proforma_total_amount') ?: 0);

    // Invoiced amount (tax_invoice_no present)
    $stats['proforma_invoiced_amount'] = (float)($safeScalar($pdo, "SELECT COALESCE(SUM(pid.inv_total_amount),0)
                         FROM proforma_invoice_details pid
                         LEFT JOIN proforma_invoices pi ON pi.id = pid.p_inv_id
                         WHERE COALESCE(pi.is_deleted, 0) = 0 AND pi.tax_invoice_no IS NOT NULL AND pi.tax_invoice_no <> ''", 'proforma_invoiced_amount') ?: 0);

    // Outstanding amount (no tax invoice no)
    $stats['proforma_outstanding_amount'] = (float)($safeScalar($pdo, "SELECT COALESCE(SUM(pid.inv_total_amount),0)
                         FROM proforma_invoice_details pid
                         LEFT JOIN proforma_invoices pi ON pi.id = pid.p_inv_id
                         WHERE COALESCE(pi.is_deleted, 0) = 0 AND (pi.tax_invoice_no IS NULL OR pi.tax_invoice_no = '')", 'proforma_outstanding_amount') ?: 0);

    $response = ['success' => true, 'data' => $stats];
    if ($debug && !empty($errors)) {
        $response['debug'] = ['errors' => $errors];
    }
    echo json_encode($response);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>


