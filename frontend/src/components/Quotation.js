import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useOnce } from '../hooks/useOnce';
import api from '../utils/axiosConfig';
import UnifiedConfig from '../config/unified';
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
  ChevronDown,
  Calculator,
  FileText,
  Mail,
  Check,
  Pause,
  Eye,
  Download
} from 'lucide-react';

const Quotation = () => {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('quotation_no');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Modal and form states
  const [showModal, setShowModal] = useState(false);
  const [showBillCompanyModal, setShowBillCompanyModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [billCompanies, setBillCompanies] = useState([]);
  const [selectedBillCompany, setSelectedBillCompany] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendToCustomer, setSendToCustomer] = useState(false);
  
  // Enhanced send modal states
  const [mailBody, setMailBody] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [toEmails, setToEmails] = useState('');
  const [emailErrors, setEmailErrors] = useState({});
  const [formData, setFormData] = useState({
    contact_id: '',
    contact_person_id: '',
    mobile: '',
    email: '',
    cp_id: '',
    contract_type_id: '',
    contract_from_date: '',
    contract_to_date: '',
    contact_address: '',
    state_id: '',
    country_id: '',
    status: 'draft',
    services: []
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
    contacts: [],
    contact_persons: [],
    contract_types: [],
    services: [],
    tax_rates: [],
    countries: [],
    states: []
  });

  // Form states for quotation creation
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContactPerson, setSelectedContactPerson] = useState(null);
  const [contactPersons, setContactPersons] = useState([]);
  const [showContactPersonModal, setShowContactPersonModal] = useState(false);
  const [newContactPerson, setNewContactPerson] = useState({
    contact_person: '',
    contact_mobile: '',
    contact_email: ''
  });
  const [contactPersonErrors, setContactPersonErrors] = useState({});
  const [quotationNo, setQuotationNo] = useState('');
  const [contractTerms, setContractTerms] = useState(0);
  const [quotationReferences, setQuotationReferences] = useState([]);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [selectedReference, setSelectedReference] = useState(null);
  const [referenceServices, setReferenceServices] = useState([]);
  const [loadingReferenceServices, setLoadingReferenceServices] = useState(false);
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);
  
  // Quotation view state
  const [viewingQuotation, setViewingQuotation] = useState(null);
  const [quotationDetails, setQuotationDetails] = useState(null);
  const [loadingQuotationDetails, setLoadingQuotationDetails] = useState(false);
  const [showPdfView, setShowPdfView] = useState(false);
  const [billingCompany, setBillingCompany] = useState(null);
  const [backendBaseUrl, setBackendBaseUrl] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Fetch quotations
  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);

      const response = await api.get(`/quotations.php?${params}`);
      
      if (response.data.success) {
        setQuotations(response.data.data);
        setTotalPages(response.data.pagination.total_pages);
        setTotalItems(response.data.pagination.total_items);
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      toast.error('Failed to fetch quotations');
    } finally {
      setLoading(false);
    }
  };

  const fetchBillCompanies = async () => {
    try {
      const response = await api.get('/bill-companies.php');
      if (response.data.success) {
        setBillCompanies(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching bill companies:', error);
      toast.error('Failed to fetch billing companies');
    }
  };

  // Fetch dropdown data
  const fetchDropdownData = async () => {
    try {
      const response = await api.get('/quotation-dropdowns.php');
      if (response.data.success) {
        setDropdownData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
      toast.error('Failed to fetch dropdown data');
    }
  };

  // Initialize filtered companies when dropdownData changes
  useEffect(() => {
    if (dropdownData.contacts.length > 0) {
      setFilteredCompanies(dropdownData.contacts);
    }
  }, [dropdownData.contacts]);

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

  // Fetch contact persons by contact ID
  const fetchContactPersons = async (contactId) => {
    try {
      const response = await api.get(`/contact-persons.php?contact_id=${contactId}`);
      if (response.data.success) {
        setContactPersons(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching contact persons:', error);
      setContactPersons([]);
    }
  };

  // Handle company search
  const handleCompanySearch = (searchTerm) => {
    setCompanySearchTerm(searchTerm);
    setShowCompanyDropdown(true);
    setSelectedCompanyIndex(-1);
    
    if (searchTerm.trim() === '') {
      setFilteredCompanies(dropdownData.contacts);
    } else {
      const filtered = dropdownData.contacts.filter(contact =>
        contact.company_name.toLowerCase().includes(searchTerm.toLowerCase())
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
  const handleCompanySelect = (contact) => {
    setCompanySearchTerm(contact.company_name);
    setShowCompanyDropdown(false);
    setSelectedCompanyIndex(-1);
    handleContactChange(contact.contact_id);
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

  // Handle contact selection
  const handleContactChange = (contactId) => {
    clearFieldError('contact_id');
    const contact = dropdownData.contacts.find(c => c.contact_id == contactId);
    setSelectedContact(contact);
    setSelectedContactPerson(null);
    
    if (contactId && contact) {
      // Update form data with contact ID and populate address, state, country
      setFormData(prev => ({
        ...prev,
        contact_id: contactId,
        mobile: '', // Clear mobile initially
        email: '', // Clear email initially
        contact_person_id: '', // Reset contact person selection
        contact_address: contact.c_address || '', // Populate address
        state_id: contact.state || '', // Populate state
        country_id: contact.country || '' // Populate country
      }));
      
      // Fetch contact persons for this contact
      fetchContactPersons(contactId);
    } else {
      // Clear form data
      setFormData(prev => ({
        ...prev,
        contact_id: '',
        mobile: '',
        email: '',
        contact_person_id: '',
        contact_address: '',
        state_id: '',
        country_id: ''
      }));
      setContactPersons([]);
    }
  };

  // Handle contact person selection
  const handleContactPersonChange = (cpId) => {
    if (cpId === 'new') {
      setShowContactPersonModal(true);
    } else {
      const contactPerson = contactPersons.find(cp => cp.cp_id == cpId);
      setSelectedContactPerson(contactPerson);
      
      // Update form data with contact person details
      if (contactPerson) {
        setFormData(prev => ({
          ...prev,
          contact_person_id: cpId,
          mobile: contactPerson.contact_mobile || '',
          email: contactPerson.contact_email || ''
        }));
      } else {
        // Clear contact person data if no selection
        setFormData(prev => ({
          ...prev,
          contact_person_id: '',
          mobile: '',
          email: ''
        }));
      }
    }
  };

  // Validate contact person form
  const validateContactPerson = () => {
    const errors = {};
    
    // Validate contact person name (mandatory, letters and spaces only)
    const contactPersonName = newContactPerson.contact_person.trim();
    if (!contactPersonName) {
      errors.contact_person = 'Contact person name is required';
    } else if (!/^[a-zA-Z\s]+$/.test(contactPersonName)) {
      errors.contact_person = 'Contact person name should only contain letters and spaces';
    }
    
    // Validate mobile (mandatory, 10 digits)
    if (!newContactPerson.contact_mobile || newContactPerson.contact_mobile.trim() === '') {
      errors.contact_mobile = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(newContactPerson.contact_mobile.trim())) {
      errors.contact_mobile = 'Mobile number must be exactly 10 digits';
    }
    
    // Validate email (mandatory, valid format)
    if (!newContactPerson.contact_email || newContactPerson.contact_email.trim() === '') {
      errors.contact_email = 'Email is required';
    } else if (!validateEmail(newContactPerson.contact_email.trim())) {
      errors.contact_email = 'Please enter a valid email address';
    }
    
    setContactPersonErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create new contact person
  const createContactPerson = async () => {
    if (!selectedContact) return;
    
    // Validate form before submitting
    if (!validateContactPerson()) {
      toast.error('Please fix validation errors');
      return;
    }
    
    try {
      const response = await api.post('/contact-persons.php', {
        contact_id: selectedContact.contact_id,
        contact_person: newContactPerson.contact_person.trim(),
        contact_mobile: newContactPerson.contact_mobile.trim(),
        contact_email: newContactPerson.contact_email.trim()
      });
      
      if (response.data.success) {
        toast.success('Contact person created successfully');
        setShowContactPersonModal(false);
        setNewContactPerson({ contact_person: '', contact_mobile: '', contact_email: '' });
        setContactPersonErrors({});
        fetchContactPersons(selectedContact.contact_id);
      }
    } catch (error) {
      console.error('Error creating contact person:', error);
      toast.error('Failed to create contact person');
    }
  };

  // Handle contract type change
  const handleContractTypeChange = (contractTypeId) => {
    const contractType = dropdownData.contract_types.find(ct => ct.id == contractTypeId);
    if (contractType) {
      setContractTerms(contractType.terms);
      setFormData(prev => ({
        ...prev,
        contract_type_id: contractTypeId
      }));
      
      // Recalculate to date if from date is already set
      if (formData.contract_from_date) {
        calculateToDate(formData.contract_from_date, contractType.terms);
      }
    }
  };

  // Calculate to date based on from date and contract terms
  const calculateToDate = (fromDate, terms) => {
    if (fromDate && terms > 0) {
      const from = new Date(fromDate);
      const to = new Date(from);
      to.setMonth(to.getMonth() + terms);
      
      // Subtract one day from the calculated date
      to.setDate(to.getDate() - 1);
      
      setFormData(prev => ({
        ...prev,
        contract_to_date: to.toISOString().split('T')[0]
      }));
    }
  };

  // Handle from date change
  const handleFromDateChange = (fromDate) => {
    setFormData(prev => ({
      ...prev,
      contract_from_date: fromDate
    }));
    
    // Auto-calculate to date if contract type is selected
    if (formData.contract_type_id) {
      const contractType = dropdownData.contract_types.find(ct => ct.id == formData.contract_type_id);
      if (contractType && contractType.terms > 0) {
        calculateToDate(fromDate, contractType.terms);
      }
    }
  };

  // Fetch quotations on component mount
  useOnce(() => {
    fetchQuotations();
    fetchDropdownData();
  }, []);

  // Fetch quotations when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchQuotations();
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
    setSortBy('quotation_no');
    setSortOrder('DESC');
    setStatusFilter('');
    setCurrentPage(1);
    setItemsPerPage(10);
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

  // Add service row
  const addServiceRow = () => {
    setFormData(prev => ({
      ...prev,
      services: [...prev.services, {
        service_id: '',
        quantity: 1,
        rate: 0,
        amount: 0,
        tax_id: '',
        igst: 0,
        cgst: 0,
        sgst: 0,
        igst_amount: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        total_amount: 0,
        description: ''
      }]
    }));
  };

  // Remove service row
  const removeServiceRow = (index) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index)
    }));
  };

  // Update service row
  const updateServiceRow = (index, field, value) => {
    // Clear field error when user starts typing
    clearServiceFieldError(index, field);
    
    setFormData(prev => {
      const newServices = [...prev.services];
      newServices[index] = { ...newServices[index], [field]: value };
      
      // Calculate amount when quantity or rate changes
      if (field === 'quantity' || field === 'rate') {
        const quantity = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(newServices[index].quantity) || 0;
        const rate = field === 'rate' ? parseFloat(value) || 0 : parseFloat(newServices[index].rate) || 0;
        // Round to 2 decimal places
        newServices[index].amount = Math.round((quantity * rate) * 100) / 100;
      }
      
      // Calculate tax amounts whenever quantity, rate, or tax changes
      if (field === 'quantity' || field === 'rate' || field === 'tax_id') {
        // Update tax rates if tax_id changed
        if (field === 'tax_id') {
          const taxRate = dropdownData.tax_rates.find(t => t.tax_id == newServices[index].tax_id);
          if (taxRate) {
            newServices[index].igst = taxRate.igst;
            newServices[index].cgst = taxRate.cgst;
            newServices[index].sgst = taxRate.sgst;
          }
        }
        
        // Recalculate tax amounts and total
        const amount = parseFloat(newServices[index].amount) || 0;
        const igst = parseFloat(newServices[index].igst) || 0;
        const cgst = parseFloat(newServices[index].cgst) || 0;
        const sgst = parseFloat(newServices[index].sgst) || 0;
        
        // Calculate tax amounts with proper rounding to 2 decimal places
        newServices[index].igst_amount = Math.round(((amount * igst) / 100) * 100) / 100;
        newServices[index].cgst_amount = Math.round(((amount * cgst) / 100) * 100) / 100;
        newServices[index].sgst_amount = Math.round(((amount * sgst) / 100) * 100) / 100;
        
        // Total amount = Amount + IGST only (not including CGST and SGST)
        // Round to 2 decimal places
        newServices[index].total_amount = Math.round((amount + newServices[index].igst_amount) * 100) / 100;
      }
      
      return { ...prev, services: newServices };
    });
  };

  // Calculate grand total
  const calculateGrandTotal = () => {
    try {
      if (!formData || !formData.services || !Array.isArray(formData.services)) {
        return 0;
      }
      const total = formData.services.reduce((total, service) => {
        const amount = parseFloat(service.total_amount) || 0;
        return total + amount;
      }, 0);
      // Round to 2 decimal places
      return isNaN(total) ? 0 : Math.round(total * 100) / 100;
    } catch (error) {
      console.error('Error calculating grand total:', error);
      return 0;
    }
  };

  // Comprehensive form validation
  const validateForm = (showErrors = true) => {
    const newErrors = {};
    
    // Required field validations
    if (!formData.contact_id) {
      newErrors.contact_id = 'Company is required';
    }
    if (!formData.contact_person_id) {
      newErrors.contact_person_id = 'Contact person is required';
    }
    if (!formData.mobile) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^[0-9]{8,15}$/.test(formData.mobile)) {
      newErrors.mobile = 'Mobile number must be 8-15 digits';
    }
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.contract_type_id) {
      newErrors.contract_type_id = 'Contract type is required';
    }
    if (!formData.contract_from_date) {
      newErrors.contract_from_date = 'Contract from date is required';
    }
    if (!formData.contract_to_date) {
      newErrors.contract_to_date = 'Contract to date is required';
    }
    if (!formData.contact_address) {
      newErrors.contact_address = 'Company address is required';
    }
    if (!formData.country_id) {
      newErrors.country_id = 'Country is required';
    }
    if (!formData.state_id) {
      newErrors.state_id = 'State is required';
    }
    
    // Services validation
    if (formData.services.length === 0) {
      newErrors.services = 'At least one service is required';
    } else {
      // Validate each service
      formData.services.forEach((service, index) => {
        if (!service.service_id) {
          newErrors[`service_${index}_service_id`] = 'Service selection is required';
        }
        if (!service.quantity || service.quantity <= 0) {
          newErrors[`service_${index}_quantity`] = 'Quantity must be greater than 0';
        }
        if (!service.rate || service.rate <= 0) {
          newErrors[`service_${index}_rate`] = 'Rate must be greater than 0';
        }
        if (!service.tax_id) {
          newErrors[`service_${index}_tax_id`] = 'Tax selection is required';
        }
      });
    }
    
    // Only set errors if showErrors is true
    if (showErrors) {
      setErrors(newErrors);
    }
    return Object.keys(newErrors).length === 0;
  };

  // Clear specific field error when user starts typing
  const clearFieldError = (fieldName) => {
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // Clear service field errors
  const clearServiceFieldError = (index, fieldName) => {
    const errorKey = `service_${index}_${fieldName}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      // Validate form before submission (always show errors on submit)
      if (!validateForm(true)) {
        toast.error('Please fix all validation errors before submitting');
        return;
      }

      let response;
      
      if (editingQuotation) {
        // Check if we should only update service descriptions
        if (shouldUpdateOnlyDescriptions()) {
          // Only update service descriptions for existing quotation_services
          const serviceUpdates = formData.services.map(service => ({
            id: service.id,
            description: service.description
          }));
          
          response = await api.put('/quotation-services.php', {
            quotation_id: editingQuotation.id,
            services: serviceUpdates
          });
          
          if (response.data.success) {
            toast.success('Service descriptions updated successfully!');
            closeModal();
            fetchQuotations(); // Refresh the list
          } else {
            toast.error(response.data.message || 'Failed to update service descriptions');
          }
        } else {
          // Normal edit - create new version
          const submissionData = {
            id: editingQuotation.id,
            cp_id: formData.contact_person_id,
            contract_type_id: formData.contract_type_id,
            contract_from_date: formData.contract_from_date,
            contract_to_date: formData.contract_to_date,
            contact_address: formData.contact_address,
            state_id: formData.state_id,
            country_id: formData.country_id,
            status: formData.status,
            grand_total: Number(calculateGrandTotal()) || 0,
            services: formData.services
          };
          
          response = await api.put('/quotations.php', submissionData);
          
          if (response.data.success) {
            toast.success('Quotation edited successfully! New version created.');
            closeModal();
            fetchQuotations(); // Refresh the list
          } else {
            toast.error(response.data.message || 'Failed to process quotation');
          }
        }
      } else {
        // Create new quotation
        const submissionData = {
          cp_id: formData.contact_person_id,
          contract_type_id: formData.contract_type_id,
          contract_from_date: formData.contract_from_date,
          contract_to_date: formData.contract_to_date,
          contact_address: formData.contact_address,
          state_id: formData.state_id,
          country_id: formData.country_id,
          status: formData.status,
          grand_total: Number(calculateGrandTotal()) || 0,
          services: formData.services
        };
        
        response = await api.post('/quotations.php', submissionData);
        
        if (response.data.success) {
          toast.success('Quotation created successfully!');
          closeModal();
          fetchQuotations(); // Refresh the list
        } else {
          toast.error(response.data.message || 'Failed to process quotation');
        }
      }
    } catch (error) {
      console.error('Error processing quotation:', error);
      toast.error('Failed to process quotation');
    }
  };

  // Open modal for new quotation
  const openModal = () => {
    setFormData({
      contact_id: '',
      contact_person_id: '',
      mobile: '',
      email: '',
      cp_id: '',
      contract_type_id: '', // No default selection
      contract_from_date: '',
      contract_to_date: '',
      contact_address: '',
      state_id: '',
      country_id: '',
      status: 'draft',
      services: []
    });
    setContractTerms(0); // Reset contract terms
    
    setErrors({});
    setTouched({});
    setSelectedContact(null);
    setSelectedContactPerson(null);
    setContactPersons([]);
    setQuotationNo('Quotation number will be automatically generated');
    setCompanySearchTerm('');
    setShowCompanyDropdown(false);
    setSelectedCompanyIndex(-1);
    setShowModal(true);
  };

  // Helper function to check if fields should be read-only
  const isReadOnly = () => {
    if (!editingQuotation) return false;
    // If quotation has sale order or proforma invoice, make all fields read-only except descriptions
    const hasSaleOrder = editingQuotation.has_sale_order > 0;
    return hasSaleOrder;
  };

  // Helper function to check if only service descriptions should be updated
  const shouldUpdateOnlyDescriptions = () => {
    if (!editingQuotation) return false;
    // If quotation has sale order or proforma invoice, only allow description edits
    const hasSaleOrder = editingQuotation.has_sale_order > 0;
    return hasSaleOrder;
  };

  // Email validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
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

  const validateSendModal = () => {
    const newErrors = {};
    
    // Validate mail body (mandatory) - check both mailBody and default message
    const currentMessage = mailBody || `To ensure uninterrupted service and avoid expiration of critical services kindly confirm your approval and process the payment at least 30 days before the renewal date. Delayed approvals may result in service suspension, domain expiration, or additional recovery charges.`;
    if (!currentMessage.trim()) {
      newErrors.mailBody = 'Mail body message is required';
    }
    
    // Validate CC emails (optional but must be valid format)
    if (ccEmails.trim()) {
      const ccValidation = validateEmailList(ccEmails);
      if (!ccValidation.isValid) {
        if (ccValidation.errorType === 'space_separation') {
          newErrors.ccEmails = 'Please add comma between email addresses (e.g., email1@domain.com, email2@domain.com)';
        } else {
          newErrors.ccEmails = `Invalid email format: ${ccValidation.invalidEmails.join(', ')}. Please use comma separation (e.g., email1@domain.com, email2@domain.com)`;
        }
      }
    }
    
    // Validate billing company (required)
    if (!selectedBillCompany) {
      newErrors.billCompany = 'Billing company is required';
    }

    // Recipient presence: require at least one recipient (either checkbox or TO emails)
    if (!sendToCustomer && !toEmails.trim()) {
      newErrors.recipient = 'At least one recipient is required. Enter TO email or select the checkbox.';
    }

    // Validate TO emails (if provided, must be valid format)
    if (toEmails.trim()) {
      const toValidation = validateEmailList(toEmails);
      if (!toValidation.isValid) {
        if (toValidation.errorType === 'space_separation') {
          newErrors.toEmails = 'Please add comma between email addresses (e.g., email1@domain.com, email2@domain.com)';
        } else {
          newErrors.toEmails = `Invalid email format: ${toValidation.invalidEmails.join(', ')}. Please use comma separation (e.g., email1@domain.com, email2@domain.com)`;
        }
      }
    }
    
    setEmailErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle edit quotation
  const handleEdit = async (quotation) => {
    // Clear any existing errors when opening edit modal
    setErrors({});
    
    setEditingQuotation(quotation);
    
    // Store whether quotation has sale order or proforma invoice
    // This will determine if fields should be read-only
    const hasSaleOrder = quotation.has_sale_order > 0;
    
    // Set quotation number message
    setQuotationNo(`Editing: ${quotation.quotation_no}`);
    
    // Find and set contract terms
    const contractType = dropdownData.contract_types?.find(ct => ct.id == quotation.contract_type_id);
    if (contractType) {
      setContractTerms(contractType.terms || 0);
    }
    
    // Fetch services for this quotation
    try {
      const servicesResponse = await api.get(`/quotation-services.php?quotation_id=${quotation.id}&edit=true`);
      const quotationServices = servicesResponse.data.success ? servicesResponse.data.data : [];
      
      // Populate form with existing quotation data
      setFormData({
        contact_id: quotation.contact_id || '',
        contact_person_id: quotation.cp_id || '',
        mobile: quotation.contact_mobile || quotation.mobile || '',
        email: quotation.contact_email || quotation.email || '',
        cp_id: quotation.cp_id || '',
        contract_type_id: quotation.contract_type_id || '',
        contract_from_date: quotation.contract_from_date || '',
        contract_to_date: quotation.contract_to_date || '',
        contact_address: quotation.contact_address || '',
        state_id: quotation.state_id || '',
        country_id: quotation.country_id || '',
        status: quotation.status || 'draft',
        services: Array.isArray(quotationServices) ? quotationServices : []
      });
      
      // Set selected contact and contact person
      if (quotation.contact_id) {
        const contact = dropdownData.contacts.find(c => c.contact_id == quotation.contact_id);
        if (contact) {
          setSelectedContact(contact);
          setCompanySearchTerm(contact.company_name);
          // Fetch contact persons for this contact
          await fetchContactPersons(quotation.contact_id);
        }
      }
      
      // Set selected contact person after a short delay to ensure contact persons are loaded
      if (quotation.cp_id) {
        setTimeout(() => {
          const contactPerson = contactPersons.find(cp => cp.cp_id == quotation.cp_id);
          if (contactPerson) {
            setSelectedContactPerson(contactPerson);
          }
        }, 200);
      }
      
    } catch (error) {
      console.error('Error fetching quotation services:', error);
      // Still open modal with basic data
      setFormData({
        contact_id: quotation.contact_id || '',
        contact_person_id: quotation.cp_id || '',
        mobile: quotation.contact_mobile || quotation.mobile || '',
        email: quotation.contact_email || quotation.email || '',
        cp_id: quotation.cp_id || '',
        contract_type_id: quotation.contract_type_id || '',
        contract_from_date: quotation.contract_from_date || '',
        contract_to_date: quotation.contract_to_date || '',
        contact_address: quotation.contact_address || '',
        state_id: quotation.state_id || '',
        country_id: quotation.country_id || '',
        status: quotation.status || 'draft',
        services: []
      });
    }
    
    // Fetch quotation references for editing
    fetchQuotationReferences(quotation.id);
    
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEditingQuotation(null);
    setQuotationReferences([]);
    setCompanySearchTerm('');
    setShowCompanyDropdown(false);
    setSelectedCompanyIndex(-1);
  };

  // Handle delete quotation
  const handleDelete = async (quotation) => {
    if (window.confirm(`Are you sure you want to delete quotation ${quotation.quotation_no}?`)) {
      try {
        const response = await api.delete('/quotations.php', {
          data: { id: quotation.id }
        });
        
        if (response.data.success) {
          toast.success('Quotation deleted successfully');
          fetchQuotations(); // Refresh the list
        } else {
          toast.error(response.data.message || 'Failed to delete quotation');
        }
      } catch (error) {
        console.error('Error deleting quotation:', error);
        toast.error('Failed to delete quotation');
      }
    }
  };

  // Handle send quotation via email
  const handleSendQuotation = async (quotation) => {
    if (quotation.status === 'sent') {
      toast.info('This quotation has already been sent');
      return;
    }

    setSelectedQuotation(quotation);
    setShowBillCompanyModal(true);
    fetchBillCompanies();
    // Do not prefill TO emails; user can enter recipients manually
    setToEmails('');
    setSendToCustomer(false);
  };

  const handleSendEmailWithBillCompany = async () => {
    // Validate the send modal - show all errors inline
    if (!validateSendModal()) {
      // Scroll to first error field after state update
      setTimeout(() => {
        // Try billing company select first
        const billCompanySelect = document.getElementById('billCompanySelect');
        if (billCompanySelect && billCompanySelect.style.border.includes('rgb(220, 38, 38)')) {
          billCompanySelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
          billCompanySelect.focus();
          return;
        }
        // Otherwise scroll to first field with red border
        const firstErrorField = document.querySelector('[style*="border: 1px solid rgb(220, 38, 38)"]');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstErrorField.focus();
        }
      }, 150);
      return;
    }

    // Show confirmation modal
    setShowSendConfirmation(true);
  };

  const handleConfirmSendEmail = async () => {
    setShowSendConfirmation(false);

    if (sendingEmail) {
      return; // Prevent multiple clicks
    }

    setSendingEmail(true);
    try {
      const currentMessage = mailBody || `To ensure uninterrupted service and avoid expiration of critical services kindly confirm your approval and process the payment at least 30 days before the renewal date. Delayed approvals may result in service suspension, domain expiration, or additional recovery charges.`;
      
      const response = await api.post('/send-quotation.php', {
        quotation_id: selectedQuotation.id,
        bill_company_id: selectedBillCompany,
        mail_body: currentMessage,
        cc_emails: ccEmails,
        to_emails: toEmails,
        send_to_customer: sendToCustomer
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setShowBillCompanyModal(false);
        setSelectedBillCompany('');
        setSelectedQuotation(null);
        setMailBody('');
        setCcEmails('');
        setToEmails('');
        setEmailErrors({});
        setSendToCustomer(false);
        fetchQuotations(); // Refresh the list
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error('Error sending quotation:', error);
      if (error.code === 'ECONNABORTED') {
        toast.error('Sending timed out. SMTP/PDF generation is taking too long on server.');
      } else {
        toast.error(error.response?.data?.message || 'Error sending quotation');
      }
    } finally {
      setSendingEmail(false);
    }
  };

  const handleConfirmQuotation = async (quotation) => {
    if (window.confirm(`Are you sure you want to confirm quotation ${quotation.quotation_no}? This will change its status to accepted.`)) {
      try {
        const response = await api.post('/confirm-quotation.php', {
          quotation_id: quotation.id,
          status: 'accepted'
        });
        
        if (response.data.success) {
          toast.success('Quotation confirmed successfully');
          fetchQuotations(); // Refresh the list
        } else {
          toast.error(response.data.message);
        }
      } catch (error) {
        console.error('Error confirming quotation:', error);
        toast.error('Failed to confirm quotation');
      }
    }
  };

  const handleHoldQuotation = async (quotation) => {
    if (window.confirm(`Are you sure you want to hold quotation ${quotation.quotation_no}? This will change its status to hold.`)) {
      try {
        const response = await api.post('/confirm-quotation.php', {
          quotation_id: quotation.id,
          status: 'hold'
        });
        
        if (response.data.success) {
          toast.success('Quotation hold successfully');
          fetchQuotations(); // Refresh the list
        } else {
          toast.error(response.data.message);
        }
      } catch (error) {
        console.error('Error holding quotation:', error);
        toast.error('Failed to hold quotation');
      }
    }
  };

  // Fetch quotation references (previous versions)
  const fetchQuotationReferences = async (quotationId) => {
    setLoadingReferences(true);
    try {
      const response = await api.get(`/quotation-references.php?quotation_id=${quotationId}`);
      
      if (response.data.success) {
        setQuotationReferences(response.data.data);
      } else {
        console.error('Failed to fetch quotation references:', response.data.message);
        setQuotationReferences([]);
      }
    } catch (error) {
      console.error('Error fetching quotation references:', error);
      setQuotationReferences([]);
    } finally {
      setLoadingReferences(false);
    }
  };

  // Handle view reference details
  const handleViewReference = async (reference) => {
    setSelectedReference(reference);
    setLoadingReferenceServices(true);
    
    try {
      // Fetch all services for the reference quotation (including soft-deleted)
      const servicesResponse = await api.get(`/quotation-services-all.php?quotation_id=${reference.id}`);
      
      if (servicesResponse.data.success) {
        setReferenceServices(servicesResponse.data.data);
      } else {
        console.error('Failed to fetch reference services:', servicesResponse.data.message);
        setReferenceServices([]);
      }
    } catch (error) {
      console.error('Error fetching reference services:', error);
      setReferenceServices([]);
    } finally {
      setLoadingReferenceServices(false);
    }
    
    setShowReferenceModal(true);
  };

  // Handle view quotation details
  const handleView = async (quotation) => {
    setViewingQuotation(quotation);
    setLoadingQuotationDetails(true);
    setShowPdfView(false);
    
    try {
      const response = await api.get(`/quotation-details.php?id=${quotation.id}`);
      if (response.data.success) {
        setQuotationDetails(response.data.data);
      } else {
        toast.error('Failed to fetch quotation details');
      }
      
      // Fetch quotation references
      await fetchQuotationReferences(quotation.id);
    } catch (error) {
      console.error('Error fetching quotation details:', error);
      toast.error('Failed to fetch quotation details');
    } finally {
      setLoadingQuotationDetails(false);
    }
  };

  // Handle toggle PDF view
  const handleTogglePdfView = async () => {
    if (!showPdfView && !billingCompany && viewingQuotation) {
      // Fetch billing company for this quotation when first showing PDF view
      try {
        const response = await api.get(`/bill-companies.php?quotation_id=${viewingQuotation.id}`);
        if (response.data.success && response.data.data.length > 0) {
          // Use the billing company returned (based on billing_com_quot_details or default)
          setBillingCompany(response.data.data[0]);
        }
      } catch (error) {
        console.error('Error fetching billing company:', error);
        toast.error('Failed to load billing company details');
      }
    }
    setShowPdfView(!showPdfView);
  };

  // Handle download quotation PDF
  const handleDownloadPdf = async () => {
    if (!viewingQuotation || !billingCompany) {
      toast.error('Unable to download PDF. Please ensure quotation details are loaded.');
      return;
    }

    setDownloadingPdf(true);

    try {
      const quotationId = viewingQuotation.id;
      const billCompanyId = billingCompany.bc_id;
      
      // Get the API base URL
      const apiBaseUrl = await UnifiedConfig.getApiBaseUrl();
      const token = localStorage.getItem('token');
      
      // Create download URL
      const downloadUrl = `${apiBaseUrl}/generate-quotation-pdf.php?id=${quotationId}&bill_company_id=${billCompanyId}`;
      
      // Add authorization header via fetch and blob
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Get the PDF as blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create download link and trigger download with proper filename
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quotation_${viewingQuotation.quotation_no}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Load backend URL from UnifiedConfig
  useEffect(() => {
    const loadBackendUrl = async () => {
      try {
        const backendUrl = await UnifiedConfig.getBackendUrl();
        setBackendBaseUrl(`${backendUrl}/`);
      } catch (error) {
        console.error('Error loading backend URL:', error);
        // Fallback to default if config fails
        const currentOrigin = window.location.origin;
        setBackendBaseUrl(currentOrigin.includes('localhost') 
          ? `${currentOrigin.replace(':3000', '')}/crmrt_live2/backend/`
          : `${currentOrigin}/backend/`);
      }
    };
    loadBackendUrl();
  }, []);

  // Handle close quotation view
  const handleCloseView = () => {
    setViewingQuotation(null);
    setQuotationDetails(null);
    setQuotationReferences([]);
    setShowPdfView(false);
    setBillingCompany(null);
  };

  // Helper function to convert number to words
  const numberToWords = (number) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (number < 20) return ones[number];
    if (number < 100) return tens[Math.floor(number/10)] + (number % 10 ? ' ' + ones[number % 10] : '');
    if (number < 1000) return ones[Math.floor(number/100)] + ' Hundred' + (number % 100 ? ' ' + numberToWords(number % 100) : '');
    if (number < 100000) return numberToWords(Math.floor(number/1000)) + ' Thousand' + (number % 1000 ? ' ' + numberToWords(number % 1000) : '');
    if (number < 10000000) return numberToWords(Math.floor(number/100000)) + ' Lakh' + (number % 100000 ? ' ' + numberToWords(number % 100000) : '');
    return numberToWords(Math.floor(number/10000000)) + ' Crore' + (number % 10000000 ? ' ' + numberToWords(number % 10000000) : '');
  };

  const convertAmountToWords = (amount) => {
    const rupees = Math.floor(amount);
    const paisa = Math.round((amount - rupees) * 100);
    
    const rupeesWords = numberToWords(rupees) + ' Rupee' + (rupees !== 1 ? 's' : '');
    
    if (paisa > 0) {
      const paisaWords = numberToWords(paisa) + ' Paisa' + (paisa !== 1 ? '' : '');
      return rupeesWords + ' and ' + paisaWords + ' Only';
    }
    
    return rupeesWords + ' Only';
  };

  // Close reference modal
  const closeReferenceModal = () => {
    setShowReferenceModal(false);
    setSelectedReference(null);
    setReferenceServices([]);
  };

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
              Quotation Management
            </h1>
            <p style={{ 
              color: '#6b7280', 
              margin: '0.5rem 0 0 0',
              fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem'
            }}>
              Create and manage quotations
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
                placeholder="Search quotations..."
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

          <div style={{
            display: 'flex',
            gap: window.innerWidth <= 768 ? '0.75rem' : '1rem',
            flexWrap: 'wrap',
            width: window.innerWidth <= 768 ? '100%' : 'auto'
          }}>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
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
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="hold">Hold</option>
              <option value="accepted">Accepted</option>
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
                fontSize: '0.875rem',
                flex: window.innerWidth <= 768 ? '1' : 'none'
              }}
            >
              Clear Filters
            </button>

            {/* Add Quotation Button */}
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
                flex: window.innerWidth <= 768 ? '1' : 'none',
                justifyContent: 'center'
              }}
            >
              <Plus size={16} style={{ marginRight: '0.5rem' }} />
              {window.innerWidth <= 768 ? 'Add' : 'Add Quotation'}
            </button>
          </div>
        </div>

        {/* Quotations Table */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '0.75rem', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          {window.innerWidth <= 768 ? (
            // Mobile Card Layout
            <div style={{ padding: '1rem' }}>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  Loading...
                </div>
              ) : quotations.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  No quotations found
                </div>
              ) : (
                quotations.map((quotation, index) => (
                  <div key={quotation.id} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '1rem',
                    backgroundColor: '#f9fafb'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.875rem' }}>
                          {quotation.quotation_no}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                          #{((currentPage - 1) * itemsPerPage) + index + 1}
                        </div>
                      </div>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: quotation.status === 'accepted' ? '#f0f9ff' : 
                                       quotation.status === 'sent' ? '#fef3c7' :
                                       quotation.status === 'hold' ? '#fef2f2' : '#f3f4f6',
                        color: quotation.status === 'accepted' ? '#0ea5e9' : 
                              quotation.status === 'sent' ? '#d97706' :
                              quotation.status === 'hold' ? '#dc2626' : '#6b7280'
                      }}>
                        {quotation.status.toUpperCase()}
                      </span>
                    </div>
                    
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Company</div>
                      <div style={{ fontWeight: '500', color: '#1f2937', fontSize: '0.875rem' }}>
                        {quotation.company_name}
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Contact Person</div>
                      <div style={{ color: '#1f2937', fontSize: '0.875rem' }}>
                        {quotation.contact_person || `${quotation.first_name} ${quotation.last_name}`}
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Total Amount</div>
                      <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '1rem' }}>
                        ₹{quotation.grand_total}
                      </div>
                    </div>
                    
                    {quotation.status === 'accepted' ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#059669',
                        fontWeight: '500',
                        fontSize: '0.875rem',
                        padding: '0.5rem',
                        backgroundColor: '#f0fdf4',
                        borderRadius: '0.375rem'
                      }}>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(quotation)}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#f3f4f6',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            color: '#374151',
                            minWidth: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1
                          }}
                          title="Edit quotation"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleSendQuotation(quotation)}
                          disabled={quotation.status === 'sent'}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: quotation.status === 'sent' ? '#f3f4f6' : '#dbeafe',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: quotation.status === 'sent' ? 'not-allowed' : 'pointer',
                            color: quotation.status === 'sent' ? '#9ca3af' : '#2563eb',
                            minWidth: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1
                          }}
                          title={quotation.status === 'sent' ? 'Already sent' : 'Send quotation via email'}
                        >
                          <Mail size={16} />
                        </button>
                        <button
                          onClick={() => handleConfirmQuotation(quotation)}
                          disabled={quotation.status === 'accepted'}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: quotation.status === 'accepted' ? '#f3f4f6' : '#f0fdf4',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: quotation.status === 'accepted' ? 'not-allowed' : 'pointer',
                            color: quotation.status === 'accepted' ? '#9ca3af' : '#059669',
                            minWidth: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1
                          }}
                          title={quotation.status === 'accepted' ? 'Already confirmed' : 'Confirm quotation'}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => handleHoldQuotation(quotation)}
                          disabled={quotation.status === 'accepted'}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: quotation.status === 'accepted' ? '#f3f4f6' : '#fef3c7',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: quotation.status === 'accepted' ? 'not-allowed' : 'pointer',
                            color: quotation.status === 'accepted' ? '#9ca3af' : '#d97706',
                            minWidth: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1
                          }}
                          title={quotation.status === 'accepted' ? 'Already processed' : 'Hold quotation'}
                        >
                          <Pause size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(quotation)}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#fef2f2',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            color: '#dc2626',
                            minWidth: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1
                          }}
                          title="Delete quotation"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            // Desktop Table Layout
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
                  }} onClick={() => handleSort('contact_person')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Contact Person {getSortIcon('contact_person')}
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
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      Loading...
                    </td>
                  </tr>
                ) : quotations.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      No quotations found
                    </td>
                  </tr>
                ) : (
                  quotations.map((quotation, index) => (
                    <tr key={quotation.id} style={{ 
                      borderBottom: '1px solid #e5e7eb',
                      '&:hover': { backgroundColor: '#f9fafb' }
                    }}>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#6b7280' }}>
                        {((currentPage - 1) * itemsPerPage) + index + 1}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: '500', color: '#1f2937' }}>
                          {quotation.quotation_no}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: '500', color: '#1f2937' }}>
                          {quotation.company_name}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280' }}>
                        {quotation.contact_person || `${quotation.first_name} ${quotation.last_name}`}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280' }}>
                        ₹{quotation.grand_total}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: quotation.status === 'accepted' ? '#f0f9ff' : 
                                         quotation.status === 'sent' ? '#fef3c7' :
                                         quotation.status === 'hold' ? '#fef2f2' : '#f3f4f6',
                          color: quotation.status === 'accepted' ? '#0ea5e9' : 
                                quotation.status === 'sent' ? '#d97706' :
                                quotation.status === 'hold' ? '#dc2626' : '#6b7280'
                        }}>
                          {quotation.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#374151' }}>
                        <div style={{ fontWeight: 500 }}>{quotation.created_by_name || '-'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{quotation.created_by_email || ''}</div>
                      </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {quotation.status === 'accepted' && quotation.has_sale_order ? (
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              gap: '0.5rem'
                            }}>
                              <span style={{ 
                                color: '#059669',
                                fontWeight: '500',
                                fontSize: '0.875rem'
                              }}>
                              </span>
                              <button
                                onClick={() => handleView(quotation)}
                                style={{
                                  padding: '0.375rem',
                                  backgroundColor: '#3b82f6',
                                  border: 'none',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer',
                                  color: 'white',
                                  minWidth: '32px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="View quotation details"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                  onClick={() => handleEdit(quotation)}
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
                                  title="Edit quotation"
                                >
                                  <Edit size={14} />
                                </button>
                            </div>
                          ) : (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleView(quotation)}
                              style={{
                                padding: '0.375rem',
                                backgroundColor: '#3b82f6',
                                border: 'none',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                color: 'white',
                                minWidth: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="View quotation details"
                            >
                              <Eye size={14} />
                            </button>
                            {quotation.has_sale_order==0 && (
                              <>
                                <button
                                  onClick={() => handleEdit(quotation)}
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
                                  title="Edit quotation"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleSendQuotation(quotation)}
                                  disabled={quotation.status === 'sent' || quotation.status === 'accepted'}
                                  style={{
                                    padding: '0.375rem',
                                    backgroundColor: (quotation.status === 'sent' || quotation.status === 'accepted') ? '#f3f4f6' : '#dbeafe',
                                    border: 'none',
                                    borderRadius: '0.25rem',
                                    cursor: (quotation.status === 'sent' || quotation.status === 'accepted') ? 'not-allowed' : 'pointer',
                                    color: (quotation.status === 'sent' || quotation.status === 'accepted') ? '#9ca3af' : '#2563eb',
                                    minWidth: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  title={(quotation.status === 'sent' || quotation.status === 'accepted') ? 'Cannot send - quotation already processed' : 'Send quotation via email'}
                                >
                                  <Mail size={14} />
                                </button>
                                <button
                                  onClick={() => handleConfirmQuotation(quotation)}
                                  disabled={quotation.status === 'accepted'}
                                  style={{
                                    padding: '0.375rem',
                                    backgroundColor: quotation.status === 'accepted' ? '#f3f4f6' : '#f0fdf4',
                                    border: 'none',
                                    borderRadius: '0.25rem',
                                    cursor: quotation.status === 'accepted' ? 'not-allowed' : 'pointer',
                                    color: quotation.status === 'accepted' ? '#9ca3af' : '#059669',
                                    minWidth: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  title={quotation.status === 'accepted' ? 'Already confirmed' : 'Confirm quotation'}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => handleHoldQuotation(quotation)}
                                  disabled={quotation.status === 'accepted'}
                                  style={{
                                    padding: '0.375rem',
                                    backgroundColor: quotation.status === 'accepted' ? '#f3f4f6' : '#fef3c7',
                                    border: 'none',
                                    borderRadius: '0.25rem',
                                    cursor: quotation.status === 'accepted' ? 'not-allowed' : 'pointer',
                                    color: quotation.status === 'accepted' ? '#9ca3af' : '#d97706',
                                    minWidth: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  title={quotation.status === 'accepted' ? 'Already processed' : 'Hold quotation'}
                                >
                                  <Pause size={14} />
                                </button>
                                <button
                                  onClick={() => handleDelete(quotation)}
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
                                  title="Delete quotation"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
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
              alignItems: window.innerWidth <= 768 ? 'stretch' : 'center',
              flexWrap: 'wrap',
              gap: window.innerWidth <= 768 ? '0.75rem' : '1rem',
              flexDirection: window.innerWidth <= 768 ? 'column' : 'row'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: window.innerWidth <= 768 ? '0.75rem' : '1rem',
                flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                width: window.innerWidth <= 768 ? '100%' : 'auto'
              }}>
                <span style={{ 
                  fontSize: window.innerWidth <= 768 ? '0.75rem' : '0.875rem', 
                  color: '#6b7280',
                  textAlign: window.innerWidth <= 768 ? 'center' : 'left'
                }}>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
                </span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    width: window.innerWidth <= 768 ? '100%' : 'auto'
                  }}
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '0.5rem',
                justifyContent: window.innerWidth <= 768 ? 'center' : 'flex-end',
                width: window.innerWidth <= 768 ? '100%' : 'auto'
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
                        padding: window.innerWidth <= 768 ? '0.75rem' : '0.5rem 0.75rem',
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

        {/* Quotation Form Modal */}
        {showModal && (
          <div className="modal-container" style={{
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
            padding: window.innerWidth <= 768 ? '0.5rem' : '1rem',
            overflow: 'auto'
          }}>
            <div className="modal-scroll" style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: window.innerWidth <= 768 ? '1rem' : '2rem',
              width: '100%',
              maxWidth: window.innerWidth <= 768 ? '100%' : '1200px',
              maxHeight: window.innerWidth <= 768 ? '95vh' : '90vh',
              overflowY: 'auto',
              margin: 'auto'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: window.innerWidth <= 768 ? '1rem' : '2rem' 
              }}>
                <h3 style={{
                  fontSize: window.innerWidth <= 768 ? '1.125rem' : '1.25rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0
                }}>
                  {editingQuotation ? 'Edit Quotation' : 'Add New Quotation'}
                </h3>
                <button
                  onClick={closeModal}
                  style={{
                    padding: '0.5rem',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'grid', gap: '2rem' }}>
                {/* Contact Header Section */}
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
                    Contact Information
                  </h4>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', 
                    gap: window.innerWidth <= 768 ? '0.75rem' : '1rem' 
                  }}>
                    {/* Company Selection */}
                    <div style={{ position: 'relative' }} data-company-dropdown>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Company Name *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={companySearchTerm}
                          onChange={isReadOnly() ? undefined : (e) => handleCompanySearch(e.target.value)}
                          onFocus={isReadOnly() ? undefined : () => setShowCompanyDropdown(true)}
                          onKeyDown={isReadOnly() ? undefined : handleKeyDown}
                          placeholder="Search and select company..."
                          readOnly={isReadOnly()}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: errors.contact_id ? '1px solid #dc2626' : '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            fontSize: '1rem',
                            backgroundColor: errors.contact_id ? '#fef2f2' : (isReadOnly() ? '#f9fafb' : 'white'),
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
                      {showCompanyDropdown && !isReadOnly() && (
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
                            filteredCompanies.map((contact, index) => (
                              <div
                                key={contact.contact_id}
                                onClick={() => handleCompanySelect(contact)}
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
                                {highlightSearchTerm(contact.company_name, companySearchTerm)}
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
                      
                      {errors.contact_id && (
                        <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {errors.contact_id}
                        </p>
                      )}
                    </div>

                    {/* Contact Person Selection */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Contact Person *
                      </label>
                      <select
                        value={formData.contact_person_id || ''}
                        onChange={(e) => handleContactPersonChange(e.target.value)}
                        disabled={!selectedContact || isReadOnly()}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: errors.contact_person_id ? '1px solid #dc2626' : '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: !selectedContact ? '#f9fafb' : (errors.contact_person_id ? '#fef2f2' : (isReadOnly() ? '#f9fafb' : 'white'))
                        }}
                      >
                        <option value="">Select Contact Person</option>
                        {contactPersons.map(cp => (
                          <option key={cp.cp_id} value={cp.cp_id}>
                            {cp.contact_person}
                          </option>
                        ))}
                        {selectedContact && (
                          <option value="new">+ Add New Contact Person</option>
                        )}
                      </select>
                      {errors.contact_person_id && (
                        <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {errors.contact_person_id}
                        </p>
                      )}
                    </div>

                    {/* Mobile */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Mobile *
                      </label>
                      <input
                        type="text"
                        value={formData.mobile}
                        readOnly
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: errors.mobile ? '1px solid #dc2626' : '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: errors.mobile ? '#fef2f2' : '#f9fafb'
                        }}
                      />
                      {errors.mobile && (
                        <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {errors.mobile}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Email *
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        readOnly
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: errors.email ? '1px solid #dc2626' : '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: errors.email ? '#fef2f2' : '#f9fafb'
                        }}
                      />
                      {errors.email && (
                        <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quotation Header Section */}
                <div style={{
                  backgroundColor: '#f0f9ff',
                  padding: '1.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #bae6fd'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: window.innerWidth <= 768 ? '0.75rem' : '1rem' }}>
                    <h4 style={{ 
                      fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem', 
                      fontWeight: '600', 
                      color: '#374151',
                      margin: 0
                    }}>
                      Quotation Details
                    </h4>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', 
                    gap: window.innerWidth <= 768 ? '0.75rem' : '1rem' 
                  }}>
                    {/* Quotation Number */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Quotation Number
                      </label>
                      <div style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: '#f9fafb',
                        color: '#6b7280',
                        fontStyle: 'italic'
                      }}>
                        {quotationNo || 'Quotation number will be automatically generated'}
                      </div>
                    </div>

                    {/* Contract Type */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Contract Type *
                      </label>
                      <select
                        value={formData.contract_type_id}
                        onChange={(e) => handleContractTypeChange(e.target.value)}
                        disabled={isReadOnly()}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: errors.contract_type_id ? '1px solid #dc2626' : '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: errors.contract_type_id ? '#fef2f2' : (isReadOnly() ? '#f9fafb' : 'white')
                        }}
                      >
                        <option value="">Select Contract Type</option>
                        {dropdownData.contract_types.map(ct => (
                          <option key={ct.id} value={ct.id}>
                            {ct.contract_name} ({ct.terms} months)
                          </option>
                        ))}
                      </select>
                      {errors.contract_type_id && (
                        <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {errors.contract_type_id}
                        </p>
                      )}
                    </div>

                    {/* Contract From Date */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Contract From Date *
                      </label>
                      <input
                        type="date"
                        value={formData.contract_from_date}
                        onChange={(e) => handleFromDateChange(e.target.value)}
                        readOnly={isReadOnly()}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: errors.contract_from_date ? '1px solid #dc2626' : '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: errors.contract_from_date ? '#fef2f2' : (isReadOnly() ? '#f9fafb' : 'white')
                        }}
                      />
                      {errors.contract_from_date && (
                        <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {errors.contract_from_date}
                        </p>
                      )}
                    </div>

                    {/* Contract To Date */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Contract To Date *
                      </label>
                      <input
                        type="date"
                        value={formData.contract_to_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, contract_to_date: e.target.value }))}
                        disabled={contractTerms > 0 || isReadOnly()}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: errors.contract_to_date ? '1px solid #dc2626' : '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: contractTerms > 0 || isReadOnly() ? '#f9fafb' : (errors.contract_to_date ? '#fef2f2' : 'white')
                        }}
                      />
                      {errors.contract_to_date && (
                        <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {errors.contract_to_date}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Services Section */}
                <div style={{
                  backgroundColor: '#fefce8',
                  padding: window.innerWidth <= 768 ? '1rem' : '1.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #fde047'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: window.innerWidth <= 768 ? '0.75rem' : '1rem',
                    flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                    gap: window.innerWidth <= 768 ? '0.75rem' : '0'
                  }}>
                    <h4 style={{ 
                      fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem', 
                      fontWeight: '600', 
                      color: '#374151', 
                      margin: 0 
                    }}>
                      Services
                    </h4>
                    <button
                      type="button"
                      onClick={addServiceRow}
                      disabled={isReadOnly()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.5rem 1rem',
                        backgroundColor: isReadOnly() ? '#9ca3af' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: isReadOnly() ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      <Plus size={16} style={{ marginRight: '0.5rem' }} />
                      Add Row
                    </button>
                  </div>

                  {formData.services.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                      No services added. Click "Add Row" to add services.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f3f4f6' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                              Service
                            </th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151', width: '100px' }}>
                              Qty
                            </th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151', width: '120px' }}>
                              Rate
                            </th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151', width: '120px' }}>
                              Amount
                            </th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151', width: '120px' }}>
                              Tax
                            </th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151', width: '120px' }}>
                              Total
                            </th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151', width: '80px' }}>
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.services.map((service, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.75rem' }}>
                                <select
                                  value={service.service_id}
                                  onChange={(e) => updateServiceRow(index, 'service_id', e.target.value)}
                                  disabled={isReadOnly()}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: errors[`service_${index}_service_id`] ? '1px solid #dc2626' : '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.875rem',
                                    backgroundColor: errors[`service_${index}_service_id`] ? '#fef2f2' : (isReadOnly() ? '#f9fafb' : 'white')
                                  }}
                                >
                                  <option value="">Select Service</option>
                                  {dropdownData.services.map(s => (
                                    <option key={s.id} value={s.id}>
                                      {s.service_name}
                                    </option>
                                  ))}
                                </select>
                                {errors[`service_${index}_service_id`] && (
                                  <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                    {errors[`service_${index}_service_id`]}
                                  </p>
                                )}
                                <textarea
                                  value={service.description}
                                  onChange={(e) => updateServiceRow(index, 'description', e.target.value)}
                                  placeholder="Description"
                                  style={{
                                    width: '100%',
                                    marginTop: '0.5rem',
                                    padding: '0.5rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.875rem',
                                    resize: 'vertical',
                                    minHeight: '60px'
                                  }}
                                />
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="1"
                                  value={service.quantity}
                                  onChange={(e) => updateServiceRow(index, 'quantity', e.target.value)}
                                  readOnly={isReadOnly()}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: errors[`service_${index}_quantity`] ? '1px solid #dc2626' : '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.875rem',
                                    textAlign: 'center',
                                    backgroundColor: errors[`service_${index}_quantity`] ? '#fef2f2' : (isReadOnly() ? '#f9fafb' : 'white')
                                  }}
                                />
                                {errors[`service_${index}_quantity`] && (
                                  <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                    {errors[`service_${index}_quantity`]}
                                  </p>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={service.rate}
                                  onChange={(e) => updateServiceRow(index, 'rate', e.target.value)}
                                  readOnly={isReadOnly()}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: errors[`service_${index}_rate`] ? '1px solid #dc2626' : '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.875rem',
                                    textAlign: 'center',
                                    backgroundColor: errors[`service_${index}_rate`] ? '#fef2f2' : (isReadOnly() ? '#f9fafb' : 'white')
                                  }}
                                />
                                {errors[`service_${index}_rate`] && (
                                  <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                    {errors[`service_${index}_rate`]}
                                  </p>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  value={service.amount}
                                  readOnly
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.875rem',
                                    textAlign: 'center',
                                    backgroundColor: '#f9fafb'
                                  }}
                                />
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <select
                                  value={service.tax_id}
                                  onChange={(e) => updateServiceRow(index, 'tax_id', e.target.value)}
                                  disabled={isReadOnly()}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: errors[`service_${index}_tax_id`] ? '1px solid #dc2626' : '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.875rem',
                                    backgroundColor: errors[`service_${index}_tax_id`] ? '#fef2f2' : (isReadOnly() ? '#f9fafb' : 'white')
                                  }}
                                >
                                  <option value="">Select Tax</option>
                                  {dropdownData.tax_rates.map(t => (
                                  <option key={t.tax_id} value={t.tax_id}>
                                    {t.tax_name}
                                  </option>
                                  ))}
                                </select>
                                {errors[`service_${index}_tax_id`] && (
                                  <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                    {errors[`service_${index}_tax_id`]}
                                  </p>
                                )}
                                {/* Tax amounts are hidden but still calculated and sent to backend */}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  value={service.total_amount}
                                  readOnly
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.875rem',
                                    textAlign: 'center',
                                    backgroundColor: '#f9fafb',
                                    fontWeight: '600'
                                  }}
                                />
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => removeServiceRow(index)}
                                  disabled={isReadOnly()}
                                  style={{
                                    padding: '0.5rem',
                                    backgroundColor: isReadOnly() ? '#f3f4f6' : '#fef2f2',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    cursor: isReadOnly() ? 'not-allowed' : 'pointer',
                                    color: isReadOnly() ? '#9ca3af' : '#dc2626'
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Services Error Display */}
                  {errors.services && (
                    <div style={{ 
                      marginTop: '1rem', 
                      padding: '0.75rem', 
                      backgroundColor: '#fef2f2', 
                      border: '1px solid #fecaca',
                      borderRadius: '0.5rem',
                      color: '#dc2626',
                      fontSize: '0.875rem'
                    }}>
                      {errors.services}
                    </div>
                  )}

                  {/* Grand Total */}
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '1rem', 
                    backgroundColor: '#f3f4f6', 
                    borderRadius: '0.5rem',
                    textAlign: 'right'
                  }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#374151' }}>
                      Grand Total: ₹{Number(calculateGrandTotal()).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
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
                    type="button"
                    onClick={handleSubmit}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    {editingQuotation ? 'Update Quotation' : 'Create Quotation'}
                  </button>
                </div>
              </div>
              
              {/* Quotation References Section - Only show when editing */}
              {editingQuotation && quotationReferences.length > 0 && (
                <div style={{
                  marginTop: window.innerWidth <= 768 ? '1rem' : '2rem',
                  padding: window.innerWidth <= 768 ? '1rem' : '1.5rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0'
                }}>
                  <h4 style={{
                    fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    📋 Previous Versions (Reference)
                  </h4>
                  
                  {loadingReferences ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280' }}>
                      Loading references...
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {quotationReferences.map((ref, index) => (
                        <div key={ref.id} style={{
                          display: 'flex',
                          flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                          justifyContent: 'space-between',
                          alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                          padding: window.innerWidth <= 768 ? '0.5rem' : '0.75rem',
                          backgroundColor: 'white',
                          borderRadius: '0.375rem',
                          border: '1px solid #e5e7eb',
                          fontSize: window.innerWidth <= 768 ? '0.75rem' : '0.875rem',
                          gap: window.innerWidth <= 768 ? '0.5rem' : '0'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                            <div style={{ fontWeight: '500', color: '#1f2937' }}>
                              {ref.quotation_no}
                            </div>
                            <div style={{ color: '#6b7280', fontSize: window.innerWidth <= 768 ? '0.625rem' : '0.75rem' }}>
                              {ref.company} • {ref.contact_person}
                            </div>
                            <div style={{ color: '#6b7280', fontSize: window.innerWidth <= 768 ? '0.625rem' : '0.75rem' }}>
                              Created: {new Date(ref.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem',
                            justifyContent: window.innerWidth <= 768 ? 'space-between' : 'flex-end',
                            width: window.innerWidth <= 768 ? '100%' : 'auto'
                          }}>
                            <div style={{ textAlign: window.innerWidth <= 768 ? 'left' : 'right' }}>
                              <div style={{ fontWeight: '600', color: '#1f2937' }}>
                                ₹{ref.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </div>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontSize: window.innerWidth <= 768 ? '0.625rem' : '0.75rem',
                                fontWeight: '500',
                                backgroundColor: ref.status === 'accepted' ? '#f0f9ff' : 
                                               ref.status === 'sent' ? '#fef3c7' :
                                               ref.status === 'hold' ? '#fef2f2' : '#f3f4f6',
                                color: ref.status === 'accepted' ? '#0ea5e9' : 
                                      ref.status === 'sent' ? '#d97706' :
                                      ref.status === 'hold' ? '#dc2626' : '#6b7280'
                              }}>
                                {ref.status.toUpperCase()}
                              </span>
                            </div>
                            
                            <button
                              onClick={() => handleViewReference(ref)}
                              style={{
                                padding: window.innerWidth <= 768 ? '0.375rem' : '0.5rem',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                fontSize: window.innerWidth <= 768 ? '0.625rem' : '0.75rem',
                                fontWeight: '500',
                                minWidth: window.innerWidth <= 768 ? '60px' : '70px',
                                height: window.innerWidth <= 768 ? '28px' : '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem'
                              }}
                              title="View quotation details"
                            >
                              👁️ View
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Billing Company Modal */}
        {showBillCompanyModal && (
          <div className="modal-container" style={{
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
            overflow: 'auto'
          }}>
            <div className="modal-scroll" style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '2rem',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
              margin: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0
                }}>
                  Send Quotation Email
                </h3>
                <button
                  onClick={() => {
                    setShowBillCompanyModal(false);
                    setSelectedBillCompany('');
                    setSelectedQuotation(null);
                  }}
                  style={{
                    padding: '0.5rem',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ margin: '0 0 1rem 0', color: '#6b7280' }}>
                  Select a billing company to send quotation <strong>{selectedQuotation?.quotation_no}</strong> to selected recipients
                </p>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Billing Company *
                  </label>
                  <select
                    id="billCompanySelect"
                    value={selectedBillCompany}
                    onChange={(e) => {
                      setSelectedBillCompany(e.target.value);
                      if (emailErrors.billCompany) {
                        setEmailErrors(prev => ({ ...prev, billCompany: '' }));
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: emailErrors.billCompany ? '1px solid #dc2626' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      backgroundColor: emailErrors.billCompany ? '#fef2f2' : 'white'
                    }}
                  >
                    <option value="">Select Billing Company</option>
                    {billCompanies.map((company) => (
                      <option key={company.bc_id} value={company.bc_id}>
                        {company.bc_name}
                      </option>
                    ))}
                  </select>
                  {emailErrors.billCompany && (
                    <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      {emailErrors.billCompany}
                    </p>
                  )}
                </div>

                {selectedBillCompany && (
                  <div style={{
                    backgroundColor: '#f9fafb',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Selected Billing Company:</h4>
                    {(() => {
                      const company = billCompanies.find(c => c.bc_id == selectedBillCompany);
                      return company ? (
                        <div>
                          <p style={{ margin: '0 0 0.25rem 0', fontWeight: '500' }}>{company.bc_name}</p>
                          <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: '#6b7280' }}>{company.bc_address}</p>
                          {company.gst_no && <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: '#6b7280' }}>GST: {company.gst_no}</p>}
                          {company.msme_no && <p style={{ margin: '0', fontSize: '0.875rem', color: '#6b7280' }}>MSME: {company.msme_no}</p>}
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* TO Emails */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    TO Emails (Optional)
                  </label>
                  <input
                    type="text"
                    value={toEmails}
                    onChange={(e) => {
                      setToEmails(e.target.value);
                      // Clear errors when user starts typing
                      if (emailErrors.toEmails) {
                        setEmailErrors(prev => ({ ...prev, toEmails: '' }));
                      }
                      if (emailErrors.recipient) {
                        setEmailErrors(prev => ({ ...prev, recipient: '' }));
                      }
                    }}
                    placeholder="abc@abc.com, user@example.com"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: (emailErrors.toEmails && !emailErrors.recipient) ? '1px solid #dc2626' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      backgroundColor: (emailErrors.toEmails && !emailErrors.recipient) ? '#fef2f2' : 'white'
                    }}
                  />
                  <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Separate multiple emails with commas.
                  </p>
                  {emailErrors.toEmails && !emailErrors.recipient && (
                    <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      {emailErrors.toEmails}
                    </p>
                  )}
                </div>

                {/* CC Emails */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    CC Emails (Optional)
                  </label>
                  <input
                    type="text"
                    value={ccEmails}
                    onChange={(e) => {
                      setCcEmails(e.target.value);
                      // Clear error when user starts typing
                      if (emailErrors.ccEmails) {
                        setEmailErrors(prev => ({ ...prev, ccEmails: '' }));
                      }
                    }}
                    placeholder="abc@abc.com, user@example.com"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: emailErrors.ccEmails ? '1px solid #dc2626' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      backgroundColor: emailErrors.ccEmails ? '#fef2f2' : 'white'
                    }}
                  />
                  <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Separate multiple emails with commas
                  </p>
                  {emailErrors.ccEmails && (
                    <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      {emailErrors.ccEmails}
                    </p>
                  )}
                </div>

                {/* Mail Body */}
                <div style={{ marginBottom: '1rem' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: '500',
                      color: '#374151',
                    }}
                  >
                    Mail Body Message *
                  </label>
                  <textarea
                    value={
                      mailBody ||
                      `To ensure uninterrupted service and avoid expiration of critical services kindly confirm your approval and process the payment at least 30 days before the renewal date. Delayed approvals may result in service suspension, domain expiration, or additional recovery charges.`
                    }
                    onChange={(e) => setMailBody(e.target.value)}
                    placeholder="Enter your mail message here..."
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: emailErrors.mailBody
                        ? '1px solid #dc2626'
                        : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      backgroundColor: emailErrors.mailBody ? '#fef2f2' : 'white',
                      resize: 'vertical',
                      minHeight: '150px',
                    }}
                  />
                  {emailErrors.mailBody && (
                    <p
                      style={{
                        color: '#dc2626',
                        fontSize: '0.75rem',
                        marginTop: '0.25rem',
                      }}
                    >
                      {emailErrors.mailBody}
                    </p>
                  )}
                </div>

                {/* Send to customer checkbox (placed after Mail Body) */}
                <div style={{
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <input
                    id="sendToCustomer"
                    type="checkbox"
                    checked={sendToCustomer}
                    onChange={(e) => {
                      setSendToCustomer(e.target.checked);
                      // Clear recipient error when checkbox is toggled
                      if (emailErrors.recipient) {
                        setEmailErrors(prev => ({ ...prev, recipient: '' }));
                      }
                    }}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor="sendToCustomer" style={{ color: '#374151', fontSize: '0.875rem',fontWeight: '500' }}>
                    Select this option to send the quotation to the customer's contact email address ({selectedQuotation.contact_email || 'N/A'})
                  </label>
                </div>
                {emailErrors.recipient && (
                  <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', marginLeft: '1.5rem' }}>
                    {emailErrors.recipient}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowBillCompanyModal(false);
                    setSelectedBillCompany('');
                    setSelectedQuotation(null);
                    setMailBody('');
                    setCcEmails('');
                    setToEmails('');
                    setEmailErrors({});
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
                  onClick={handleSendEmailWithBillCompany}
                  disabled={sendingEmail}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: sendingEmail ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {sendingEmail && (
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #ffffff',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  )}
                  {sendingEmail ? 'Sending...' : 'Send Email'}
                </button>
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
                  Send Quotation Email?
                </h3>
                <p style={{
                  margin: '0 0 2rem 0',
                  color: '#6b7280',
                  fontSize: '0.875rem'
                }}>
                  Are you sure you want to send this quotation email? This action cannot be undone.
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

        {/* Contact Person Modal */}
        {showContactPersonModal && (
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
              width: '100%',
              maxWidth: '500px'
            }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '1.5rem'
              }}>
                Add New Contact Person
              </h3>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Contact Person Name *
                  </label>
                  <input
                    type="text"
                    value={newContactPerson.contact_person}
                    onChange={(e) => {
                      // Only allow letters and spaces
                      const value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                      setNewContactPerson(prev => ({ ...prev, contact_person: value }));
                      // Clear error when user starts typing
                      if (contactPersonErrors.contact_person) {
                        setContactPersonErrors(prev => ({ ...prev, contact_person: '' }));
                      }
                    }}
                    onBlur={() => {
                      const name = newContactPerson.contact_person.trim();
                      if (!name) {
                        setContactPersonErrors(prev => ({ ...prev, contact_person: 'Contact person name is required' }));
                      } else if (!/^[a-zA-Z\s]+$/.test(name)) {
                        setContactPersonErrors(prev => ({ ...prev, contact_person: 'Contact person name should only contain letters and spaces' }));
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: contactPersonErrors.contact_person ? '1px solid #dc2626' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: contactPersonErrors.contact_person ? '#fef2f2' : 'white'
                    }}
                    placeholder="Enter contact person name"
                  />
                  {contactPersonErrors.contact_person && (
                    <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      {contactPersonErrors.contact_person}
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Mobile *
                  </label>
                  <input
                    type="text"
                    value={newContactPerson.contact_mobile}
                    onChange={(e) => {
                      // Only allow digits
                      const value = e.target.value.replace(/\D/g, '');
                      // Limit to 10 digits
                      const limitedValue = value.slice(0, 10);
                      setNewContactPerson(prev => ({ ...prev, contact_mobile: limitedValue }));
                      // Clear error when user starts typing
                      if (contactPersonErrors.contact_mobile) {
                        setContactPersonErrors(prev => ({ ...prev, contact_mobile: '' }));
                      }
                    }}
                    onBlur={() => {
                      const mobile = newContactPerson.contact_mobile.trim();
                      if (!mobile) {
                        setContactPersonErrors(prev => ({ ...prev, contact_mobile: 'Mobile number is required' }));
                      } else if (!/^\d{10}$/.test(mobile)) {
                        setContactPersonErrors(prev => ({ ...prev, contact_mobile: 'Mobile number must be exactly 10 digits' }));
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: contactPersonErrors.contact_mobile ? '1px solid #dc2626' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: contactPersonErrors.contact_mobile ? '#fef2f2' : 'white'
                    }}
                    placeholder="Enter 10-digit mobile number"
                    maxLength="10"
                  />
                  {contactPersonErrors.contact_mobile && (
                    <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      {contactPersonErrors.contact_mobile}
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={newContactPerson.contact_email}
                    onChange={(e) => {
                      setNewContactPerson(prev => ({ ...prev, contact_email: e.target.value }));
                      // Clear error when user starts typing
                      if (contactPersonErrors.contact_email) {
                        setContactPersonErrors(prev => ({ ...prev, contact_email: '' }));
                      }
                    }}
                    onBlur={() => {
                      const email = newContactPerson.contact_email.trim();
                      if (!email) {
                        setContactPersonErrors(prev => ({ ...prev, contact_email: 'Email is required' }));
                      } else if (!validateEmail(email)) {
                        setContactPersonErrors(prev => ({ ...prev, contact_email: 'Please enter a valid email address' }));
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: contactPersonErrors.contact_email ? '1px solid #dc2626' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: contactPersonErrors.contact_email ? '#fef2f2' : 'white'
                    }}
                    placeholder="Enter email address"
                  />
                  {contactPersonErrors.contact_email && (
                    <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      {contactPersonErrors.contact_email}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button
                  onClick={() => {
                    setShowContactPersonModal(false);
                    setNewContactPerson({ contact_person: '', contact_mobile: '', contact_email: '' });
                    setContactPersonErrors({});
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
                  onClick={createContactPerson}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reference View Modal */}
        {showReferenceModal && selectedReference && (
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
            zIndex: 1100,
            padding: '1rem'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '2rem',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0
                }}>
                  Quotation Reference: {selectedReference.quotation_no}
                </h3>
                <button
                  onClick={closeReferenceModal}
                  style={{
                    padding: '0.5rem',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Quotation Details */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem', display: 'block' }}>
                      Company
                    </label>
                    <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                      {selectedReference.company}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem', display: 'block' }}>
                      Contact Person
                    </label>
                    <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                      {selectedReference.contact_person}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem', display: 'block' }}>
                      Status
                    </label>
                    <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: selectedReference.status === 'accepted' ? '#f0f9ff' : 
                                       selectedReference.status === 'sent' ? '#fef3c7' :
                                       selectedReference.status === 'hold' ? '#fef2f2' : '#f3f4f6',
                        color: selectedReference.status === 'accepted' ? '#0ea5e9' : 
                              selectedReference.status === 'sent' ? '#d97706' :
                              selectedReference.status === 'hold' ? '#dc2626' : '#6b7280'
                      }}>
                        {selectedReference.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem', display: 'block' }}>
                      Total Amount
                    </label>
                    <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb', fontWeight: '600', color: '#1f2937' }}>
                      ₹{selectedReference.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem', display: 'block' }}>
                      Created Date
                    </label>
                    <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                      {new Date(selectedReference.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem', display: 'block' }}>
                      Last Updated
                    </label>
                    <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                      {new Date(selectedReference.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Services Section */}
              <div>
                <h4 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  📋 Services
                </h4>
                
                {loadingReferenceServices ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    Loading services...
                  </div>
                ) : referenceServices.length > 0 ? (
                  <div style={{ 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '0.5rem', 
                    overflow: 'hidden',
                    backgroundColor: 'white'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '2fr 1fr 1fr 1fr 1fr 1fr',
                      gap: '1rem',
                      padding: '0.75rem',
                      backgroundColor: '#f9fafb',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      <div>Service</div>
                      <div style={{ textAlign: 'right' }}>Qty</div>
                      <div style={{ textAlign: 'right' }}>Rate</div>
                      <div style={{ textAlign: 'right' }}>Amount</div>
                      <div style={{ textAlign: 'right' }}>Tax</div>
                      <div style={{ textAlign: 'right' }}>Total</div>
                    </div>
                    
                    {referenceServices.map((service, index) => (
                      <div key={index} style={{
                        display: 'grid',
                        gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '2fr 1fr 1fr 1fr 1fr 1fr',
                        gap: '1rem',
                        padding: '0.75rem',
                        borderBottom: index < referenceServices.length - 1 ? '1px solid #f3f4f6' : 'none',
                        fontSize: '0.875rem',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontWeight: '500', color: '#1f2937', marginBottom: '0.25rem' }}>
                            {service.service_name}
                          </div>
                          {service.description && (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {service.description}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', color: '#374151' }}>
                          {service.quantity}
                        </div>
                        <div style={{ textAlign: 'right', color: '#374151' }}>
                          ₹{service.rate?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </div>
                        <div style={{ textAlign: 'right', color: '#374151' }}>
                          ₹{service.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </div>
                        <div style={{ textAlign: 'right', color: '#374151' }}>
                          {service.tax_name} ({service.igst}%)
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: '600', color: '#1f2937' }}>
                          ₹{service.total_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '2rem', 
                    color: '#6b7280',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    No services found for this quotation.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button
                  onClick={closeReferenceModal}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quotation View Modal */}
        {viewingQuotation && (
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
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2 style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: '#111827'
                  }}>
                    Quotation Details - {viewingQuotation.quotation_no}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={handleTogglePdfView}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: showPdfView ? '#3b82f6' : '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        color: showPdfView ? 'white' : '#374151',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      {showPdfView ? 'Switch to Text View' : 'Switch to PDF View'}
                    </button>
                    {showPdfView && (
                      <button
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: downloadingPdf ? '#6b7280' : '#10b981',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: downloadingPdf ? 'not-allowed' : 'pointer',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          opacity: downloadingPdf ? 0.7 : 1
                        }}
                        title="Download Quotation PDF"
                      >
                        {downloadingPdf ? (
                          <div style={{
                            width: '18px',
                            height: '18px',
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            borderTop: '2px solid white',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                        ) : (
                          <Download size={18} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleCloseView}
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
                {loadingQuotationDetails ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem'
                  }}>
                    <div style={{
                      width: '2rem',
                      height: '2rem',
                      border: '2px solid #e5e7eb',
                      borderTop: '2px solid #3b82f6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>Loading...</span>
                  </div>
                ) : quotationDetails ? (
                  showPdfView ? (
                    // PDF Style View
                    <div style={{
                      fontFamily: 'Arial, sans-serif',
                      fontSize: '14px',
                      margin: 0,
                      padding: '10px',
                      backgroundColor: '#f5f5f5'
                    }}>
                      <style>
                        {`
                          @media only screen and (max-width: 600px) {
                            .mobile-header-quote { display: block !important; }
                            .desktop-header-quote { display: none !important; }
                            .mobile-table-quote { display: block !important; }
                            .desktop-table-quote { display: none !important; }
                            .mobile-totals-quote { display: block !important; }
                            .desktop-totals-quote { display: none !important; }
                            .mobile-service-item-quote { 
                              border: 1px solid #000 !important; 
                              margin-bottom: 10px !important; 
                              padding: 10px !important; 
                              background: #f9f9f9 !important;
                            }
                          }
                          @media only screen and (min-width: 601px) {
                            .mobile-header-quote { display: none !important; }
                            .desktop-header-quote { display: block !important; }
                            .mobile-table-quote { display: none !important; }
                            .desktop-table-quote { display: block !important; }
                            .mobile-totals-quote { display: none !important; }
                            .desktop-totals-quote { display: block !important; }
                          }
                        `}
                      </style>
                      <div style={{
                        border: '1px solid #000',
                        padding: '15px',
                        backgroundColor: 'white',
                        maxWidth: '800px',
                        margin: '0 auto'
                      }}>
                        {/* Determine GST Logic */}
                        {(() => {
                          const quot = quotationDetails.quotation;
                          const billComp = billingCompany;
                          let gstLogic = 'no_gst';
                          if (billComp && quot) {
                            const billCompanyCountryId = billComp.bc_country_id;
                            const quotationCountryId = quot.country_id;
                            const billCompanyStateId = billComp.bc_state_id;
                            const quotationStateId = quot.state_id;
                            
                            if (billCompanyCountryId && quotationCountryId) {
                              if (billCompanyCountryId !== quotationCountryId) {
                                gstLogic = 'no_gst';
                              } else if (billCompanyStateId && quotationStateId && billCompanyStateId === quotationStateId) {
                                gstLogic = 'cgst_sgst';
                              } else {
                                gstLogic = 'igst';
                              }
                            }
                          }
                          
                          // Calculate totals
                          let subTotal = 0;
                          let totalCGST = 0;
                          let totalSGST = 0;
                          let totalIGST = 0;
                          
                          quotationDetails.services.forEach(service => {
                            subTotal += parseFloat(service.amount || 0);
                            if (gstLogic === 'cgst_sgst') {
                              totalCGST += parseFloat(service.cgst_amount || 0);
                              totalSGST += parseFloat(service.sgst_amount || 0);
                            } else if (gstLogic === 'igst') {
                              totalIGST += parseFloat(service.igst_amount || 0);
                            }
                          });
                          
                          const grandTotalAmount = subTotal + totalCGST + totalSGST + totalIGST;
                          const amountInWords = convertAmountToWords(grandTotalAmount);
                          
                          // Helper to return image URL (backend now sends full URLs)
                          const getImageUrl = (imagePath) => {
                            if (!imagePath) return '';
                            // If already a full URL, return as is
                            if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                              return imagePath;
                            }
                            // Otherwise, construct URL using backend base URL (fallback)
                            const cleanPath = imagePath.replace(/^\//, '');
                            return `${backendBaseUrl}${cleanPath}`;
                          };
                          
                          return (
                            <>
                              {/* Desktop Header */}
                              <div className="desktop-header-quote">
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
                                  <tbody>
                                    <tr>
                                      <td style={{ width: '35%', verticalAlign: 'top', textAlign: 'center' }}>
                                        {billComp && billComp.bc_logo && (
                                          <img 
                                            src={getImageUrl(billComp.bc_logo)} 
                                            alt="Company Logo" 
                                            style={{ maxWidth: '150px', height: 'auto', display: 'block', margin: '0 auto' }}
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                          />
                                        )}
                                      </td>
                                      <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '10px' }}>
                                        <h2 style={{ margin: 0, fontSize: '16px', lineHeight: 1.2 }}>
                                          <b>{billComp?.bc_name || 'N/A'}</b>
                                        </h2>
                                        <p style={{ margin: '5px 0', fontSize: '12px', lineHeight: 1.3 }}>
                                          {billComp?.bc_address || ''}
                                          {billComp?.bc_gst && <><br />GST no: {billComp.bc_gst}</>}
                                        </p>
                                      </td>
                                      <td style={{ width: '15%', textAlign: 'center', verticalAlign: 'middle' }}>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>Quotation</div>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>

                              {/* Mobile Header */}
                              <div className="mobile-header-quote" style={{ textAlign: 'center', marginBottom: '15px' }}>
                                {billComp && billComp.bc_logo && (
                                  <img 
                                    src={getImageUrl(billComp.bc_logo)} 
                                    alt="Company Logo" 
                                    style={{ maxWidth: '120px', height: 'auto', marginBottom: '10px' }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                )}
                                <h2 style={{ margin: '5px 0', fontSize: '18px' }}>{billComp?.bc_name || 'N/A'}</h2>
                                <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>
                                  {billComp?.bc_address || ''}
                                  {billComp?.bc_gst && <><br />GST no: {billComp.bc_gst}</>}
                                </p>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginTop: '10px' }}>Quotation</div>
                              </div>

                              {/* Quote details */}
                              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', border: '1px solid #000' }}>
                                <tbody>
                                  <tr>
                                    <td style={{ border: '1px solid #000', padding: '6px', width: '33%' }}>
                                      Quotation No: <b>{quot.quotation_no}</b>
                                      <br /><br />
                                      Quotation Date: <b>{new Date().toLocaleDateString('en-GB')}</b><br />
                                      Contract Year: <b>{quot.contract_name || 'N/A'}</b><br />
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '6px', width: '34%' }}>
                                      Place Of Supply: <b>{quot.state || 'N/A'}</b>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>

                              {/* Bill To */}
                              <table style={{ width: '100%', border: '1px solid #000', borderCollapse: 'collapse', marginTop: '10px' }}>
                                <tbody>
                                  <tr>
                                    <td style={{ padding: '6px', backgroundColor: '#f2f2f2' }}>
                                      <b>Bill To</b><br />
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style={{ padding: '6px' }}>
                                      {quot.company_name}<br />
                                      {quot.contact_address || ''}<br />
                                      {quot.state || ''}<br />
                                      {quot.country || ''}<br />
                                    </td>
                                  </tr>
                                </tbody>
                              </table>

                              {/* Desktop Services Table */}
                              <div className="desktop-table-quote">
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', fontSize: '12px' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ border: '1px solid #000', padding: '8px 4px', background: '#f2f2f2', width: '8%', textAlign: 'center', fontSize: '11px' }}>#</th>
                                      <th style={{ border: '1px solid #000', padding: '8px 4px', background: '#f2f2f2', width: '45%', textAlign: 'left', fontSize: '11px' }}>Item & Description</th>
                                      <th style={{ border: '1px solid #000', padding: '8px 4px', background: '#f2f2f2', width: '15%', textAlign: 'center', fontSize: '11px' }}>HSN/SAC</th>
                                      {gstLogic === 'cgst_sgst' ? (
                                        <>
                                          <th style={{ border: '1px solid #000', padding: '8px 4px', background: '#f2f2f2', width: '8%', textAlign: 'center', fontSize: '11px' }} colSpan="2">CGST</th>
                                          <th style={{ border: '1px solid #000', padding: '8px 4px', background: '#f2f2f2', width: '8%', textAlign: 'center', fontSize: '11px' }} colSpan="2">SGST</th>
                                          <th style={{ border: '1px solid #000', padding: '8px 4px', background: '#f2f2f2', width: '16%', textAlign: 'right', fontSize: '11px' }}>Amount</th>
                                        </>
                                      ) : gstLogic === 'igst' ? (
                                        <>
                                          <th style={{ border: '1px solid #000', padding: '8px 4px', background: '#f2f2f2', width: '16%', textAlign: 'center', fontSize: '11px' }} colSpan="2">IGST</th>
                                          <th style={{ border: '1px solid #000', padding: '8px 4px', background: '#f2f2f2', width: '16%', textAlign: 'right', fontSize: '11px' }}>Amount</th>
                                        </>
                                      ) : (
                                        <th style={{ border: '1px solid #000', padding: '8px 4px', background: '#f2f2f2', width: '32%', textAlign: 'right', fontSize: '11px' }}>Amount</th>
                                      )}
                                    </tr>
                                    <tr>
                                      <th style={{ borderLeft: '1px solid #000', padding: '4px', background: '#f2f2f2' }}></th>
                                      <th style={{ padding: '4px', borderLeft: '1px solid #000', backgroundColor: '#f2f2f2' }}></th>
                                      <th style={{ padding: '4px', borderLeft: '1px solid #000', backgroundColor: '#f2f2f2' }}></th>
                                      {gstLogic === 'cgst_sgst' ? (
                                        <>
                                          <th style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'center' }}>%</th>
                                          <th style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'right' }}>Amt</th>
                                          <th style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'center' }}>%</th>
                                          <th style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'right' }}>Amt</th>
                                          <th style={{ border: '1px solid #000', borderTop: 'none', backgroundColor: '#f2f2f2', padding: '4px' }}></th>
                                        </>
                                      ) : gstLogic === 'igst' ? (
                                        <>
                                          <th style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'center' }}>%</th>
                                          <th style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'right' }}>Amt</th>
                                          <th style={{ border: '1px solid #000', borderTop: 'none', backgroundColor: '#f2f2f2', padding: '4px' }}></th>
                                        </>
                                      ) : (
                                        <th style={{ border: '1px solid #000', borderTop: 'none', backgroundColor: '#f2f2f2', padding: '4px' }}></th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {quotationDetails.services.map((service, index) => (
                                      <tr key={index}>
                                        <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{index + 1}</td>
                                        <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>
                                          {service.service_name}<br />
                                          Qty: {parseFloat(service.quantity || 1).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br />
                                          Rate per qty: {parseFloat(service.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br />
                                          {service.description || ''}
                                        </td>
                                        <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{service.hsn_sac || ''}</td>
                                        {gstLogic === 'cgst_sgst' ? (
                                          <>
                                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{(parseFloat(service.cgst || 0)).toFixed(1)}%</td>
                                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{parseFloat(service.cgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{(parseFloat(service.sgst || 0)).toFixed(1)}%</td>
                                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{parseFloat(service.sgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{parseFloat(service.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          </>
                                        ) : gstLogic === 'igst' ? (
                                          <>
                                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{(parseFloat(service.igst || 0)).toFixed(1)}%</td>
                                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{parseFloat(service.igst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{parseFloat(service.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          </>
                                        ) : (
                                          <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{parseFloat(service.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* Mobile Services List */}
                              <div className="mobile-table-quote">
                                {quotationDetails.services.map((service, index) => {
                                  const amount = parseFloat(service.amount || 0);
                                  const taxRate = parseFloat(service.igst || 0);
                                  const cgstRate = parseFloat(service.cgst || 0);
                                  const sgstRate = parseFloat(service.sgst || 0);
                                  const cgstAmount = parseFloat(service.cgst_amount || 0);
                                  const sgstAmount = parseFloat(service.sgst_amount || 0);
                                  const igstAmount = parseFloat(service.igst_amount || 0);
                                  
                                  return (
                                    <div key={index} className="mobile-service-item-quote">
                                      <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>
                                        {index + 1}. {service.service_name}
                                      </div>
                                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '3px' }}>
                                        HSN/SAC: {service.hsn_sac || ''}
                                      </div>
                                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '3px' }}>
                                        Qty: {parseFloat(service.quantity || 1).toLocaleString('en-IN', { minimumFractionDigits: 2 })} | 
                                        Rate: ₹{parseFloat(service.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </div>
                                      {service.description && (
                                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '5px' }}>
                                          {service.description}
                                        </div>
                                      )}
                                      {gstLogic === 'cgst_sgst' && (
                                        <div style={{ fontSize: '12px', marginTop: '5px' }}>
                                          <div>CGST: {cgstRate.toFixed(1)}% = ₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                          <div>SGST: {sgstRate.toFixed(1)}% = ₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                      )}
                                      {gstLogic === 'igst' && (
                                        <div style={{ fontSize: '12px', marginTop: '5px' }}>
                                          <div>IGST: {taxRate.toFixed(1)}% = ₹{igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                      )}
                                      <div style={{ fontWeight: 'bold', fontSize: '14px', marginTop: '5px', textAlign: 'right' }}>
                                        Total: ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Desktop Totals */}
                              <div className="desktop-totals-quote">
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', fontSize: '12px' }}>
                                  <tbody>
                                    <tr>
                                      <td style={{ border: '1px solid #000', padding: '10px', width: '60%', verticalAlign: 'top', backgroundColor: '#f9f9f9' }}>
                                        <b style={{ fontSize: '13px' }}>Total In Words</b><br />
                                        <span style={{ fontSize: '11px', lineHeight: 1.4 }}>Indian Rupee {amountInWords}</span>
                                      </td>
                                      <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', backgroundColor: '#f0f0f0' }}>
                                        <b style={{ fontSize: '12px' }}>Sub Total</b>
                                      </td>
                                      <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', backgroundColor: '#f0f0f0' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </td>
                                    </tr>
                                    {gstLogic === 'cgst_sgst' && (
                                      <>
                                        <tr>
                                          <td style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f0f0f0' }}></td>
                                          <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', backgroundColor: '#f0f0f0' }}>
                                            <b style={{ fontSize: '12px' }}>CGST (9%)</b>
                                          </td>
                                          <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', backgroundColor: '#f0f0f0' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>₹{totalCGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                          </td>
                                        </tr>
                                        <tr>
                                          <td style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f0f0f0' }}></td>
                                          <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', backgroundColor: '#f0f0f0' }}>
                                            <b style={{ fontSize: '12px' }}>SGST (9%)</b>
                                          </td>
                                          <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', backgroundColor: '#f0f0f0' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>₹{totalSGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                          </td>
                                        </tr>
                                      </>
                                    )}
                                    {gstLogic === 'igst' && (
                                      <tr>
                                        <td style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f0f0f0' }}></td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', backgroundColor: '#f0f0f0' }}>
                                          <b style={{ fontSize: '12px' }}>IGST (18%)</b>
                                        </td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', backgroundColor: '#f0f0f0' }}>
                                          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>₹{totalIGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                      </tr>
                                    )}
                                    <tr style={{ backgroundColor: '#e0e0e0' }}>
                                      <td style={{ border: '1px solid #000', padding: '10px', backgroundColor: '#e0e0e0' }}></td>
                                      <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'left' }}>
                                        <b style={{ fontSize: '14px', color: '#333' }}>Total</b>
                                      </td>
                                      <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>
                                        <b style={{ fontSize: '14px', color: '#d32f2f' }}>₹{grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>

                              {/* Mobile Totals */}
                              <div className="mobile-totals-quote" style={{ marginTop: '15px' }}>
                                <div style={{ background: '#f9f9f9', border: '1px solid #000', padding: '15px', marginBottom: '10px' }}>
                                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Total In Words</div>
                                  <div style={{ fontSize: '12px', color: '#666' }}>Indian Rupee {amountInWords}</div>
                                </div>
                                
                                <div style={{ border: '1px solid #000', background: '#f0f0f0', padding: '10px', marginBottom: '5px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                    <span><b>Sub Total:</b></span>
                                    <span><b>₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
                                  </div>
                                </div>
                                
                                {gstLogic === 'cgst_sgst' && (
                                  <>
                                    <div style={{ border: '1px solid #000', background: '#f0f0f0', padding: '10px', marginBottom: '5px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                        <span><b>CGST (9%):</b></span>
                                        <span><b>₹{totalCGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
                                      </div>
                                    </div>
                                    <div style={{ border: '1px solid #000', background: '#f0f0f0', padding: '10px', marginBottom: '5px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                        <span><b>SGST (9%):</b></span>
                                        <span><b>₹{totalSGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
                                      </div>
                                    </div>
                                  </>
                                )}
                                
                                {gstLogic === 'igst' && (
                                  <div style={{ border: '1px solid #000', background: '#f0f0f0', padding: '10px', marginBottom: '5px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                      <span><b>IGST (18%):</b></span>
                                      <span><b>₹{totalIGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
                                    </div>
                                  </div>
                                )}
                                
                                <div style={{ border: '2px solid #000', background: '#e0e0e0', padding: '15px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#d32f2f' }}>
                                    <span>TOTAL:</span>
                                    <span>₹{grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Bank Details & Signature */}
                              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                                <tbody>
                                  <tr>
                                    <td style={{ width: '70%', verticalAlign: 'top', paddingRight: '15px' }}>
                                      <div style={{ marginTop: '15px', fontSize: '13px' }}>
                                        <p style={{ margin: '5px 0' }}><b>Bank Details:</b></p>
                                        <p style={{ margin: '5px 0' }}>
                                          Account Name: {billComp?.bc_name || 'N/A'}<br />
                                          Account Number: {billComp?.bc_bank_acc_no || 'N/A'}<br />
                                          IFSC Code: {billComp?.bc_bank_ifsc || 'N/A'}<br />
                                          {billComp?.bc_bank_address ? (
                                            <>
                                              {billComp.bc_bank_address.includes('<br') ? (
                                                <>
                                                  {billComp.bc_bank_address.split(/<br\s*\/?>/i).filter(line => line.trim()).map((line, idx, arr) => (
                                                    <React.Fragment key={idx}>
                                                      {line.trim()}
                                                      {idx < arr.length - 1 && <br />}
                                                    </React.Fragment>
                                                  ))}
                                                </>
                                              ) : (
                                                billComp.bc_bank_address
                                              )}
                                              <br />
                                            </>
                                          ) : null}
                                          Bank Name: {billComp?.bc_bank_name || 'N/A'}<br />
                                          Branch: {billComp?.bc_bank_branch || 'N/A'}
                                        </p>
                                      </div>
                                    </td>
                                    <td style={{ width: '30%', verticalAlign: 'top', textAlign: 'center' }}>
                                      <div style={{ border: '1px solid #000', padding: '15px', backgroundColor: '#fff' }}>
                                        {billComp && billComp.bc_seal && (
                                          <div style={{ marginBottom: '20px' }}>
                                            <img 
                                              src={getImageUrl(billComp.bc_seal)} 
                                              alt="Authorized Signature" 
                                              style={{ maxHeight: '60px', width: 'auto', opacity: 0.7 }}
                                              onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                          </div>
                                        )}
                                        <div style={{ borderTop: '1px solid #000', marginTop: '10px', paddingTop: '8px' }}>
                                          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Authorized Signature</span>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>

                              {/* Terms & Conditions */}
                              <div style={{ marginTop: '15px', fontSize: '13px' }}>
                                <p style={{ margin: '5px 0' }}><b>Terms & Conditions</b></p>
                                <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.6, color: '#374151', fontSize: '0.7rem' }}>
                                  <li>This quote is valid for 30 days from the date of issue.</li>
                                  <li>Services or renewals commence only after written/email approval and advance payment.</li>
                                  <li>Changes in scope may result in revised costs or timelines.</li>
                                  <li>Payment delays may lead to service suspension or delayed delivery.</li>
                                  <li>Renewal approvals must be received 30 days prior to the renewal date.</li>
                                  <li>Intellectual property rights remain with Webindia until full payment.</li>
                                  <li>Support and maintenance apply only under an active service agreement or AMC.</li>
                                </ul>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                  <div>
                    {/* Quotation Info */}
                    <div style={{
                      backgroundColor: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      marginBottom: '1.5rem'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Company</label>
                          <p style={{ margin: '0.25rem 0 0 0', color: '#111827' }}>{quotationDetails.quotation.company_name}</p>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Contact Person</label>
                          <p style={{ margin: '0.25rem 0 0 0', color: '#111827' }}>{quotationDetails.quotation.contact_person}</p>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Contract Type</label>
                          <p style={{ margin: '0.25rem 0 0 0', color: '#111827' }}>{quotationDetails.quotation.contract_name}</p>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Status</label>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            backgroundColor: quotationDetails.quotation.status === 'accepted' ? '#dcfce7' : 
                                           quotationDetails.quotation.status === 'sent' ? '#dbeafe' :
                                           quotationDetails.quotation.status === 'hold' ? '#fef3c7' : '#f3f4f6',
                            color: quotationDetails.quotation.status === 'accepted' ? '#166534' :
                                   quotationDetails.quotation.status === 'sent' ? '#1e40af' :
                                   quotationDetails.quotation.status === 'hold' ? '#92400e' : '#374151'
                          }}>
                            {quotationDetails.quotation.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Services Table */}
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
                        Services
                      </h3>
                      <div style={{ overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f9fafb' }}>
                              <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Service</th>
                              <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '500', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                              <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '500', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Rate</th>
                              <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '500', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quotationDetails.services.map((service, index) => (
                              <tr key={index}>
                                <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                                  <div>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{service.service_name}</div>
                                    {service.description && (
                                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                        {service.description}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                                  {service.quantity}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                                  ₹{parseFloat(service.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                                  ₹{parseFloat(service.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Totals */}
                    <div style={{
                      marginTop: '1.5rem',
                      padding: '1rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: '500', color: '#374151' }}>Sub Total:</span>
                        <span style={{ fontWeight: '500', color: '#111827' }}>
                          ₹{parseFloat(quotationDetails.totals.sub_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {/* Tax Breakdown */}
                      {quotationDetails.services.some(service => (service.igst_amount || 0) + (service.cgst_amount || 0) + (service.sgst_amount || 0) > 0) && (
                        <>
                          {quotationDetails.services.some(service => service.igst_amount > 0) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>IGST:</span>
                              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                ₹{quotationDetails.services.reduce((sum, service) => sum + (service.igst_amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          {quotationDetails.services.some(service => service.cgst_amount > 0) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>CGST:</span>
                              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                ₹{quotationDetails.services.reduce((sum, service) => sum + (service.cgst_amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          {quotationDetails.services.some(service => service.sgst_amount > 0) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>SGST:</span>
                              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                ₹{quotationDetails.services.reduce((sum, service) => sum + (service.sgst_amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: '500', color: '#374151' }}>Total Tax:</span>
                        <span style={{ fontWeight: '500', color: '#111827' }}>
                          ₹{parseFloat(quotationDetails.totals.total_tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                        <span style={{ fontWeight: '600', fontSize: '1.125rem', color: '#111827' }}>Grand Total:</span>
                        <span style={{ fontWeight: '600', fontSize: '1.125rem', color: '#111827' }}>
                          ₹{parseFloat(quotationDetails.totals.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Previous Versions (Reference) Section - Only show if there are actual references */}
                    {quotationReferences && quotationReferences.length > 0 && (
                      <div style={{
                        marginTop: '2rem',
                        padding: '1.5rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '0.5rem',
                        border: '1px solid #e2e8f0'
                      }}>
                        <h4 style={{
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          📋 Previous Versions (Reference)
                        </h4>
                        
                        {loadingReferences ? (
                          <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280' }}>
                            Loading references...
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {quotationReferences.map((ref, index) => (
                              <div key={ref.id} style={{
                                display: 'flex',
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem',
                                backgroundColor: 'white',
                                borderRadius: '0.375rem',
                                border: '1px solid #e5e7eb',
                                fontSize: '0.875rem'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                                  <div style={{ fontWeight: '500', color: '#1f2937' }}>
                                    {ref.quotation_no}
                                  </div>
                                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                                    {ref.company} • {ref.contact_person}
                                  </div>
                                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                                    Created: {new Date(ref.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                                
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '0.75rem',
                                  justifyContent: 'flex-end'
                                }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                                      ₹{ref.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                    </div>
                                    <span style={{
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '0.25rem',
                                      fontSize: '0.75rem',
                                      fontWeight: '500',
                                      backgroundColor: ref.status === 'accepted' ? '#f0f9ff' : 
                                                     ref.status === 'sent' ? '#fef3c7' :
                                                     ref.status === 'hold' ? '#fef2f2' : '#f3f4f6',
                                      color: ref.status === 'accepted' ? '#0ea5e9' : 
                                            ref.status === 'sent' ? '#d97706' :
                                            ref.status === 'hold' ? '#dc2626' : '#6b7280'
                                    }}>
                                      {ref.status.toUpperCase()}
                                    </span>
                                  </div>
                                  
                                  <button
                                    onClick={() => handleViewReference(ref)}
                                    style={{
                                      padding: '0.5rem',
                                      backgroundColor: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '0.25rem',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                      fontWeight: '500',
                                      minWidth: '70px',
                                      height: '32px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '0.25rem'
                                    }}
                                    title="View quotation details"
                                  >
                                    👁️ View
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    color: '#6b7280'
                  }}>
                    No quotation details found
                  </div>
                )}

                {/* Bottom Close Button */}
                <div style={{
                  padding: '1.5rem',
                  borderTop: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  backgroundColor: '#f9fafb'
                }}>
                  <button
                    onClick={handleCloseView}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#e5e7eb',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <X size={16} />
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Quotation;
