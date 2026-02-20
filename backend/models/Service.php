<?php
require_once __DIR__ . '/../config/database.php';

class Service {
    private $db;
    
    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }
    
    // Get all services with pagination (excluding soft deleted)
    public function getAll($page = 1, $limit = 10, $search = '', $sortBy = 'service_name', $sortOrder = 'ASC', $status = '') {
        // Validate pagination parameters
        $page = max(1, $page);
        $limit = max(1, min(100, $limit)); // Limit between 1 and 100
        $offset = ($page - 1) * $limit;
        
        // Build base query
        $baseSql = "FROM services s 
                    LEFT JOIN users u1 ON s.created_by = u1.id 
                    LEFT JOIN users u2 ON s.updated_by = u2.id 
                    WHERE s.is_deleted = FALSE";
        
        $params = [];
        
        // Add search condition
        if (!empty($search)) {
            $baseSql .= " AND (s.service_name LIKE ? OR s.hsn_sac LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        
        // Add status filter
        if (!empty($status)) {
            $baseSql .= " AND s.status = ?";
            $params[] = $status;
        }
        
        // Add sorting
        $allowedSortFields = ['service_name', 'hsn_sac', 'status', 'created_at', 'updated_at'];
        $sortBy = in_array($sortBy, $allowedSortFields) ? $sortBy : 'service_name';
        $sortOrder = strtoupper($sortOrder) === 'DESC' ? 'DESC' : 'ASC';
        
        $orderBy = " ORDER BY s.$sortBy $sortOrder";
        
        // Get total count
        $countSql = "SELECT COUNT(*) " . $baseSql;
        $countStmt = $this->db->prepare($countSql);
        $countStmt->execute($params);
        $totalItems = $countStmt->fetchColumn();
        $totalPages = ceil($totalItems / $limit);
        
        // Get paginated data
        $dataSql = "SELECT s.*, u1.username as created_by_name, u2.username as updated_by_name " . 
                   $baseSql . $orderBy . " LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        
        $dataStmt = $this->db->prepare($dataSql);
        $dataStmt->execute($params);
        $data = $dataStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get stats
        $stats = $this->getStats();
        
        return [
            'data' => $data,
            'total_items' => $totalItems,
            'total_pages' => $totalPages,
            'current_page' => $page,
            'items_per_page' => $limit,
            'stats' => $stats
        ];
    }
    
    // Get service by ID
    public function getById($id) {
        $sql = "SELECT s.*, u1.username as created_by_name, u2.username as updated_by_name 
                FROM services s 
                LEFT JOIN users u1 ON s.created_by = u1.id 
                LEFT JOIN users u2 ON s.updated_by = u2.id 
                WHERE s.id = ? AND s.is_deleted = FALSE";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    // Create new service
    public function create($data) {
        $sql = "INSERT INTO services (service_name, hsn_sac, status, created_by, updated_by) 
                VALUES (?, ?, ?, ?, ?)";
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            $data['service_name'],
            $data['hsn_sac'],
            $data['status'] ?? 'active',
            $data['created_by'],
            $data['updated_by']
        ]);
    }
    
    // Update service
    public function update($id, $data) {
        $sql = "UPDATE services 
                SET service_name = ?, hsn_sac = ?, status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ? AND is_deleted = FALSE";
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            $data['service_name'],
            $data['hsn_sac'],
            $data['status'],
            $data['updated_by'],
            $id
        ]);
    }
    
    // Soft delete service
    public function softDelete($id, $updated_by) {
        $sql = "UPDATE services 
                SET is_deleted = TRUE, updated_by = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ? AND is_deleted = FALSE";
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$updated_by, $id]);
    }
    
    // Toggle service status
    public function toggleStatus($id, $updated_by) {
        $sql = "UPDATE services 
                SET status = CASE 
                    WHEN status = 'active' THEN 'inactive' 
                    ELSE 'active' 
                END, 
                updated_by = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ? AND is_deleted = FALSE";
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$updated_by, $id]);
    }
    
    // Check if service name exists (for validation)
    public function nameExists($service_name, $exclude_id = null) {
        $sql = "SELECT COUNT(*) FROM services 
                WHERE service_name = ? AND is_deleted = FALSE";
        
        $params = [$service_name];
        
        if ($exclude_id) {
            $sql .= " AND id != ?";
            $params[] = $exclude_id;
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn() > 0;
    }
    
    // Check if HSN/SAC exists (for validation)
    public function hsnSacExists($hsn_sac, $exclude_id = null) {
        $sql = "SELECT COUNT(*) FROM services 
                WHERE hsn_sac = ? AND is_deleted = FALSE";
        
        $params = [$hsn_sac];
        
        if ($exclude_id) {
            $sql .= " AND id != ?";
            $params[] = $exclude_id;
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn() > 0;
    }
    
    // Get service statistics
    public function getStats() {
        $sql = "SELECT 
                    COUNT(*) as total_services,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_services,
                    SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_services
                FROM services 
                WHERE is_deleted = FALSE";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
?>
