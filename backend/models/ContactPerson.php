<?php
require_once __DIR__ . '/../config/database.php';

class ContactPerson {
    private $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    // Get contact persons by contact ID
    public function getByContactId($contactId) {
        $sql = "SELECT * FROM contact_persons WHERE contact_id = ? AND status = 'active' ORDER BY contact_person";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$contactId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Get contact person by ID
    public function getById($id) {
        $sql = "SELECT * FROM contact_persons WHERE cp_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Create contact person
    public function create($data) {
        $sql = "INSERT INTO contact_persons (contact_id, contact_person, contact_mobile, contact_email, status) VALUES (?, ?, ?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        $result = $stmt->execute([
            $data['contact_id'],
            $data['contact_person'],
            $data['contact_mobile'],
            $data['contact_email'],
            $data['status']
        ]);
        
        if ($result) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    // Update contact person
    public function update($id, $data) {
        $sql = "UPDATE contact_persons SET contact_person = ?, contact_mobile = ?, contact_email = ?, status = ? WHERE cp_id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            $data['contact_person'],
            $data['contact_mobile'],
            $data['contact_email'],
            $data['status'],
            $id
        ]);
    }

    // Delete contact person
    public function delete($id) {
        $sql = "UPDATE contact_persons SET status = 'inactive' WHERE cp_id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
}
?>

