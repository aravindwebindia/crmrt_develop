<?php
require_once __DIR__ . '/../config/database.php';

class QuotationService {
    private $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    // Get services by quotation ID (excludes soft-deleted and moved to sale order)
    public function getByQuotationId($quotationId) {
        $sql = "SELECT qs.*, 
                       s.service_name,
                       s.hsn_sac,
                       t.tax_name,
                       t.igst,
                       t.cgst,
                       t.sgst
                FROM quotation_services qs 
                LEFT JOIN services s ON qs.service_id = s.id 
                LEFT JOIN tax t ON qs.tax_id = t.tax_id
                WHERE qs.quotation_id = ? AND qs.is_deleted = FALSE AND qs.is_moved_so = 0
                ORDER BY qs.id";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$quotationId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    public function getByQuotationIdEdit($quotationId) {
        $sql = "SELECT qs.*, 
                       s.service_name,
                       s.hsn_sac,
                       t.tax_name,
                       t.igst,
                       t.cgst,
                       t.sgst
                FROM quotation_services qs 
                LEFT JOIN services s ON qs.service_id = s.id 
                LEFT JOIN tax t ON qs.tax_id = t.tax_id
                WHERE qs.quotation_id = ? AND qs.is_deleted = FALSE 
                ORDER BY qs.id";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$quotationId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Get all services by quotation ID (includes soft-deleted for references)
    public function getAllByQuotationId($quotationId) {
        $sql = "SELECT qs.*, 
                       s.service_name,
                       s.hsn_sac,
                       t.tax_name,
                       t.igst,
                       t.cgst,
                       t.sgst
                FROM quotation_services qs 
                LEFT JOIN services s ON qs.service_id = s.id 
                LEFT JOIN tax t ON qs.tax_id = t.tax_id
                WHERE qs.quotation_id = ?
                ORDER BY qs.id";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$quotationId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Create quotation service
    public function create($data) {
        $sql = "INSERT INTO quotation_services (quotation_id, service_id, quantity, rate, amount, tax_id, igst, cgst, sgst, igst_amount, cgst_amount, sgst_amount, total_amount, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            $data['quotation_id'],
            $data['service_id'],
            $data['quantity'],
            $data['rate'],
            $data['amount'],
            $data['tax_id'],
            $data['igst'],
            $data['cgst'],
            $data['sgst'],
            $data['igst_amount'],
            $data['cgst_amount'],
            $data['sgst_amount'],
            $data['total_amount'],
            $data['description'],
            $data['created_by']
        ]);
    }

    // Update quotation service
    public function update($id, $data) {
        $sql = "UPDATE quotation_services SET service_id = ?, quantity = ?, rate = ?, amount = ?, tax_id = ?, igst = ?, cgst = ?, sgst = ?, igst_amount = ?, cgst_amount = ?, sgst_amount = ?, total_amount = ?, description = ?, updated_by = ? WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            $data['service_id'],
            $data['quantity'],
            $data['rate'],
            $data['amount'],
            $data['tax_id'],
            $data['igst'],
            $data['cgst'],
            $data['sgst'],
            $data['igst_amount'],
            $data['cgst_amount'],
            $data['sgst_amount'],
            $data['total_amount'],
            $data['description'],
            $data['updated_by'],
            $id
        ]);
    }

    // Update service description only
    public function updateDescription($id, $description) {
        $sql = "UPDATE quotation_services SET description = ? WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$description, $id]);
    }

    // Delete quotation service
    public function delete($id) {
        $sql = "UPDATE quotation_services SET is_deleted = TRUE WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }

    // Delete all services for a quotation (soft delete)
    public function deleteByQuotationId($quotationId) {
        $sql = "UPDATE quotation_services SET is_deleted = TRUE WHERE quotation_id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$quotationId]);
    }

    // Soft delete specific services by their IDs
    public function deleteServicesByIds($serviceIds) {
        if (empty($serviceIds)) {
            return true;
        }
        
        $placeholders = str_repeat('?,', count($serviceIds) - 1) . '?';
        $sql = "UPDATE quotation_services SET is_deleted = TRUE WHERE id IN ($placeholders)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($serviceIds);
    }

    // Get all service IDs for a quotation (including deleted ones)
    public function getAllServiceIdsByQuotationId($quotationId) {
        $sql = "SELECT id FROM quotation_services WHERE quotation_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$quotationId]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    // Calculate tax amounts
    public function calculateTaxAmounts($amount, $taxId) {
        $sql = "SELECT igst, cgst, sgst FROM tax WHERE tax_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$taxId]);
        $tax = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$tax) {
            return [
                'igst' => 0,
                'cgst' => 0,
                'sgst' => 0,
                'igst_amount' => 0,
                'cgst_amount' => 0,
                'sgst_amount' => 0
            ];
        }
        
        $igstAmount = ($amount * $tax['igst']) / 100;
        $cgstAmount = ($amount * $tax['cgst']) / 100;
        $sgstAmount = ($amount * $tax['sgst']) / 100;
        
        return [
            'igst' => $tax['igst'],
            'cgst' => $tax['cgst'],
            'sgst' => $tax['sgst'],
            'igst_amount' => $igstAmount,
            'cgst_amount' => $cgstAmount,
            'sgst_amount' => $sgstAmount
        ];
    }
}
?>
