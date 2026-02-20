import React, { useState, useEffect, useRef } from 'react';
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
  ToggleLeft, 
  ToggleRight, 
  ArrowUpDown,
  Filter,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

const Services = () => {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    service_name: '',
    hsn_sac: '',
    status: 'active'
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch services
  const fetchServices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);

      const response = await api.get(`/services.php?${params.toString()}`);
      
      if (response.data.success) {
        setServices(response.data.data);
        setStats(response.data.stats);
        setTotalPages(response.data.pagination?.total_pages || 1);
        setTotalItems(response.data.pagination?.total_items || 0);
      } else {
        toast.error(response.data.message || 'Failed to fetch services');
      }
    } catch (error) {
      toast.error('Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  // Fetch services on component mount and when filters change
  useOnce(() => {
    fetchServices();
  }, []);

  // Avoid duplicate initial calls for filters
  const didMountFilters = useRef(false);
  useEffect(() => {
    if (!didMountFilters.current) {
      didMountFilters.current = true;
      return; // skip first run (handled by initial fetch)
    }
    const timeoutId = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when filters change
      fetchServices();
    }, 300); // Debounce search/filter changes
    return () => clearTimeout(timeoutId);
  }, [searchTerm, sortBy, sortOrder, statusFilter]);

  // Avoid duplicate initial call for page change
  const didMountPage = useRef(false);
  useEffect(() => {
    if (!didMountPage.current) {
      didMountPage.current = true;
      return;
    }
    fetchServices();
  }, [currentPage]);

  // Avoid duplicate initial call for items-per-page
  const didMountPerPage = useRef(false);
  useEffect(() => {
    if (!didMountPerPage.current) {
      didMountPerPage.current = true;
      return;
    }
    setCurrentPage(1); // Reset to first page when items per page changes
    fetchServices();
  }, [itemsPerPage]);

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.service_name.trim()) {
      newErrors.service_name = 'Service name is required';
    } else if (formData.service_name.trim().length < 2) {
      newErrors.service_name = 'Service name must be at least 2 characters';
    }
    
    if (!formData.hsn_sac.trim()) {
      newErrors.hsn_sac = 'HSN/SAC is required';
    } else if (!/^[0-9]{3,10}$/.test(formData.hsn_sac.trim())) {
      newErrors.hsn_sac = 'HSN/SAC must be 3-10 digits';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Real-time validation
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    
    const newErrors = { ...errors };
    
    if (field === 'service_name') {
      if (!value.trim()) {
        newErrors.service_name = 'Service name is required';
      } else if (value.trim().length < 2) {
        newErrors.service_name = 'Service name must be at least 2 characters';
      } else if (value.length > 100) {
        newErrors.service_name = 'Service name must not exceed 100 characters';
      } else {
        delete newErrors.service_name;
      }
    } else if (field === 'hsn_sac') {
      if (!value.trim()) {
        newErrors.hsn_sac = 'HSN/SAC is required';
      } else if (!/^[0-9]{3,10}$/.test(value.trim())) {
        newErrors.hsn_sac = 'HSN/SAC must be 3-10 digits';
      } else {
        delete newErrors.hsn_sac;
      }
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
        service_name: formData.service_name.trim(),
        hsn_sac: formData.hsn_sac.trim()
      };

      let response;
      if (editingService) {
        // Update service
        response = await api.put('/services.php', {
          id: editingService.id,
          ...data
        });
      } else {
        // Create service
        response = await api.post('/services.php', data);
      }

      if (response.data.success) {
        toast.success(response.data.message);
        setShowModal(false);
        setEditingService(null);
        setFormData({ service_name: '', hsn_sac: '', status: 'active' });
        setErrors({});
        fetchServices();
      } else {
        if (response.data.errors) {
          setErrors(response.data.errors);
        }
        toast.error(response.data.message || 'Operation failed');
      }
    } catch (error) {
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
      toast.error('Failed to save service');
    } finally {
      setLoading(false);
    }
  };

  // Handle edit
  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      service_name: service.service_name,
      hsn_sac: service.hsn_sac,
      status: service.status
    });
    setErrors({});
    setShowModal(true);
  };

  // Handle delete
  const handleDelete = async (service) => {
    if (window.confirm(`Are you sure you want to delete "${service.service_name}"?`)) {
      setLoading(true);
      try {
        const response = await api.delete('/services.php', {
          data: { id: service.id }
        });

        if (response.data.success) {
          toast.success(response.data.message);
          fetchServices();
        } else {
          toast.error(response.data.message || 'Failed to delete service');
        }
      } catch (error) {
        toast.error('Failed to delete service');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle status toggle
  const handleStatusToggle = async (service) => {
    setLoading(true);
    try {
      const response = await api.post('/service-status.php', {
        id: service.id
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchServices();
      } else {
        toast.error(response.data.message || 'Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  // Handle sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({ service_name: '', hsn_sac: '', status: 'active' });
    setErrors({});
    setTouched({});
    setEditingService(null);
  };

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSortBy('created_at');
    setSortOrder('DESC');
    setStatusFilter('');
    setCurrentPage(1);
    setItemsPerPage(10);
  };

  // Open modal for new service
  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="main-container" style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc'
    }}>
      {/* Sidebar */}
      <Sidebar activeItem="services" />

      {/* Main Content */}
      <div className="main-content" style={{ 
        flex: 1, 
        padding: '1rem'
      }}>
        {/* Header with User Dropdown */}
        <div className="header-section" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#1f2937',
              marginBottom: '0.5rem'
            }}>
              Services Management
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Manage your services and HSN/SAC codes
            </p>
          </div>
          <div className="user-dropdown" style={{ flexShrink: 0 }}>
            <UserDropdown />
          </div>
        </div>

        {/* Search and Filters */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '2rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '400px' }}>
            <Search style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
              width: '1.25rem',
              height: '1.25rem'
            }} />
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
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
          {(searchTerm || statusFilter || sortBy !== 'created_at' || sortOrder !== 'DESC' || itemsPerPage !== 10) && (
            <button
              onClick={clearFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              <X size={16} style={{ marginRight: '0.5rem' }} />
              Clear
            </button>
          )}

          {/* Add Service Button */}
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
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <Plus size={20} style={{ marginRight: '0.5rem' }} />
            Add Service
          </button>
        </div>

        {/* Services Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          overflow: 'auto'
        }}>
          <div style={{ 
            minWidth: '100%',
            overflowX: 'auto'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              minWidth: '600px'
            }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ 
                  padding: '0.75rem 0.5rem', 
                  textAlign: 'center', 
                  fontSize: '0.75rem', 
                  fontWeight: '500', 
                  color: '#374151', 
                  width: '50px',
                  minWidth: '50px'
                }}>
                  #
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  <button
                    onClick={() => handleSort('service_name')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151'
                    }}
                  >
                    Service Name
                    {sortBy === 'service_name' ? (
                      sortOrder === 'ASC' ? <ChevronUp size={16} style={{ marginLeft: '0.25rem' }} /> : <ChevronDown size={16} style={{ marginLeft: '0.25rem' }} />
                    ) : (
                      <ArrowUpDown size={16} style={{ marginLeft: '0.25rem', opacity: 0.5 }} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  <button
                    onClick={() => handleSort('hsn_sac')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151'
                    }}
                  >
                    HSN/SAC
                    {sortBy === 'hsn_sac' ? (
                      sortOrder === 'ASC' ? <ChevronUp size={16} style={{ marginLeft: '0.25rem' }} /> : <ChevronDown size={16} style={{ marginLeft: '0.25rem' }} />
                    ) : (
                      <ArrowUpDown size={16} style={{ marginLeft: '0.25rem', opacity: 0.5 }} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  <button
                    onClick={() => handleSort('status')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151'
                    }}
                  >
                    Status
                    {sortBy === 'status' ? (
                      sortOrder === 'ASC' ? <ChevronUp size={16} style={{ marginLeft: '0.25rem' }} /> : <ChevronDown size={16} style={{ marginLeft: '0.25rem' }} />
                    ) : (
                      <ArrowUpDown size={16} style={{ marginLeft: '0.25rem', opacity: 0.5 }} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  <button
                    onClick={() => handleSort('created_at')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151'
                    }}
                  >
                    Created
                    {sortBy === 'created_at' ? (
                      sortOrder === 'ASC' ? <ChevronUp size={16} style={{ marginLeft: '0.25rem' }} /> : <ChevronDown size={16} style={{ marginLeft: '0.25rem' }} />
                    ) : (
                      <ArrowUpDown size={16} style={{ marginLeft: '0.25rem', opacity: 0.5 }} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    Loading services...
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    No services found
                  </td>
                </tr>
              ) : (
                services.map((service, index) => (
                  <tr key={service.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ 
                      padding: '0.75rem 0.5rem', 
                      textAlign: 'center', 
                      fontSize: '0.75rem', 
                      color: '#6b7280', 
                      fontWeight: '500' 
                    }}>
                      {((currentPage - 1) * itemsPerPage) + index + 1}
                    </td>
                    <td style={{ 
                      padding: '0.75rem 0.5rem', 
                      fontSize: '0.875rem', 
                      color: '#1f2937',
                      wordBreak: 'break-word'
                    }}>
                      {service.service_name}
                    </td>
                    <td style={{ 
                      padding: '0.75rem 0.5rem', 
                      fontSize: '0.875rem', 
                      color: '#1f2937' 
                    }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        fontFamily: 'monospace',
                        display: 'inline-block'
                      }}>
                        {service.hsn_sac}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <button
                        onClick={() => handleStatusToggle(service)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: service.status === 'active' ? '#f0f9ff' : '#fef2f2',
                          color: service.status === 'active' ? '#0ea5e9' : '#dc2626',
                          border: 'none',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {service.status.toUpperCase()}
                      </button>
                    </td>
                    <td style={{ 
                      padding: '0.75rem 0.5rem', 
                      fontSize: '0.75rem', 
                      color: '#6b7280',
                      whiteSpace: 'nowrap'
                    }}>
                      {new Date(service.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ 
                      padding: '0.75rem 0.5rem', 
                      textAlign: 'right' 
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        gap: '0.25rem', 
                        justifyContent: 'flex-end',
                        flexWrap: 'nowrap'
                      }}>
                        <button
                          onClick={() => handleEdit(service)}
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
                          title="Edit service"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(service)}
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
                          title="Delete service"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280',
              textAlign: 'center',
              flex: '1',
              minWidth: '200px'
            }}>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} services
            </div>

            {/* Items per page dropdown */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              marginRight: '1rem'
            }}>
              <label style={{ 
                fontSize: '0.875rem', 
                color: '#374151',
                whiteSpace: 'nowrap'
              }}>
                Show:
              </label>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  backgroundColor: 'white',
                  minWidth: '70px'
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span style={{ 
                fontSize: '0.875rem', 
                color: '#6b7280',
                whiteSpace: 'nowrap'
              }}>
                per page
              </span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
              flex: '1',
              minWidth: '200px'
            }}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.5rem',
                  backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
                  color: currentPage === 1 ? '#9ca3af' : '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                <ChevronLeft size={16} />
              </button>

              {/* Page Numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => {
                      handlePageChange(pageNum);
                    }}
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: currentPage === pageNum ? '#3b82f6' : 'white',
                      color: currentPage === pageNum ? 'white' : '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: currentPage === pageNum ? '500' : '400'
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.5rem',
                  backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
                  color: currentPage === totalPages ? '#9ca3af' : '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

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
                {editingService ? 'Edit Service' : 'Add New Service'}
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
                    Service Name
                  </label>
                  <input
                    type="text"
                    value={formData.service_name}
                    onChange={(e) => handleFieldChange('service_name', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, service_name: true }))}
                    maxLength={100}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${errors.service_name ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: errors.service_name ? '#fef2f2' : 'white'
                    }}
                  />
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.25rem',
                    fontSize: '0.75rem',
                    color: formData.service_name.length > 90 ? '#dc2626' : '#6b7280'
                  }}>
                    <span>
                      {formData.service_name.length > 90 && (
                        <span style={{ color: '#dc2626', marginRight: '0.25rem' }}>⚠️</span>
                      )}
                      {formData.service_name.length > 90 ? 'Character limit approaching' : 'Service name'}
                    </span>
                    <span style={{ 
                      color: formData.service_name.length > 90 ? '#dc2626' : '#6b7280',
                      fontWeight: formData.service_name.length > 90 ? '500' : 'normal'
                    }}>
                      {formData.service_name.length}/100
                    </span>
                  </div>
                  {errors.service_name && touched.service_name && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginTop: '0.25rem',
                      fontSize: '0.75rem',
                      color: '#dc2626'
                    }}>
                      <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                      {errors.service_name}
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
                    HSN/SAC Code
                  </label>
                  <input
                    type="text"
                    value={formData.hsn_sac}
                    onChange={(e) => handleFieldChange('hsn_sac', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, hsn_sac: true }))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${errors.hsn_sac ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      fontFamily: 'monospace',
                      backgroundColor: errors.hsn_sac ? '#fef2f2' : 'white'
                    }}
                  />
                  {errors.hsn_sac && touched.hsn_sac && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginTop: '0.25rem',
                      fontSize: '0.75rem',
                      color: '#dc2626'
                    }}>
                      <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                      {errors.hsn_sac}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
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
                    {loading ? 'Saving...' : (editingService ? 'Update' : 'Create')}
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

export default Services;
