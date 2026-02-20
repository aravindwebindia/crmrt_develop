<?php
require_once __DIR__ . '/../config/database.php';

class Tax {
    private $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    // Get all taxes with pagination (excluding soft deleted)
    public function getAll($page = 1, $limit = 10, $search = '', $sortBy = 'tax_name', $sortOrder = 'ASC', $status = '') {
        // Validate pagination parameters
        $page = max(1, $page);
        $limit = max(1, min(100, $limit)); // Limit between 1 and 100
        $offset = ($page - 1) * $limit;

        // Build base query
        $baseSql = "FROM tax t 
                    LEFT JOIN users u1 ON t.created_by = u1.id 
                    LEFT JOIN users u2 ON t.updated_by = u2.id 
                    WHERE t.is_deleted = FALSE";

        $params = [];

        // Add search condition
        if (!empty($search)) {
            $baseSql .= " AND (t.tax_name LIKE ?)";
            $params[] = "%$search%";
        }

        // Add status filter
        if (!empty($status)) {
            $baseSql .= " AND t.status = ?";
            $params[] = $status;
        }

        // Add sorting
        $allowedSortFields = ['tax_name', 'igst', 'cgst', 'sgst', 'status', 'created_at', 'updated_at'];
        $sortBy = in_array($sortBy, $allowedSortFields) ? $sortBy : 'tax_name';
        $sortOrder = strtoupper($sortOrder) === 'DESC' ? 'DESC' : 'ASC';

        $orderBy = " ORDER BY t.$sortBy $sortOrder";

        // Get total count
        $countSql = "SELECT COUNT(*) " . $baseSql;
        $countStmt = $this->db->prepare($countSql);
        $countStmt->execute($params);
        $totalItems = $countStmt->fetchColumn();
        $totalPages = ceil($totalItems / $limit);

        // Get paginated data
        $dataSql = "SELECT t.*, 
                           u1.username as created_by_name, 
                           u2.username as updated_by_name
                    " . $baseSql . $orderBy . " LIMIT " . (int)$limit . " OFFSET " . (int)$offset;

        $dataStmt = $this->db->prepare($dataSql);
        $dataStmt->execute($params);
        $data = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'data' => $data,
            'total_items' => $totalItems,
            'total_pages' => $totalPages,
            'current_page' => $page,
            'items_per_page' => $limit
        ];
    }

    // Get tax by ID
    public function getById($id) {
        $sql = "SELECT t.*, 
                       u1.username as created_by_name, 
                       u2.username as updated_by_name
                FROM tax t 
                LEFT JOIN users u1 ON t.created_by = u1.id 
                LEFT JOIN users u2 ON t.updated_by = u2.id 
                WHERE t.tax_id = ? AND t.is_deleted = FALSE";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Create new tax
    public function create($data) {
        $sql = "INSERT INTO tax (tax_name, igst, cgst, sgst, status, created_by) VALUES (?, ?, ?, ?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            $data['tax_name'], 
            $data['igst'], 
            $data['cgst'], 
            $data['sgst'], 
            $data['status'], 
            $data['created_by']
        ]);
    }

    // Update tax
    public function update($id, $data) {
        $sql = "UPDATE tax SET tax_name = ?, igst = ?, cgst = ?, sgst = ?, status = ?, updated_by = ? WHERE tax_id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            $data['tax_name'], 
            $data['igst'], 
            $data['cgst'], 
            $data['sgst'], 
            $data['status'], 
            $data['updated_by'], 
            $id
        ]);
    }

    // Soft delete tax
    public function delete($id) {
        $sql = "UPDATE tax SET is_deleted = TRUE WHERE tax_id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }

    // Toggle tax status
    public function toggleStatus($id) {
        $tax = $this->getById($id);
        if ($tax) {
            $newStatus = ($tax['status'] === 'active') ? 'inactive' : 'active';
            $sql = "UPDATE tax SET status = ? WHERE tax_id = ?";
            $stmt = $this->db->prepare($sql);
            return $stmt->execute([$newStatus, $id]);
        }
        return false;
    }

    // Check if tax exists (for validation)
    public function taxExists($tax_name, $excludeId = null) {
        $sql = "SELECT COUNT(*) FROM tax WHERE tax_name = ? AND is_deleted = FALSE";
        $params = [$tax_name];
        if ($excludeId) {
            $sql .= " AND tax_id != ?";
            $params[] = $excludeId;
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn() > 0;
    }

    // Get tax statistics
    public function getStats() {
        $sql = "SELECT 
                    COUNT(*) as total_taxes,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_taxes,
                    SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_taxes
                FROM tax WHERE is_deleted = FALSE";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
?>
