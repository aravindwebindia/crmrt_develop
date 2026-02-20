import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axiosConfig';
import { toast } from 'react-toastify';
import Sidebar from './Sidebar';
import UserDropdown from './UserDropdown';
import { useOnce } from '../hooks/useOnce';
import { 
  Plus,
  Edit,
  Trash2,
  ArrowLeft
} from 'lucide-react';

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [errors, setErrors] = useState({});
  const [emailInputRef, setEmailInputRef] = useState(null);
  const [usernameInputRef, setUsernameInputRef] = useState(null);

  useOnce(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users.php');
      
      if (response.data.success) {
        setUsers(response.data.data);
      } else {
        console.error('API returned success: false', response.data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({}); // Clear previous errors
    
    try {
      const url = editingUser ? `/users.php/${editingUser.id}` : '/users.php';
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await api({
        method,
        url,
        data: formData
      });
      
      if (response.data.success) {
        toast.success(editingUser ? 'User updated successfully' : 'User created successfully');
        setShowModal(false);
        setEditingUser(null);
        setFormData({ username: '', email: '', password: '', role: 'user' });
        setErrors({});
        fetchUsers();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Operation failed';
      
      // Check if it's a username duplicate error
      if (errorMessage.includes('Username already exists')) {
        setErrors({ username: errorMessage });
        // Focus on username field
        if (usernameInputRef) {
          usernameInputRef.focus();
        }
        toast.error(errorMessage);
      }
      // Check if it's an email duplicate error
      else if (errorMessage.includes('Email already exists')) {
        setErrors({ email: errorMessage });
        // Focus on email field
        if (emailInputRef) {
          emailInputRef.focus();
        }
        toast.error(errorMessage);
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role
    });
    setErrors({});
    setShowModal(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const response = await api.delete(`/users.php/${userId}`);
      
      if (response.data.success) {
        toast.success('User deleted successfully');
        fetchUsers();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };


  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-container" style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc'
    }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="main-content" style={{ flex: 1, padding: '2rem' }}>
        {/* Header with User Dropdown */}
        <div className="header-section" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '2rem' 
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.5rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                  cursor: 'pointer',
                  marginRight: '1rem'
                }}
              >
                <ArrowLeft size={20} />
              </button>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: '#1f2937'
              }}>
                User Management
              </h2>
            </div>
            <p style={{ color: '#6b7280' }}>
              Manage users and their roles in the system.
            </p>
          </div>
          <div className="user-dropdown">
            <UserDropdown />
          </div>
        </div>

        {/* Add User Button */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => {
              setEditingUser(null);
              setFormData({ username: '', email: '', password: '', role: 'user' });
              setErrors({});
              setShowModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <Plus size={20} style={{ marginRight: '0.5rem' }} />
            Add User
          </button>
        </div>

        {/* Users Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Username
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Email
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Role
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Created
                </th>
                <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#1f2937' }}>
                    {user.username}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#1f2937' }}>
                    {user.email}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      backgroundColor: user.role === 'admin' ? '#fef2f2' : '#f0f9ff',
                      color: user.role === 'admin' ? '#dc2626' : '#0ea5e9'
                    }}>
                      {user.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleEdit(user)}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#f3f4f6',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          color: '#374151'
                        }}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#fef2f2',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          color: '#dc2626'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '0.75rem',
            width: '100%',
            maxWidth: '500px',
            margin: '1rem'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '1.5rem'
            }}>
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => {
                    setFormData({ ...formData, username: e.target.value });
                    // Clear username error when user types
                    if (errors.username) {
                      setErrors({ ...errors, username: '' });
                    }
                  }}
                  ref={(el) => setUsernameInputRef(el)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${errors.username ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    backgroundColor: errors.username ? '#fef2f2' : 'white'
                  }}
                />
                {errors.username && (
                  <div style={{
                    color: '#dc2626',
                    fontSize: '0.75rem',
                    marginTop: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <span>⚠️</span>
                    {errors.username}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Email
                </label>
                <input
                  ref={setEmailInputRef}
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    // Clear email error when user types
                    if (errors.email) {
                      setErrors({ ...errors, email: '' });
                    }
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${errors.email ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    backgroundColor: errors.email ? '#fef2f2' : 'white'
                  }}
                />
                {errors.email && (
                  <div style={{
                    color: '#dc2626',
                    fontSize: '0.75rem',
                    marginTop: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <span>⚠️</span>
                    {errors.email}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Password {editingUser && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setErrors({});
                    setEditingUser(null);
                    setFormData({ username: '', email: '', password: '', role: 'user' });
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  {editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
