import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Calendar, Building, FileText, DollarSign, Clock, Plus, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/axiosConfig';

const RecurringInvoiceView = ({ isOpen, onClose, recurringInvoice, onNextBillCreated }) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [nextBillDate, setNextBillDate] = useState('');
  const [serviceDetails, setServiceDetails] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  
  // Fetch service details when modal opens
  useEffect(() => {
    const fetchServiceDetails = async () => {
      if (!isOpen || !recurringInvoice?.bill_to_date || (!recurringInvoice?.invoice_id && !recurringInvoice?.sale_order_id)) {
        setServiceDetails([]);
        return;
      }
      
      setLoadingServices(true);
      try {
        // Use sale_order_id if available (preferred), otherwise fallback to invoice_id
        const params = recurringInvoice.sale_order_id 
          ? `sale_order_id=${recurringInvoice.sale_order_id}&bill_to_date=${recurringInvoice.bill_to_date}`
          : `invoice_id=${recurringInvoice.invoice_id}&bill_to_date=${recurringInvoice.bill_to_date}`;
        const response = await api.get(`/recurring-invoice-details.php?${params}`);
        if (response.data.success) {
          setServiceDetails(response.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching service details:', error);
        // Don't show error toast, just silently fail
      } finally {
        setLoadingServices(false);
      }
    };

    fetchServiceDetails();
  }, [isOpen, recurringInvoice?.invoice_id, recurringInvoice?.sale_order_id, recurringInvoice?.bill_to_date]);

  if (!isOpen || !recurringInvoice) return null;

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

  const getDueStatusBadge = (dueStatus, daysUntilDue) => {
    const statusConfig = {
      'Due': { color: '#DC2626', bgColor: '#FEE2E2', text: 'Due Today' },
      'Overdue': { color: '#DC2626', bgColor: '#FEE2E2', text: `Overdue (${Math.abs(daysUntilDue)} days)` },
      'Upcoming Due': { color: '#D97706', bgColor: '#FEF3C7', text: `Due in ${daysUntilDue} days` }
    };
    
    const config = statusConfig[dueStatus] || { color: '#6B7280', bgColor: '#F3F4F6', text: 'Unknown' };
    
    return (
      <span
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '9999px',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: config.color,
          backgroundColor: config.bgColor,
          border: `1px solid ${config.color}20`
        }}
      >
        {config.text}
      </span>
    );
  };

  const getBillCycleText = (cycleName, cycleTerms, billFollowup) => {
    if (!cycleName) return '-';
    
    const followupNumber = billFollowup || 1;
    const cycleText = cycleName.toLowerCase();
    
    if (cycleText.includes('quarterly')) {
      return `${followupNumber}${getOrdinalSuffix(followupNumber)} Quarterly Payment`;
    } else if (cycleText.includes('half yearly')) {
      return `${followupNumber}${getOrdinalSuffix(followupNumber)} Half Yearly Payment`;
    } else if (cycleText.includes('yearly')) {
      return `${followupNumber}${getOrdinalSuffix(followupNumber)} Yearly Payment`;
    } else if (cycleText.includes('monthly')) {
      return `${followupNumber}${getOrdinalSuffix(followupNumber)} Monthly Payment`;
    } else {
      return `${followupNumber}${getOrdinalSuffix(followupNumber)} ${cycleName} Payment`;
    }
  };

  const getOrdinalSuffix = (num) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  const handleCreateNextBill = async () => {
    // Validate date
    if (!nextBillDate) {
      toast.error('Please select a date for the next bill');
      return;
    }

    setIsCreating(true);
    try {
      const response = await api.post('/create-next-recurring-invoice.php', {
        sale_order_id: recurringInvoice.sale_order_id, // Use sale_order_id to find all related invoices
        bill_to_date: recurringInvoice.bill_to_date, // Only create for services with this specific end date
        inv_date: nextBillDate
      });

      if (response.data.success) {
        // Handle grouped response (multiple invoices) or single invoice response
        if (response.data.data.created_invoices) {
          // Grouped by end date - multiple invoices created
          const invoiceNumbers = response.data.data.created_invoices.map(inv => inv.invoice_number).join(', ');
          toast.success(`${response.data.data.total_invoices} recurring invoice(s) created successfully! Invoices: ${invoiceNumbers}`);
        } else {
          // Single invoice response (backward compatibility)
          toast.success(`Next recurring invoice created successfully! New invoice: ${response.data.data.new_invoice_number}`);
        }
        setShowConfirmDialog(false);
        setNextBillDate(''); // Reset date
        onClose();
        if (onNextBillCreated) {
          onNextBillCreated();
        }
      } else {
        toast.error(response.data.message || 'Failed to create next recurring invoice');
      }
    } catch (error) {
      toast.error('Failed to create next recurring invoice');
    } finally {
      setIsCreating(false);
    }
  };

  return (
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
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 0.25rem 0'
            }}>
              Recurring Invoice Details
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              margin: 0
            }}>
              {recurringInvoice.pi_number}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => window.print()}
              style={{
                padding: '0.5rem',
                backgroundColor: '#f3f4f6',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151'
              }}
            >
              <Printer size={16} />
              Print
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem',
                backgroundColor: '#fee2e2',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#dc2626'
              }}
            >
              <X size={16} />
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Status Badge */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            {getDueStatusBadge(recurringInvoice.due_status, recurringInvoice.days_until_due)}
          </div>

          {/* Details Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* Invoice Information */}
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#1f2937',
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <FileText size={20} />
                Invoice Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>PI Number:</span>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{recurringInvoice.pi_number}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>SO Number:</span>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{recurringInvoice.saleorder_no || '-'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>Invoice Date:</span>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{formatDate(recurringInvoice.pi_date)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>Total Amount:</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#059669' }}>{formatCurrency(recurringInvoice.grand_total)}</div>
                </div>
              </div>
            </div>

            {/* Company Information */}
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#1f2937',
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Building size={20} />
                Company Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>Company:</span>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{recurringInvoice.company_name}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>Billing Company:</span>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{recurringInvoice.billing_company || '-'}</div>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#1f2937',
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Clock size={20} />
                Payment Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>Next Due Date:</span>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{formatDate(recurringInvoice.bill_to_date_plus_one)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>Bill Cycle:</span>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{recurringInvoice.cycle_name || '-'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>Payment Collection:</span>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>
                    {getBillCycleText(recurringInvoice.cycle_name, recurringInvoice.cycle_terms, recurringInvoice.bill_followup)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>Days Until Due:</span>
                  <div style={{ 
                    fontSize: '1rem', 
                    fontWeight: '600', 
                    color: recurringInvoice.days_until_due < 0 ? '#dc2626' : recurringInvoice.days_until_due === 0 ? '#d97706' : '#059669'
                  }}>
                    {recurringInvoice.days_until_due < 0 ? `${Math.abs(recurringInvoice.days_until_due)} days overdue` : 
                     recurringInvoice.days_until_due === 0 ? 'Due today' : 
                     `${recurringInvoice.days_until_due} days remaining`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            border: '1px solid #e5e7eb',
            marginTop: '1.5rem'
          }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 1rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Package size={20} />
              Service Details
            </h3>
            {loadingServices ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                Loading services...
              </div>
            ) : serviceDetails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                No service details found
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem'
                }}>
                  <thead>
                    <tr style={{
                      backgroundColor: '#f3f4f6',
                      borderBottom: '2px solid #e5e7eb'
                    }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>#</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Service Name</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Qty</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Rate</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Amount</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Invoice Amt</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Cycle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceDetails.map((service, index) => (
                      <tr 
                        key={service.id} 
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                        }}
                      >
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>{index + 1}</td>
                        <td style={{ padding: '0.75rem', fontWeight: '500', color: '#1f2937' }}>{service.service_name || '-'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#374151' }}>{parseFloat(service.qty || 0).toFixed(2)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#374151' }}>{formatCurrency(service.inv_rate || 0)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#374151' }}>{formatCurrency(service.inv_amount || 0)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: '#059669' }}>{formatCurrency(service.inv_total_amount || 0)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280', fontSize: '0.75rem' }}>{service.cycle_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              onClick={() => setShowConfirmDialog(true)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                transition: 'background-color 0.2s'
              }}
            >
              <Plus size={16} />
              Create Next Bill
            </button>
            <button
              onClick={() => window.print()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                transition: 'background-color 0.2s'
              }}
            >
              <Printer size={16} />
              Print Details
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                transition: 'background-color 0.2s'
              }}
            >
              <X size={16} />
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
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
          zIndex: 1001,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#fef3c7',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle size={24} color="#d97706" />
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#1f2937',
                  margin: '0 0 0.25rem 0'
                }}>
                  Create Next Recurring Invoice
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#6b7280',
                  margin: 0
                }}>
                  This will create a new recurring invoice based on the current one
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#f9fafb',
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <p style={{
                fontSize: '0.875rem',
                color: '#374151',
                margin: '0 0 0.5rem 0',
                fontWeight: '500'
              }}>
                Current Invoice: {recurringInvoice.pi_number}
              </p>
              <p style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                margin: 0
              }}>
                A new proforma invoice will be created with updated dates and incremented followup number.
              </p>
            </div>

            {/* Date Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Proforma Invoice Date <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="date"
                value={nextBillDate}
                onChange={(e) => setNextBillDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  backgroundColor: 'white',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem'
            }}>
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={isCreating}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  opacity: isCreating ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNextBill}
                disabled={isCreating || !nextBillDate}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: (isCreating || !nextBillDate) ? '#9ca3af' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: (isCreating || !nextBillDate) ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: (isCreating || !nextBillDate) ? 0.5 : 1
                }}
              >
                {isCreating ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #ffffff40',
                      borderTop: '2px solid #ffffff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Create Next Bill
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringInvoiceView;

