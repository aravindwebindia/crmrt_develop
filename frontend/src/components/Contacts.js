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
  ArrowUpDown,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Users
} from 'lucide-react';

const Contacts = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
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
  const [editingContact, setEditingContact] = useState(null);
  // Contact persons modal state
  const [showPersonsModal, setShowPersonsModal] = useState(false);
  const [selectedContactForPersons, setSelectedContactForPersons] = useState(null);
  const [persons, setPersons] = useState([]);
  const [personsLoading, setPersonsLoading] = useState(false);
  const [personsError, setPersonsError] = useState('');
  const [editingPerson, setEditingPerson] = useState(null);
  const [personForm, setPersonForm] = useState({ contact_person: '', contact_mobile: '', contact_email: '', status: 'active' });
  const [personErrors, setPersonErrors] = useState({});
  const [savingPerson, setSavingPerson] = useState(false);
  const [formData, setFormData] = useState({
    sal_id: '',
    first_name: '',
    last_name: '',
    designation: '',
    email: '',
    mobile: '',
    notes: '',
    company: '',
    c_address: '',
    picture: '',
    company_gst: '',
    state: '',
    country: '',
    city: '',
    zip: '',
    status: 'active'
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  // Dropdown data
  const [salutations, setSalutations] = useState([]);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);

  // Fetch contacts
  const fetchContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);

      const response = await api.get(`/contacts.php?${params.toString()}`);
      
      if (response.data.success) {
        setContacts(response.data.data);
        setTotalPages(response.data.pagination?.total_pages || 1);
        setTotalItems(response.data.pagination?.total_items || 0);
      } else {
        toast.error(response.data.message || 'Failed to fetch contacts');
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  // Fetch dropdown data
  const fetchDropdownData = async () => {
    try {
      
      // Fetch salutations
      const salutationsResponse = await api.get('/contact-dropdowns.php?action=salutations');
      if (salutationsResponse.data.success) {
        setSalutations(salutationsResponse.data.data);
      }

      // Fetch countries
      const countriesResponse = await api.get('/contact-dropdowns.php?action=countries');
      if (countriesResponse.data.success) {
        setCountries(countriesResponse.data.data);
      }
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
    }
  };

  // Fetch states by country
  const fetchStates = async (countryId) => {
    try {
      const response = await api.get(`/contact-dropdowns.php?action=states&country_id=${countryId}`);
      if (response.data.success) {
        setStates(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching states:', error);
    }
  };

  // Fetch contacts on component mount
  useOnce(() => {
    fetchContacts();
    fetchDropdownData();
  }, []);

  // Fetch contacts when filters change (skip first render)
  const didMountFilters = useRef(false);
  useEffect(() => {
    if (!didMountFilters.current) {
      didMountFilters.current = true;
      return; // initial fetch handled above
    }
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchContacts();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, sortBy, sortOrder, statusFilter]);

  // Fetch contacts when page or items per page changes (skip first render)
  const didMountPagePerPage = useRef(false);
  useEffect(() => {
    if (!didMountPagePerPage.current) {
      didMountPagePerPage.current = true;
      return;
    }
    fetchContacts();
  }, [currentPage, itemsPerPage]);

  // Handle sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
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

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    // First Name validation
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'This is required field';
    }
    
    // Email validation - must contain @ and .
    if (!formData.email.trim()) {
      newErrors.email = 'This is required field';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address with @ and .';
    }
    
    // Mobile validation - 8 to 15 digits
    if (!formData.mobile.trim()) {
      newErrors.mobile = 'This is required field';
    } else if (!/^[0-9]{8,15}$/.test(formData.mobile.trim())) {
      newErrors.mobile = 'Mobile number must be 8 to 15 digits';
    }
    
    // Company validation
    if (!formData.company.trim()) {
      newErrors.company = 'This is required field';
    }
    
    // Country validation
    if (!formData.country) {
      newErrors.country = 'This is required field';
    }
    
    // State validation
    if (!formData.state) {
      newErrors.state = 'This is required field';
    }
    
    // Company Address validation
    if (!formData.c_address.trim()) {
      newErrors.c_address = 'This is required field';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Real-time validation
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    
    const newErrors = { ...errors };
    
    if (field === 'first_name') {
      if (!value.trim()) {
        newErrors.first_name = 'This is required field';
      } else {
        delete newErrors.first_name;
      }
    } else if (field === 'email') {
      if (!value.trim()) {
        newErrors.email = 'This is required field';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        newErrors.email = 'Please enter a valid email address with @ and .';
      } else {
        delete newErrors.email;
      }
    } else if (field === 'mobile') {
      if (!value.trim()) {
        newErrors.mobile = 'This is required field';
      } else if (!/^[0-9]{8,15}$/.test(value.trim())) {
        newErrors.mobile = 'Mobile number must be 8 to 15 digits';
      } else {
        delete newErrors.mobile;
      }
    } else if (field === 'company') {
      if (!value.trim()) {
        newErrors.company = 'This is required field';
      } else {
        delete newErrors.company;
      }
    } else if (field === 'country') {
      if (!value) {
        newErrors.country = 'This is required field';
      } else {
        delete newErrors.country;
        // Fetch states when country changes
        fetchStates(value);
        setFormData(prev => ({ ...prev, state: '' })); // Reset state
      }
    } else if (field === 'state') {
      if (!value) {
        newErrors.state = 'This is required field';
      } else {
        delete newErrors.state;
      }
    } else if (field === 'c_address') {
      if (!value.trim()) {
        newErrors.c_address = 'This is required field';
      } else {
        delete newErrors.c_address;
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
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        mobile: formData.mobile.trim(),
        company: formData.company.trim()
      };

      let response;
      if (editingContact) {
        // Update contact
        response = await api.put('/contacts.php', {
          id: editingContact.ld_id,
          ...data
        });
      } else {
        // Create contact
        response = await api.post('/contacts.php', data);
      }

      if (response.data.success) {
        toast.success(response.data.message);
        setShowModal(false);
        setEditingContact(null);
        resetForm();
        fetchContacts();
      } else {
        if (response.data.errors) {
          setErrors(response.data.errors);
        }
        toast.error(response.data.message || 'Operation failed');
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
      toast.error('Failed to save contact');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      sal_id: '',
      first_name: '',
      last_name: '',
      designation: '',
      email: '',
      mobile: '',
      notes: '',
      company: '',
      c_address: '',
      picture: '',
      company_gst: '',
      state: '',
      country: '',
      city: '',
      zip: '',
      status: 'active'
    });
    setErrors({});
    setTouched({});
    setEditingContact(null);
  };

  // Open modal for new contact
  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Handle edit contact
  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormData({
      sal_id: contact.sal_id || '',
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      designation: contact.designation || '',
      email: contact.email || '',
      mobile: contact.mobile || '',
      notes: contact.notes || '',
      company: contact.company || '',
      c_address: contact.c_address || '',
      picture: contact.picture || '',
      company_gst: contact.company_gst || '',
      state: contact.state || '',
      country: contact.country || '',
      city: contact.city || '',
      zip: contact.zip || '',
      status: contact.status || 'active'
    });
    setErrors({});
    setTouched({});
    
    // Load states for the selected country
    if (contact.country) {
      fetchStates(contact.country);
    }
    
    setShowModal(true);
  };

  // Handle delete contact
  const handleDelete = async (contact) => {
    if (window.confirm(`Are you sure you want to delete "${contact.first_name} ${contact.last_name}"?`)) {
      setLoading(true);
      try {
        const response = await api.delete('/contacts.php', {
          data: { id: contact.ld_id }
        });

        if (response.data.success) {
          toast.success(response.data.message);
          fetchContacts();
        } else {
          toast.error(response.data.message || 'Failed to delete contact');
        }
      } catch (error) {
        console.error('Error deleting contact:', error);
        toast.error('Failed to delete contact');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle status toggle
  const handleStatusToggle = async (contact) => {
    setLoading(true);
    try {
      const response = await api.post('/contact-status.php', {
        id: contact.ld_id
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchContacts();
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

  // View contact persons for a contact
  const handleViewPersons = async (contact) => {
    setSelectedContactForPersons(contact);
    setShowPersonsModal(true);
    setPersons([]);
    setPersonsError('');
    setPersonsLoading(true);
    setEditingPerson(null);
    try {
      // ld_id is the contact's primary key used elsewhere in this file
      const response = await api.get(`/contact-persons.php?contact_id=${contact.ld_id}`);
      if (response.data && response.data.success) {
        setPersons(Array.isArray(response.data.data) ? response.data.data : []);
      } else {
        setPersonsError(response.data?.message || 'Failed to load contact persons');
      }
    } catch (e) {
      setPersonsError('Failed to load contact persons');
    } finally {
      setPersonsLoading(false);
    }
  };

  const startEditPerson = (p) => {
    setEditingPerson(p);
    setPersonForm({
      contact_person: p.contact_person || '',
      contact_mobile: (p.contact_mobile || '').replace(/\D/g, '').slice(0, 10),
      contact_email: p.contact_email || '',
      status: p.status || 'active'
    });
    setPersonErrors({});
  };

  const cancelEditPerson = () => {
    setEditingPerson(null);
    setPersonForm({ contact_person: '', contact_mobile: '', contact_email: '', status: 'active' });
    setPersonErrors({});
  };

  const validatePersonForm = () => {
    const errors = {};
    const name = (personForm.contact_person || '').trim();
    const mobile = (personForm.contact_mobile || '').trim();
    const email = (personForm.contact_email || '').trim();
    if (!name) errors.contact_person = 'Name is required';
    else if (!/^[a-zA-Z\s]+$/.test(name)) errors.contact_person = 'Only letters and spaces allowed';
    if (!mobile) errors.contact_mobile = 'Mobile is required';
    else if (!/^\d{10}$/.test(mobile)) errors.contact_mobile = 'Enter 10-digit number';
    if (!email) errors.contact_email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.contact_email = 'Invalid email';
    setPersonErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const savePersonUpdate = async () => {
    if (!editingPerson) return;
    if (!validatePersonForm()) return;
    setSavingPerson(true);
    try {
      const payload = {
        id: editingPerson.cp_id,
        contact_person: personForm.contact_person.trim(),
        contact_mobile: personForm.contact_mobile.trim(),
        contact_email: personForm.contact_email.trim(),
        status: personForm.status || 'active'
      };
      const response = await api.put('/contact-persons.php', payload);
      if (response.data && response.data.success) {
        const refreshed = persons.map(p => p.cp_id === editingPerson.cp_id ? { ...p, ...payload } : p);
        setPersons(refreshed);
        cancelEditPerson();
        toast.success('Contact person updated');
      } else {
        toast.error(response.data?.message || 'Failed to update');
      }
    } catch (e) {
      toast.error('Failed to update');
    } finally {
      setSavingPerson(false);
    }
  };

  return (
    <div className="main-container" style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc'
    }}>
      {/* Sidebar */}
      <Sidebar activeItem="contacts" />

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
              Contacts Management
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Manage your contacts and company information
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
              placeholder="Search contacts..."
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

          {/* Add Contact Button */}
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
            Add Contact
          </button>
        </div>

        {/* Contacts Table */}
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
              minWidth: '800px'
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
                      onClick={() => handleSort('first_name')}
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
                      Name
                      {sortBy === 'first_name' ? (
                        sortOrder === 'ASC' ? <ChevronUp size={16} style={{ marginLeft: '0.25rem' }} /> : <ChevronDown size={16} style={{ marginLeft: '0.25rem' }} />
                      ) : (
                        <ArrowUpDown size={16} style={{ marginLeft: '0.25rem', opacity: 0.5 }} />
                      )}
                    </button>
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                    Email
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                    Mobile
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                    <button
                      onClick={() => handleSort('company')}
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
                      Company
                      {sortBy === 'company' ? (
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
                  <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      Loading contacts...
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      No contacts found
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact, index) => (
                    <tr key={contact.ld_id} style={{ borderTop: '1px solid #e5e7eb' }}>
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
                        <div>
                          <div style={{ fontWeight: '500' }}>
                            {contact.salutation_name} {contact.first_name} {contact.last_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {contact.designation}
                          </div>
                        </div>
                      </td>
                      <td style={{ 
                        padding: '0.75rem 0.5rem', 
                        fontSize: '0.875rem', 
                        color: '#1f2937' 
                      }}>
                        {contact.email}
                      </td>
                      <td style={{ 
                        padding: '0.75rem 0.5rem', 
                        fontSize: '0.875rem', 
                        color: '#1f2937' 
                      }}>
                        {contact.mobile}
                      </td>
                      <td style={{ 
                        padding: '0.75rem 0.5rem', 
                        fontSize: '0.875rem', 
                        color: '#1f2937',
                        wordBreak: 'break-word'
                      }}>
                        {contact.company}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <button
                          onClick={() => handleStatusToggle(contact)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            backgroundColor: contact.status === 'active' ? '#f0f9ff' : '#fef2f2',
                            color: contact.status === 'active' ? '#0ea5e9' : '#dc2626',
                            border: 'none',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {contact.status.toUpperCase()}
                        </button>
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
                          onClick={() => handleViewPersons(contact)}
                          style={{
                            padding: '0.375rem',
                            backgroundColor: '#eff6ff',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            color: '#1d4ed8',
                            minWidth: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="View contact persons"
                        >
                          <Users size={14} />
                        </button>
                        <button
                          onClick={() => handleEdit(contact)}
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
                          title="Edit contact"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(contact)}
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
                          title="Delete contact"
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
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} contacts
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
                    onClick={() => handlePageChange(pageNum)}
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
              maxWidth: '600px',
              margin: '1rem',
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
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h3>

              <form onSubmit={handleSubmit}>
                {/* Row 1: Salutation, First Name */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: '1' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Salutation
                    </label>
                    <select
                      value={formData.sal_id}
                      onChange={(e) => handleFieldChange('sal_id', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                    >
                      <option value="">Select Salutation</option>
                      {salutations.map(sal => (
                        <option key={sal.sal_id} value={sal.sal_id}>
                          {sal.salutation_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: '2' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => handleFieldChange('first_name', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, first_name: true }))}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${errors.first_name ? '#dc2626' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: errors.first_name ? '#fef2f2' : 'white'
                      }}
                    />
                    {errors.first_name && touched.first_name && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#dc2626'
                      }}>
                        <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                        {errors.first_name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Last Name, Email */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: '1' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => handleFieldChange('last_name', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, last_name: true }))}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${errors.last_name ? '#dc2626' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: errors.last_name ? '#fef2f2' : 'white'
                      }}
                    />
                    {errors.last_name && touched.last_name && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#dc2626'
                      }}>
                        <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                        {errors.last_name}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: '2' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
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
                    {errors.email && touched.email && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#dc2626'
                      }}>
                        <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                        {errors.email}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 3: Designation, Mobile */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: '1' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Designation
                    </label>
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => handleFieldChange('designation', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <div style={{ flex: '2' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Mobile *
                    </label>
                    <input
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) => handleFieldChange('mobile', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, mobile: true }))}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${errors.mobile ? '#dc2626' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: errors.mobile ? '#fef2f2' : 'white'
                      }}
                    />
                    {errors.mobile && touched.mobile && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#dc2626'
                      }}>
                        <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                        {errors.mobile}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 4: Company Name, Company GST */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: '2' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => handleFieldChange('company', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, company: true }))}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${errors.company ? '#dc2626' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: errors.company ? '#fef2f2' : 'white'
                      }}
                    />
                    {errors.company && touched.company && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#dc2626'
                      }}>
                        <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                        {errors.company}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: '1' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Company GST Number
                    </label>
                    <input
                      type="text"
                      value={formData.company_gst}
                      onChange={(e) => handleFieldChange('company_gst', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                </div>

                {/* Country, State, City, Zip */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  {/* Country */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Country *
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => handleFieldChange('country', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, country: true }))}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${errors.country ? '#dc2626' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: errors.country ? '#fef2f2' : 'white'
                      }}
                    >
                      <option value="">Select Country</option>
                      {countries.map(country => (
                        <option key={country.country_id} value={country.country_id}>
                          {country.country_name}
                        </option>
                      ))}
                    </select>
                    {errors.country && touched.country && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#dc2626'
                      }}>
                        <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                        {errors.country}
                      </div>
                    )}
                  </div>
                  {/* State */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      State *
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) => handleFieldChange('state', e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, state: true }))}
                      required
                      disabled={!formData.country}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${errors.state ? '#dc2626' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: errors.state ? '#fef2f2' : (formData.country ? 'white' : '#f9fafb')
                      }}
                    >
                      <option value="">Select State</option>
                      {states.map(state => (
                        <option key={state.state_id} value={state.state_id}>
                          {state.state_name}
                        </option>
                      ))}
                    </select>
                    {errors.state && touched.state && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#dc2626'
                      }}>
                        <AlertCircle size={14} style={{ marginRight: '0.25rem' }} />
                        {errors.state}
                      </div>
                    )}
                  </div>
                  {/* City */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleFieldChange('city', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  {/* Zip Code */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Zip Code
                    </label>
                    <input
                      type="text"
                      value={formData.zip}
                      onChange={(e) => handleFieldChange('zip', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                </div>

                {/* Row 5: Company Address */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Company Address *
                  </label>
                  <textarea
                    value={formData.c_address}
                    onChange={(e) => handleFieldChange('c_address', e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: errors.c_address ? '1px solid #dc2626' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      resize: 'vertical'
                    }}
                  />
                  {errors.c_address && (
                    <div style={{
                      color: '#dc2626',
                      fontSize: '0.75rem',
                      marginTop: '0.25rem'
                    }}>
                      {errors.c_address}
                    </div>
                  )}
                </div>

                {/* Row 6: Notes */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Row 7: Status */}
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
                    {loading ? 'Saving...' : (editingContact ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Contact Persons Modal */}
        {showPersonsModal && (
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
            zIndex: 1100
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              width: '100%',
              maxWidth: '700px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '1.5rem',
              position: 'relative',
              margin: '1rem'
            }}>
              <button
                onClick={() => { setShowPersonsModal(false); setSelectedContactForPersons(null); setPersons([]); setPersonsError(''); }}
                style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
                title="Close"
              >
                <X size={20} />
              </button>

              <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
                {selectedContactForPersons ? `Contact Persons from ${selectedContactForPersons.company || (selectedContactForPersons.first_name + ' ' + (selectedContactForPersons.last_name || ''))}` : 'Contact Persons'}
              </h3>

              {personsLoading ? (
                <div style={{ padding: '1rem', color: '#6b7280' }}>Loading...</div>
              ) : personsError ? (
                <div style={{ padding: '1rem', color: '#dc2626' }}>{personsError}</div>
              ) : persons.length === 0 ? (
                <div style={{ padding: '1rem', color: '#6b7280' }}>No contact persons found for this contact.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem', color: '#374151' }}>Name</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem', color: '#374151' }}>Mobile</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem', color: '#374151' }}>Email</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem', color: '#374151', width: '100px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {persons.map((p, i) => (
                        editingPerson?.cp_id === p.cp_id ? (
                          <tr key={`${p.cp_id || i}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td colSpan={4} style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.25rem' }}>Name</label>
                                  <input
                                    type="text"
                                    value={personForm.contact_person}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                      setPersonForm(prev => ({ ...prev, contact_person: value }));
                                      if (personErrors.contact_person) setPersonErrors(prev => ({ ...prev, contact_person: '' }));
                                    }}
                                    onBlur={() => {
                                      const name = (personForm.contact_person || '').trim();
                                      if (!name) setPersonErrors(prev => ({ ...prev, contact_person: 'Name is required' }));
                                      else if (!/^[a-zA-Z\s]+$/.test(name)) setPersonErrors(prev => ({ ...prev, contact_person: 'Only letters and spaces allowed' }));
                                    }}
                                    style={{ width: '100%', padding: '0.5rem', border: personErrors.contact_person ? '1px solid #dc2626' : '1px solid #d1d5db', borderRadius: '0.375rem' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.25rem' }}>Mobile</label>
                                  <input
                                    type="text"
                                    value={personForm.contact_mobile}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(/\D/g, '').slice(0,10);
                                      setPersonForm(prev => ({ ...prev, contact_mobile: value }));
                                      if (personErrors.contact_mobile) setPersonErrors(prev => ({ ...prev, contact_mobile: '' }));
                                    }}
                                    onBlur={() => {
                                      const mobile = (personForm.contact_mobile || '').trim();
                                      if (!mobile) setPersonErrors(prev => ({ ...prev, contact_mobile: 'Mobile is required' }));
                                      else if (!/^\d{10}$/.test(mobile)) setPersonErrors(prev => ({ ...prev, contact_mobile: 'Enter 10-digit number' }));
                                    }}
                                    style={{ width: '100%', padding: '0.5rem', border: personErrors.contact_mobile ? '1px solid #dc2626' : '1px solid #d1d5db', borderRadius: '0.375rem' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.25rem' }}>Email</label>
                                  <input
                                    type="email"
                                    value={personForm.contact_email}
                                    onChange={(e) => {
                                      setPersonForm(prev => ({ ...prev, contact_email: e.target.value }));
                                      if (personErrors.contact_email) setPersonErrors(prev => ({ ...prev, contact_email: '' }));
                                    }}
                                    onBlur={() => {
                                      const email = (personForm.contact_email || '').trim();
                                      if (!email) setPersonErrors(prev => ({ ...prev, contact_email: 'Email is required' }));
                                      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setPersonErrors(prev => ({ ...prev, contact_email: 'Invalid email' }));
                                    }}
                                    style={{ width: '100%', padding: '0.5rem', border: personErrors.contact_email ? '1px solid #dc2626' : '1px solid #d1d5db', borderRadius: '0.375rem' }}
                                  />
                                </div>
                                {(personErrors.contact_person || personErrors.contact_mobile || personErrors.contact_email) && (
                                  <div style={{ color: '#dc2626', fontSize: '0.75rem' }}>
                                    {personErrors.contact_person || personErrors.contact_mobile || personErrors.contact_email}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={savePersonUpdate}
                                    disabled={savingPerson}
                                    style={{ padding: '0.375rem 0.75rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: savingPerson ? 'not-allowed' : 'pointer' }}
                                  >
                                    {savingPerson ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={cancelEditPerson}
                                    style={{ padding: '0.375rem 0.75rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={`${p.cp_id || i}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.75rem', color: '#111827' }}>{p.contact_person || '-'}</td>
                            <td style={{ padding: '0.75rem', color: '#6b7280' }}>{p.contact_mobile || '-'}</td>
                            <td style={{ padding: '0.75rem', color: '#6b7280' }}>{p.contact_email || '-'}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                              <button
                                onClick={() => startEditPerson(p)}
                                style={{ padding: '0.375rem', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', color: '#374151', minWidth: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Edit contact person"
                              >
                                <Edit size={14} />
                              </button>
                            </td>
                          </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Contacts;
