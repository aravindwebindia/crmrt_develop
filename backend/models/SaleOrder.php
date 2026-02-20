<?php
require_once __DIR__ . '/../config/database.php';

class SaleOrder {
    private $db;
    private $table_name = "sale_orders";

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function getAll($params = []) {
        $page = $params['page'] ?? 1;
        $limit = $params['limit'] ?? 10;
        $search = $params['search'] ?? '';
        $sortBy = $params['sortBy'] ?? 'created_at';
        $sortOrder = $params['sortOrder'] ?? 'DESC';
        $status = $params['status'] ?? '';

        $offset = ($page - 1) * $limit;

        $query = "SELECT 
                    so.id,
                    so.saleorder_no as so_number,
                    q.quotation_no,
                    c.company as company_name,
                    so.date as so_date,
                    so.overall_total_amt as total_amount,
                    so.status,
                    so.is_invoiced,
                    so.created_at,
                    bc.bc_name as billing_company,
                    u.username as created_by_name,
                    u.email as created_by_email
                  FROM {$this->table_name} so
                  LEFT JOIN quotations q ON so.quotation_id = q.id
                  LEFT JOIN contacts c ON so.contact_id = c.ld_id
                  LEFT JOIN bill_company bc ON so.bc_id = bc.bc_id
                  LEFT JOIN users u ON so.created_by = u.id
                  WHERE so.is_deleted = 0";

        $countQuery = "SELECT COUNT(*) as total
                       FROM {$this->table_name} so
                       LEFT JOIN quotations q ON so.quotation_id = q.id
                       LEFT JOIN contacts c ON so.contact_id = c.ld_id
                       LEFT JOIN bill_company bc ON so.bc_id = bc.bc_id
                       LEFT JOIN users u ON so.created_by = u.id
                       WHERE so.is_deleted = 0";

        $conditions = [];
        $bindParams = [];

        if (!empty($search)) {
            $conditions[] = "(so.saleorder_no LIKE :search OR c.company LIKE :search OR q.quotation_no LIKE :search)";
            $bindParams[':search'] = "%{$search}%";
        }

        if (!empty($status)) {
            $conditions[] = "so.status = :status";
            $bindParams[':status'] = $status;
        }

        if (!empty($conditions)) {
            $whereClause = " AND " . implode(" AND ", $conditions);
            $query .= $whereClause;
            $countQuery .= $whereClause;
        }

        // Map sortBy to actual column names
        $sortColumnMap = [
            'created_at' => 'so.created_at',
            'so_date' => 'so.date',
            'so_number' => 'so.saleorder_no',
            'company' => 'c.company',
            'quotation_no' => 'q.quotation_no',
            'total_amount' => 'so.overall_total_amt',
            'status' => 'so.status',
            'created_by_name' => 'u.username'
        ];
        
        $sortColumn = $sortColumnMap[$sortBy] ?? 'so.created_at';
        $query .= " ORDER BY {$sortColumn} {$sortOrder} LIMIT :limit OFFSET :offset";

        // Get total count
        $countStmt = $this->db->prepare($countQuery);
        foreach ($bindParams as $key => $value) {
            $countStmt->bindValue($key, $value);
        }
        $countStmt->execute();
        $totalItems = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

        // Get data
        $stmt = $this->db->prepare($query);
        foreach ($bindParams as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        $stmt->execute();

        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $totalPages = ceil($totalItems / $limit);

        return [
            'data' => $data,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => $totalPages,
                'total_items' => $totalItems,
                'items_per_page' => $limit
            ]
        ];
    }

    public function getById($id) {
        $query = "SELECT 
                    so.*,
                    c.company as company_name,
                    q.quotation_no,
                    q.grand_total,
                    bc.bc_name as billing_company
                  FROM {$this->table_name} so
                  LEFT JOIN quotations q ON so.quotation_id = q.id
                  LEFT JOIN contacts c ON so.contact_id = c.ld_id
                  LEFT JOIN bill_company bc ON so.bc_id = bc.bc_id
                  WHERE so.id = :id";

        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();

        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function create($data) {
        try {
            $this->db->beginTransaction();
            
            // Generate SO number
            $soNumber = $this->generateSONumber();
            
            $query = "INSERT INTO {$this->table_name} 
                      (so_number, quotation_id, so_date, bill_cycle_id, from_date, to_date, notes, status, created_by, created_at) 
                      VALUES (:so_number, :quotation_id, :so_date, :bill_cycle_id, :from_date, :to_date, :notes, :status, :created_by, NOW())";

            $stmt = $this->db->prepare($query);
            
            $stmt->bindParam(':so_number', $soNumber);
            $stmt->bindParam(':quotation_id', $data['quotation_id']);
            $stmt->bindParam(':so_date', $data['so_date']);
            $stmt->bindParam(':bill_cycle_id', $data['bill_cycle_id']);
            $stmt->bindParam(':from_date', $data['from_date']);
            $stmt->bindParam(':to_date', $data['to_date']);
            $stmt->bindParam(':notes', $data['notes']);
            $stmt->bindParam(':status', $data['status']);
            $stmt->bindParam(':created_by', $data['created_by']);
            
            if (!$stmt->execute()) {
                throw new Exception('Failed to create sale order');
            }
            
            $saleOrderId = $this->db->lastInsertId();
            
            // Create sale order details if services are provided
            if (!empty($data['services'])) {
                require_once __DIR__ . '/SaleOrderDetails.php';
                $saleOrderDetails = new SaleOrderDetails();
                
                if (!$saleOrderDetails->createMultiple($saleOrderId, $data['services'])) {
                    throw new Exception('Failed to create sale order details');
                }
            }
            
            $this->db->commit();
            return $saleOrderId;
        } catch (Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }

    public function update($id, $data) {
        $query = "UPDATE {$this->table_name} 
                  SET quotation_id = :quotation_id, so_date = :so_date, bill_cycle_id = :bill_cycle_id, 
                      from_date = :from_date, to_date = :to_date, notes = :notes, status = :status, 
                      updated_by = :updated_by, updated_at = NOW()
                  WHERE id = :id";

        $stmt = $this->db->prepare($query);
        
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':quotation_id', $data['quotation_id']);
        $stmt->bindParam(':so_date', $data['so_date']);
        $stmt->bindParam(':bill_cycle_id', $data['bill_cycle_id']);
        $stmt->bindParam(':from_date', $data['from_date']);
        $stmt->bindParam(':to_date', $data['to_date']);
        $stmt->bindParam(':notes', $data['notes']);
        $stmt->bindParam(':status', $data['status']);
        $stmt->bindParam(':updated_by', $data['updated_by']);

        return $stmt->execute();
    }

    public function delete($id) {
        $query = "DELETE FROM {$this->table_name} WHERE id = :id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':id', $id);
        return $stmt->execute();
    }

    private function generateSONumber() {
        $year = date('Y');
        $month = date('m');
        
        // Get the last SO number for this year and month
        $query = "SELECT so_number FROM {$this->table_name} 
                  WHERE so_number LIKE :pattern 
                  ORDER BY so_number DESC LIMIT 1";
        
        $pattern = "SO{$year}{$month}%";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':pattern', $pattern);
        $stmt->execute();
        
        $lastNumber = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($lastNumber) {
            // Extract the number part and increment
            $lastNum = intval(substr($lastNumber['so_number'], -4));
            $newNum = $lastNum + 1;
        } else {
            $newNum = 1;
        }
        
        return "SO{$year}{$month}" . str_pad($newNum, 4, '0', STR_PAD_LEFT);
    }
}
?>