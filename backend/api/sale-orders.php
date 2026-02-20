<?php
header('Content-Type: application/json');
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../models/SaleOrder.php';
require_once '../models/SaleOrderDetails.php';
require_once '../config/jwt.php';

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
$saleOrder = new SaleOrder();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $params = [
            'page' => $_GET['page'] ?? 1,
            'limit' => $_GET['limit'] ?? 10,
            'search' => $_GET['search'] ?? '',
            'sortBy' => $_GET['sortBy'] ?? 'created_at',
            'sortOrder' => $_GET['sortOrder'] ?? 'DESC',
            'status' => $_GET['status'] ?? ''
        ];

        $result = $saleOrder->getAll($params);
        echo json_encode([
            'success' => true,
            'data' => $result['data'],
            'pagination' => $result['pagination']
        ]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $errors = [];

        // Validation
        if (empty($input['quotation_id'])) {
            $errors[] = 'Quotation ID is required';
        }
        if (empty($input['so_date'])) {
            $errors[] = 'Sale order date is required';
        }
        if (empty($input['bill_cycle_id'])) {
            $errors[] = 'Bill cycle is required';
        }
        if (empty($input['from_date'])) {
            $errors[] = 'From date is required';
        }
        if (empty($input['to_date'])) {
            $errors[] = 'To date is required';
        }

        if (!empty($errors)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
            break;
        }

        $data = [
            'quotation_id' => (int)$input['quotation_id'],
            'so_date' => $input['so_date'],
            'bill_cycle_id' => (int)$input['bill_cycle_id'],
            'from_date' => $input['from_date'],
            'to_date' => $input['to_date'],
            'notes' => $input['notes'] ?? '',
            'status' => $input['status'] ?? 'active',
            'created_by' => $user_id,
            'services' => $input['services'] ?? []
        ];

        $saleOrderId = $saleOrder->create($data);
        if ($saleOrderId) {
            echo json_encode([
                'success' => true,
                'message' => 'Sale order created successfully',
                'sale_order_id' => $saleOrderId
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to create sale order'
            ]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? null;

        if (!$id) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Sale order ID is required'
            ]);
            break;
        }

        $data = [
            'quotation_id' => (int)$input['quotation_id'],
            'so_date' => $input['so_date'],
            'bill_cycle_id' => (int)$input['bill_cycle_id'],
            'from_date' => $input['from_date'],
            'to_date' => $input['to_date'],
            'notes' => $input['notes'] ?? '',
            'status' => $input['status'] ?? 'active',
            'updated_by' => $user_id,
            'services' => $input['services'] ?? []
        ];

        if ($saleOrder->update($id, $data)) {
            // Update sale order details
            if (!empty($data['services'])) {
                $saleOrderDetails = new SaleOrderDetails();
                $saleOrderDetails->updateBySaleOrderId($id, $data['services']);
            }

            echo json_encode([
                'success' => true,
                'message' => 'Sale order updated successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to update sale order'
            ]);
        }
        break;

    case 'DELETE':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? null;

        if (!$id) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Sale order ID is required'
            ]);
            break;
        }

        try {
            $database = new Database();
            $pdo = $database->getConnection();
            
            if (!$pdo) {
                throw new Exception('Database connection failed');
            }

            $pdo->beginTransaction();

            // Get sale order details including status and is_invoiced
            $saleOrderQuery = "SELECT quotation_id, status, is_invoiced, is_deleted FROM sale_orders WHERE id = :id";
            $saleOrderStmt = $pdo->prepare($saleOrderQuery);
            $saleOrderStmt->execute(['id' => $id]);
            $saleOrderData = $saleOrderStmt->fetch(PDO::FETCH_ASSOC);

            if (!$saleOrderData) {
                throw new Exception('Sale order not found');
            }

            // Check if sale order is already deleted
            if ($saleOrderData['is_deleted'] == 1) {
                throw new Exception('Sale order is already deleted');
            }

            // Check if sale order status is closed
            if ($saleOrderData['status'] === 'closed') {
                throw new Exception('Cannot delete closed sale orders');
            }

            // Check if sale order is invoiced
            if ($saleOrderData['is_invoiced'] == 1) {
                throw new Exception('Cannot delete invoiced sale orders. This record has been moved to proforma invoice.');
            }

            $quotation_id = $saleOrderData['quotation_id'];

            // Update quotation_services.is_moved_so to 0
            if ($quotation_id) {
                $updateQuotationServicesQuery = "UPDATE quotation_services 
                                                SET is_moved_so = 0 
                                                WHERE quotation_id = :quotation_id";
                $updateQuotationServicesStmt = $pdo->prepare($updateQuotationServicesQuery);
                $updateQuotationServicesStmt->execute(['quotation_id' => $quotation_id]);
                
                // Update quotation status to 'draft' so it can be edited again
                $updateQuotationStatusQuery = "UPDATE quotations 
                                              SET status = 'draft', updated_at = NOW() 
                                              WHERE id = :quotation_id";
                $updateQuotationStatusStmt = $pdo->prepare($updateQuotationStatusQuery);
                $updateQuotationStatusStmt->execute(['quotation_id' => $quotation_id]);
            }

            // Soft delete sale order (set is_deleted = 1)
            $softDeleteQuery = "UPDATE sale_orders 
                               SET is_deleted = 1, updated_at = NOW() 
                               WHERE id = :id";
            $softDeleteStmt = $pdo->prepare($softDeleteQuery);
            $softDeleteStmt->execute(['id' => $id]);

            // Soft delete sale order details
            $softDeleteDetailsQuery = "UPDATE sale_order_details 
                                      SET is_deleted = 1, updated_at = NOW() 
                                      WHERE sale_order_id = :sale_order_id";
            $softDeleteDetailsStmt = $pdo->prepare($softDeleteDetailsQuery);
            $softDeleteDetailsStmt->execute(['sale_order_id' => $id]);

            $pdo->commit();

            echo json_encode([
                'success' => true,
                'message' => 'Sale order deleted successfully'
            ]);

        } catch (Exception $e) {
            if (isset($pdo)) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to delete sale order: ' . $e->getMessage()
            ]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed'
        ]);
        break;
}
?>