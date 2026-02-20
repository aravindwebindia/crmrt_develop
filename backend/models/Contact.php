<?php
require_once __DIR__ . '/../config/database.php';

class Contact {
    private $db;
    
    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }
    
    // Get all contacts with pagination (excluding soft deleted)
    public function getAll($page = 1, $limit = 10, $search = '', $sortBy = 'created_at', $sortOrder = 'DESC', $status = '') {
        // Validate pagination parameters
        $page = max(1, $page);
        $limit = max(1, min(100, $limit)); // Limit between 1 and 100
        $offset = ($page - 1) * $limit;
        
        // Build base query
        $baseSql = "FROM contacts c 
                    LEFT JOIN users u1 ON c.created_by = u1.id 
                    LEFT JOIN users u2 ON c.updated_by = u2.id 
                    LEFT JOIN tbl_salutations s ON c.sal_id = s.sal_id
                    LEFT JOIN tbl_countries co ON c.country = co.id
                    LEFT JOIN tbl_states st ON c.state = st.id
                    WHERE c.is_deleted = FALSE";
        
        $params = [];
        
        // Add search condition
        if (!empty($search)) {
            $baseSql .= " AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.company LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        
        // Add status filter
        if (!empty($status)) {
            $baseSql .= " AND c.status = ?";
            $params[] = $status;
        }
        
        // Add sorting
        $allowedSortFields = ['first_name', 'last_name', 'email', 'company', 'status', 'created_at', 'updated_at'];
        $sortBy = in_array($sortBy, $allowedSortFields) ? $sortBy : 'created_at';
        $sortOrder = strtoupper($sortOrder) === 'ASC' ? 'ASC' : 'DESC';
        
        $orderBy = " ORDER BY c.$sortBy $sortOrder";
        
        // Get total count
        $countSql = "SELECT COUNT(*) " . $baseSql;
        $countStmt = $this->db->prepare($countSql);
        $countStmt->execute($params);
        $totalItems = $countStmt->fetchColumn();
        $totalPages = ceil($totalItems / $limit);
        
        // Get paginated data
        $dataSql = "SELECT c.*, 
                           u1.username as created_by_name, 
                           u2.username as updated_by_name,
                           s.salutation as salutation_name,
                           co.name as country_name,
                           st.name as state_name
                    " . $baseSql . $orderBy . " LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        
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
    
    // Get contact by ID
    public function getById($id) {
        $sql = "SELECT c.*, 
                       u1.username as created_by_name, 
                       u2.username as updated_by_name,
                       s.salutation as salutation_name,
                       co.name as country_name,
                       st.name as state_name
                FROM contacts c 
                LEFT JOIN users u1 ON c.created_by = u1.id 
                LEFT JOIN users u2 ON c.updated_by = u2.id 
                LEFT JOIN tbl_salutations s ON c.sal_id = s.sal_id
                LEFT JOIN tbl_countries co ON c.country = co.id
                LEFT JOIN tbl_states st ON c.state = st.id
                WHERE c.ld_id = ? AND c.is_deleted = FALSE";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    // Sanitize data for database insertion
    private function sanitizeData($data) {
        return [
            'sal_id' => !empty($data['sal_id']) ? (int)$data['sal_id'] : 0,
            'first_name' => trim($data['first_name']),
            'last_name' => trim($data['last_name']),
            'designation' => $data['designation'] ?? '',
            'email' => trim($data['email']),
            'mobile' => trim($data['mobile']),
            'notes' => $data['notes'] ?? '',
            'company' => trim($data['company']),
            'c_address' => trim($data['c_address']),
            'picture' => $data['picture'] ?? '',
            'company_gst' => $data['company_gst'] ?? '',
            'state' => (int)$data['state'],
            'country' => (int)$data['country'],
            'city' => $data['city'] ?? '',
            'zip' => $data['zip'] ?? '',
            'status' => $data['status'] ?? 'active',
            'created_by' => $data['created_by'] ?? null,
            'updated_by' => $data['updated_by'] ?? null
        ];
    }

    // Create new contact
    public function create($data) {
        try {
            // Sanitize data
            $sanitizedData = $this->sanitizeData($data);
            
            // Start transaction
            $this->db->beginTransaction();
            
            // Insert into contacts table
            $sql = "INSERT INTO contacts (sal_id, first_name, last_name, designation, email, mobile, notes, company, c_address, picture, company_gst, state, country, city, zip, status, created_by) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $stmt = $this->db->prepare($sql);
            $result = $stmt->execute([
                $sanitizedData['sal_id'],
                $sanitizedData['first_name'],
                $sanitizedData['last_name'],
                $sanitizedData['designation'],
                $sanitizedData['email'],
                $sanitizedData['mobile'],
                $sanitizedData['notes'],
                $sanitizedData['company'],
                $sanitizedData['c_address'],
                $sanitizedData['picture'],
                $sanitizedData['company_gst'],
                $sanitizedData['state'],
                $sanitizedData['country'],
                $sanitizedData['city'],
                $sanitizedData['zip'],
                $sanitizedData['status'],
                $sanitizedData['created_by']
            ]);
            
            if (!$result) {
                throw new Exception('Failed to create contact');
            }
            
            // Get the inserted contact ID (ld_id)
            $contactId = $this->db->lastInsertId();
            
            // Create contact person record
            $contactPersonSql = "INSERT INTO contact_persons (contact_id, contact_person, contact_mobile, contact_email, status) 
                                VALUES (?, ?, ?, ?, ?)";
            
            $contactPersonStmt = $this->db->prepare($contactPersonSql);
            $contactPersonResult = $contactPersonStmt->execute([
                $contactId, // contact_id = ld_id from contacts table
                trim($sanitizedData['first_name'] . ' ' . $sanitizedData['last_name']), // contact_person = first_name + last_name
                $sanitizedData['mobile'], // contact_mobile = mobile
                $sanitizedData['email'], // contact_email = email
                'active' // status = active
            ]);
            
            if (!$contactPersonResult) {
                throw new Exception('Failed to create contact person');
            }
            
            // Commit transaction
            $this->db->commit();
            return true;
            
        } catch (Exception $e) {
            // Rollback transaction on error
            $this->db->rollback();
            return false;
        }
    }
    
    // Update contact
    public function update($id, $data) {
        try {
            // Sanitize data
            $sanitizedData = $this->sanitizeData($data);
            
            // Start transaction
            $this->db->beginTransaction();
            
            // Update contacts table
            $sql = "UPDATE contacts SET 
                    sal_id = ?, first_name = ?, last_name = ?, designation = ?, email = ?, mobile = ?, 
                    notes = ?, company = ?, c_address = ?, picture = ?, company_gst = ?, 
                    state = ?, country = ?, city = ?, zip = ?, status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE ld_id = ? AND is_deleted = FALSE";
            
            $stmt = $this->db->prepare($sql);
            $result = $stmt->execute([
                $sanitizedData['sal_id'],
                $sanitizedData['first_name'],
                $sanitizedData['last_name'],
                $sanitizedData['designation'],
                $sanitizedData['email'],
                $sanitizedData['mobile'],
                $sanitizedData['notes'],
                $sanitizedData['company'],
                $sanitizedData['c_address'],
                $sanitizedData['picture'],
                $sanitizedData['company_gst'],
                $sanitizedData['state'],
                $sanitizedData['country'],
                $sanitizedData['city'],
                $sanitizedData['zip'],
                $sanitizedData['status'],
                $sanitizedData['updated_by'],
                $id
            ]);
            
            if (!$result) {
                throw new Exception('Failed to update contact');
            }
            
            // Update the corresponding contact person record
            // $contactPersonSql = "UPDATE contact_persons SET 
            //                     contact_person = ?, contact_mobile = ?, contact_email = ?, status = ?
            //                     WHERE contact_id = ?";
            
            // $contactPersonStmt = $this->db->prepare($contactPersonSql);
            // $contactPersonResult = $contactPersonStmt->execute([
            //     trim($sanitizedData['first_name'] . ' ' . $sanitizedData['last_name']), // contact_person = first_name + last_name
            //     $sanitizedData['mobile'], // contact_mobile = mobile
            //     $sanitizedData['email'], // contact_email = email
            //     $sanitizedData['status'], // status = same as contact status
            //     $id // contact_id = ld_id
            // ]);
            
            // if (!$contactPersonResult) {
            //     throw new Exception('Failed to update contact person');
            // }
            
            // Commit transaction
            $this->db->commit();
            return true;
            
        } catch (Exception $e) {
            // Rollback transaction on error
            $this->db->rollback();
            return false;
        }
    }
    
    // Soft delete contact
    public function delete($id) {
        $sql = "UPDATE contacts SET is_deleted = TRUE WHERE ld_id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
    
    // Toggle status
    public function toggleStatus($id) {
        $sql = "UPDATE contacts SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END WHERE ld_id = ? AND is_deleted = FALSE";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
    
    // Check if email exists
    public function emailExists($email, $excludeId = null) {
        $sql = "SELECT COUNT(*) FROM contacts WHERE email = ? AND is_deleted = FALSE";
        $params = [$email];
        
        if ($excludeId) {
            $sql .= " AND ld_id != ?";
            $params[] = $excludeId;
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn() > 0;
    }
    
    
    // Get stats
    public function getStats() {
        $sql = "SELECT 
                    COUNT(*) as total_contacts,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_contacts,
                    SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_contacts
                FROM contacts WHERE is_deleted = FALSE";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    // Get salutations
    public function getSalutations() {
        $sql = "SELECT sal_id, salutation as salutation_name FROM tbl_salutations ORDER BY salutation";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Get countries
    public function getCountries() {
        $sql = "SELECT id as country_id, name as country_name FROM tbl_countries ORDER BY name";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Get states by country
    public function getStatesByCountry($countryId) {
        $sql = "SELECT id as state_id, name as state_name FROM tbl_states WHERE country_id = ? ORDER BY name";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$countryId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
?>
