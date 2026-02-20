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
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Calculator,
  AlertCircle,
  Eye
} from 'lucide-react';

const SaleOrder = () => {
  const { user } = useAuth();
  const [saleOrders, setSaleOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Modal and form states
  const [showModal, setShowModal] = useState(false);
  const [editingSaleOrder, setEditingSaleOrder] = useState(null);
  const [showOutstandingModal, setShowOutstandingModal] = useState(false);
  const [selectedSaleOrder, setSelectedSaleOrder] = useState(null);
  const [outstandingData, setOutstandingData] = useState(null);
  
  // Sale order view modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingSaleOrder, setViewingSaleOrder] = useState(null);
  const [saleOrderDetails, setSaleOrderDetails] = useState(null);
  const [loadingSaleOrderDetails, setLoadingSaleOrderDetails] = useState(false);
  
  // Invoice history modal state
  const [showInvoiceHistoryModal, setShowInvoiceHistoryModal] = useState(false);
  const [selectedServiceDetail, setSelectedServiceDetail] = useState(null);
  const [invoiceHistory, setInvoiceHistory] = useState(null);
  const [loadingInvoiceHistory, setLoadingInvoiceHistory] = useState(false);
  const [formData, setFormData] = useState({
    contact_id: '',
    quotation_id: '',
    billing_company_id: '',
    from_date: '',
    to_date: '',
    is_invoiced: 0
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  // Searchable select states
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState(-1);
  
  // Dropdown data
  const [dropdownData, setDropdownData] = useState({
    companies: [],
    quotations: [],
    quotationServices: [],
    billCycles: [],
    taxRates: [],
    billingCompanies: []
  });
  
  // Loading states
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [loadingQuotationServices, setLoadingQuotationServices] = useState(false);
  const [loadingBillCycles, setLoadingBillCycles] = useState(false);
  const [loadingTaxRates, setLoadingTaxRates] = useState(false);
  const [loadingBillingCompanies, setLoadingBillingCompanies] = useState(false);

  // Fetch sale orders
  const fetchSaleOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);

      const response = await api.get(`/sale-orders.php?${params}`);
      if (response.data.success) {
        setSaleOrders(response.data.data);
        setTotalPages(response.data.pagination.total_pages);
        setTotalItems(response.data.pagination.total_items);
      }
    } catch (error) {
      console.error('Error fetching sale orders:', error);
      toast.error('Failed to fetch sale orders');
    } finally {
      setLoading(false);
    }
  };

  // Fetch dropdown data - companies with active quotations
  const fetchDropdownData = async () => {
    try {
      const response = await api.get('/companies-with-quotations.php');
      if (response.data.success) {
        setDropdownData(prev => ({
          ...prev,
          companies: response.data.data || []
        }));
      }
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
      toast.error('Failed to fetch dropdown data');
    }
  };

  // Initialize filtered companies when dropdownData changes
  useEffect(() => {
    if (dropdownData.companies.length > 0) {
      setFilteredCompanies(dropdownData.companies);
    }
  }, [dropdownData.companies]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCompanyDropdown && !event.target.closest('[data-company-dropdown]')) {
        setShowCompanyDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCompanyDropdown]);

  // Fetch bill cycles
  const fetchBillCycles = async () => {
    setLoadingBillCycles(true);
    try {
      const response = await api.get('/bill-cycles.php');
      if (response.data.success) {
        setDropdownData(prev => ({
          ...prev,
          billCycles: response.data.data || []
        }));
      }
    } catch (error) {
      console.error('Error fetching bill cycles:', error);
      toast.error('Failed to fetch bill cycles');
    } finally {
      setLoadingBillCycles(false);
    }
  };

  // Fetch tax rates
  const fetchTaxRates = async () => {
    setLoadingTaxRates(true);
      try {
        const response = await api.get('/tax.php');
        if (response.data.success) {
          const taxData = response.data.data || [];
        setDropdownData(prev => ({
          ...prev,
          taxRates: taxData
        }));
      } else {
        console.error('Tax API Error:', response.data.message);
        toast.error('Failed to fetch tax rates: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error fetching tax rates:', error);
      toast.error('Failed to fetch tax rates');
    } finally {
      setLoadingTaxRates(false);
    }
  };

  // Fetch billing companies for selected quotation
  const fetchBillingCompanies = async (quotationId) => {
    if (!quotationId) {
      setDropdownData(prev => ({
        ...prev,
        billingCompanies: []
      }));
      return;
    }
    
    setLoadingBillingCompanies(true);
      try {
        const response = await api.get(`/billing-companies-by-quotation.php?quotation_id=${quotationId}`);
        if (response.data.success) {
          const billingData = response.data.data || [];
        
        // Find the selected billing company using ternary operator pattern
        const selectedBillingCompany = billingData.find(company => 
          company.selected_bill_company_id && 
          company.selected_bill_company_id === company.bill_company_id
        );
        
        setDropdownData(prev => ({
          ...prev,
          billingCompanies: billingData
        }));
        
        // Auto-select the billing company if one is found
        if (selectedBillingCompany) {
          setFormData(prev => ({
            ...prev,
            billing_company_id: selectedBillingCompany.bill_company_id
          }));
        }
      } else {
        console.error('Billing Companies API Error:', response.data.message);
        toast.error('Failed to fetch billing companies: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error fetching billing companies:', error);
      toast.error('Failed to fetch billing companies');
    } finally {
      setLoadingBillingCompanies(false);
    }
  };

  // Fetch all billing companies for edit mode
  const fetchAllBillingCompanies = async () => {
    setLoadingBillingCompanies(true);
    try {
      const response = await api.get('/bill-companies.php');
      if (response.data.success) {
        const billingData = response.data.data.map(company => ({
          bill_company_id: company.bc_id,
          company_name: company.bc_name,
          company_address: company.bc_address,
          gst_no: company.gst_no,
          msme_no: company.msme_no
        }));
        
        setDropdownData(prev => ({
          ...prev,
          billingCompanies: billingData
        }));
      } else {
        console.error('Billing Companies API Error:', response.data.message);
        toast.error('Failed to fetch billing companies: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error fetching billing companies:', error);
      toast.error('Failed to fetch billing companies');
    } finally {
      setLoadingBillingCompanies(false);
    }
  };

  // Fetch accepted quotations for selected company
  const fetchAcceptedQuotations = async (contactId) => {
    if (!contactId) {
      setDropdownData(prev => ({
        ...prev,
        quotations: [],
        quotationServices: []
      }));
      return;
    }
    
    setLoadingQuotations(true);
    try {
      const response = await api.get(`/accepted-quotations.php?contact_id=${contactId}`);
      if (response.data.success) {
        setDropdownData(prev => ({
          ...prev,
          quotations: response.data.data,
          quotationServices: []
        }));
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
      toast.error('Failed to fetch quotations');
    } finally {
      setLoadingQuotations(false);
    }
  };

  // Fetch quotation services
  const fetchQuotationServices = async (quotationId) => {
    if (!quotationId) {
      setDropdownData(prev => ({
        ...prev,
        quotationServices: []
      }));
      return;
    }
    
    setLoadingQuotationServices(true);
    try {
      const response = await api.get(`/quotation-services.php?quotation_id=${quotationId}`);
      if (response.data.success) {
        setDropdownData(prev => ({
          ...prev,
          quotationServices: response.data.data
        }));
      }
    } catch (error) {
      console.error('Error fetching quotation services:', error);
      toast.error('Failed to fetch quotation services');
    } finally {
      setLoadingQuotationServices(false);
    }
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Handle company search
  const handleCompanySearch = (searchTerm) => {
    setCompanySearchTerm(searchTerm);
    setShowCompanyDropdown(true);
    setSelectedCompanyIndex(-1);
    
    if (searchTerm.trim() === '') {
      setFilteredCompanies(dropdownData.companies);
    } else {
      const filtered = dropdownData.companies.filter(company =>
        company.company_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCompanies(filtered);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showCompanyDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedCompanyIndex(prev => 
          prev < filteredCompanies.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedCompanyIndex(prev => 
          prev > 0 ? prev - 1 : filteredCompanies.length - 1
        );
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

  // Handle company selection from dropdown
  const handleCompanySelect = (company) => {
    setCompanySearchTerm(company.company_name);
    setShowCompanyDropdown(false);
    setSelectedCompanyIndex(-1);
    handleCompanyChange({ target: { value: company.contact_id } });
  };

  // Highlight search term in company name
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

  // Handle company selection - directly fetch accepted quotations for the company
  const handleCompanyChange = (e) => {
    const contactId = e.target.value;
    setFormData(prev => ({
      ...prev,
      contact_id: contactId,
      quotation_id: ''
    }));

    // Clear errors when company is selected
    setErrors(prev => ({
      ...prev,
      contact_id: ''
    }));
    
    // Clear quotations when company changes
    setDropdownData(prev => ({
      ...prev,
      quotations: []
    }));
    // Fetch accepted quotations for this company
    if (contactId) {
      fetchAcceptedQuotations(contactId);
    }
  };

  // Handle quotation selection
  const handleQuotationChange = (e) => {
    const quotationId = e.target.value;
    const selectedQuotation = dropdownData.quotations.find(q => q.id == quotationId);
    
    setFormData(prev => ({
      ...prev,
      quotation_id: quotationId,
      billing_company_id: '', // Will be set after billing companies are fetched
      from_date: selectedQuotation?.contract_from_date || '',
      to_date: selectedQuotation?.contract_to_date || ''
    }));
    
    // Clear errors when quotation is selected
    setErrors(prev => ({
      ...prev,
      quotation_id: ''
    }));
    
    // Fetch billing companies and quotation services
    fetchBillingCompanies(quotationId);
    fetchQuotationServices(quotationId);
  };

  // Handle bill cycle change for a specific service
  const handleServiceBillCycleChange = (serviceIndex, billCycleId) => {
    setDropdownData(prev => ({
      ...prev,
      quotationServices: prev.quotationServices.map((service, index) => {
        if (index === serviceIndex) {
          const updatedService = { ...service, bill_cycle_id: billCycleId };
          
          // Clear validation errors for this service
          updatedService.validationErrors = {};
          
          // If from_date is already set, auto-calculate to_date
          if (service.from_date && billCycleId) {
            const selectedBillCycle = prev.billCycles.find(cycle => cycle.id == billCycleId);
            const cycleName = selectedBillCycle?.cycle_name?.toLowerCase() || '';
            
            // Only show for exact "Yearly" or "Annual" matches (not "Half Yearly" or other variations)
            const isYearly = selectedBillCycle && (
              (cycleName === 'yearly' || cycleName === 'annual') ||
              (cycleName.includes('yearly') && !cycleName.includes('half') && !cycleName.includes('quarter')) ||
              (cycleName.includes('annual') && !cycleName.includes('half') && !cycleName.includes('quarter'))
            );
            
            if (isYearly) {
              // For yearly bill cycle, use duration (default 1 year if not entered or 0)
              const duration = (service.duration && parseInt(service.duration) > 0) ? parseInt(service.duration) : 1;
              const fromDate = new Date(service.from_date);
              const toDate = new Date(fromDate);
              toDate.setFullYear(toDate.getFullYear() + duration);
              toDate.setDate(toDate.getDate() - 1);
              updatedService.to_date = toDate.toISOString().split('T')[0];
            } else {
              // For non-yearly bill cycles, clear duration and calculate to_date using month_terms
              updatedService.duration = null;
              if (selectedBillCycle && selectedBillCycle.month_terms) {
                updatedService.to_date = calculateToDate(service.from_date, selectedBillCycle.month_terms);
              }
            }
          }
          
          // Calculate bill amount based on cycle_terms
          if (billCycleId) {
            const selectedBillCycle = prev.billCycles.find(cycle => cycle.id == billCycleId);
            if (selectedBillCycle) {
              // For one-time payments (cycle_terms = 0), use full amount
              // For recurring payments, divide by cycle_terms
              if (selectedBillCycle.cycle_terms === 0 || selectedBillCycle.cycle_terms === null) {
                updatedService.bill_amount = parseFloat(service.amount) || 0;
              } else {
              updatedService.bill_amount = calculateBillAmount(service.amount, selectedBillCycle.cycle_terms);
              }
              
              // Calculate tax amounts based on selected tax
              const selectedTax = prev.taxRates.find(tax => tax.tax_id == service.tax_id);
              if (selectedTax) {
                const igstPercentage = selectedTax.igst || 0;
                const cgstPercentage = selectedTax.cgst || 0;
                const sgstPercentage = selectedTax.sgst || 0;
                
                updatedService.igst_amount = calculateTaxAmount(updatedService.bill_amount, igstPercentage);
                updatedService.cgst_amount = calculateTaxAmount(updatedService.bill_amount, cgstPercentage);
                updatedService.sgst_amount = calculateTaxAmount(updatedService.bill_amount, sgstPercentage);
                updatedService.tax_amount = updatedService.igst_amount; // Keep for compatibility
              } else {
                // If no tax selected, set all tax amounts to 0
                updatedService.igst_amount = 0;
                updatedService.cgst_amount = 0;
                updatedService.sgst_amount = 0;
                updatedService.tax_amount = 0;
              }
              
              // Calculate total amount
              updatedService.total_amount = calculateTotalAmount(updatedService.bill_amount, updatedService.igst_amount);
            }
          }
          
          return updatedService;
        }
        return service;
      })
    }));
  };

  // Calculate to date based on from date and month terms
  const calculateToDate = (fromDate, monthTerms) => {
    if (!fromDate || !monthTerms) return '';
    
    const from = new Date(fromDate);
    const to = new Date(from);
    
    // Add months to the date
    to.setMonth(to.getMonth() + parseInt(monthTerms));
    
    // Subtract one day to get the end date of the period
    to.setDate(to.getDate() - 1);
    
    return to.toISOString().split('T')[0];
  };

  // Calculate bill amount based on amount and cycle_terms
  const calculateBillAmount = (amount, cycleTerms) => {
    if (!amount) return 0;
    
    // If cycle_terms is 0 or not provided, treat as one-time payment (full amount)
    if (!cycleTerms || cycleTerms === 0) {
      return parseFloat(amount);
    }
    
    const result = parseFloat(amount) / parseInt(cycleTerms);
    return isNaN(result) ? 0 : result;
  };

  // Calculate tax amount based on bill amount and tax percentage
  const calculateTaxAmount = (billAmount, taxPercentage) => {
    if (!billAmount || !taxPercentage) return 0;
    const result = (parseFloat(billAmount) * parseFloat(taxPercentage)) / 100;
    return isNaN(result) ? 0 : result;
  };

  // Calculate total amount (bill amount + tax amount)
  const calculateTotalAmount = (billAmount, taxAmount) => {
    const result = parseFloat(billAmount || 0) + parseFloat(taxAmount || 0);
    return isNaN(result) ? 0 : result;
  };

  // Handle date change for a specific service
  const handleServiceDateChange = (serviceIndex, dateType, dateValue) => {
    setDropdownData(prev => ({
      ...prev,
      quotationServices: prev.quotationServices.map((service, index) => {
        if (index === serviceIndex) {
          const updatedService = { ...service, [dateType]: dateValue };
          
          // Clear validation errors for this service
          updatedService.validationErrors = { ...service.validationErrors };
          delete updatedService.validationErrors[dateType];
          
          // If from_date is changed and we have bill_cycle_id, auto-calculate to_date
          if (dateType === 'from_date' && service.bill_cycle_id) {
            const selectedBillCycle = prev.billCycles.find(cycle => cycle.id == service.bill_cycle_id);
            const cycleName = selectedBillCycle?.cycle_name?.toLowerCase() || '';
            
            // Only show for exact "Yearly" or "Annual" matches (not "Half Yearly" or other variations)
            const isYearly = selectedBillCycle && (
              (cycleName === 'yearly' || cycleName === 'annual') ||
              (cycleName.includes('yearly') && !cycleName.includes('half') && !cycleName.includes('quarter')) ||
              (cycleName.includes('annual') && !cycleName.includes('half') && !cycleName.includes('quarter'))
            );
            
            if (isYearly) {
              // For yearly bill cycle, use duration (default 1 year if not entered or 0)
              const duration = (service.duration && parseInt(service.duration) > 0) ? parseInt(service.duration) : 1;
              const fromDate = new Date(dateValue);
              const toDate = new Date(fromDate);
              toDate.setFullYear(toDate.getFullYear() + duration);
              toDate.setDate(toDate.getDate() - 1);
              updatedService.to_date = toDate.toISOString().split('T')[0];
            } else if (selectedBillCycle && selectedBillCycle.month_terms) {
              // For other bill cycles, use month_terms
              updatedService.to_date = calculateToDate(dateValue, selectedBillCycle.month_terms);
            }
          }
          
          // Validate dates
          if (dateType === 'from_date' && dateValue && service.to_date) {
            if (new Date(dateValue) >= new Date(service.to_date)) {
              updatedService.validationErrors = {
                ...updatedService.validationErrors,
                from_date: 'From date must be before to date'
              };
            }
          }
          
          if (dateType === 'to_date' && dateValue && service.from_date) {
            if (new Date(service.from_date) >= new Date(dateValue)) {
              updatedService.validationErrors = {
                ...updatedService.validationErrors,
                to_date: 'To date must be after from date'
              };
            }
          }
          
          return updatedService;
        }
        return service;
      })
    }));
  };

  // Handle duration change for a specific service
  const handleDurationChange = (serviceIndex, durationValue) => {
    setDropdownData(prev => ({
      ...prev,
      quotationServices: prev.quotationServices.map((service, index) => {
        if (index === serviceIndex) {
          // Parse duration value, defaulting to null if empty or 0
          const parsedDuration = durationValue ? parseInt(durationValue) : null;
          const updatedService = { ...service, duration: parsedDuration };
          
          // Clear validation errors when user starts typing
          if (updatedService.validationErrors?.duration) {
            updatedService.validationErrors = { ...updatedService.validationErrors };
            delete updatedService.validationErrors.duration;
          }
          
          // Auto-calculate to_date based on duration if bill cycle is yearly and from_date is set
          if (service.from_date) {
            // Check if bill cycle is yearly
            const selectedBillCycle = prev.billCycles.find(cycle => cycle.id == service.bill_cycle_id);
            const isYearly = selectedBillCycle && (selectedBillCycle.cycle_name?.toLowerCase().includes('yearly') || 
                                                   selectedBillCycle.cycle_name?.toLowerCase().includes('annual'));
            
            if (isYearly) {
              // If no duration entered (null or empty), default to 1 year
              const duration = parsedDuration && parsedDuration > 0 ? parsedDuration : 1;
              
              // Calculate to_date: From Date + duration years (showing the day before the new period starts)
              const fromDate = new Date(service.from_date);
              const toDate = new Date(fromDate);
              toDate.setFullYear(toDate.getFullYear() + duration);
              
              // Set to last day before the new period starts (day before the anniversary date)
              toDate.setDate(toDate.getDate() - 1);
              
              updatedService.to_date = toDate.toISOString().split('T')[0];
            }
          }
          
          return updatedService;
        }
        return service;
      })
    }));
  };

  // Handle tax change for a specific service
  const handleServiceTaxChange = (serviceIndex, taxId) => {
    setDropdownData(prev => ({
      ...prev,
      quotationServices: prev.quotationServices.map((service, index) => {
        if (index === serviceIndex) {
          const updatedService = { ...service, tax_id: taxId };
          
          // Clear validation errors for this service
          updatedService.validationErrors = { ...service.validationErrors };
          delete updatedService.validationErrors.tax_id;
          
          // Recalculate tax amounts and total if bill amount exists
          if (service.bill_amount && taxId) {
            const selectedTax = prev.taxRates.find(tax => tax.tax_id == taxId);
              if (selectedTax) {
                const igstPercentage = selectedTax.igst || 0;
                const cgstPercentage = selectedTax.cgst || 0;
                const sgstPercentage = selectedTax.sgst || 0;
                
                updatedService.igst_amount = calculateTaxAmount(service.bill_amount, igstPercentage);
                updatedService.cgst_amount = calculateTaxAmount(service.bill_amount, cgstPercentage);
                updatedService.sgst_amount = calculateTaxAmount(service.bill_amount, sgstPercentage);
                updatedService.tax_amount = updatedService.igst_amount; // Keep for compatibility
                updatedService.total_amount = calculateTotalAmount(service.bill_amount, updatedService.igst_amount);
              } else {
                // If no tax found, set all tax amounts to 0
                updatedService.igst_amount = 0;
                updatedService.cgst_amount = 0;
                updatedService.sgst_amount = 0;
                updatedService.tax_amount = 0;
                updatedService.total_amount = service.bill_amount;
              }
          }
          
          return updatedService;
        }
        return service;
      })
    }));
  };

  // Handle service selection checkbox - allow both checking and unchecking in edit mode
  const handleServiceSelection = (serviceIndex, isSelected) => {
    // If unchecking in edit mode, show warning
    if (editingSaleOrder && !isSelected) {
      const service = dropdownData.quotationServices[serviceIndex];
      const confirmed = window.confirm(
        `⚠️ WARNING: You are about to remove "${service.service_name}" from this sale order.\n\n` +
        `This action will:\n` +
        `• Remove the service from the sale order\n` +
        `• Mark the service as deleted\n` +
        `• Reset the quotation service status\n\n` +
        `Are you sure you want to continue?`
      );
      
      if (!confirmed) {
        return; // User cancelled, don't uncheck
      }
    }
    
    setDropdownData(prev => ({
      ...prev,
      quotationServices: prev.quotationServices.map((service, index) => {
        if (index === serviceIndex) {
          return { ...service, selected: isSelected };
        }
        return service;
      })
    }));
  };

  // Handle billing company selection
  const handleBillingCompanyChange = (e) => {
    const billingCompanyId = e.target.value;
    setFormData(prev => ({
      ...prev,
      billing_company_id: billingCompanyId
    }));
    
    // Clear errors when billing company is selected
    setErrors(prev => ({
      ...prev,
      billing_company_id: ''
    }));
  };

  // Validate selected services with comprehensive checks
  const validateSelectedServices = () => {
    const selectedServices = dropdownData.quotationServices.filter(service => service.selected);
    
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return false;
    }
    
    let hasErrors = false;
    const updatedServices = dropdownData.quotationServices.map(service => {
      if (!service.selected) {
        return { ...service, validationErrors: {} };
      }
      
      const errors = {};
      
      // Validate bill cycle
      if (!service.bill_cycle_id) {
        errors.bill_cycle_id = 'Bill cycle is required';
        hasErrors = true;
      }
      
      // Validate from date
      if (!service.from_date) {
        errors.from_date = 'From date is required';
        hasErrors = true;
      }
      
      // Validate to date
      if (!service.to_date) {
        errors.to_date = 'To date is required';
        hasErrors = true;
      }
      
      // Validate tax
      if (!service.tax_id) {
        errors.tax_id = 'Tax is required';
        hasErrors = true;
      }
      
      // Validate date logic
      if (service.from_date && service.to_date) {
        if (new Date(service.from_date) >= new Date(service.to_date)) {
          errors.from_date = 'From date must be before to date';
          errors.to_date = 'To date must be after from date';
          hasErrors = true;
        }
      }
      
      // Validate calculated amounts
      if (service.bill_cycle_id && (!service.bill_amount || service.bill_amount <= 0)) {
        errors.bill_amount = 'Bill amount calculation failed';
        hasErrors = true;
      }
      
      if (service.tax_id && service.igst_amount < 0) {
        errors.tax_amount = 'Tax amount calculation failed';
        hasErrors = true;
      }
      
      if (service.bill_cycle_id && service.tax_id && (!service.total_amount || service.total_amount <= 0)) {
        errors.total_amount = 'Total amount calculation failed';
        hasErrors = true;
      }
      
      return { ...service, validationErrors: errors };
    });
    
    // Update the state with all validation errors
    setDropdownData(prev => ({
      ...prev,
      quotationServices: updatedServices
    }));
    
    if (hasErrors) {
      toast.error('Please fix all validation errors before submitting');
      return false;
    }
    
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = {};
    
    if (editingSaleOrder) {
      // Edit mode: Validate billing company and at least one service
      if (!formData.billing_company_id) {
        newErrors.billing_company_id = 'Please select a billing company';
        toast.error('Please select a billing company');
      }
      
      // Check if at least one service is selected
      const selectedServices = dropdownData.quotationServices.filter(service => service.selected);
      if (selectedServices.length === 0) {
        newErrors.services = 'Please select at least one service';
        toast.error('Please select at least one service to update');
      }
    } else {
      // Create mode: Validate company, quotation, and billing company
      if (!formData.contact_id) {
        newErrors.contact_id = 'Please select a company';
        toast.error('Please select a company');
      }
      if (!formData.quotation_id) {
        newErrors.quotation_id = 'Please select a quotation';
        toast.error('Please select a quotation');
      }
      if (!formData.billing_company_id) {
        newErrors.billing_company_id = 'Please select a billing company';
        toast.error('Please select a billing company');
      }
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    // Validation - selected services
    if (!validateSelectedServices()) {
      return;
    }
    
    try {
      // Filter only selected services
      const selectedServices = dropdownData.quotationServices.filter(service => service.selected);
      
      // Calculate grand totals
      const subTotal = selectedServices.reduce((sum, service) => {
        const billAmount = parseFloat(service.bill_amount) || 0;
        return sum + billAmount;
      }, 0);
      
      const grandTotal = selectedServices.reduce((sum, service) => {
        const totalAmount = parseFloat(service.total_amount) || 0;
        return sum + totalAmount;
      }, 0);
      
      // Calculate total GST amount based on amount field from selected services
      const gstTotAmt = selectedServices.reduce((sum, service) => {
        const amount = parseFloat(service.amount) || 0;
        return sum + amount;
      }, 0);
      
      const submitData = {
        contact_id: formData.contact_id,
        quotation_id: formData.quotation_id,
        bc_id: formData.billing_company_id,
        sub_total: subTotal,
        grand_total: grandTotal,
        gst_tot_amt: gstTotAmt,
        is_invoiced: formData.is_invoiced,
        services: selectedServices.map(service => ({
          quotation_service_id: service.id,
          service_name: service.service_name,
          service_id: service.service_id,
          quantity: service.quantity,
          rate: service.rate,
          amount: service.amount,
          tax_id: service.tax_id,
          bill_amount: service.bill_amount,
          tax_amount: service.tax_amount,
          igst_amount: service.igst_amount,
          total_amount: service.total_amount,
          bill_cycle_id: service.bill_cycle_id,
          from_date: service.from_date,
          to_date: service.to_date,
          duration: service.duration || null // Add duration field (null if not provided)
        }))
        };
      
      const updateData = editingSaleOrder 
        ? { 
            sale_order_id: editingSaleOrder.id,
            billing_company_id: formData.billing_company_id,
            services: selectedServices.map(service => ({
              id: service.id, // This should be the sale_order_details.id
              quotation_service_id: service.quotation_service_id, // Add quotation_service_id
              bill_cycle_id: service.bill_cycle_id,
              from_date: service.from_date,
              to_date: service.to_date,
              duration: service.duration !== undefined && service.duration !== null && service.duration !== '' ? service.duration : null, // Add duration field with proper handling
              tax_id: service.tax_id,
              amount: service.amount, // Add base amount field
              igst_amount: service.igst_amount,
              cgst_amount: service.cgst_amount,
              sgst_amount: service.sgst_amount,
              bill_amount: service.bill_amount,
              total_amount: service.total_amount
            }))
          }
        : submitData;
      
      
      const response = editingSaleOrder 
        ? await api.put('/update-sale-order.php', updateData)
        : await api.post('/create-sale-order.php', submitData);
      
      if (response.data.success) {
        let successMessage = response.data.message;
        if (editingSaleOrder) {
          successMessage += ` - SO-${editingSaleOrder.so_number}`;
        } else {
          successMessage += ` - ${response.data.saleorder_no}`;
        if (response.data.proforma_invoice_generated) {
          successMessage += ` | Proforma Invoice: ${response.data.proforma_invoice_no}`;
          }
        }
        toast.success(successMessage);
        setShowModal(false);
        setEditingSaleOrder(null);
        resetForm();
        fetchSaleOrders();
      }
    } catch (error) {
      console.error('=== SALE ORDER SUBMISSION ERROR ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error config:', error.config);
      console.error('=== END ERROR ===');
      toast.error('Error saving sale order: ' + (error.response?.data?.message || error.message));
    }
  };

  // Handle edit
  const handleEdit = async (saleOrder) => {
    // Check if sale order is invoiced
    if (saleOrder.is_invoiced === 1) {
      toast.error('Cannot edit invoiced sale orders. This record has been moved to proforma invoice.');
      return;
    }
    
    setEditingSaleOrder(saleOrder);
    setShowModal(true);
    
    try {
      // Load all dropdown data first
      await Promise.all([
        fetchDropdownData(), // This loads companies with quotations
        fetchBillCycles(),
        fetchTaxRates()
      ]);
      
      // Fetch sale order details
      const response = await api.get(`/sale-order-details.php?id=${saleOrder.id}`);
      if (response.data.success) {
        const details = response.data.data;
        
        // Set form data with existing values
        
    setFormData({
      contact_id: saleOrder.contact_id || '',
      quotation_id: saleOrder.quotation_id,
          billing_company_id: details.sale_order.bc_id || '',
          from_date: saleOrder.from_date || '',
          to_date: saleOrder.to_date || ''
        });
        
        // Set company search term for display
        setCompanySearchTerm(saleOrder.company_name || '');
        
        // Load quotations for the selected company
        if (saleOrder.contact_id) {
          await fetchAcceptedQuotations(saleOrder.contact_id);
        }
        
        // Load all billing companies for edit mode
        await fetchAllBillingCompanies();
        
        // Convert sale order details to quotation services format
        const services = details.details.map(detail => {
          return {
            id: detail.id,
            quotation_service_id: detail.quotation_service_id, // Add quotation_service_id
            service_name: detail.service_name,
            qty: detail.qty,
            quantity: detail.qty, // Add quantity field for display
            rate: detail.rate,
            amount: detail.amount,
            igst: detail.igst,
            cgst: detail.cgst,
            sgst: detail.sgst,
            igst_amount: detail.igst_amount,
            cgst_amount: detail.cgst_amount,
            sgst_amount: detail.sgst_amount,
            bill_amount: detail.bill_amount,
            total_amount: detail.total_amount,
            bill_cycle_id: detail.bill_cycle_id,
            tax_id: detail.tax_id, // Include tax_id for proper selection
            from_date: detail.from_date,
            to_date: detail.to_date,
            duration: detail.duration || null, // Add duration field
            bill_cycle_name: detail.bill_cycle_name,
            selected: true, // Mark as selected since it's existing data
            is_selected: true // Also keep this for compatibility
          };
        });
        
        // Update dropdown data with existing services
        setDropdownData(prev => ({
          ...prev,
          quotationServices: services
        }));
        
        // Totals will be calculated dynamically by the component
        
      } else {
        toast.error('Failed to load sale order details');
      }
    } catch (error) {
      console.error('Error loading sale order details:', error);
      toast.error('Failed to load sale order details');
    }
  };

  // Handle delete
  const handleDelete = async (saleOrder) => {
    // Check if sale order can be deleted
    if (saleOrder.status === 'closed') {
      toast.error('Cannot delete closed sale orders');
      return;
    }
    
    if (saleOrder.is_invoiced === 1) {
      toast.error('Cannot delete invoiced sale orders. This record has been moved to proforma invoice.');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete sale order ${saleOrder.so_number}?`)) {
      try {
        const response = await api.delete('/sale-orders.php', {
          data: { id: saleOrder.id }
        });
        
        if (response.data.success) {
          toast.success(response.data.message);
          fetchSaleOrders();
        } else {
          toast.error(response.data.message);
        }
      } catch (error) {
        console.error('Error deleting sale order:', error);
        const errorMessage = error.response?.data?.message || 'Error deleting sale order';
        toast.error(errorMessage);
      }
    }
  };

  // Handle view sale order details
  const handleView = async (saleOrder) => {
    setViewingSaleOrder(saleOrder);
    setLoadingSaleOrderDetails(true);
    setShowViewModal(true);
    
    try {
      const response = await api.get(`/sale-order-details.php?id=${saleOrder.id}`);
      if (response.data.success) {
        setSaleOrderDetails(response.data.data);
      } else {
        toast.error('Failed to load sale order details');
      }
    } catch (error) {
      console.error('Error fetching sale order details:', error);
      toast.error('Failed to load sale order details');
    } finally {
      setLoadingSaleOrderDetails(false);
    }
  };

  // Handle close view modal
  const handleCloseView = () => {
    setShowViewModal(false);
    setViewingSaleOrder(null);
    setSaleOrderDetails(null);
  };

  // Handle bill cycle click to show invoice history
  const handleBillCycleClick = async (serviceDetail) => {
    setSelectedServiceDetail(serviceDetail);
    setLoadingInvoiceHistory(true);
    setShowInvoiceHistoryModal(true);
    
    try {
      const response = await api.get(`/service-invoice-history.php?sale_order_detail_id=${serviceDetail.id}`);
      if (response.data.success) {
        setInvoiceHistory(response.data.data);
      } else {
        toast.error('Failed to load invoice history');
      }
    } catch (error) {
      console.error('Error fetching invoice history:', error);
      toast.error('Failed to load invoice history');
    } finally {
      setLoadingInvoiceHistory(false);
    }
  };

  // Handle close invoice history modal
  const handleCloseInvoiceHistory = () => {
    setShowInvoiceHistoryModal(false);
    setSelectedServiceDetail(null);
    setInvoiceHistory(null);
  };

  // Handle outstanding amount check
  const handleOutstandingCheck = async (saleOrder) => {
    setSelectedSaleOrder(saleOrder);
    setShowOutstandingModal(true);
    
    try {
      const response = await api.get(`/sale-order-outstanding.php?sale_order_id=${saleOrder.id}`);
      if (response.data.success) {
        setOutstandingData(response.data.data);
      } else {
        toast.error('Failed to fetch outstanding amount details');
      }
    } catch (error) {
      console.error('Error fetching outstanding amount:', error);
      toast.error('Failed to fetch outstanding amount details');
    }
  };

  // Handle close outstanding modal
  const handleCloseOutstandingModal = () => {
    setShowOutstandingModal(false);
    setSelectedSaleOrder(null);
    setOutstandingData(null);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      contact_id: '',
      quotation_id: '',
      billing_company_id: '',
      from_date: '',
      to_date: '',
      is_invoiced: 0
    });
    setEditingSaleOrder(null);
    setShowModal(false);
    setErrors({});
    setTouched({});
    setCompanySearchTerm('');
    setShowCompanyDropdown(false);
    setSelectedCompanyIndex(-1);
    setDropdownData(prev => ({
      ...prev,
      quotations: [],
      quotationServices: []
    }));
  };

  // Handle add sale order
  const handleAddSaleOrder = () => {
    setShowModal(true);
    setCompanySearchTerm('');
    setShowCompanyDropdown(false);
    setSelectedCompanyIndex(-1);
    fetchDropdownData();
    fetchBillCycles();
    fetchTaxRates();
  };

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

  // Effects
  useEffect(() => {
    fetchSaleOrders();
  }, [currentPage, searchTerm, sortBy, sortOrder, statusFilter, itemsPerPage]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <Sidebar />
      
      <div style={{ 
        flex: 1, 
        padding: window.innerWidth <= 768 ? '1rem' : '2rem',
        overflowX: 'auto'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center', 
          marginBottom: '2rem',
          flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
          gap: window.innerWidth <= 768 ? '1rem' : '0'
        }}>
          <div>
            <h1 style={{ 
              fontSize: window.innerWidth <= 768 ? '1.5rem' : '2rem', 
              fontWeight: '700', 
              color: '#1f2937', 
              margin: 0 
            }}>
              Sale Orders
            </h1>
            <p style={{ 
              color: '#6b7280', 
              margin: '0.5rem 0 0 0',
              fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem'
            }}>
              Manage your sale orders and quotations
            </p>
          </div>
          <UserDropdown />
            </div>
            
        {/* Search and Filter Section */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: window.innerWidth <= 768 ? '1rem' : '1.5rem', 
          borderRadius: '0.75rem', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          marginBottom: '1.5rem',
          display: 'flex',
          gap: window.innerWidth <= 768 ? '0.75rem' : '1rem',
          alignItems: window.innerWidth <= 768 ? 'stretch' : 'center',
          flexWrap: 'wrap',
          flexDirection: window.innerWidth <= 768 ? 'column' : 'row'
        }}>
          <div style={{ 
            flex: window.innerWidth <= 768 ? 'none' : '1', 
            minWidth: window.innerWidth <= 768 ? '100%' : '200px',
            width: window.innerWidth <= 768 ? '100%' : 'auto'
          }}>
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
                    placeholder="Search sale orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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

          <div style={{
            display: 'flex',
            gap: window.innerWidth <= 768 ? '0.75rem' : '1rem',
            flexWrap: 'wrap',
            width: window.innerWidth <= 768 ? '100%' : 'auto'
          }}>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                minWidth: window.innerWidth <= 768 ? '120px' : '120px',
                flex: window.innerWidth <= 768 ? '1' : 'none'
              }}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Add Sale Order Button */}
            <button
              onClick={handleAddSaleOrder}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.5rem 0.25rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                flex: window.innerWidth <= 768 ? '1' : 'none',
                justifyContent: 'center'
              }}
            >
              <Plus size={16} style={{ marginRight: '0.5rem' }} />
              Add Sale Order
            </button>
          </div>
        </div>


        {/* Main Table Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>

          <div style={{ padding: '1.5rem' }}>
              {loading ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '3rem 0' 
              }}>
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  border: '2px solid #e5e7eb',
                  borderTop: '2px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span style={{ marginLeft: '0.75rem', color: '#6b7280' }}>Loading...</span>
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
                      }} onClick={() => handleSort('so_number')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          SO Number {getSortIcon('so_number')}
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
                      }} onClick={() => handleSort('quotation_no')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Quotation No {getSortIcon('quotation_no')}
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
                      }} onClick={() => handleSort('so_date')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          SO Date {getSortIcon('so_date')}
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
                      }} onClick={() => handleSort('total_amount')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Total Amount {getSortIcon('total_amount')}
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
                      }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saleOrders.map((order) => (
                      <tr key={order.id} style={{ 
                        borderBottom: '1px solid #e5e7eb',
                        transition: 'background-color 0.15s ease-in-out'
                      }} onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}>
                        <td style={{ 
                          padding: '0.75rem 0.5rem'
                        }}>
                          <div style={{ fontWeight: '500', color: '#1f2937' }}>
                            {order.so_number}
                          </div>
                        </td>
                        <td style={{ 
                          padding: '0.75rem 0.5rem'
                        }}>
                          <div style={{ fontWeight: '500', color: '#1f2937' }}>
                            {order.quotation_no}
                          </div>
                        </td>
                        <td style={{ 
                          padding: '0.75rem 0.5rem'
                        }}>
                          <div style={{ fontWeight: '500', color: '#1f2937' }}>
                            {order.company_name}
                          </div>
                        </td>
                        <td style={{ 
                          padding: '0.75rem 0.5rem', 
                          color: '#6b7280' 
                        }}>
                          {new Date(order.so_date).toLocaleDateString()}
                        </td>
                        <td style={{ 
                          padding: '0.75rem 0.5rem', 
                          color: '#6b7280' 
                        }}>
                          ₹{parseFloat(order.total_amount || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            backgroundColor: order.status === 'active' ? '#f0f9ff' : '#f3f4f6',
                            color: order.status === 'active' ? '#0ea5e9' : '#6b7280'
                          }}>
                            {order.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#374151' }}>
                          <div style={{ fontWeight: 500 }}>{order.created_by_name || '-'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{order.created_by_email || ''}</div>
                        </td>
                        <td style={{ 
                          padding: '0.75rem 0.5rem'
                        }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {/* View button */}
                            <button 
                              style={{
                                color: '#3b82f6',
                                padding: '0.25rem',
                                borderRadius: '0.25rem',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleView(order)}
                              title="View sale order details"
                            >
                              <Eye size={16} />
                            </button>
                            
                            {/* Edit button - only show if not invoiced */}
                            {order.is_invoiced === 0 && (
                            <button 
                              style={{
                                color: '#2563eb',
                                padding: '0.25rem',
                                borderRadius: '0.25rem',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleEdit(order)}
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            )}
                            
                            {/* Warning icon for invoiced records */}
                            {order.is_invoiced === 1 && (
                              <button 
                                style={{
                                  color: '#f59e0b',
                                  padding: '0.25rem',
                                  borderRadius: '0.25rem',
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'not-allowed'
                                }}
                                title="Cannot edit invoiced sale orders. This record has been moved to proforma invoice."
                                disabled
                              >
                                <AlertCircle size={16} />
                              </button>
                            )}
                            {/* Delete button - only show if conditions are met */}
                            {order.status !== 'closed' && order.is_invoiced === 0 && (
                            <button 
                              style={{
                                color: '#dc2626',
                                padding: '0.25rem',
                                borderRadius: '0.25rem',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleDelete(order)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                              </button>
                            )}
                            
                            {/* Warning icon for non-deletable records */}
                            {(order.status === 'closed' || order.is_invoiced === 1) && (
                              <button 
                                style={{
                                  color: '#f59e0b',
                                  padding: '0.25rem',
                                  borderRadius: '0.25rem',
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'not-allowed'
                                }}
                                title={
                                  order.status === 'closed' 
                                    ? 'Cannot delete closed sale orders' 
                                    : 'Cannot delete invoiced sale orders. This record has been moved to proforma invoice.'
                                }
                                disabled
                              >
                                <AlertCircle size={16} />
                              </button>
                            )}
                            <button 
                              style={{
                                color: '#059669',
                                padding: '0.25rem',
                                borderRadius: '0.25rem',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleOutstandingCheck(order)}
                              title="Check Outstanding Amount"
                            >
                              <Calculator size={16} />
                            </button>
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: currentPage === 1 ? '#9ca3af' : '#374151',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: currentPage === 1 ? 0.5 : 1
                    }}
                  >
                    <ChevronLeft size={16} style={{ marginRight: '0.25rem' }} />
                        Previous
                      </button>
                  
                    {[...Array(totalPages)].map((_, index) => (
                        <button 
                      key={index}
                          onClick={() => handlePageChange(index + 1)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        borderRadius: '0.5rem',
                        backgroundColor: currentPage === index + 1 ? '#3b82f6' : 'white',
                        color: currentPage === index + 1 ? 'white' : '#374151',
                        border: currentPage === index + 1 ? 'none' : '1px solid #d1d5db',
                        cursor: 'pointer'
                      }}
                        >
                          {index + 1}
                        </button>
                    ))}
                  
                      <button 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: currentPage === totalPages ? '#9ca3af' : '#374151',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      opacity: currentPage === totalPages ? 0.5 : 1
                    }}
                      >
                        Next
                    <ChevronRight size={16} style={{ marginLeft: '0.25rem' }} />
                      </button>
            </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sale Order Form Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '2rem 1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '90rem',
            maxHeight: '90vh',
            position: 'relative',
            zIndex: 10000,
            overflowY: 'auto'
          }}>
            <div style={{ 
              padding: '1.5rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '500',
                  color: '#1f2937',
                  margin: 0
                }}>
                  {editingSaleOrder ? 'Edit Sale Order' : 'Add Sale Order'}
                </h3>
                <button 
                  type="button" 
                  style={{
                    color: '#9ca3af',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem'
                  }}
                  onClick={resetForm}
                >
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit}>
                {/* Hidden field for total GST amount */}
                <input
                  type="hidden"
                  value={dropdownData.quotationServices
                    .filter(service => service.selected)
                    .reduce((sum, service) => sum + (parseFloat(service.amount) || 0), 0)
                  }
                  name="gst_tot_amt"
                />
                <div style={{ display: 'grid', gap: '2rem' }}>
                  {/* Company and Quotation Selection */}
                  <div style={{
                    backgroundColor: '#f9fafb',
                    padding: '1.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h4 style={{ 
                      fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem', 
                      fontWeight: '600', 
                      color: '#374151', 
                      marginBottom: window.innerWidth <= 768 ? '0.75rem' : '1rem' 
                    }}>
                      Select Company and Quotation
                    </h4>
                    
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr 1fr', 
                      gap: window.innerWidth <= 768 ? '0.75rem' : '1rem' 
                    }}>
                     {/* Company Selection - Readonly in Edit Mode */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Company Name *
                        </label>
                         {editingSaleOrder ? (
                           <input
                             type="text"
                             value={editingSaleOrder.company_name || 'N/A'}
                             readOnly
                             style={{
                               width: '100%',
                               padding: '0.75rem',
                               border: '1px solid #d1d5db',
                               borderRadius: '0.5rem',
                               fontSize: '1rem',
                               backgroundColor: '#f9fafb',
                               color: '#6b7280'
                             }}
                           />
                         ) : (
                      <div style={{ position: 'relative' }} data-company-dropdown>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={companySearchTerm}
                            onChange={(e) => handleCompanySearch(e.target.value)}
                            onFocus={() => setShowCompanyDropdown(true)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search and select company..."
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: errors.contact_id ? '1px solid #dc2626' : '1px solid #d1d5db',
                              borderRadius: '0.5rem',
                              fontSize: '1rem',
                              backgroundColor: errors.contact_id ? '#fef2f2' : 'white',
                              outline: 'none'
                            }}
                          />
                          <div style={{
                            position: 'absolute',
                            right: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none'
                          }}>
                            <Search size={16} color="#6b7280" />
                          </div>
                        </div>
                        
                        {/* Dropdown */}
                        {showCompanyDropdown && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            zIndex: 1000,
                            maxHeight: '200px',
                            overflowY: 'auto',
                            marginTop: '0.25rem'
                          }}>
                            {filteredCompanies.length > 0 ? (
                              filteredCompanies.map((company, index) => (
                                <div
                                  key={company.contact_id}
                                  onClick={() => handleCompanySelect(company)}
                                  style={{
                                    padding: '0.75rem',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f3f4f6',
                                    fontSize: '0.875rem',
                                    color: '#374151',
                                    transition: 'background-color 0.2s',
                                    backgroundColor: index === selectedCompanyIndex ? '#f0f9ff' : 'white'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#f9fafb';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = index === selectedCompanyIndex ? '#f0f9ff' : 'white';
                                  }}
                                >
                                  {highlightSearchTerm(company.company_name, companySearchTerm)}
                                </div>
                              ))
                            ) : (
                              <div style={{
                                padding: '0.75rem',
                                color: '#6b7280',
                                fontSize: '0.875rem',
                                textAlign: 'center'
                              }}>
                                No companies found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                         )}
                        {errors.contact_id && (
                          <div style={{
                            fontSize: '0.875rem',
                            color: '#dc2626',
                            marginTop: '0.25rem'
                          }}>
                            {errors.contact_id}
                    </div>
                        )}
                      </div>

                     {/* Quotation Selection - Readonly in Edit Mode */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Quotation *
                        </label>
                         {editingSaleOrder ? (
                           <input
                             type="text"
                             value={editingSaleOrder.quotation_no || 'N/A'}
                             readOnly
                             style={{
                               width: '100%',
                               padding: '0.75rem',
                               border: '1px solid #d1d5db',
                               borderRadius: '0.5rem',
                               fontSize: '1rem',
                               backgroundColor: '#f9fafb',
                               color: '#6b7280'
                             }}
                           />
                         ) : (
                      <select
                        value={formData.quotation_id}
                        onChange={handleQuotationChange}
                          disabled={!formData.contact_id}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: `1px solid ${errors.quotation_id ? '#dc2626' : '#d1d5db'}`,
                            borderRadius: '0.5rem',
                            fontSize: '1rem',
                            backgroundColor: errors.quotation_id ? '#fef2f2' : (!formData.contact_id ? '#f9fafb' : 'white')
                          }}
                      >
                        <option value="">Select Quotation</option>
                          {dropdownData.quotations.map(quotation => (
                          <option key={quotation.id} value={quotation.id}>
                                 {quotation.quotation_no}
                          </option>
                        ))}
                      </select>
                         )}
                        {errors.quotation_id && (
                          <div style={{
                            fontSize: '0.875rem',
                            color: '#dc2626',
                            marginTop: '0.25rem'
                          }}>
                            {errors.quotation_id}
                          </div>
                        )}
                        {loadingQuotations && <p style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: '#6b7280' }}>Loading quotations...</p>}
                    </div>

                      {/* Billing Company Selection */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Billing Company *
                        </label>
                      <select
                          value={formData.billing_company_id || ''}
                          onChange={handleBillingCompanyChange}
                          disabled={(!formData.quotation_id && !editingSaleOrder) || loadingBillingCompanies}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: `1px solid ${errors.billing_company_id ? '#dc2626' : '#d1d5db'}`,
                            borderRadius: '0.5rem',
                            fontSize: '1rem',
                            backgroundColor: errors.billing_company_id ? '#fef2f2' : ((!formData.quotation_id && !editingSaleOrder) ? '#f9fafb' : 'white')
                          }}
                        >
                          <option value="">Select Billing Company</option>
                            {dropdownData.billingCompanies.map(company => {
                              const isSelected = company.bill_company_id == formData.billing_company_id;
                              return (
                            <option 
                              key={company.bill_company_id} 
                              value={company.bill_company_id}
                              style={{
                                  backgroundColor: isSelected ? '#f0f9ff' : 'white',
                                  fontWeight: isSelected ? '600' : 'normal'
                              }}
                            >
                                {isSelected ? '✓ ' : ''}{company.company_name || 'Unknown Company'}
                                {isSelected ? ' (Selected)' : ''}
                          </option>
                            );
                          })}
                      </select>
                        {errors.billing_company_id && (
                          <div style={{
                            fontSize: '0.875rem',
                            color: '#dc2626',
                            marginTop: '0.25rem'
                          }}>
                            {errors.billing_company_id}
                          </div>
                        )}
                        {loadingBillingCompanies && <p style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: '#6b7280' }}>Loading billing companies...</p>}
                        {!loadingBillingCompanies && dropdownData.billingCompanies.some(company => company.selected_bill_company_id) ? (
                          <p style={{ 
                            marginTop: '0.25rem', 
                            fontSize: '0.875rem', 
                            color: '#059669',
                            fontStyle: 'italic'
                          }}>
                            ✓ A billing company is pre-selected for this quotation
                          </p>
                        ) : null}
                      </div>

                       {/* Generate Proforma Invoice Checkbox - Only show in create mode */}
                       {!editingSaleOrder && (
                      <div style={{ marginTop: '1rem' }}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: '#374151',
                          cursor: 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={formData.is_invoiced === 1}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              is_invoiced: e.target.checked ? 1 : 0
                            }))}
                            style={{
                              width: '1rem',
                              height: '1rem',
                              accentColor: '#3b82f6'
                            }}
                          />
                          <span>Generate Proforma Invoice automatically</span>
                        </label>
                        <p style={{
                          marginTop: '0.25rem',
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          fontStyle: 'italic'
                        }}>
                          When checked, a proforma invoice will be created automatically after the sale order is saved
                        </p>
                      </div>
                       )}
                    </div>
                    </div>

                  {/* Quotation Services Table */}
                  {loadingQuotationServices && (
                    <div style={{
                      backgroundColor: '#fefce8',
                      padding: '1.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #fde047',
                      textAlign: 'center'
                    }}>
                      <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading quotation services...</p>
                    </div>
                  )}
                  
                  {!loadingQuotationServices && dropdownData.quotationServices.length > 0 && (
                    <div style={{
                      backgroundColor: '#fefce8',
                      padding: '1.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #fde047'
                    }}>
                      <h4 style={{ 
                        fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem', 
                        fontWeight: '600', 
                        color: '#374151', 
                        marginBottom: window.innerWidth <= 768 ? '0.75rem' : '1rem' 
                      }}>
                        Quotation Services
                        <span style={{ 
                          fontSize: '0.875rem', 
                          fontWeight: '400', 
                          color: '#6b7280',
                          marginLeft: '0.5rem'
                        }}>
                          (Scroll to see all services)
                        </span>
                      </h4>
                      
                      <div style={{ 
                        maxHeight: '400px',
                        overflowY: 'auto',
                        overflowX: 'auto',
                        border: `1px solid ${errors.services ? '#dc2626' : '#e5e7eb'}`,
                        borderRadius: '0.5rem',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#d1d5db #f9fafb',
                        backgroundColor: errors.services ? '#fef2f2' : 'white'
                      }}>
                        <table style={{ 
                          width: '100%', 
                          borderCollapse: 'collapse',
                          tableLayout: 'fixed',
                          minWidth: '800px'
                        }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr style={{ backgroundColor: '#f9fafb' }}>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'center',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '50px'
                              }}>Select</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'left',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '120px'
                              }}>Service Name</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'right',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '60px'
                              }}>Qty</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'right',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '80px'
                              }}>Rate</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'right',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '80px'
                              }}>Amount</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'left',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '90px'
                              }}>Bill Cycle</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'left',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '90px'
                              }}>From Date</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'left',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '90px'
                              }}>To Date</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'left',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '70px'
                              }}>Tax</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'right',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '90px'
                              }}>Bill Amt</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'right',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '90px'
                              }}>Tax Amt</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'right',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '90px',
                                display: 'none'
                              }}>IGST Amt</th>
                              <th style={{
                                padding: '0.5rem 0.25rem',
                                textAlign: 'right',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: '1px solid #e5e7eb',
                                width: '90px'
                              }}>Total Amt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dropdownData.quotationServices.map((service, index) => (
                              <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                      <input
                                    type="checkbox"
                                    checked={service.selected || false}
                                    onChange={(e) => handleServiceSelection(index, e.target.checked)}
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      cursor: 'pointer'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', color: '#1f2937' }}>
                                  {service.service_name}
                                </td>
                                <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', color: '#1f2937', textAlign: 'right' }}>
                                  {service.quantity}
                                </td>
                                <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', color: '#1f2937', textAlign: 'right' }}>
                                  ₹{parseFloat(service.rate).toFixed(2)}
                                </td>
                                <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', color: '#1f2937', textAlign: 'right' }}>
                                  ₹{parseFloat(service.amount).toFixed(2)}
                                </td>
                                <td style={{ padding: '0.5rem 1rem' }}>
                                  <div>
                                    <select
                                      value={service.bill_cycle_id || ''}
                                      onChange={(e) => handleServiceBillCycleChange(index, e.target.value)}
                                      style={{
                                        width: '100%',
                                        padding: '0.25rem 0.5rem',
                                        border: `1px solid ${service.validationErrors?.bill_cycle_id ? '#dc2626' : '#d1d5db'}`,
                                        borderRadius: '0.375rem',
                                        fontSize: '0.875rem',
                                        backgroundColor: service.validationErrors?.bill_cycle_id ? '#fef2f2' : 'white',
                                        minWidth: '120px'
                                      }}
                                    >
                                      <option value="">Select Cycle</option>
                                      {dropdownData.billCycles.map(cycle => (
                                        <option key={cycle.id} value={cycle.id}>
                                          {cycle.cycle_name}
                                        </option>
                                      ))}
                                    </select>
                                    {service.validationErrors?.bill_cycle_id && (
                                      <div style={{
                                        fontSize: '0.875rem',
                                        color: '#dc2626',
                                        marginTop: '0.25rem'
                                      }}>
                                        {service.validationErrors.bill_cycle_id}
                    </div>
                                    )}
                                    
                                    {/* Duration field - only show for yearly bill cycles */}
                                    {(() => {
                                      const selectedBillCycle = dropdownData.billCycles.find(cycle => cycle.id == service.bill_cycle_id);
                                      const cycleName = selectedBillCycle?.cycle_name?.toLowerCase() || '';
                                      // Only show for exact "Yearly" or "Annual" matches (not "Half Yearly" or other variations)
                                      const isYearly = selectedBillCycle && (
                                        (cycleName === 'yearly' || cycleName === 'annual') ||
                                        (cycleName.includes('yearly') && !cycleName.includes('half') && !cycleName.includes('quarter')) ||
                                        (cycleName.includes('annual') && !cycleName.includes('half') && !cycleName.includes('quarter'))
                                      );
                                      
                                      if (isYearly) {
                                        return (
                                          <>
                                            <label style={{ display: 'block', fontSize: '0.7rem', color: '#6b7280', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                                              Duration (Years)
                                            </label>
                                            <input
                                              type="number"
                                              placeholder="Years"
                                              value={service.duration || ''}
                                              onChange={(e) => {
                                                const value = e.target.value;
                                                // Only allow empty string or positive integers (whole numbers) between 1-10
                                                if (value === '') {
                                                  handleDurationChange(index, value);
                                                } else if (/^\d+$/.test(value)) {
                                                  const numValue = parseInt(value);
                                                  if (numValue >= 1 && numValue <= 10) {
                                                    handleDurationChange(index, value);
                                                  }
                                                }
                                              }}
                                              onBlur={(e) => {
                                                const value = e.target.value;
                                                // Validate that value is between 1 and 10 if entered
                                                if (value) {
                                                  const numValue = parseInt(value);
                                                  if (numValue < 1 || numValue > 10) {
                                                    setDropdownData(prev => ({
                                                      ...prev,
                                                      quotationServices: prev.quotationServices.map((s, idx) => 
                                                        idx === index ? {
                                                          ...s,
                                                          validationErrors: {
                                                            ...s.validationErrors,
                                                            duration: 'Duration must be between 1 and 10 years'
                                                          }
                                                        } : s
                                                      )
                                                    }));
                                                  }
                                                }
                                              }}
                                              onKeyDown={(e) => {
                                                // Prevent decimal point, minus, plus, and other non-numeric characters
                                                if (e.key === '.' || e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                                                  e.preventDefault();
                                                }
                                              }}
                                              style={{
                                                width: '100%',
                                                padding: '0.25rem 0.5rem',
                                                border: `1px solid ${service.validationErrors?.duration ? '#dc2626' : '#d1d5db'}`,
                                                borderRadius: '0.375rem',
                                                fontSize: '0.875rem',
                                                backgroundColor: service.validationErrors?.duration ? '#fef2f2' : 'white',
                                                minWidth: '120px'
                                              }}
                                              min="1"
                                              max="10"
                                              step="1"
                                            />
                                            {service.validationErrors?.duration && (
                                              <div style={{
                                                fontSize: '0.75rem',
                                                color: '#dc2626',
                                                marginTop: '0.25rem'
                                              }}>
                                                {service.validationErrors.duration}
                                              </div>
                                            )}
                                          </>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                </td>
                                <td style={{ padding: '0.5rem 1rem' }}>
                      <input
                        type="date"
                                    value={service.from_date || ''}
                                    onChange={(e) => handleServiceDateChange(index, 'from_date', e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '0.25rem 0.5rem',
                                      border: `1px solid ${service.validationErrors?.from_date ? '#dc2626' : '#d1d5db'}`,
                                      borderRadius: '0.375rem',
                                      fontSize: '0.875rem',
                                      backgroundColor: service.validationErrors?.from_date ? '#fef2f2' : 'white',
                                      minWidth: '120px'
                                    }}
                                  />
                                  {service.validationErrors?.from_date && (
                                    <div style={{
                                      fontSize: '0.875rem',
                                      color: '#dc2626',
                                      marginTop: '0.25rem'
                                    }}>
                                      {service.validationErrors.from_date}
                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '0.5rem 1rem' }}>
                      <input
                        type="date"
                                    value={service.to_date || ''}
                                    onChange={(e) => handleServiceDateChange(index, 'to_date', e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '0.25rem 0.5rem',
                                      border: `1px solid ${service.validationErrors?.to_date ? '#dc2626' : '#d1d5db'}`,
                                      borderRadius: '0.375rem',
                                      fontSize: '0.875rem',
                                      backgroundColor: service.validationErrors?.to_date ? '#fef2f2' : 'white',
                                      minWidth: '120px'
                                    }}
                                  />
                                  {service.validationErrors?.to_date && (
                                    <div style={{
                                      fontSize: '0.875rem',
                                      color: '#dc2626',
                                      marginTop: '0.25rem'
                                    }}>
                                      {service.validationErrors.to_date}
                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '0.5rem 1rem' }}>
                                  <div>
                      <select
                                      value={service.tax_id ? String(service.tax_id) : ''}
                                      onChange={(e) => handleServiceTaxChange(index, e.target.value)}
                                      disabled={loadingTaxRates}
                                      style={{
                                        width: '100%',
                                        padding: '0.25rem 0.5rem',
                                        border: `1px solid ${service.validationErrors?.tax_id ? '#dc2626' : '#d1d5db'}`,
                                        borderRadius: '0.375rem',
                                        fontSize: '0.875rem',
                                        backgroundColor: service.validationErrors?.tax_id ? '#fef2f2' : (loadingTaxRates ? '#f9fafb' : 'white'),
                                        minWidth: '120px',
                                        cursor: loadingTaxRates ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                       <option value="">Please select tax_id</option>
                                      {loadingTaxRates ? (
                                        <option value="" disabled>Loading taxes...</option>
                                      ) : dropdownData.taxRates && dropdownData.taxRates.length > 0 ? (
                                        dropdownData.taxRates.map(tax => (
                                          <option key={tax.tax_id} value={String(tax.tax_id)}>
                                            {tax.tax_name || 'Unknown Tax'} ({tax.igst || 0}%)
                                          </option>
                                        ))
                                      ) : (
                                        <option value="" disabled>No taxes available</option>
                                      )}
                      </select>
                                    {service.validationErrors?.tax_id && (
                                      <div style={{
                                        fontSize: '0.875rem',
                                        color: '#dc2626',
                                        marginTop: '0.25rem'
                                      }}>
                                        {service.validationErrors.tax_id}
                    </div>
                                    )}
                    </div>
                                </td>
                                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontSize: '0.7rem', color: '#1f2937', fontWeight: '500' }}>
                                  {service.bill_cycle_id ? `₹${parseFloat(service.bill_amount || 0).toFixed(2)}` : '-'}
                                </td>
                                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontSize: '0.7rem', color: '#1f2937', fontWeight: '500' }}>
                                    {service.bill_cycle_id ? `₹${parseFloat(service.igst_amount || 0).toFixed(2)}` : '-'}
                                  </td>
                                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontSize: '0.7rem', color: '#1f2937', fontWeight: '500', display: 'none' }}>
                                  {service.bill_cycle_id ? `₹${parseFloat(service.igst_amount || 0).toFixed(2)}` : '-'}
                                  {/* Hidden field for igst_amount */}
                                  <input
                                    type="hidden"
                                    value={service.igst_amount || 0}
                                    name={`services[${index}][igst_amount]`}
                                  />
                                </td>
                                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontSize: '0.7rem', color: '#1f2937', fontWeight: '600' }}>
                                  {service.bill_cycle_id ? `₹${parseFloat(service.total_amount || 0).toFixed(2)}` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '500', color: '#6b7280' }}></td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '500', color: '#6b7280' }}></td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '500', color: '#6b7280' }}></td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '500', color: '#6b7280' }}></td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '500', color: '#6b7280' }}></td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '500', color: '#6b7280' }}></td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '500', color: '#6b7280' }}></td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '500', color: '#6b7280' }}></td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '600', color: '#374151', textAlign: 'left' }}>
                                Grand Total:
                              </td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '600', color: '#1f2937', textAlign: 'right' }}>
                                {dropdownData.quotationServices.some(service => service.bill_cycle_id) ? 
                                  `₹${dropdownData.quotationServices.reduce((total, service) => total + (service.bill_cycle_id ? parseFloat(service.bill_amount) || 0 : 0), 0).toFixed(2)}` : 
                                  '-'
                                }
                              </td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '600', color: '#1f2937', textAlign: 'right' }}>
                                {dropdownData.quotationServices.some(service => service.bill_cycle_id) ? 
                                   `₹${dropdownData.quotationServices.reduce((total, service) => total + (service.bill_cycle_id ? parseFloat(service.igst_amount) || 0 : 0), 0).toFixed(2)}` : 
                                   '-'
                                  }
                                </td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '600', color: '#1f2937', textAlign: 'right', display: 'none' }}>
                                {dropdownData.quotationServices.some(service => service.bill_cycle_id) ? 
                                  `₹${dropdownData.quotationServices.reduce((total, service) => total + (service.bill_cycle_id ? parseFloat(service.igst_amount) || 0 : 0), 0).toFixed(2)}` : 
                                  '-'
                                }
                              </td>
                              <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: '600', color: '#1f2937', textAlign: 'right' }}>
                                {dropdownData.quotationServices.some(service => service.bill_cycle_id) ? 
                                  `₹${dropdownData.quotationServices.reduce((total, service) => total + (service.bill_cycle_id ? parseFloat(service.total_amount) || 0 : 0), 0).toFixed(2)}` : 
                                  '-'
                                }
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {errors.services && (
                        <div style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          color: '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <span>⚠️</span>
                          {errors.services}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div style={{
                  backgroundColor: '#f9fafb',
                  padding: '1rem 1.5rem',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '1.5rem'
                }}>
                  <button
                    type="submit"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.5rem 0.25rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    {editingSaleOrder ? 'Update' : 'Create'} Sale Order
                  </button>
                  <button 
                    type="button" 
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.5rem 0.25rem',
                      backgroundColor: 'white',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Outstanding Amount Modal */}
      {showOutstandingModal && selectedSaleOrder && outstandingData && (
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
                Outstanding Amount Details
              </h2>
              <button
                onClick={handleCloseOutstandingModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.25rem'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.25rem'
                  }}>
                    Sale Order Number
                  </label>
                  <div style={{
                    padding: '0.5rem',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#111827'
                  }}>
                    {outstandingData.sale_order.so_number}
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
                    {outstandingData.sale_order.company_name}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
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
                    Total Amount
                  </label>
                  <div style={{
                    padding: '0.5rem',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#111827',
                    fontWeight: '500'
                  }}>
                    ₹{parseFloat(outstandingData.outstanding_summary.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                    Invoiced Amount
                  </label>
                  <div style={{
                    padding: '0.5rem',
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#0c4a6e',
                    fontWeight: '500'
                  }}>
                    ₹{parseFloat(outstandingData.outstanding_summary.invoiced_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                    Outstanding Amount
                  </label>
                  <div style={{
                    padding: '0.5rem',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#dc2626',
                    fontWeight: '600'
                  }}>
                    ₹{parseFloat(outstandingData.outstanding_summary.outstanding_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
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
                  <Calculator size={16} color="#0ea5e9" />
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#0c4a6e'
                  }}>
                    Outstanding Amount Calculation
                  </span>
                </div>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#0c4a6e',
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  <strong>Calculation:</strong> Outstanding Amount = Total Amount - Invoiced Amount<br/>
                  <strong>Current:</strong> ₹{parseFloat(outstandingData.outstanding_summary.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} - ₹{parseFloat(outstandingData.outstanding_summary.invoiced_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} = ₹{parseFloat(outstandingData.outstanding_summary.outstanding_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br/>
                  <strong>Invoices:</strong> {outstandingData.outstanding_summary.invoice_count} invoice(s) found with tax invoice numbers.
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
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
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
                onClick={handleCloseOutstandingModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Order View Modal */}
      {showViewModal && viewingSaleOrder && (
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
            maxWidth: '900px',
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
                Sale Order Details - {viewingSaleOrder.so_number}
              </h2>
              <button
                onClick={handleCloseView}
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
                <X size={20} />
              </button>
            </div>

            {loadingSaleOrderDetails ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '2rem'
              }}>
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  border: '3px solid #f3f4f6',
                  borderTop: '3px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span style={{ marginLeft: '0.75rem', color: '#6b7280' }}>Loading details...</span>
              </div>
            ) : saleOrderDetails ? (
              <div>
                {/* Sale Order Information */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '1rem',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.5rem'
                  }}>
                    Sale Order Information
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Sale Order No:</label>
                      <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280' }}>{saleOrderDetails.sale_order.saleorder_no}</p>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Quotation No:</label>
                      <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280' }}>{saleOrderDetails.sale_order.quotation_no || 'N/A'}</p>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Company:</label>
                      <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280' }}>{saleOrderDetails.sale_order.company_name}</p>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Date:</label>
                      <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280' }}>{new Date(saleOrderDetails.sale_order.so_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Status:</label>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: saleOrderDetails.sale_order.status === 'active' ? '#f0f9ff' : '#f3f4f6',
                        color: saleOrderDetails.sale_order.status === 'active' ? '#0ea5e9' : '#6b7280'
                      }}>
                        {saleOrderDetails.sale_order.status.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Billing Company:</label>
                      <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280' }}>{saleOrderDetails.sale_order.billing_company || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Services Table */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '1rem',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.5rem'
                  }}>
                    Services
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.875rem'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Service</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Qty</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Rate</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Amount</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Bill Cycle</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>GST Amt</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saleOrderDetails.details.map((detail, index) => {
                          // Use bo_gst_amt directly from database
                          const amount = parseFloat(detail.amount || 0);
                          const gstAmount = parseFloat(detail.bo_gst_amt || 0);
                          const total = amount + gstAmount;
                          
                          return (
                            <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '0.75rem', color: '#111827' }}>{detail.service_name}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>{detail.qty}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>₹{parseFloat(detail.rate || 0).toFixed(2)}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>₹{amount.toFixed(2)}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280' }}>
                                <span 
                                  style={{ 
                                    cursor: 'pointer', 
                                    color: '#3b82f6', 
                                    textDecoration: 'underline',
                                    fontWeight: '500'
                                  }}
                                  onClick={() => handleBillCycleClick(detail)}
                                  title="Click to view invoice history"
                                >
                                  {(() => {
                                    // If duration is provided and is between 2-10, append it to the bill cycle name
                                    const duration = detail.duration;
                                    const baseName = detail.bill_cycle_name || 'N/A';
                                    const billCycleId = detail.bill_cycle_id;
                                    
                                    // Only show duration for yearly bill cycles (bill_cycle_id = 1)
                                    if (billCycleId == 1) {
                                      // If duration is between 2-10, show only the duration
                                      if (duration && duration >= 2 && duration <= 10) {
                                        return `${duration} Years`;
                                      }
                                      // For null, 0, 1, show the base name "Yearly"
                                      return baseName;
                                    }
                                    // For all other bill cycles, show the base name only
                                    return baseName;
                                  })()}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>₹{gstAmount.toFixed(2)}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>₹{total.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: '#f9fafb', fontWeight: '600' }}>
                          <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', color: '#111827' }} colSpan="4">Total:</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', borderTop: '2px solid #e5e7eb', color: '#111827' }}>-</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', color: '#111827' }}>₹{saleOrderDetails.totals.total_bo_gst_amt.toFixed(2)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', color: '#111827' }}>₹{saleOrderDetails.totals.total_final_amount.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Outstanding Amount Section */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '1rem',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.5rem'
                  }}>
                    Outstanding Amount
                  </h3>
                  <div style={{
                    backgroundColor: '#f9fafb',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Total Amount:</label>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#111827', fontSize: '1rem', fontWeight: '600' }}>
                          ₹{saleOrderDetails.totals.total_final_amount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Invoiced Amount:</label>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#059669', fontSize: '1rem', fontWeight: '600' }}>
                          ₹{saleOrderDetails.totals.total_invoiced_amount ? saleOrderDetails.totals.total_invoiced_amount.toFixed(2) : '0.00'}
                        </p>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Outstanding Amount:</label>
                        <p style={{ 
                          margin: '0.25rem 0 0 0', 
                          color: saleOrderDetails.totals.outstanding_amount > 0 ? '#dc2626' : '#059669', 
                          fontSize: '1rem', 
                          fontWeight: '600' 
                        }}>
                          ₹{(saleOrderDetails.totals.outstanding_amount || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {saleOrderDetails.totals.outstanding_amount > 0 && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '0.375rem'
                      }}>
                        <p style={{
                          margin: 0,
                          fontSize: '0.875rem',
                          color: '#dc2626',
                          fontWeight: '500'
                        }}>
                          ⚠️ This sale order has an outstanding amount that needs to be collected.
                        </p>
                      </div>
                    )}
                    {(saleOrderDetails.totals.outstanding_amount || 0) === 0 && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '0.375rem'
                      }}>
                        <p style={{
                          margin: 0,
                          fontSize: '0.875rem',
                          color: '#059669',
                          fontWeight: '500'
                        }}>
                          ✅ This sale order is fully paid with no outstanding amount.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  borderTop: '1px solid #e5e7eb',
                  paddingTop: '1rem'
                }}>
                  <button
                    onClick={handleCloseView}
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
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '2rem',
                color: '#6b7280'
              }}>
                No details available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice History Modal */}
      {showInvoiceHistoryModal && selectedServiceDetail && (
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
            borderRadius: '0.5rem',
            padding: '1.5rem',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '1rem'
            }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#111827',
                margin: 0
              }}>
                Invoice History - {selectedServiceDetail.service_name}
              </h3>
              <button
                onClick={handleCloseInvoiceHistory}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.25rem'
                }}
              >
                ×
              </button>
            </div>

            {loadingInvoiceHistory ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '2rem'
              }}>
                <div style={{
                  width: '2rem',
                  height: '2rem',
                  border: '3px solid #f3f4f6',
                  borderTop: '3px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span style={{ marginLeft: '0.75rem', color: '#6b7280' }}>Loading invoice history...</span>
              </div>
            ) : invoiceHistory ? (
              <div>
                <div style={{
                  backgroundColor: '#f9fafb',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>
                    <strong>Service:</strong> {selectedServiceDetail.service_name}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#374151' }}>
                    <strong>Bill Cycle:</strong> {(() => {
                      const duration = selectedServiceDetail.duration;
                      const baseName = selectedServiceDetail.bill_cycle_name || 'N/A';
                      const billCycleId = selectedServiceDetail.bill_cycle_id;
                      
                      // Only show duration for yearly bill cycles (bill_cycle_id = 1)
                      if (billCycleId == 1) {
                        // If duration is between 2-10, show only the duration
                        if (duration && duration >= 2 && duration <= 10) {
                          return `${duration} Years`;
                        }
                        // For null, 0, 1, show the base name "Yearly"
                        return baseName;
                      }
                      // For all other bill cycles, show the base name only
                      return baseName;
                    })()}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#374151' }}>
                    <strong>Total Invoices:</strong> {invoiceHistory.length}
                  </p>
                </div>

                {invoiceHistory.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.875rem'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Invoice #</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Sale Order No #</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Tax Invoice #</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Amount</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Status</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>Invoice Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceHistory.map((invoice, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.75rem', color: '#111827' }}>{invoice.invoice_no || 'N/A'}</td>
                            <td style={{ padding: '0.75rem', color: '#6b7280' }}>{invoice.saleorder_no || 'N/A'}</td>
                            <td style={{ padding: '0.75rem', color: '#6b7280' }}>{invoice.tax_invoice_no || 'N/A'}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>₹{parseFloat(invoice.amount || 0).toFixed(2)}</td>
                            <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                backgroundColor: invoice.status === 'completed' ? '#f0f9ff' : '#f3f4f6',
                                color: invoice.status === 'completed' ? '#0ea5e9' : '#6b7280'
                              }}>
                                {invoice.status || 'N/A'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                              {invoice.inv_date ? new Date(invoice.inv_date).toLocaleDateString() : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    color: '#6b7280'
                  }}>
                    <div style={{
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      padding: '1.5rem',
                      margin: '1rem 0'
                    }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>No Invoice Records</h4>
                      <p style={{ margin: 0, fontSize: '0.875rem' }}>
                        This service has not been moved to any proforma invoices yet.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#6b7280'
              }}>
                Failed to load invoice history.
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '1.5rem',
              borderTop: '1px solid #e5e7eb',
              paddingTop: '1rem'
            }}>
              <button
                onClick={handleCloseInvoiceHistory}
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaleOrder;
