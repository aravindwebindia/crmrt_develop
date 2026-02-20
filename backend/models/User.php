<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/jwt.php';

class User {
    private $conn;
    private $table_name = "users";
    
    public $id;
    public $username;
    public $email;
    public $password;
    public $role;
    public $profile_image;
    public $first_name;
    public $last_name;
    public $phone;
    public $created_at;
    public $updated_at;
    
    public function __construct($db) {
        $this->conn = $db;
    }
    
    public function login($username, $password) {
        $query = "SELECT id, username, email, password, role, profile_image, first_name, last_name, phone FROM " . $this->table_name . " 
                  WHERE username = :username OR email = :username";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':username', $username);
        $stmt->execute();
        
        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (password_verify($password, $row['password'])) {
                $this->id = $row['id'];
                $this->username = $row['username'];
                $this->email = $row['email'];
                $this->role = $row['role'];
                $this->profile_image = $row['profile_image'];
                $this->first_name = $row['first_name'];
                $this->last_name = $row['last_name'];
                $this->phone = $row['phone'];
                
                return true;
            }
        }
        
        return false;
    }
    
    public function create() {
        $query = "INSERT INTO " . $this->table_name . " 
                  SET username=:username, email=:email, password=:password, role=:role";
        
        $stmt = $this->conn->prepare($query);
        
        $this->username = htmlspecialchars(strip_tags($this->username));
        $this->email = htmlspecialchars(strip_tags($this->email));
        $this->password = password_hash($this->password, PASSWORD_DEFAULT);
        $this->role = htmlspecialchars(strip_tags($this->role));
        
        $stmt->bindParam(':username', $this->username);
        $stmt->bindParam(':email', $this->email);
        $stmt->bindParam(':password', $this->password);
        $stmt->bindParam(':role', $this->role);
        
        if ($stmt->execute()) {
            $this->id = $this->conn->lastInsertId();
            return true;
        }
        
        return false;
    }
    
    public function getAll() {
        $query = "SELECT id, username, email, role, created_at FROM " . $this->table_name . " ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        
        return $stmt;
    }
    
    public function getById($id) {
        $query = "SELECT id, username, email, role, created_at FROM " . $this->table_name . " WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $this->id = $row['id'];
            $this->username = $row['username'];
            $this->email = $row['email'];
            $this->role = $row['role'];
            $this->created_at = $row['created_at'];
            return true;
        }
        
        return false;
    }
    
    public function update() {
        // Check if password is provided and not empty
        $includePassword = !empty($this->password);
        
        if ($includePassword) {
            $query = "UPDATE " . $this->table_name . " 
                      SET username=:username, email=:email, password=:password, role=:role 
                      WHERE id=:id";
        } else {
            $query = "UPDATE " . $this->table_name . " 
                      SET username=:username, email=:email, role=:role 
                      WHERE id=:id";
        }
        
        $stmt = $this->conn->prepare($query);
        
        $this->username = htmlspecialchars(strip_tags($this->username));
        $this->email = htmlspecialchars(strip_tags($this->email));
        $this->role = htmlspecialchars(strip_tags($this->role));
        
        $stmt->bindParam(':username', $this->username);
        $stmt->bindParam(':email', $this->email);
        $stmt->bindParam(':role', $this->role);
        $stmt->bindParam(':id', $this->id);
        
        if ($includePassword) {
            $this->password = password_hash($this->password, PASSWORD_DEFAULT);
            $stmt->bindParam(':password', $this->password);
        }
        
        return $stmt->execute();
    }
    
    public function delete() {
        $query = "DELETE FROM " . $this->table_name . " WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $this->id);
        
        return $stmt->execute();
    }
    
    public function updateProfile() {
        $query = "UPDATE " . $this->table_name . " 
                  SET first_name=:first_name, last_name=:last_name, phone=:phone, profile_image=:profile_image
                  WHERE id=:id";
        
        $stmt = $this->conn->prepare($query);
        
        $this->first_name = htmlspecialchars(strip_tags($this->first_name ?? ''));
        $this->last_name = htmlspecialchars(strip_tags($this->last_name ?? ''));
        $this->phone = htmlspecialchars(strip_tags($this->phone ?? ''));
        $this->profile_image = htmlspecialchars(strip_tags($this->profile_image ?? ''));
        
        $stmt->bindParam(':first_name', $this->first_name);
        $stmt->bindParam(':last_name', $this->last_name);
        $stmt->bindParam(':phone', $this->phone);
        $stmt->bindParam(':profile_image', $this->profile_image);
        $stmt->bindParam(':id', $this->id);
        
        return $stmt->execute();
    }
    
    public function getProfile() {
        $query = "SELECT id, username, email, role, profile_image, first_name, last_name, phone, created_at, updated_at 
                  FROM " . $this->table_name . " WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $this->id);
        $stmt->execute();
        
        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $this->id = $row['id'];
            $this->username = $row['username'];
            $this->email = $row['email'];
            $this->role = $row['role'];
            $this->profile_image = $row['profile_image'];
            $this->first_name = $row['first_name'];
            $this->last_name = $row['last_name'];
            $this->phone = $row['phone'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
            return true;
        }
        
        return false;
    }
    
    // Check if email exists
    public function emailExists($email, $excludeId = null) {
        $query = "SELECT COUNT(*) FROM " . $this->table_name . " WHERE email = :email";
        $params = [':email' => $email];
        
        if ($excludeId) {
            $query .= " AND id != :exclude_id";
            $params[':exclude_id'] = $excludeId;
        }
        
        $stmt = $this->conn->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchColumn() > 0;
    }
    
    public function usernameExists($username, $excludeId = null) {
        $query = "SELECT COUNT(*) FROM " . $this->table_name . " WHERE username = :username";
        $params = [':username' => $username];
        
        if ($excludeId) {
            $query .= " AND id != :exclude_id";
            $params[':exclude_id'] = $excludeId;
        }
        
        $stmt = $this->conn->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchColumn() > 0;
    }
}
?>
