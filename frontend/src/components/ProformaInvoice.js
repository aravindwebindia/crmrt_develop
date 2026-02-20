import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import api from '../utils/axiosConfig';
import Sidebar from './Sidebar';
import UserDropdown from './UserDropdown';
import { 
  Plus, 
  Search, 
  ArrowUpDown,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Calculator,
  FileText,
  Mail,
  Check,
  Pause,
  Eye,
  Receipt,
  Trash2,
  Edit
} from 'lucide-react';
import ProformaInvoiceView from './ProformaInvoiceView';

const ProformaInvoice = () => {
  const { user } = useAuth();
  const [proformaInvoices, setProformaInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Modal state
  const [viewingProformaInvoiceId, setViewingProformaInvoiceId] = useState(null);
  const [showTaxInvoiceModal, setShowTaxInvoiceModal] = useState(false);
  const [selectedProformaInvoice, setSelectedProformaInvoice] = useState(null);
  const [taxInvoiceData, setTaxInvoiceData] = useState({
    tax_invoice_no: '',
    inv_grand_total: 0
  });
  const [taxInvoiceErrors, setTaxInvoiceErrors] = useState({});
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProformaInvoice, setEditingProformaInvoice] = useState(null);
  const [editFormData, setEditFormData] = useState({
    bc_id: '',
    inv_date: ''
  });
  const [editErrors, setEditErrors] = useState({});
  const [billingCompanies, setBillingCompanies] = useState([]);
  const [loadingBillingCompanies, setLoadingBillingCompanies] = useState(false);
  
  // Add Proforma Invoice Modal state
  const [showAddProformaModal, setShowAddProformaModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [saleOrders, setSaleOrders] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedSaleOrderId, setSelectedSaleOrderId] = useState('');
  const [proformaInvoiceDate, setProformaInvoiceDate] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingSaleOrders, setLoadingSaleOrders] = useState(false);
  const [creatingProforma, setCreatingProforma] = useState(false);
  
  // Searchable select states for company
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState(-1);
  
  // Send Proforma Invoice Modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedProformaForSend, setSelectedProformaForSend] = useState(null);
  const [mailBody, setMailBody] = useState('');
  const [toEmails, setToEmails] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendModalErrors, setSendModalErrors] = useState({});
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);
  const [sendToCustomer, setSendToCustomer] = useState(false); // Unchecked by default
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [proformaToDelete, setProformaToDelete] = useState(null);
  const [deletingProforma, setDeletingProforma] = useState(false);

  // Fetch contacts for proforma invoice modal
  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const response = await api.get('/proforma-invoice-dropdowns.php?action=contacts');
      if (response.data.success) {
        setContacts(response.data.data);
      } else {
        toast.error('Failed to fetch contacts');
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to fetch contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  // Fetch sale orders for selected contact
  const fetchSaleOrders = async (contactId) => {
    if (!contactId) {
      setSaleOrders([]);
      return;
    }
    
    setLoadingSaleOrders(true);
    try {
      const response = await api.get(`/proforma-invoice-dropdowns.php?action=sale_orders&contact_id=${contactId}`);
      if (response.data.success) {
        setSaleOrders(response.data.data);
      } else {
        toast.error('Failed to fetch sale orders');
      }
    } catch (error) {
      console.error('Error fetching sale orders:', error);
      toast.error('Failed to fetch sale orders');
    } finally {
      setLoadingSaleOrders(false);
    }
  };

  // Handle contact selection
  const handleContactChange = (contactId) => {
    setSelectedContactId(contactId);
    setSelectedSaleOrderId(''); // Reset sale order selection
    fetchSaleOrders(contactId);
  };

  // Searchable select functions for company
  const handleCompanySearch = (e) => {
    const searchTerm = e.target.value;
    setCompanySearchTerm(searchTerm);
    setShowCompanyDropdown(true);
    setSelectedCompanyIndex(-1);
    
    if (searchTerm.trim() === '') {
      setFilteredCompanies(contacts);
    } else {
      const filtered = contacts.filter(contact =>
        contact.company.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCompanies(filtered);
    }
  };

  const handleKeyDown = (e) => {
    if (!showCompanyDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedCompanyIndex(prev => 
          prev < filteredCompanies.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedCompanyIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedCompanyIndex >= 0 && filteredCompanies[selectedCompanyIndex]) {
          handleCompanySelect(filteredCompanies[selectedCompanyIndex]);
        }
        break;
      case 'Escape':
        setShowCompanyDropdown(false);
        setSelectedCompanyIndex(-1);
        break;
    }
  };

  const handleCompanySelect = (contact) => {
    setCompanySearchTerm(contact.company);
    setSelectedContactId(contact.ld_id);
    setShowCompanyDropdown(false);
    setSelectedCompanyIndex(-1);
    setSelectedSaleOrderId(''); // Reset sale order selection
    fetchSaleOrders(contact.ld_id);
  };

  const highlightSearchTerm = (text, searchTerm) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} style={{ backgroundColor: '#fef3c7', fontWeight: '600' }}>
          {part}
        </span>
      ) : part
    );
  };

  // Check if proforma invoice can be deleted
  const canDeleteProformaInvoice = (proformaInvoice) => {
    // Don't show delete if tax_invoice_no is already set
    if (proformaInvoice.tax_invoice_no) {
      return false;
    }
    
    // For now, we'll show delete for all invoices without tax_invoice_no
    // The backend will handle the more complex logic about first invoice only
    return true;
  };

  // Handle delete proforma invoice
  const handleDeleteProformaInvoice = (proformaInvoice) => {
    setProformaToDelete(proformaInvoice);
    setShowDeleteModal(true);
  };

  // Confirm delete proforma invoice
  const confirmDeleteProformaInvoice = async () => {
    if (!proformaToDelete) return;
    
    setDeletingProforma(true);
    try {
      const response = await api.delete('/proforma-invoices.php', {
        data: { id: proformaToDelete.id }
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setShowDeleteModal(false);
        setProformaToDelete(null);
        fetchProformaInvoices(); // Refresh the list
      } else {
        toast.error(response.data.message || 'Failed to delete proforma invoice');
      }
    } catch (error) {
      console.error('Error deleting proforma invoice:', error);
      // Try to extract the specific error message from the response
      const errorMessage = error.response?.data?.message || 'Failed to delete proforma invoice';
      toast.error(errorMessage);
    } finally {
      setDeletingProforma(false);
    }
  };

  // Handle proforma invoice creation
  const handleCreateProformaInvoice = async (saleOrderId, invoiceDate) => {
    setCreatingProforma(true);
    try {
      const response = await api.post('/create-proforma-invoice.php', {
        sale_order_id: saleOrderId,
        inv_date: invoiceDate
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setShowAddProformaModal(false);
        setSelectedContactId('');
        setSelectedSaleOrderId('');
        setProformaInvoiceDate('');
        setSaleOrders([]);
        setCompanySearchTerm('');
        setShowCompanyDropdown(false);
        setSelectedCompanyIndex(-1);
        fetchProformaInvoices(); // Refresh the proforma invoices list
      } else {
        toast.error(response.data.message || 'Failed to create proforma invoice');
      }
    } catch (error) {
      console.error('Error creating proforma invoice:', error);
      toast.error('Failed to create proforma invoice');
    } finally {
      setCreatingProforma(false);
    }
  };

  // Fetch proforma invoices
  const fetchProformaInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);

      const response = await api.get(`/proforma-invoices.php?${params}`);
      if (response.data.success) {
        setProformaInvoices(response.data.data);
        setTotalPages(response.data.pagination.total_pages);
        setTotalItems(response.data.pagination.total_items);
      }
    } catch (error) {
      console.error('Error fetching proforma invoices:', error);
      toast.error('Failed to fetch proforma invoices');
    } finally {
      setLoading(false);
    }
  };



  // Effects
  useEffect(() => {
    fetchProformaInvoices();
  }, [currentPage, searchTerm, sortBy, sortOrder, statusFilter, itemsPerPage]);

  // Fetch contacts when modal opens
  useEffect(() => {
    if (showAddProformaModal) {
      fetchContacts();
    }
  }, [showAddProformaModal]);

  // Initialize filtered companies when contacts change
  useEffect(() => {
    setFilteredCompanies(contacts);
  }, [contacts]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCompanyDropdown && !event.target.closest('.company-search-container')) {
        setShowCompanyDropdown(false);
        setSelectedCompanyIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCompanyDropdown]);


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

  // Handle status filter
  const handleStatusFilter = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };


  // Handle view proforma invoice
  const handleViewProformaInvoice = (proformaInvoiceId) => {
    setViewingProformaInvoiceId(proformaInvoiceId);
  };

  // Handle send proforma invoice
  const handleSendProformaInvoice = (proformaInvoice) => {
      setSelectedProformaForSend(proformaInvoice);
      setMailBody(
        `Please remit payment to the bank account details mentioned in the attached invoice.
Services will be activated only upon payment confirmation, and payment delays may affect service activation timelines.

For domain renewals and email services, timely payment is critical to avoid expiration and potential loss of services. A tax invoice will be issued upon receipt of payment.

Please verify all details in the attached invoice. Should you notice any discrepancies or have questions, contact us immediately.

We appreciate your prompt attention to this matter.`
      );
      setToEmails('');
      setCcEmails('');
      setSendModalErrors({});
      setSendToCustomer(false); // Unchecked by default
      setShowSendModal(true);
  };


  // Handle close send modal
  const handleCloseSendModal = () => {
    setShowSendModal(false);
    setSelectedProformaForSend(null);
    setMailBody('');
    setToEmails('');
    setCcEmails('');
    setSendModalErrors({});
  };

  // Email validation functions
  const validateEmail = (email) => {
    // Basic email structure validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Check for specific problematic characters that should not be in emails
    const problematicChars = /[\^&*()=<>{}[\]\\|;:'"`~#$]/;
    const hasProblematicChars = problematicChars.test(email.trim());
    
    return emailRegex.test(email.trim()) && !hasProblematicChars;
  };

  const validateEmailList = (emailString) => {
    if (!emailString.trim()) return { isValid: true, emails: [] };
    
    // Check if user used spaces instead of commas
    if (emailString.includes(' ') && !emailString.includes(',')) {
      return {
        isValid: false,
        emails: [],
        invalidEmails: [],
        errorType: 'space_separation'
      };
    }
    
    // Split by comma only, then filter out empty strings
    const emails = emailString.split(',').map(email => email.trim()).filter(email => email);
    const invalidEmails = emails.filter(email => !validateEmail(email));
    
    
    return {
      isValid: invalidEmails.length === 0,
      emails: emails,
      invalidEmails: invalidEmails,
      errorType: invalidEmails.length > 0 ? 'invalid_format' : null
    };
  };

  // Validate send modal
  const validateSendModal = () => {
    const errors = {};
    
    if (!mailBody.trim()) {
      errors.mailBody = 'Mail body message is required';
    }
    
    // Check if at least one recipient is provided
    const hasToEmails = toEmails.trim() !== '';
    const hasSendToCustomer = sendToCustomer;
    
    if (!hasToEmails && !hasSendToCustomer) {
      errors.recipients = 'At least one recipient is required';
    }
    
    // Validate CC emails (optional but must be valid format)
    if (ccEmails.trim()) {
      const ccValidation = validateEmailList(ccEmails);
      if (!ccValidation.isValid) {
        if (ccValidation.errorType === 'space_separation') {
          errors.ccEmails = 'Please add comma between email addresses (e.g., email1@domain.com, email2@domain.com)';
        } else {
          errors.ccEmails = `Invalid email format: ${ccValidation.invalidEmails.join(', ')}`;
        }
      }
    }
    
    // Validate TO emails (optional but must be valid format)
    if (toEmails.trim()) {
      const toValidation = validateEmailList(toEmails);
      if (!toValidation.isValid) {
        if (toValidation.errorType === 'space_separation') {
          errors.toEmails = 'Please add comma between email addresses (e.g., email1@domain.com, email2@domain.com)';
        } else {
          errors.toEmails = `Invalid email format: ${toValidation.invalidEmails.join(', ')}`;
        }
      }
    }
    
    setSendModalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle send email
  const handleSendEmail = async () => {
    if (!validateSendModal()) return;
    
    // Show confirmation modal
    setShowSendConfirmation(true);
  };

  const handleConfirmSendEmail = async () => {
    setShowSendConfirmation(false);
    
    setSendingEmail(true);
    try {
      const response = await api.post('/send-proforma-invoice-view.php', {
        proforma_invoice_id: selectedProformaForSend.id,
        to_emails: toEmails,
        cc_emails: ccEmails,
        mail_body: mailBody,
        send_to_customer: sendToCustomer
      }, {
        timeout: 30000 // 30 second timeout
      });
      
      if (response.data.success) {
        // Update the local state to mark this proforma invoice as sent only if checkbox is checked
        if (sendToCustomer) {
          setProformaInvoices(prevInvoices => 
            prevInvoices.map(invoice => 
              invoice.id === selectedProformaForSend.id 
                ? { ...invoice, mail_status: 1 }
                : invoice
            )
          );
        }
        
        toast.success('Proforma invoice sent successfully');
        handleCloseSendModal();
      } else {
        toast.error(response.data.message || 'Failed to send proforma invoice view');
      }
    } catch (error) {
      console.error('Error sending proforma invoice view:', error);
      const errorMessage = error.response?.data?.message || 'Failed to send proforma invoice view';
      toast.error(errorMessage);
    } finally {
      setSendingEmail(false);
    }
  };

  // Fetch billing companies for edit modal
  const fetchBillingCompanies = async () => {
    try {
      setLoadingBillingCompanies(true);
      const response = await api.get('/bill-companies.php');
      if (response.data.success) {
        setBillingCompanies(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching billing companies:', error);
      toast.error('Failed to fetch billing companies');
    } finally {
      setLoadingBillingCompanies(false);
    }
  };

  // Handle edit proforma invoice
  const handleEditProformaInvoice = (proformaInvoice) => {
    setEditingProformaInvoice(proformaInvoice);
    setEditFormData({
      bc_id: proformaInvoice.bc_id ? String(proformaInvoice.bc_id) : '',
      inv_date: proformaInvoice.pi_date || ''
    });
    setEditErrors({});
    setShowEditModal(true);
    fetchBillingCompanies();
  };

  // Validate edit form
  const validateEditForm = () => {
    const errors = {};
    
    if (!editFormData.bc_id) {
      errors.bc_id = 'Billing company is required';
    }
    
    if (!editFormData.inv_date) {
      errors.inv_date = 'Invoice date is required';
    }
    
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle edit form submit
  const handleEditSubmit = async () => {
    if (!validateEditForm()) {
      return;
    }

    try {
      const response = await api.put(`/proforma-invoices.php`, {
        id: editingProformaInvoice.id,
        bc_id: editFormData.bc_id,
        inv_date: editFormData.inv_date
      });

      if (response.data.success) {
        // Update the local state to reset mail_status to 0 (not sent) for edited invoice
        setProformaInvoices(prevInvoices => 
          prevInvoices.map(invoice => 
            invoice.id === editingProformaInvoice.id 
              ? { 
                  ...invoice, 
                  mail_status: 0,
                  // Update invoice number if it was changed
                  ...(response.data.data.invoice_no && { pi_number: response.data.data.invoice_no })
                }
              : invoice
          )
        );
        
        // Show success message with new invoice number if applicable
        const successMessage = response.data.data.invoice_no 
          ? `Proforma invoice updated successfully. New invoice number: ${response.data.data.invoice_no}`
          : 'Proforma invoice updated successfully';
        
        toast.success(successMessage);
        setShowEditModal(false);
        fetchProformaInvoices(); // Refresh the list
      } else {
        toast.error(response.data.message || 'Failed to update proforma invoice');
      }
    } catch (error) {
      console.error('Error updating proforma invoice:', error);
      toast.error('Failed to update proforma invoice');
    }
  };

  // Handle edit modal close
  const handleEditModalClose = () => {
    setShowEditModal(false);
    setEditingProformaInvoice(null);
    setEditFormData({ bc_id: '', inv_date: '' });
    setEditErrors({});
  };

  // Handle tax invoice update
  const handleTaxInvoiceUpdate = (proformaInvoice) => {
    // Find the current invoice data from the state to get the latest tax_invoice_no
    const currentInvoice = proformaInvoices.find(inv => inv.id === proformaInvoice.id) || proformaInvoice;
    
    setSelectedProformaInvoice(currentInvoice);
    setTaxInvoiceData({
      tax_invoice_no: currentInvoice.tax_invoice_no || '',
      inv_grand_total: parseFloat(currentInvoice.grand_total || 0)
    });
    setShowTaxInvoiceModal(true);
  };

  // Handle close tax invoice modal
  const handleCloseTaxInvoiceModal = () => {
    setShowTaxInvoiceModal(false);
    setSelectedProformaInvoice(null);
    setTaxInvoiceData({
      tax_invoice_no: '',
      inv_grand_total: 0
    });
    setTaxInvoiceErrors({});
  };

  // Handle tax invoice data change
  const handleTaxInvoiceDataChange = (e) => {
    const { name, value } = e.target;
    setTaxInvoiceData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (taxInvoiceErrors[name]) {
      setTaxInvoiceErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate tax invoice data
  const validateTaxInvoiceData = () => {
    const errors = {};
    
    if (!taxInvoiceData.tax_invoice_no.trim()) {
      errors.tax_invoice_no = 'Tax invoice number is required';
    }
    
    setTaxInvoiceErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle tax invoice update
  const handleTaxInvoiceUpdateSubmit = async () => {
    if (!validateTaxInvoiceData()) {
      return;
    }

    try {
      const response = await api.put('/proforma-invoices.php', {
        id: selectedProformaInvoice.id,
        tax_invoice_no: taxInvoiceData.tax_invoice_no.trim(),
        tax_received_amt: taxInvoiceData.inv_grand_total
      });

      if (response.data.success) {
        toast.success(response.data.message);
        handleCloseTaxInvoiceModal();
        fetchProformaInvoices(); // Refresh the list
      } else {
        toast.error(response.data.message || 'Failed to update tax invoice');
      }
    } catch (error) {
      console.error('Error updating tax invoice:', error);
      toast.error('Failed to update tax invoice');
    }
  };


  // Effects

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <style>
        {`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>
      
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
              Proforma Invoices
            </h1>
            <p style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280',
              margin: '0.25rem 0 0 0'
            }}>
              Manage your proforma invoices
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
                    placeholder="Search proforma invoices..."
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

              {/* Status Filter */}
              <div>
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
                  value={statusFilter}
                  onChange={handleStatusFilter}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    outline: 'none'
                  }}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Add Proforma Invoice Button */}
              <div>
                <button
                  onClick={() => setShowAddProformaModal(true)}
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
                    fontWeight: '500',
                    gap: '0.5rem',
                    width: '100%',
                    justifyContent: 'center'
                  }}
                >
                  <Plus size={16} />
                  Add Proforma Invoice
                </button>
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
            {loading ? (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                padding: '3rem',
                color: '#6b7280'
              }}>
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
                  Loading proforma invoices...
                </div>
              </div>
            ) : proformaInvoices.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center', 
                padding: '3rem',
                color: '#6b7280'
              }}>
                <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: '500', margin: '0 0 0.5rem 0' }}>
                  No proforma invoices found
                </h3>
                <p style={{ fontSize: '0.875rem', margin: 0, textAlign: 'center' }}>
                  {searchTerm || statusFilter 
                    ? 'Try adjusting your search or filter criteria.' 
                    : 'Get started by creating your first proforma invoice.'
                  }
                </p>
              </div>
            ) : (
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
                      }} onClick={() => handleSort('pi_date')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          PI Date {getSortIcon('pi_date')}
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
                      }} onClick={() => handleSort('created_by_name')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Created By {getSortIcon('created_by_name')}
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
                    {proformaInvoices.map((proformaInvoice, index) => (
                      <tr key={proformaInvoice.id} style={{ 
                        borderBottom: '1px solid #f3f4f6',
                        transition: 'background-color 0.2s'
                      }}>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: '500', color: '#1f2937' }}>
                            {proformaInvoice.pi_number}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: '500', color: '#1f2937' }}>
                            {proformaInvoice.company_name}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ color: '#6b7280' }}>
                            {proformaInvoice.saleorder_no || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ color: '#6b7280' }}>
                            {proformaInvoice.billing_company || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ color: '#6b7280' }}>
                            {proformaInvoice.pi_date ? new Date(proformaInvoice.pi_date).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: '500', color: '#1f2937' }}>
                            ₹{parseFloat(proformaInvoice.grand_total || 0).toFixed(2)}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            backgroundColor: 
                              proformaInvoice.status === 'active' ? '#dcfce7' :
                              proformaInvoice.status === 'inactive' ? '#fee2e2' :
                              '#f3f4f6',
                            color: 
                              proformaInvoice.status === 'active' ? '#166534' :
                              proformaInvoice.status === 'inactive' ? '#dc2626' :
                              '#6b7280'
                          }}>
                            {proformaInvoice.status?.charAt(0).toUpperCase() + proformaInvoice.status?.slice(1) || 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#374151' }}>
                          <div style={{ fontWeight: 500 }}>{proformaInvoice.created_by_name || '-'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{proformaInvoice.created_by_email || ''}</div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <button
                              onClick={() => handleViewProformaInvoice(proformaInvoice.id)}
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
                            <button
                              onClick={() => proformaInvoice.mail_status === 0 ? handleSendProformaInvoice(proformaInvoice) : null}
                              disabled={proformaInvoice.mail_status === 1}
                              style={{
                                padding: '0.5rem',
                                backgroundColor: proformaInvoice.mail_status === 1 ? '#f3f4f6' : '#f0fdf4',
                                border: 'none',
                                borderRadius: '0.375rem',
                                cursor: proformaInvoice.mail_status === 1 ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s',
                                opacity: proformaInvoice.mail_status === 1 ? 0.6 : 1
                              }}
                              title={proformaInvoice.mail_status === 1 ? "Email Already Sent" : "Send Proforma Invoice"}
                            >
                              <Mail size={14} color={proformaInvoice.mail_status === 1 ? "#9ca3af" : "#16a34a"} />
                            </button>
                            {proformaInvoice.status === 'active' && (
                              <button
                                onClick={() => handleEditProformaInvoice(proformaInvoice)}
                                style={{
                                  padding: '0.5rem',
                                  backgroundColor: '#fef3c7',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background-color 0.2s'
                                }}
                                title="Edit Proforma Invoice"
                              >
                                <Edit size={14} color="#d97706" />
                              </button>
                            )}
                            <button
                              onClick={() => handleTaxInvoiceUpdate(proformaInvoice)}
                              style={{
                                padding: '0.5rem',
                                backgroundColor: '#f0fdf4',
                                border: 'none',
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s'
                              }}
                              title="Update Tax Invoice"
                            >
                              <Receipt size={14} color="#16a34a" />
                            </button>
                            {canDeleteProformaInvoice(proformaInvoice) && (
                              <button
                                onClick={() => handleDeleteProformaInvoice(proformaInvoice)}
                                style={{
                                  padding: '0.5rem',
                                  backgroundColor: '#fef2f2',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background-color 0.2s'
                                }}
                                title="Delete Proforma Invoice"
                              >
                                <Trash2 size={14} color="#dc2626" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

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
                  
                  {Array.from({ length: Math.min(window.innerWidth <= 768 ? 3 : 5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        style={{
                          padding: window.innerWidth <= 768 ? '0.75rem' : '0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          backgroundColor: currentPage === page ? '#3b82f6' : 'white',
                          color: currentPage === page ? 'white' : '#374151',
                          cursor: 'pointer',
                          minWidth: window.innerWidth <= 768 ? '40px' : 'auto',
                          fontSize: window.innerWidth <= 768 ? '0.875rem' : '0.875rem'
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

      {/* Proforma Invoice View Modal */}
      {viewingProformaInvoiceId && (
        <ProformaInvoiceView
          proformaInvoiceId={viewingProformaInvoiceId}
          onClose={() => setViewingProformaInvoiceId(null)}
        />
      )}

      {/* Tax Invoice Update Modal */}
      {showTaxInvoiceModal && selectedProformaInvoice && (
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
            borderRadius: '0.5rem',
            padding: '1.5rem',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '1rem'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#111827',
                margin: 0
              }}>
                Update Tax Invoice
              </h2>
              <button
                onClick={handleCloseTaxInvoiceModal}
                style={{
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
                  borderRadius: '0.25rem',
                  transition: 'all 0.2s ease'
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
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.25rem'
                  }}>
                    Proforma Invoice Number
                  </label>
                  <div style={{
                    padding: '0.5rem',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#111827'
                  }}>
                    {selectedProformaInvoice.pi_number}
                  </div>
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.25rem'
                  }}>
                    Company
                  </label>
                  <div style={{
                    padding: '0.5rem',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#111827'
                  }}>
                    {selectedProformaInvoice.company_name}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Tax Invoice Number <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  name="tax_invoice_no"
                  value={taxInvoiceData.tax_invoice_no}
                  onChange={handleTaxInvoiceDataChange}
                  placeholder="Enter tax invoice number"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${taxInvoiceErrors.tax_invoice_no ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#111827',
                    backgroundColor: taxInvoiceErrors.tax_invoice_no ? '#fef2f2' : 'white'
                  }}
                />
                {taxInvoiceErrors.tax_invoice_no && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#dc2626',
                    marginTop: '0.25rem'
                  }}>
                    {taxInvoiceErrors.tax_invoice_no}
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
                  Invoice Grand Total
                </label>
                <input
                  type="text"
                  value={`₹${taxInvoiceData.inv_grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    backgroundColor: '#f9fafb',
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              <div style={{
                padding: '1rem',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '0.375rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <Receipt size={16} color="#0ea5e9" />
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#0c4a6e'
                  }}>
                    Tax Invoice Information
                  </span>
                </div>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#0c4a6e',
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  Enter the tax invoice number to update the proforma invoice. 
                  The grand total amount is displayed for reference. 
                  <strong>The status will be automatically changed to "Completed" after update.</strong>
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.75rem',
              borderTop: '1px solid #e5e7eb',
              paddingTop: '1rem'
            }}>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
                onClick={handleTaxInvoiceUpdateSubmit}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Proforma Invoice Modal */}
      {showEditModal && editingProformaInvoice && (
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
            borderRadius: '0.5rem',
            padding: '1.5rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '1rem'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#111827',
                margin: 0
              }}>
                Edit Proforma Invoice
              </h2>
              <button
                onClick={handleEditModalClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              {/* Read-only details */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={editingProformaInvoice.pi_number || ''}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      backgroundColor: '#f9fafb',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={editingProformaInvoice.company_name || ''}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      backgroundColor: '#f9fafb',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Sale Order Number
                  </label>
                  <input
                    type="text"
                    value={editingProformaInvoice.saleorder_no || '-'}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      backgroundColor: '#f9fafb',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Grand Total
                  </label>
                  <input
                    type="text"
                    value={`₹${parseFloat(editingProformaInvoice.grand_total || 0).toFixed(2)}`}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      backgroundColor: '#f9fafb',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              </div>

              {/* Editable fields */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Billing Company <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    value={editFormData.bc_id || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, bc_id: e.target.value })}
                    disabled={loadingBillingCompanies}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${editErrors.bc_id ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      backgroundColor: 'white',
                      outline: 'none',
                      cursor: loadingBillingCompanies ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="">Select billing company</option>
                    {billingCompanies.map((company) => (
                      <option 
                        key={company.bc_id} 
                        value={String(company.bc_id)}
                        selected={String(company.bc_id) === String(editFormData.bc_id)}
                      >
                        {company.bc_name}
                      </option>
                    ))}
                  </select>
                  {editErrors.bc_id && (
                    <p style={{ color: '#dc2626', fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>
                      {editErrors.bc_id}
                    </p>
                  )}
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Invoice Date <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={editFormData.inv_date}
                    onChange={(e) => setEditFormData({ ...editFormData, inv_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${editErrors.inv_date ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      backgroundColor: 'white',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  {editErrors.inv_date && (
                    <p style={{ color: '#dc2626', fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>
                      {editErrors.inv_date}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.75rem',
              borderTop: '1px solid #e5e7eb',
              paddingTop: '1rem'
            }}>
              <button
                onClick={handleEditModalClose}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#d97706',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Proforma Invoice Modal */}
      {showAddProformaModal && (
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
            borderRadius: '0.75rem',
            padding: '2rem',
            width: '100%',
            maxWidth: '600px',
            margin: '1rem',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative'
          }}>
            {/* Close button (X) in top right corner */}
            <button
              onClick={() => {
                setShowAddProformaModal(false);
                setCompanySearchTerm('');
                setShowCompanyDropdown(false);
                setSelectedCompanyIndex(-1);
              }}
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
              Add New Proforma Invoice
            </h3>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (selectedSaleOrderId && proformaInvoiceDate) {
                handleCreateProformaInvoice(selectedSaleOrderId, proformaInvoiceDate);
              }
            }}>
              {/* Contact Selection */}
              <div style={{ marginBottom: '1.5rem' }} className="company-search-container">
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Select Company <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={companySearchTerm}
                    onChange={handleCompanySearch}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowCompanyDropdown(true)}
                    placeholder={loadingContacts ? 'Loading companies...' : 'Search and select a company'}
                    disabled={loadingContacts}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      backgroundColor: loadingContacts ? '#f9fafb' : 'white',
                      outline: 'none',
                      cursor: loadingContacts ? 'not-allowed' : 'text'
                    }}
                  />
                  
                  {/* Dropdown */}
                  {showCompanyDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderTop: 'none',
                      borderRadius: '0 0 0.5rem 0.5rem',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                      {filteredCompanies.length > 0 ? (
                        filteredCompanies.map((contact, index) => (
                          <div
                            key={contact.ld_id}
                            onClick={() => handleCompanySelect(contact)}
                            style={{
                              padding: '0.75rem',
                              cursor: 'pointer',
                              backgroundColor: index === selectedCompanyIndex ? '#f3f4f6' : 'white',
                              borderBottom: index < filteredCompanies.length - 1 ? '1px solid #f3f4f6' : 'none'
                            }}
                            onMouseEnter={() => setSelectedCompanyIndex(index)}
                          >
                            {highlightSearchTerm(contact.company, companySearchTerm)}
                          </div>
                        ))
                      ) : (
                        <div style={{
                          padding: '0.75rem',
                          color: '#6b7280',
                          fontStyle: 'italic'
                        }}>
                          No companies found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sale Order Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Select Sale Order <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={selectedSaleOrderId}
                  onChange={(e) => setSelectedSaleOrderId(e.target.value)}
                  disabled={loadingSaleOrders || !selectedContactId}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    backgroundColor: loadingSaleOrders || !selectedContactId ? '#f9fafb' : 'white',
                    outline: 'none',
                    cursor: loadingSaleOrders || !selectedContactId ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="">
                    {!selectedContactId 
                      ? 'Please select a company first' 
                      : loadingSaleOrders 
                        ? 'Loading sale orders...' 
                        : 'Select a sale order'
                    }
                  </option>
                  {saleOrders.map((saleOrder) => (
                    <option key={saleOrder.id} value={saleOrder.id}>
                      {saleOrder.saleorder_no}
                    </option>
                  ))}
                </select>
              </div>

              {/* Proforma Invoice Date */}
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
                  value={proformaInvoiceDate}
                  onChange={(e) => setProformaInvoiceDate(e.target.value)}
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

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                borderTop: '1px solid #e5e7eb',
                paddingTop: '1rem'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProformaModal(false);
                    setCompanySearchTerm('');
                    setShowCompanyDropdown(false);
                    setSelectedCompanyIndex(-1);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedContactId || !selectedSaleOrderId || !proformaInvoiceDate || creatingProforma}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: (!selectedContactId || !selectedSaleOrderId || !proformaInvoiceDate || creatingProforma) ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: (!selectedContactId || !selectedSaleOrderId || !proformaInvoiceDate || creatingProforma) ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {creatingProforma && (
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid transparent',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  )}
                  {creatingProforma ? 'Creating...' : 'Create Proforma Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && proformaToDelete && (
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
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '2rem',
            width: '100%',
            maxWidth: '500px',
            margin: '1rem',
            position: 'relative'
          }}>
            {/* Close button (X) in top right corner */}
            <button
              onClick={() => setShowDeleteModal(false)}
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

            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '1.5rem',
              paddingRight: '3rem'
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                backgroundColor: '#fef2f2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '1rem'
              }}>
                <AlertCircle size={24} color="#dc2626" />
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0,
                  marginBottom: '0.25rem'
                }}>
                  Delete Proforma Invoice
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#6b7280',
                  margin: 0
                }}>
                  This action cannot be undone
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
                margin: 0,
                fontSize: '0.875rem',
                color: '#374151',
                fontWeight: '500'
              }}>
                Are you sure you want to delete this proforma invoice?
              </p>
              <div style={{ marginTop: '0.75rem' }}>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
                  <strong>Invoice:</strong> {proformaToDelete.pi_number}
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
                  <strong>Company:</strong> {proformaToDelete.company_name}
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
                  <strong>Amount:</strong> ₹{parseFloat(proformaToDelete.grand_total || 0).toFixed(2)}
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
              borderTop: '1px solid #e5e7eb',
              paddingTop: '1rem'
            }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingProforma}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: deletingProforma ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  opacity: deletingProforma ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteProformaInvoice}
                disabled={deletingProforma}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: deletingProforma ? '#9ca3af' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: deletingProforma ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {deletingProforma && (
                  <div style={{
                    width: '1rem',
                    height: '1rem',
                    border: '2px solid #ffffff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                )}
                {deletingProforma ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Proforma Invoice Modal */}
      {showSendModal && selectedProformaForSend && (
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
            borderRadius: '0.5rem',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#111827'
              }}>
                Send Proforma Invoice - {selectedProformaForSend.pi_number}
              </h2>
              <button
                onClick={handleCloseSendModal}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  To Emails
                </label>
                <input
                  type="text"
                  value={toEmails}
                  onChange={(e) => {
                    setToEmails(e.target.value);
                    // Clear errors when user starts typing
                    if (sendModalErrors.toEmails) {
                      setSendModalErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.toEmails;
                        return newErrors;
                      });
                    }
                    // Clear recipients error when user types in To Emails
                    if (sendModalErrors.recipients) {
                      setSendModalErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.recipients;
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    // Validate on blur
                    if (toEmails.trim()) {
                      const toValidation = validateEmailList(toEmails);
                      if (!toValidation.isValid) {
                        if (toValidation.errorType === 'space_separation') {
                          setSendModalErrors(prev => ({
                            ...prev,
                            toEmails: 'Please add comma between email addresses (e.g., email1@domain.com, email2@domain.com)'
                          }));
                        } else {
                          setSendModalErrors(prev => ({
                            ...prev,
                            toEmails: `Invalid email format: ${toValidation.invalidEmails.join(', ')}`
                          }));
                        }
                      }
                    }
                  }}
                  placeholder="Enter email addresses separated by commas (optional)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#111827',
                    backgroundColor: '#ffffff'
                  }}
                />
                {sendModalErrors.toEmails && (
                  <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {sendModalErrors.toEmails}
                  </p>
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
                  CC Emails
                </label>
                <input
                  type="text"
                  value={ccEmails}
                  onChange={(e) => {
                    setCcEmails(e.target.value);
                    // Clear errors when user starts typing
                    if (sendModalErrors.ccEmails) {
                      setSendModalErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.ccEmails;
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    // Validate on blur
                    if (ccEmails.trim()) {
                      const ccValidation = validateEmailList(ccEmails);
                      if (!ccValidation.isValid) {
                        if (ccValidation.errorType === 'space_separation') {
                          setSendModalErrors(prev => ({
                            ...prev,
                            ccEmails: 'Please add comma between email addresses (e.g., email1@domain.com, email2@domain.com)'
                          }));
                        } else {
                          setSendModalErrors(prev => ({
                            ...prev,
                            ccEmails: `Invalid email format: ${ccValidation.invalidEmails.join(', ')}`
                          }));
                        }
                      }
                    }
                  }}
                  placeholder="Enter CC email addresses separated by commas (optional)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#111827',
                    backgroundColor: '#ffffff'
                  }}
                />
                {sendModalErrors.ccEmails && (
                  <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {sendModalErrors.ccEmails}
                  </p>
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
                  Mail Body Message <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                  placeholder="Enter your message here..."
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#111827',
                    backgroundColor: '#ffffff',
                    resize: 'vertical'
                  }}
                />
                {sendModalErrors.mailBody && (
                  <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {sendModalErrors.mailBody}
                  </p>
                )}
              </div>

              {/* Send to Customer Checkbox */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={sendToCustomer}
                    onChange={(e) => {
                      setSendToCustomer(e.target.checked);
                      // Clear recipients error when checkbox is toggled
                      if (sendModalErrors.recipients) {
                        setSendModalErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.recipients;
                          return newErrors;
                        });
                      }
                    }}
                    style={{
                      marginRight: '0.5rem',
                      width: '1rem',
                      height: '1rem',
                      cursor: 'pointer'
                    }}
                  />
                  Select this option to send the proforma invoice to the customer's contact email address ({selectedProformaForSend.contact_email || 'N/A'})
                </label>
                {sendModalErrors.recipients && (
                  <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {sendModalErrors.recipients}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                marginTop: '2rem'
              }}>
                <button
                  onClick={handleCloseSendModal}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !mailBody.trim() || Object.keys(sendModalErrors).length > 0}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: (mailBody.trim() && !sendingEmail && Object.keys(sendModalErrors).length === 0) ? '#16a34a' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: (mailBody.trim() && !sendingEmail && Object.keys(sendModalErrors).length === 0) ? 'pointer' : 'not-allowed'
                  }}
                >
                  {sendingEmail ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Confirmation Modal */}
      {showSendConfirmation && (
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
          zIndex: 1002,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#fef3c7',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
              </div>
              <h3 style={{
                margin: '0 0 1rem 0',
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#374151'
              }}>
                Send Proforma Invoice Email?
              </h3>
              <p style={{
                margin: '0 0 2rem 0',
                color: '#6b7280',
                fontSize: '0.875rem'
              }}>
                Are you sure you want to send this proforma invoice email? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowSendConfirmation(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSendEmail}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProformaInvoice;
