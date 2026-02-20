<?php
require_once __DIR__ . '/../config/database.php';

class SaleOrderDetails {
    private $db;
    private $table_name = "sale_order_details";

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function createMultiple($saleOrderId, $services) {
        $query = "INSERT INTO {$this->table_name} 
                  (sale_order_id, service_id, quantity, rate, amount, tax_id, tax_amount, total_amount, created_at) 
                  VALUES (:sale_order_id, :service_id, :quantity, :rate, :amount, :tax_id, :tax_amount, :total_amount, NOW())";
        
        $stmt = $this->db->prepare($query);
        
        foreach ($services as $service) {
            $stmt->bindParam(':sale_order_id', $saleOrderId);
            $stmt->bindParam(':service_id', $service['service_id']);
            $stmt->bindParam(':quantity', $service['quantity']);
            $stmt->bindParam(':rate', $service['rate']);
            $stmt->bindParam(':amount', $service['amount']);
            $stmt->bindParam(':tax_id', $service['tax_id']);
            $stmt->bindParam(':tax_amount', $service['tax_amount']);
            $stmt->bindParam(':total_amount', $service['total_amount']);
            
            if (!$stmt->execute()) {
                return false;
            }
        }
        return true;
    }

    public function getBySaleOrderId($saleOrderId) {
        $query = "SELECT sod.*, s.service_name, t.tax_name, t.igst, t.cgst, t.sgst
                  FROM {$this->table_name} sod
                  LEFT JOIN services s ON sod.service_id = s.id
                  LEFT JOIN tax t ON sod.tax_id = t.tax_id
                  WHERE sod.sale_order_id = :sale_order_id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':sale_order_id', $saleOrderId);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function updateBySaleOrderId($saleOrderId, $services) {
        try {
            $this->db->beginTransaction();
            
            // Delete existing details
            $deleteQuery = "DELETE FROM {$this->table_name} WHERE sale_order_id = :sale_order_id";
            $deleteStmt = $this->db->prepare($deleteQuery);
            $deleteStmt->bindParam(':sale_order_id', $saleOrderId);
            $deleteStmt->execute();
            
            // Insert new details
            if (!empty($services)) {
                if (!$this->createMultiple($saleOrderId, $services)) {
                    throw new Exception('Failed to create sale order details');
                }
            }
            
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }

    public function deleteBySaleOrderId($saleOrderId) {
        $query = "DELETE FROM {$this->table_name} WHERE sale_order_id = :sale_order_id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':sale_order_id', $saleOrderId);
        return $stmt->execute();
    }
}
?>

