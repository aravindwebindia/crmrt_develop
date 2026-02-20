<?php
header('Content-Type: application/json');
require_once '../config/cors.php';
require_once '../jwt/JWT.php';
require_once '../config/database.php';

try {
    $jwt = new JWT();
    $database = new Database();
    $pdo = $database->getConnection();

    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }

    // Get authorization header
    $auth_header = null;
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    if (empty($auth_header)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Access token required']);
        exit;
    }

    // Extract token
    if (preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
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

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $sale_order_id = $input['sale_order_id'] ?? null;

        if (!$sale_order_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Sale order ID is required']);
            exit;
        }

        // Start transaction
        $pdo->beginTransaction();

        try {
            // Get sale order data
            $sale_order_query = "SELECT id, bc_id, sub_total, grand_total, is_invoiced 
                                FROM sale_orders 
                                WHERE id = ? AND is_invoiced = 1";
            $sale_order_stmt = $pdo->prepare($sale_order_query);
            $sale_order_stmt->execute([$sale_order_id]);
            $sale_order = $sale_order_stmt->fetch(PDO::FETCH_ASSOC);

            if (!$sale_order) {
                throw new Exception('Sale order not found or not ready for invoicing');
            }

            // Generate proforma invoice number
            $invoice_no_query = "SELECT COUNT(*) as count FROM proforma_invoices WHERE YEAR(inv_date) = YEAR(NOW())";
            $invoice_no_stmt = $pdo->prepare($invoice_no_query);
            $invoice_no_stmt->execute();
            $count = $invoice_no_stmt->fetch(PDO::FETCH_ASSOC)['count'];
            $invoice_no = 'PI-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);

            // Insert into proforma_invoices table
            $proforma_invoice_query = "INSERT INTO proforma_invoices 
                                     (sale_order_id, bc_id, inv_sub_total, inv_grand_total, invoice_no, inv_date, created_by, created_at) 
                                     VALUES (?, ?, ?, ?, ?, NOW(), ?, NOW())";
            
            $proforma_invoice_stmt = $pdo->prepare($proforma_invoice_query);
            $proforma_invoice_stmt->execute([
                $sale_order['id'],
                $sale_order['bc_id'],
                $sale_order['sub_total'],
                $sale_order['grand_total'],
                $invoice_no,
                $user_id
            ]);

            $proforma_invoice_id = $pdo->lastInsertId();

            // Get sale order details
            $sale_order_details_query = "SELECT id, service_id, service_name, qty, rate, amount, tax_id, 
                                               igst, cgst, sgst, igst_amount, cgst_amount, sgst_amount, 
                                               total_amount, bill_cycle_id, from_date, to_date
                                        FROM sale_order_details 
                                        WHERE sale_order_id = ?";
            
            $sale_order_details_stmt = $pdo->prepare($sale_order_details_query);
            $sale_order_details_stmt->execute([$sale_order_id]);
            $sale_order_details = $sale_order_details_stmt->fetchAll(PDO::FETCH_ASSOC);

            // Insert into proforma_invoice_details table
            $proforma_invoice_details_query = "INSERT INTO proforma_invoice_details 
                                             (p_inv_id, sale_order_detail_id, service_id, service_name, qty, inv_rate, inv_amount, 
                                              tax_id, igst, cgst, sgst, igst_amount, cgst_amount, sgst_amount, 
                                              inv_total_amount, bill_cycle_id, bill_from_date, bill_to_date, created_at) 
                                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";

            $proforma_invoice_details_stmt = $pdo->prepare($proforma_invoice_details_query);

            foreach ($sale_order_details as $detail) {
                $proforma_invoice_details_stmt->execute([
                    $proforma_invoice_id,
                    $detail['id'],
                    $detail['service_id'],
                    $detail['service_name'],
                    $detail['qty'],
                    $detail['rate'],
                    $detail['amount'],
                    $detail['tax_id'],
                    $detail['igst'],
                    $detail['cgst'],
                    $detail['sgst'],
                    $detail['igst_amount'],
                    $detail['cgst_amount'],
                    $detail['sgst_amount'],
                    $detail['total_amount'],
                    $detail['bill_cycle_id'],
                    $detail['from_date'],
                    $detail['to_date']
                ]);
            }

            // Update sale order to mark as proforma invoice generated
            $update_sale_order_query = "UPDATE sale_orders SET is_proforma_generated = 1 WHERE id = ?";
            $update_sale_order_stmt = $pdo->prepare($update_sale_order_query);
            $update_sale_order_stmt->execute([$sale_order_id]);

            // Commit transaction
            $pdo->commit();

            echo json_encode([
                'success' => true,
                'message' => 'Proforma invoice generated successfully',
                'invoice_no' => $invoice_no,
                'proforma_invoice_id' => $proforma_invoice_id
            ]);

        } catch (Exception $e) {
            // Rollback transaction
            $pdo->rollBack();
            throw $e;
        }

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}
?>
