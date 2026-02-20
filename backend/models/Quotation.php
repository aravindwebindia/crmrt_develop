<?php
require_once __DIR__ . '/../config/database.php';

class Quotation {
    private $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    // Get all quotations with pagination (excluding soft deleted)
    public function getAll($page = 1, $limit = 10, $search = '', $sortBy = 'created_at', $sortOrder = 'DESC', $status = '') {
        // Validate pagination parameters
        $page = max(1, $page);
        $limit = max(1, min(100, $limit)); // Limit between 1 and 100
        $offset = ($page - 1) * $limit;

        // Build base query
        $baseSql = "FROM quotations q 
                    LEFT JOIN contact_persons cp ON q.cp_id = cp.cp_id
                    LEFT JOIN contacts c ON cp.contact_id = c.ld_id 
                    LEFT JOIN contract_types ct ON q.contract_type_id = ct.id
                    LEFT JOIN users u1 ON q.created_by = u1.id 
                    LEFT JOIN users u2 ON q.updated_by = u2.id
                    WHERE q.is_deleted = FALSE AND q.status != 'edited'";

        $params = [];

        // Add search condition
        if (!empty($search)) {
            $baseSql .= " AND (q.quotation_no LIKE ? OR c.company LIKE ? OR cp.contact_person LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        // Add status filter
        if (!empty($status)) {
            $baseSql .= " AND q.status = ?";
            $params[] = $status;
        }

        // Add sorting - ONLY date/time based, NO quotation number sorting
        // quotation_no sorting is disabled - will fallback to created_at
        $allowedSortFields = ['company', 'contact_person', 'grand_total', 'status', 'created_at', 'updated_at', 'id', 'created_by_name'];
        $sortBy = in_array($sortBy, $allowedSortFields) ? $sortBy : 'created_at';
        $sortOrder = strtoupper($sortOrder) === 'DESC' ? 'DESC' : 'ASC';

        // Handle sorting for different fields - NO quotation number sorting
        if ($sortBy === 'company') {
            $orderBy = " ORDER BY c.company $sortOrder";
        } elseif ($sortBy === 'contact_person') {
            $orderBy = " ORDER BY cp.contact_person $sortOrder";
        } elseif ($sortBy === 'created_at') {
            $orderBy = " ORDER BY q.created_at $sortOrder";
        } elseif ($sortBy === 'updated_at') {
            $orderBy = " ORDER BY q.updated_at $sortOrder";
        } elseif ($sortBy === 'id') {
            // Sort by ID - highest ID first (most recent)
            $orderBy = " ORDER BY q.id $sortOrder";
        } elseif ($sortBy === 'created_by_name') {
            // Sort by created by username
            $orderBy = " ORDER BY u1.username $sortOrder";
        } else {
            // Default to created_at for any other field
            $orderBy = " ORDER BY q.created_at $sortOrder";
        }

        // Get total count
        $countSql = "SELECT COUNT(*) " . $baseSql;
        $countStmt = $this->db->prepare($countSql);
        $countStmt->execute($params);
        $totalItems = $countStmt->fetchColumn();
        $totalPages = ceil($totalItems / $limit);

        // Get paginated data
        $dataSql = "SELECT q.*, 
                           q.created_at,
                           q.updated_at,
                           c.ld_id as contact_id,
                           c.company as company_name, 
                           c.first_name, 
                           c.last_name, 
                           c.mobile, 
                           c.email,
                           cp.contact_person,
                           cp.contact_mobile,
                           cp.contact_email,
                           ct.contract_name,
                           u1.username as created_by_name,
                           u1.email as created_by_email, 
                           u2.username as updated_by_name,
                           (SELECT COUNT(*) FROM sale_orders so WHERE so.quotation_id = q.id AND so.is_deleted = 0) as has_sale_order
                    " . $baseSql . $orderBy . " LIMIT " . (int)$limit . " OFFSET " . (int)$offset;

        $dataStmt = $this->db->prepare($dataSql);
        $dataStmt->execute($params);
        $data = $dataStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Debug: Log the sorting method and first few created_at values
        if (!empty($data)) {
            $createdAtValues = array_slice(array_column($data, 'created_at'), 0, 3);
            error_log("Sorting by: $sortBy $sortOrder - First 3 created_at values: " . implode(', ', $createdAtValues));
        }

        return [
            'data' => $data,
            'total_items' => $totalItems,
            'total_pages' => $totalPages,
            'current_page' => $page,
            'items_per_page' => $limit
        ];
    }

    // Get quotation by ID
    public function getById($id) {
        $sql = "SELECT q.*, 
                       q.created_at,
                       q.updated_at,
                       c.ld_id as contact_id,
                       c.company as company_name, 
                       c.first_name, 
                       c.last_name, 
                       c.mobile, 
                       c.email,
                       q.contact_address,
                       q.country_id,
                       q.state_id,
                       co.name as country,
                       s.name as state,
                       cp.contact_person,
                       cp.contact_mobile,
                       cp.contact_email,
                       ct.contract_name,
                       u1.username as created_by_name, 
                       u2.username as updated_by_name
                FROM quotations q 
                LEFT JOIN contact_persons cp ON q.cp_id = cp.cp_id
                LEFT JOIN contacts c ON cp.contact_id = c.ld_id 
                LEFT JOIN contract_types ct ON q.contract_type_id = ct.id
                LEFT JOIN tbl_countries co ON q.country_id = co.id
                LEFT JOIN tbl_states s ON q.state_id = s.id
                LEFT JOIN users u1 ON q.created_by = u1.id 
                LEFT JOIN users u2 ON q.updated_by = u2.id 
                WHERE q.id = ? AND q.is_deleted = FALSE";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Generate quotation number
    public function generateQuotationNo() {
        $year = date('Y');
        // Count only valid QT-YYYY-XXX format numbers (not QT-YYYY-XXX-1, etc.)
        $sql = "SELECT COUNT(*) as count FROM quotations WHERE quotation_no REGEXP ? AND YEAR(created_at) = ?";
        $stmt = $this->db->prepare($sql);
        $pattern = "^QT-$year-[0-9]{3}$"; // Only QT-YYYY-XXX format
        $stmt->execute([$pattern, $year]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $nextNumber = $result['count'] + 1;
        return "QT-$year-" . str_pad($nextNumber, 3, '0', STR_PAD_LEFT);
    }

    // Generate versioned quotation number for edits
    public function generateVersionedQuotationNo($originalQuotationNo) {
        // Extract base number (QT-2025-001) from any version (QT-2025-001-1, QT-2025-001-2, etc.)
        $basePattern = '/^(QT-\d{4}-\d{3})/';
        preg_match($basePattern, $originalQuotationNo, $matches);
        $baseNumber = $matches[1] ?? $originalQuotationNo;
        
        // Find all quotations that start with the exact base number
        // Use exact match pattern to avoid matching other similar numbers
        $sql = "SELECT quotation_no FROM quotations WHERE quotation_no = ? OR quotation_no LIKE ? ORDER BY quotation_no DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$baseNumber, $baseNumber . '-%']);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $maxVersion = 0;
        
        foreach ($results as $row) {
            $quotationNo = $row['quotation_no'];
            
            // Check if it's a versioned number (has -X suffix)
            if (preg_match('/^(.+)-(\d+)$/', $quotationNo, $versionMatches)) {
                // Make sure the base part matches exactly
                if ($versionMatches[1] === $baseNumber) {
                    $version = intval($versionMatches[2]);
                    if ($version > $maxVersion) {
                        $maxVersion = $version;
                    }
                }
            } else {
                // This is the original quotation (no version suffix)
                // If we find the original, it means no versions exist yet
                if ($quotationNo === $baseNumber) {
                    $maxVersion = 0; // Will become 1
                }
            }
        }
        
        // Return the next version number
        return $baseNumber . '-' . ($maxVersion + 1);
    }

    // Create new quotation
    public function create($data) {
        $quotationNo = $this->generateQuotationNo();
        
        $sql = "INSERT INTO quotations (cp_id, quotation_no, contract_type_id, contract_from_date, contract_to_date, contact_address, state_id, country_id, status, grand_total, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
        $stmt = $this->db->prepare($sql);
        
        $result = $stmt->execute([
            $data['cp_id'],
            $quotationNo,
            $data['contract_type_id'],
            $data['contract_from_date'],
            $data['contract_to_date'],
            $data['contact_address'],
            $data['state_id'],
            $data['country_id'],
            $data['status'],
            $data['grand_total'],
            $data['created_by']
        ]);
        
        if ($result) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    // Mark quotation as edited
    public function markAsEdited($id) {
        $sql = "UPDATE quotations SET status = 'edited', updated_at = NOW() WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }

    // Update quotation
    public function update($id, $data) {
        $sql = "UPDATE quotations SET cp_id = ?, contract_type_id = ?, contract_from_date = ?, contract_to_date = ?, contact_address = ?, state_id = ?, country_id = ?, status = ?, grand_total = ?, updated_by = ? WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            $data['cp_id'],
            $data['contract_type_id'],
            $data['contract_from_date'],
            $data['contract_to_date'],
            $data['contact_address'],
            $data['state_id'],
            $data['country_id'],
            $data['status'],
            $data['grand_total'],
            $data['updated_by'],
            $id
        ]);
    }

    // Soft delete quotation
    public function delete($id) {
        $sql = "UPDATE quotations SET is_deleted = TRUE WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }

    // Toggle quotation status
    public function toggleStatus($id) {
        $quotation = $this->getById($id);
        if ($quotation) {
            $statuses = ['draft', 'sent', 'hold', 'accepted'];
            $currentIndex = array_search($quotation['status'], $statuses);
            $newStatus = $statuses[($currentIndex + 1) % count($statuses)];
            
            $sql = "UPDATE quotations SET status = ? WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            return $stmt->execute([$newStatus, $id]);
        }
        return false;
    }

    // Update quotation status
    public function updateStatus($id, $status) {
        $sql = "UPDATE quotations SET status = ? WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$status, $id]);
    }

    public function updateStatusWithUser($id, $status, $updatedBy) {
        $sql = "UPDATE quotations SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$status, $updatedBy, $id]);
    }


    // Update existing records that don't have created_at values
    public function updateMissingCreatedAt() {
        $sql = "UPDATE quotations SET created_at = NOW() WHERE created_at IS NULL";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute();
    }

    // Get quotation statistics
    public function getStats() {
        $sql = "SELECT 
                    COUNT(*) as total_quotations,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_quotations,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_quotations,
                    SUM(CASE WHEN status = 'hold' THEN 1 ELSE 0 END) as hold_quotations,
                    SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_quotations,
                    SUM(grand_total) as total_value
                FROM quotations WHERE is_deleted = FALSE";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
?>
