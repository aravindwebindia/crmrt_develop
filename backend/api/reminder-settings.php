<?php
header("Content-Type: application/json; charset=UTF-8");
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/jwt.php';

$database = new Database();
$pdo = $database->getConnection();
$jwt = new JWT();

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
    echo json_encode(['success' => false, 'message' => 'Access denied. No token provided.']);
    exit();
}

$decoded = $jwt->validate($token);
if (!$decoded) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid or expired token.']);
    exit();
}

if (($decoded['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Only admins can view or change reminder settings.']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT id, days_before_due, admin_emails, is_active, updated_at FROM recurring_invoice_reminder_settings WHERE id = 1");
        $stmt->execute();
        $settings = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$settings) {
            // Self-heal: the singleton row should always exist after the migration, but recreate it if missing.
            $pdo->prepare("INSERT INTO recurring_invoice_reminder_settings (id, days_before_due, admin_emails, is_active) VALUES (1, 10, '', 1)")->execute();
            $settings = [
                'id' => 1,
                'days_before_due' => 10,
                'admin_emails' => '',
                'is_active' => 1,
                'updated_at' => null
            ];
        }

        echo json_encode(['success' => true, 'data' => $settings]);

    } elseif ($method === 'PUT' || $method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $daysBeforeDue = isset($input['days_before_due']) ? intval($input['days_before_due']) : null;
        if ($daysBeforeDue === null || $daysBeforeDue < 0 || $daysBeforeDue > 365) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'days_before_due must be a number between 0 and 365']);
            exit;
        }

        $adminEmailsRaw = isset($input['admin_emails']) ? $input['admin_emails'] : '';
        $emailList = array_values(array_filter(array_map('trim', explode(',', $adminEmailsRaw))));
        foreach ($emailList as $email) {
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => "Invalid email address: $email"]);
                exit;
            }
        }
        $adminEmails = implode(', ', $emailList);

        $isActive = isset($input['is_active']) ? (intval($input['is_active']) ? 1 : 0) : 1;

        $stmt = $pdo->prepare("UPDATE recurring_invoice_reminder_settings
                                SET days_before_due = ?, admin_emails = ?, is_active = ?, updated_by = ?
                                WHERE id = 1");
        $stmt->execute([$daysBeforeDue, $adminEmails, $isActive, $decoded['user_id']]);

        echo json_encode(['success' => true, 'message' => 'Reminder settings updated successfully']);

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
