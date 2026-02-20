import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useOnce } from '../hooks/useOnce';
import api from '../utils/axiosConfig';
import Sidebar from './Sidebar';
import UserDropdown from './UserDropdown';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ArrowUpDown,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

const Tax = () => {
  const { user } = useAuth();
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('tax_name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Modal and form states
  const [showModal, setShowModal] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [formData, setFormData] = useState({
    tax_name: '',
    igst: '',
    cgst: '',
    sgst: '',
    status: 'active'
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Fetch taxes
  const fetchTaxes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);

      const response = await api.get(`/tax.php?${params}`);
      if (response.data.success) {
        setTaxes(response.data.data);
        setTotalPages(response.data.pagination.total_pages);
        setTotalItems(response.data.pagination.total_items);
      }
    } catch (error) {
      console.error('Error fetching taxes:', error);
      toast.error('Failed to fetch taxes');
    } finally {
      setLoading(false);
    }
  };

  // Fetch taxes on component mount
  useOnce(() => {
    fetchTaxes();
  }, []);

  // Fetch taxes when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchTaxes();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, sortBy, sortOrder, statusFilter, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSortBy('tax_name');
    setSortOrder('ASC');
    setStatusFilter('');
    setCurrentPage(1);
    setItemsPerPage(10);
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.tax_name.trim()) {
      newErrors.tax_name = 'This is required field';
    }
    
    if (!formData.status) {
      newErrors.status = 'This is required field';
    }
    
    // At least one tax rate should be provided
    if (!formData.igst && !formData.cgst && !formData.sgst) {
      newErrors.tax_rates = 'At least one tax rate (IGST, CGST, or SGST) is required';
    }
    
    // Validate tax rates are numeric and positive
    if (formData.igst && (!/^\d*\.?\d+$/.test(formData.igst) || parseFloat(formData.igst) < 0)) {
      newErrors.igst = 'IGST must be a valid positive number';
    }
    if (formData.cgst && (!/^\d*\.?\d+$/.test(formData.cgst) || parseFloat(formData.cgst) < 0)) {
      newErrors.cgst = 'CGST must be a valid positive number';
    }
    if (formData.sgst && (!/^\d*\.?\d+$/.test(formData.sgst) || parseFloat(formData.sgst) < 0)) {
      newErrors.sgst = 'SGST must be a valid positive number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Real-time validation
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    
    const newErrors = { ...errors };
    
    if (field === 'tax_name') {
      if (!value.trim()) {
        newErrors.tax_name = 'This is required field';
      } else {
        delete newErrors.tax_name;
      }
    } else if (field === 'status') {
      if (!value) {
        newErrors.status = 'This is required field';
      } else {
        delete newErrors.status;
      }
    } else if (field === 'igst' || field === 'cgst' || field === 'sgst') {
      if (value && (!/^\d*\.?\d+$/.test(value) || parseFloat(value) < 0)) {
        newErrors[field] = `${field.toUpperCase()} must be a valid positive number`;
      } else {
        delete newErrors[field];
      }
    }
    
    // Check if at least one tax rate is provided
    const { igst, cgst, sgst } = { ...formData, [field]: value };
    if (!igst && !cgst && !sgst) {
      newErrors.tax_rates = 'At least one tax rate (IGST, CGST, or SGST) is required';
    } else {
      delete newErrors.tax_rates;
    }
    
    setErrors(newErrors);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setLoading(true);
    try {
      const data = {
        ...formData,
        tax_name: formData.tax_name.trim(),
        igst: formData.igst ? parseFloat(formData.igst) : null,
        cgst: formData.cgst ? parseFloat(formData.cgst) : null,
        sgst: formData.sgst ? parseFloat(formData.sgst) : null
      };

      let response;
      if (editingTax) {
        // Update tax
        response = await api.put('/tax.php', {
          id: editingTax.tax_id,
          ...data
        });
      } else {
        // Create tax
        response = await api.post('/tax.php', data);
      }

      if (response.data.success) {
        toast.success(response.data.message);
        fetchTaxes();
        closeModal();
      } else {
        toast.error(response.data.message || 'Failed to save tax');
      }
    } catch (error) {
      console.error('Error saving tax:', error);
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
        toast.error('Please fix the validation errors');
      } else {
        toast.error('Failed to save tax');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      tax_name: '',
      igst: '',
      cgst: '',
      sgst: '',
      status: 'active'
    });
    setErrors({});
    setTouched({});
  };

  // Open modal for new tax
  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    resetForm();
    setEditingTax(null);
  };

  // Handle edit tax
  const handleEdit = (tax) => {
    setEditingTax(tax);
    setFormData({
      tax_name: tax.tax_name || '',
      igst: tax.igst || '',
      cgst: tax.cgst || '',
      sgst: tax.sgst || '',
      status: tax.status || 'active'
    });
    setErrors({});
    setTouched({});
    setShowModal(true);
  };

  // Handle delete tax
  const handleDelete = async (tax) => {
    if (window.confirm(`Are you sure you want to delete "${tax.tax_name}"?`)) {
      setLoading(true);
      try {
        const response = await api.delete('/tax.php', {
          data: { id: tax.tax_id }
        });

        if (response.data.success) {
          toast.success(response.data.message);
          fetchTaxes();
        } else {
          toast.error(response.data.message || 'Failed to delete tax');
        }
      } catch (error) {
        console.error('Error deleting tax:', error);
        toast.error('Failed to delete tax');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle status toggle
  const handleStatusToggle = async (tax) => {
    setLoading(true);
    try {
      const response = await api.post('/tax-status.php', {
        id: tax.tax_id
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchTaxes();
      } else {
        toast.error(response.data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return <ArrowUpDown size={14} />;
    return sortOrder === 'ASC' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar />
      
      <div style={{ flex: 1, padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
              Tax Management
            </h1>
            <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>
              Manage tax rates and configurations
            </p>
          </div>
          <UserDropdown />
        </div>

        {/* Search and Filter Section */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1.5rem', 
          borderRadius: '0.75rem', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={20} style={{ 
                position: 'absolute', 
                left: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#9ca3af' 
              }} />
              <input
                type="text"
                placeholder="Search taxes..."
                value={searchTerm}
                onChange={handleSearch}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              minWidth: '120px'
            }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Clear Filters
          </button>

          {/* Add Tax Button */}
          <button
            onClick={openModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            <Plus size={16} style={{ marginRight: '0.5rem' }} />
            Add Tax
          </button>
        </div>

        {/* Tax Table */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '0.75rem', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'center', 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    width: '60px'
                  }}>
                    S.No
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'left', 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('tax_name')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Tax Name {getSortIcon('tax_name')}
                    </div>
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'left', 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('igst')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      IGST % {getSortIcon('igst')}
                    </div>
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'left', 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('cgst')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      CGST % {getSortIcon('cgst')}
                    </div>
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'left', 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('sgst')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      SGST % {getSortIcon('sgst')}
                    </div>
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'left', 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('status')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Status {getSortIcon('status')}
                    </div>
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'left', 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('created_at')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Created {getSortIcon('created_at')}
                    </div>
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'center', 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      Loading...
                    </td>
                  </tr>
                ) : taxes.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      No taxes found
                    </td>
                  </tr>
                ) : taxes && taxes.length > 0 ? (
                  taxes.map((tax, index) => (
                    <tr key={tax.tax_id} style={{ 
                      borderBottom: '1px solid #e5e7eb',
                      '&:hover': { backgroundColor: '#f9fafb' }
                    }}>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#6b7280' }}>
                        {((currentPage - 1) * itemsPerPage) + index + 1}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: '500', color: '#1f2937' }}>
                          {tax.tax_name || 'Unknown Tax'}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280' }}>
                        {tax.igst ? `${tax.igst}%` : '-'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280' }}>
                        {tax.cgst ? `${tax.cgst}%` : '-'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280' }}>
                        {tax.sgst ? `${tax.sgst}%` : '-'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <button
                          onClick={() => handleStatusToggle(tax)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            backgroundColor: tax.status === 'active' ? '#f0f9ff' : '#fef2f2',
                            color: tax.status === 'active' ? '#0ea5e9' : '#dc2626',
                            border: 'none',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {(tax.status || 'unknown').toUpperCase()}
                        </button>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280' }}>
                        {tax.created_at ? new Date(tax.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEdit(tax)}
                            style={{
                              padding: '0.375rem',
                              backgroundColor: '#f3f4f6',
                              border: 'none',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              color: '#374151',
                              minWidth: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Edit tax"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(tax)}
                            style={{
                              padding: '0.375rem',
                              backgroundColor: '#fef2f2',
                              border: 'none',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              color: '#dc2626',
                              minWidth: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Delete tax"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      No taxes available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ 
              padding: '1rem', 
              borderTop: '1px solid #e5e7eb', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
                </span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    backgroundColor: currentPage === 1 ? '#f9fafb' : 'white',
                    color: currentPage === 1 ? '#9ca3af' : '#374151',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        backgroundColor: currentPage === page ? '#3b82f6' : 'white',
                        color: currentPage === page ? 'white' : '#374151',
                        cursor: 'pointer'
                      }}
                    >
                      {page}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white',
                    color: currentPage === totalPages ? '#9ca3af' : '#374151',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
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
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '2rem',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative'
            }}>
              {/* Close button (X) in top right corner */}
              <button
                onClick={closeModal}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '0.25rem'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#f3f4f6';
                  e.target.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#6b7280';
                }}
                title="Close"
              >
                ×
              </button>

              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '1.5rem',
                paddingRight: '3rem' // Add padding to prevent overlap with X button
              }}>
                {editingTax ? 'Edit Tax' : 'Add New Tax'}
              </h3>

              <form onSubmit={handleSubmit}>
                {/* Tax Name */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Tax Name *
                  </label>
                  <input
                    type="text"
                    value={formData.tax_name}
                    onChange={(e) => handleFieldChange('tax_name', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, tax_name: true }))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${errors.tax_name ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: errors.tax_name ? '#fef2f2' : 'white'
                    }}
                    placeholder="Enter tax name (e.g., GST 18%)"
                  />
                  {errors.tax_name && touched.tax_name && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginTop: '0.25rem',
                      fontSize: '0.75rem',
                      color: '#dc2626'
                    }}>
                      <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                      {errors.tax_name}
                    </div>
                  )}
                </div>

                {/* Tax Rates */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '1rem', 
                  marginBottom: '1rem' 
                }}>
                  {/* IGST */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      IGST %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.igst}
                      onChange={(e) => handleFieldChange('igst', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, igst: true }))}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${errors.igst ? '#dc2626' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: errors.igst ? '#fef2f2' : 'white'
                      }}
                      placeholder="0.00"
                    />
                    {errors.igst && touched.igst && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#dc2626'
                      }}>
                        <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                        {errors.igst}
                      </div>
                    )}
                  </div>

                  {/* CGST */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      CGST %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cgst}
                      onChange={(e) => handleFieldChange('cgst', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, cgst: true }))}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${errors.cgst ? '#dc2626' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: errors.cgst ? '#fef2f2' : 'white'
                      }}
                      placeholder="0.00"
                    />
                    {errors.cgst && touched.cgst && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#dc2626'
                      }}>
                        <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                        {errors.cgst}
                      </div>
                    )}
                  </div>

                  {/* SGST */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      SGST %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.sgst}
                      onChange={(e) => handleFieldChange('sgst', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, sgst: true }))}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${errors.sgst ? '#dc2626' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: errors.sgst ? '#fef2f2' : 'white'
                      }}
                      placeholder="0.00"
                    />
                    {errors.sgst && touched.sgst && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#dc2626'
                      }}>
                        <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                        {errors.sgst}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tax Rates Error */}
                {errors.tax_rates && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    fontSize: '0.75rem',
                    color: '#dc2626'
                  }}>
                    <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                    {errors.tax_rates}
                  </div>
                )}

                {/* Status */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, status: true }))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${errors.status ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: errors.status ? '#fef2f2' : 'white'
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  {errors.status && touched.status && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginTop: '0.25rem',
                      fontSize: '0.75rem',
                      color: '#dc2626'
                    }}>
                      <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                      {errors.status}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={closeModal}
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
                    disabled={loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? 'Saving...' : (editingTax ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tax;
