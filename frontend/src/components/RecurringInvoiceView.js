import React, { useState, useEffect } from 'react';
import { X, Printer, Building, FileText, Clock, Plus, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/axiosConfig';

const RecurringInvoiceView = ({ isOpen, onClose, recurringInvoice, onNextBillCreated }) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [nextBillDate, setNextBillDate] = useState('');
  const [serviceDetails, setServiceDetails] = useState([]);
  const [previousDetails, setPreviousDetails] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [customPeriods, setCustomPeriods] = useState({});

  useEffect(() => {
    setSelectedServiceIds([]);
    setNextBillDate('');
    setCustomPeriods({});
  }, [recurringInvoice?.invoice_id, isOpen]);

  useEffect(() => {
    const fetchServiceDetails = async () => {
      if (!isOpen || !recurringInvoice?.invoice_id) {
        setServiceDetails([]);
        setPreviousDetails([]);
        return;
      }

      setLoadingServices(true);
      try {
        const params = `invoice_id=${recurringInvoice.invoice_id}`;
        const response = await api.get(`/recurring-invoice-details.php?${params}`);
        if (response.data.success) {
          const details = response.data.data || [];
          setServiceDetails(details);
          setPreviousDetails(response.data.previous_details || []);
          setSelectedServiceIds(details.filter((s) => Number(s.is_eligible) === 1).map((s) => s.id));
          const initialCustomPeriods = {};
          details.forEach((s) => {
            initialCustomPeriods[String(s.id)] = {
              next_from_date: s.next_from_date || '',
              next_to_date: s.next_to_date || '',
            };
          });
          setCustomPeriods(initialCustomPeriods);
        }
      } catch (error) {
        setServiceDetails([]);
        setPreviousDetails([]);
        setSelectedServiceIds([]);
        toast.error('Failed to fetch recurring service details');
      } finally {
        setLoadingServices(false);
      }
    };

    fetchServiceDetails();
  }, [isOpen, recurringInvoice?.invoice_id]);

  if (!isOpen || !recurringInvoice) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount || 0);
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
      Due: { color: '#DC2626', bgColor: '#FEE2E2', text: 'Due Today' },
      Overdue: { color: '#DC2626', bgColor: '#FEE2E2', text: `Overdue (${Math.abs(daysUntilDue)} days)` },
      'Upcoming Due': { color: '#D97706', bgColor: '#FEF3C7', text: `Due in ${daysUntilDue} days` },
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
          border: `1px solid ${config.color}20`,
        }}
      >
        {config.text}
      </span>
    );
  };

  const handleToggleService = (serviceId, enabled) => {
    if (!enabled) return;
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleCreateRecurringInvoice = async () => {
    if (!nextBillDate) {
      toast.error('Please select proforma invoice date');
      return;
    }
    if (selectedServiceIds.length === 0) {
      toast.error('Please select at least one eligible service');
      return;
    }

    setIsCreating(true);
    try {
      const response = await api.post('/recurring-invoice-details.php', {
        invoice_id: recurringInvoice.invoice_id,
        inv_date: nextBillDate,
        selected_detail_ids: selectedServiceIds,
        custom_periods: customPeriods,
      });

      if (response.data.success) {
        toast.success(`Recurring invoice created: ${response.data.data.new_invoice_number}`);
        setShowConfirmDialog(false);
        setNextBillDate('');
        onClose();
        if (onNextBillCreated) {
          onNextBillCreated();
        }
      } else {
        toast.error(response.data.message || 'Failed to create recurring invoice');
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to create recurring invoice');
    } finally {
      setIsCreating(false);
    }
  };

  const eligibleCount = serviceDetails.filter((s) => Number(s.is_eligible) === 1).length;

  const handlePeriodChange = (serviceId, field, value) => {
    setCustomPeriods((prev) => ({
      ...prev,
      [String(serviceId)]: {
        ...(prev[String(serviceId)] || {}),
        [field]: value,
      },
    }));
  };

  return (
    <div
      style={{
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
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '980px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.25rem 0' }}>
              Recurring Invoice Details
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>{recurringInvoice.pi_number}</p>
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
                color: '#374151',
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
                color: '#dc2626',
              }}
            >
              <X size={16} />
              Close
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            {getDueStatusBadge(recurringInvoice.due_status, recurringInvoice.days_until_due)}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} />
                Invoice
              </h3>
              <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.7 }}>
                <div>PI: <strong>{recurringInvoice.pi_number}</strong></div>
                <div>SO: <strong>{recurringInvoice.saleorder_no || '-'}</strong></div>
                <div>Date: <strong>{formatDate(recurringInvoice.pi_date)}</strong></div>
                <div>Amount: <strong>{formatCurrency(recurringInvoice.grand_total)}</strong></div>
              </div>
            </div>

            <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building size={18} />
                Company
              </h3>
              <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.7 }}>
                <div>Name: <strong>{recurringInvoice.company_name || '-'}</strong></div>
                <div>Billing: <strong>{recurringInvoice.billing_company || '-'}</strong></div>
                <div>Active services: <strong>{serviceDetails.length}</strong></div>
              </div>
            </div>

            <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} />
                Eligibility
              </h3>
              <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                <div style={{ marginBottom: '0.4rem' }}>Checkbox enabled from 30 days before next period start.</div>
                <div>Eligible: <strong>{eligibleCount}</strong></div>
                <div>Selected: <strong>{selectedServiceIds.length}</strong></div>
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#f9fafb',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              marginTop: '1rem',
            }}
          >
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={20} />
              Services
            </h3>

            {loadingServices ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading services...</div>
            ) : serviceDetails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No active services found</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Select</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Service</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Cycle</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Followup</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Current Period</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Next Period</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceDetails.map((service, index) => {
                      const isEligible = Number(service.is_eligible) === 1;
                      const isYearly = Number(service.is_yearly) === 1;
                      const isDateEditable = Number(service.is_date_editable) === 1;
                      const isSelected = selectedServiceIds.includes(service.id);
                      return (
                        <tr key={service.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isEligible}
                              onChange={() => handleToggleService(service.id, isEligible)}
                              style={{ width: '16px', height: '16px', cursor: isEligible ? 'pointer' : 'not-allowed' }}
                            />
                          </td>
                          <td style={{ padding: '0.75rem', color: '#1f2937', fontWeight: '500' }}>{service.service_name || '-'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#374151' }}>{service.cycle_name || '-'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#1f2937', fontWeight: '600' }}>
                            {service.bill_followup || 0}/{service.cycle_terms || '-'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#374151' }}>
                            {formatDate(service.bill_from_date)} to {formatDate(service.bill_to_date)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#1f2937', fontWeight: '600' }}>
                            {isDateEditable ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <input
                                  type="date"
                                  value={customPeriods[String(service.id)]?.next_from_date || ''}
                                  onChange={(e) => handlePeriodChange(service.id, 'next_from_date', e.target.value)}
                                  style={{
                                    width: '140px',
                                    padding: '0.35rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.35rem',
                                    fontSize: '0.78rem',
                                  }}
                                />
                                <input
                                  type="date"
                                  value={customPeriods[String(service.id)]?.next_to_date || ''}
                                  onChange={(e) => handlePeriodChange(service.id, 'next_to_date', e.target.value)}
                                  style={{
                                    width: '140px',
                                    padding: '0.35rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.35rem',
                                    fontSize: '0.78rem',
                                  }}
                                />
                              </div>
                            ) : (
                              <div>
                                <div>{formatDate(service.next_from_date)} to {formatDate(service.next_to_date)}</div>
                                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.2rem' }}>
                                  {isYearly ? 'Yearly service date not editable' : (isEligible ? 'Date locked' : 'Editable when eligible')}
                                </div>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', color: '#059669', fontWeight: '600' }}>
                            {formatCurrency(service.inv_total_amount)}
                          </td>
                          <td style={{ padding: '0.75rem', color: isEligible ? '#059669' : '#6b7280', fontSize: '0.8rem' }}>
                            {service.eligibility_reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div
            style={{
              backgroundColor: '#f9fafb',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              marginTop: '1rem',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', margin: '0 0 0.75rem 0' }}>
              Previous Proforma Details
            </h3>
            {previousDetails.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>No previous proforma details found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Proforma No</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Service</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previousDetails.map((row, index) => (
                      <tr key={`prev-${index}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem', color: '#374151', fontWeight: '500' }}>{row.invoice_no || '-'}</td>
                        <td style={{ padding: '0.75rem', color: '#1f2937' }}>{row.service_name || '-'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#059669', fontWeight: '600' }}>
                          {formatCurrency(row.inv_total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', marginTop: '1rem' }}>
            <button
              onClick={() => setShowConfirmDialog(true)}
              disabled={selectedServiceIds.length === 0}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: selectedServiceIds.length === 0 ? '#9ca3af' : '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: selectedServiceIds.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              <Plus size={16} />
              Create Recurring Invoice
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
              }}
            >
              <X size={16} />
              Close
            </button>
          </div>
        </div>
      </div>

      {showConfirmDialog && (
        <div
          style={{
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
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#fef3c7',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={24} color="#d97706" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.25rem 0' }}>
                  Create Recurring Invoice
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                  {selectedServiceIds.length} service(s) will be included
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
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
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
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
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRecurringInvoice}
                disabled={isCreating || !nextBillDate || selectedServiceIds.length === 0}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: (isCreating || !nextBillDate || selectedServiceIds.length === 0) ? '#9ca3af' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: (isCreating || !nextBillDate || selectedServiceIds.length === 0) ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringInvoiceView;
