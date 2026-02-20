import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import api from '../utils/axiosConfig';
import Sidebar from './Sidebar';
import UserDropdown from './UserDropdown';
import RecurringInvoiceView from './RecurringInvoiceView';
import { 
  Search, 
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  Clock
} from 'lucide-react';
import { useOnce } from '../hooks/useOnce';

const RecurringInvoice = () => {
  const { user } = useAuth();
  const [recurringInvoices, setRecurringInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('bill_to_date');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedRecurringInvoice, setSelectedRecurringInvoice] = useState(null);

  // Fetch recurring invoices
  const fetchRecurringInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);

      const response = await api.get(`/recurring-invoice.php?${params}`);
      if (response.data.success) {
        setRecurringInvoices(response.data.data);
        setTotalPages(response.data.pagination.total_pages);
        setTotalItems(response.data.pagination.total_items);
      }
    } catch (error) {
      toast.error('Failed to fetch recurring invoices');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch - ensure it runs only once even in StrictMode
  useOnce(() => {
    fetchRecurringInvoices();
  }, []);

  // Subsequent fetches when filters/pagination change
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return; // skip duplicate initial call triggered by StrictMode
    }
    fetchRecurringInvoices();
  }, [currentPage, searchTerm, sortBy, sortOrder, itemsPerPage]);

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
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

  // Get sort icon
  const getSortIcon = (field) => {
    if (sortBy !== field) return <ArrowUpDown size={14} />;
    return sortOrder === 'ASC' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Handle view button click
  const handleView = (recurringInvoice) => {
    setSelectedRecurringInvoice(recurringInvoice);
    setViewModalOpen(true);
  };

  // Handle close modal
  const handleCloseModal = () => {
    setViewModalOpen(false);
    setSelectedRecurringInvoice(null);
  };

  // Handle next bill created
  const handleNextBillCreated = () => {
    fetchRecurringInvoices(); // Refresh the list
  };

  // Get due status badge
  const getDueStatusBadge = (dueStatus, daysUntilDue, overdueDays) => {
    const statusConfig = {
      'Due': { color: '#DC2626', bgColor: '#FEE2E2', text: 'Due Today' },
      'Overdue': { color: '#DC2626', bgColor: '#FEE2E2', text: `Overdue (${overdueDays} days)` },
      'Upcoming Due': { color: '#D97706', bgColor: '#FEF3C7', text: `Due in ${daysUntilDue} days` }
    };
    
    const config = statusConfig[dueStatus] || { color: '#6B7280', bgColor: '#F3F4F6', text: 'Unknown' };
    
    return (
      <span
        style={{
          padding: '0.25rem 0.5rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '500',
          color: config.color,
          backgroundColor: config.bgColor,
        }}
      >
        {config.text}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar />
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ 
          backgroundColor: 'white', 
          borderBottom: '1px solid #e5e7eb', 
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              color: '#1f2937',
              margin: 0
            }}>
              Recurring Invoice
            </h1>
            <p style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280',
              margin: '0.25rem 0 0 0'
            }}>
              Manage your recurring invoices
            </p>
          </div>
          <UserDropdown />
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '1.5rem' }}>
          {/* Filters and Search */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '0.75rem', 
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr 1fr auto', 
              gap: '1rem',
              alignItems: 'end'
            }}>
              {/* Search */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Search
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ 
                    position: 'absolute', 
                    left: '0.75rem', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }} />
                  <input
                    type="text"
                    placeholder="Search recurring invoices..."
                    value={searchTerm}
                    onChange={handleSearch}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Table */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '0.75rem', 
            overflow: 'hidden',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ 
                      padding: '1rem 0.75rem', 
                      textAlign: 'left', 
                      fontSize: '0.875rem', 
                      fontWeight: '600', 
                      color: '#374151',
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }} onClick={() => handleSort('pi_number')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        PI Number {getSortIcon('pi_number')}
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
                    }} onClick={() => handleSort('company_name')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Company {getSortIcon('company_name')}
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
                    }} onClick={() => handleSort('saleorder_no')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        SO Number {getSortIcon('saleorder_no')}
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
                    }} onClick={() => handleSort('billing_company')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Billing Company {getSortIcon('billing_company')}
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
                    }} onClick={() => handleSort('bill_to_date')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Next Due Date {getSortIcon('bill_to_date')}
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
                    }} onClick={() => handleSort('grand_total')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Total Amount {getSortIcon('grand_total')}
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
                    <tr key="loading">
                      <td colSpan="9" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ 
                            width: '2rem', 
                            height: '2rem', 
                            border: '2px solid #e5e7eb', 
                            borderTop: '2px solid #3b82f6', 
                            borderRadius: '50%', 
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1rem'
                          }}></div>
                          Loading recurring invoices...
                        </div>
                      </td>
                    </tr>
                  ) : recurringInvoices.length === 0 ? (
                    <tr key="empty">
                      <td colSpan="9" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                        <div style={{ textAlign: 'center' }}>
                          <Clock size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                          <h3 style={{ fontSize: '1.125rem', fontWeight: '500', margin: '0 0 0.5rem 0' }}>
                            No recurring invoices found
                          </h3>
                          <p style={{ fontSize: '0.875rem', margin: 0 }}>
                            No recurring invoices are due within the next 30 days.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recurringInvoices.map((recurringInvoice, index) => (
                      <tr key={recurringInvoice.id} style={{ 
                        borderBottom: '1px solid #f3f4f6',
                        transition: 'background-color 0.2s'
                      }}>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: '500', color: '#1f2937' }}>
                            {recurringInvoice.pi_number}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: '500', color: '#1f2937' }}>
                            {recurringInvoice.company_name}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ color: '#6b7280' }}>
                            {recurringInvoice.saleorder_no || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ color: '#6b7280' }}>
                            {recurringInvoice.billing_company || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ color: '#6b7280' }}>
                            {formatDate(recurringInvoice.bill_to_date_plus_one)}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {getDueStatusBadge(recurringInvoice.due_status, recurringInvoice.days_until_due, recurringInvoice.overdue_days)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}>
                            <button
                              onClick={() => handleView(recurringInvoice)}
                              style={{
                                padding: '0.5rem',
                                backgroundColor: '#f0f9ff',
                                border: 'none',
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s'
                              }}
                              title="View"
                            >
                              <Eye size={14} color="#3b82f6" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ 
                padding: window.innerWidth <= 768 ? '0.75rem' : '1rem', 
                borderTop: '1px solid #e5e7eb', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                gap: window.innerWidth <= 768 ? '1rem' : '0'
              }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  textAlign: window.innerWidth <= 768 ? 'center' : 'left'
                }}>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
                </div>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    color: '#374151',
                    minWidth: '80px'
                  }}
                >
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  justifyContent: window.innerWidth <= 768 ? 'center' : 'flex-end'
                }}>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: window.innerWidth <= 768 ? '0.75rem' : '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: currentPage === 1 ? '#f9fafb' : 'white',
                      color: currentPage === 1 ? '#9ca3af' : '#374151',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      minWidth: window.innerWidth <= 768 ? '40px' : 'auto'
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  {(() => {
                    const maxButtons = window.innerWidth <= 768 ? 3 : 5;
                    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
                    let endPage = startPage + maxButtons - 1;
                    if (endPage > totalPages) {
                      endPage = totalPages;
                      startPage = Math.max(1, endPage - maxButtons + 1);
                    }
                    const pages = [];

                    // Optional: First page shortcut when window is shifted
                    if (startPage > 1) {
                      pages.push(
                        <button
                          key={1}
                          onClick={() => handlePageChange(1)}
                          style={{
                            padding: window.innerWidth <= 768 ? '0.75rem' : '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            backgroundColor: currentPage === 1 ? '#3b82f6' : 'white',
                            color: currentPage === 1 ? 'white' : '#374151',
                            cursor: 'pointer',
                            minWidth: window.innerWidth <= 768 ? '40px' : 'auto',
                            fontSize: window.innerWidth <= 768 ? '0.875rem' : '0.875rem'
                          }}
                        >
                          1
                        </button>
                      );
                      if (startPage > 2) {
                        pages.push(<span key="start-ellipsis">...</span>);
                      }
                    }

                    for (let p = startPage; p <= endPage; p++) {
                      pages.push(
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          style={{
                            padding: window.innerWidth <= 768 ? '0.75rem' : '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            backgroundColor: currentPage === p ? '#3b82f6' : 'white',
                            color: currentPage === p ? 'white' : '#374151',
                            cursor: 'pointer',
                            minWidth: window.innerWidth <= 768 ? '40px' : 'auto',
                            fontSize: window.innerWidth <= 768 ? '0.875rem' : '0.875rem'
                          }}
                        >
                          {p}
                        </button>
                      );
                    }

                    if (endPage < totalPages) {
                      if (endPage < totalPages - 1) {
                        pages.push(<span key="end-ellipsis">...</span>);
                      }
                      pages.push(
                        <button
                          key={totalPages}
                          onClick={() => handlePageChange(totalPages)}
                          style={{
                            padding: window.innerWidth <= 768 ? '0.75rem' : '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            backgroundColor: currentPage === totalPages ? '#3b82f6' : 'white',
                            color: currentPage === totalPages ? 'white' : '#374151',
                            cursor: 'pointer',
                            minWidth: window.innerWidth <= 768 ? '40px' : 'auto',
                            fontSize: window.innerWidth <= 768 ? '0.875rem' : '0.875rem'
                          }}
                        >
                          {totalPages}
                        </button>
                      );
                    }

                    return pages;
                  })()}
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: window.innerWidth <= 768 ? '0.75rem' : '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white',
                      color: currentPage === totalPages ? '#9ca3af' : '#374151',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      minWidth: window.innerWidth <= 768 ? '40px' : 'auto'
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Modal */}
      <RecurringInvoiceView
        isOpen={viewModalOpen}
        onClose={handleCloseModal}
        recurringInvoice={selectedRecurringInvoice}
        onNextBillCreated={handleNextBillCreated}
      />
    </div>
  );
};

export default RecurringInvoice;

