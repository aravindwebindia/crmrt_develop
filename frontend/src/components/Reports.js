import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import api from '../utils/axiosConfig';
import Sidebar from './Sidebar';
import UserDropdown from './UserDropdown';
import * as XLSX from 'xlsx';
import { 
  FileBarChart,
  Filter,
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const Reports = () => {
  const { user } = useAuth();
  const [reportType, setReportType] = useState('sale_order_wise');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Filter states
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedContactPerson, setSelectedContactPerson] = useState('');
  const [selectedFinancialYear, setSelectedFinancialYear] = useState('');
  const [companies, setCompanies] = useState([]);
  const [contactPersons, setContactPersons] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);

  // Generate financial years (April to March)
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    
    // Calculate current financial year start
    const currentFYStart = currentMonth >= 4 ? currentYear : currentYear - 1;
    
    const years = [];
    const seen = new Set();
    
    // Generate years from 2020 to current + 2 years
    for (let startYear = 2020; startYear <= currentYear + 2; startYear++) {
      const fyStart = `${startYear}-${String(startYear + 1).slice(-2)}`;
      if (!seen.has(fyStart)) {
        seen.add(fyStart);
        years.push({
          value: fyStart,
          label: `${fyStart} (Apr ${startYear} - Mar ${startYear + 1})`,
          startYear: startYear,
          endYear: startYear + 1
        });
      }
    }
    
    // Sort by start year descending
    years.sort((a, b) => b.startYear - a.startYear);
    
    setFinancialYears(years);
    // Set default to current financial year
    const defaultFY = `${currentFYStart}-${String(currentFYStart + 1).slice(-2)}`;
    setSelectedFinancialYear(defaultFY);
  }, []);

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await api.get('/contacts.php?limit=1000');
        if (response.data.success) {
          setCompanies(response.data.data.map(item => ({
            value: item.ld_id,
            label: item.company
          })));
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };
    fetchCompanies();
  }, []);

  // Fetch contact persons when company is selected
  useEffect(() => {
    const fetchContactPersons = async () => {
      if (!selectedCompany) {
        setContactPersons([]);
        return;
      }
      try {
        const response = await api.get(`/contact-persons.php?contact_id=${selectedCompany}`);
        if (response.data.success) {
          setContactPersons(response.data.data.map(item => ({
            value: item.cp_id,
            label: item.contact_person
          })));
        }
      } catch (error) {
        console.error('Error fetching contact persons:', error);
      }
    };
    fetchContactPersons();
  }, [selectedCompany]);

  // Fetch report data
  const fetchReport = async () => {
    if (!reportType) {
      toast.error('Please select a report type');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('report_type', reportType);
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);
      if (selectedCompany) params.append('company_id', selectedCompany);
      if (selectedContactPerson) params.append('contact_person_id', selectedContactPerson);
      if (selectedFinancialYear) params.append('financial_year', selectedFinancialYear);

      const response = await api.get(`/reports.php?${params}`);
      
      if (response.data.success) {
        setReportData(response.data.data);
        setTotalPages(response.data.total_pages || 1);
        setTotalItems(response.data.total_items || 0);
      } else {
        toast.error(response.data.message || 'Failed to fetch report');
        setReportData(null);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Failed to fetch report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [reportType, selectedCompany, selectedContactPerson, selectedFinancialYear]);

  useEffect(() => {
    // Only fetch if we have a report type selected
    if (reportType) {
      fetchReport();
    }
  }, [reportType, selectedCompany, selectedContactPerson, selectedFinancialYear, currentPage, itemsPerPage]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatCurrencyForExcel = (amount) => {
    return parseFloat(amount || 0).toFixed(2);
  };

  // Export to Excel function
  const exportToExcel = async () => {
    if (!reportData || !reportType) {
      toast.error('No data to export');
      return;
    }

    try {
      // Fetch all data for export (not paginated)
      const params = new URLSearchParams();
      params.append('report_type', reportType);
      params.append('page', 1);
      params.append('limit', 10000); // Large limit to get all data
      if (selectedCompany) params.append('company_id', selectedCompany);
      if (selectedContactPerson) params.append('contact_person_id', selectedContactPerson);
      if (selectedFinancialYear) params.append('financial_year', selectedFinancialYear);

      const response = await api.get(`/reports.php?${params}`);
      
      if (!response.data.success || !response.data.data) {
        toast.error('Failed to fetch data for export');
        return;
      }

      const allData = response.data.data;
      let workbook = XLSX.utils.book_new();
      let worksheet;
      let reportName = '';

      // Generate Excel based on report type
      switch (reportType) {
        case 'sale_order_wise':
          reportName = 'Sale Order Wise Report';
          if (allData.sale_orders && allData.sale_orders.length > 0) {
            const excelData = allData.sale_orders.map((row, index) => ({
              'S.No': index + 1,
              'SO Number': row.so_number || '',
              'Customer': row.customer || '',
              'SO Value (₹)': formatCurrencyForExcel(row.so_value),
              'Invoiced Value (₹)': formatCurrencyForExcel(row.total_pi_value),
              'Diff (₹)': formatCurrencyForExcel(row.diff),
              'Status': row.status || '',
              '# of PIs': row.pi_count || 0
            }));
            worksheet = XLSX.utils.json_to_sheet(excelData);
          }
          break;

        case 'company_wise':
          reportName = 'Company Wise Report';
          if (allData.companies && allData.companies.length > 0) {
            const excelData = allData.companies.map((row, index) => ({
              'S.No': index + 1,
              'Company Name': row.company_name || '',
              'Total Sale Orders': row.total_sale_orders || 0,
              'Total Quotations': row.total_quotations || 0,
              'Total SO Value (₹)': formatCurrencyForExcel(row.total_so_value),
              'Invoiced Value (₹)': formatCurrencyForExcel(row.total_pi_value),
              'Outstanding (₹)': formatCurrencyForExcel(row.total_outstanding)
            }));
            worksheet = XLSX.utils.json_to_sheet(excelData);
          }
          break;

        case 'company_contact_wise':
          reportName = 'Company Contact Person Wise Report';
          if (allData.company_contacts && allData.company_contacts.length > 0) {
            const excelData = allData.company_contacts.map((row, index) => ({
              'S.No': index + 1,
              'Company Name': row.company_name || '',
              'Contact Person': row.contact_person || 'N/A',
              'Total Sale Orders': row.total_sale_orders || 0,
              'Total Quotations': row.total_quotations || 0,
              'Total SO Value (₹)': formatCurrencyForExcel(row.total_so_value),
              'Invoiced Value (₹)': formatCurrencyForExcel(row.total_pi_value),
              'Outstanding (₹)': formatCurrencyForExcel(row.total_outstanding)
            }));
            worksheet = XLSX.utils.json_to_sheet(excelData);
          }
          break;

        case 'quotation_wise':
          reportName = 'Quotation Wise Report';
          if (allData.quotations && allData.quotations.length > 0) {
            const excelData = allData.quotations.map((row, index) => ({
              'S.No': index + 1,
              'Quotation No': row.quotation_no || '',
              'Company Name': row.company_name || '',
              'Contact Person': row.contact_person || 'N/A',
              'Quotation Value (₹)': formatCurrencyForExcel(row.grand_total),
              'Sale Orders': row.total_sale_orders || 0,
              'Proforma Invoices': row.total_proforma_invoices || 0,
              'Total SO Value (₹)': formatCurrencyForExcel(row.total_so_value),
              'Invoiced Value (₹)': formatCurrencyForExcel(row.total_pi_value),
              'Outstanding (₹)': formatCurrencyForExcel(row.total_outstanding)
            }));
            worksheet = XLSX.utils.json_to_sheet(excelData);
          }
          break;

        case 'accounts_receivable':
          reportName = 'Accounts Receivable Summary Report';
          // Create multiple sheets for accounts receivable
          if (allData.invoices && allData.invoices.length > 0) {
            const invoiceData = allData.invoices.map((invoice, index) => ({
              'S.No': index + 1,
              'Customer Name': invoice.customer_name || '',
              'Sales Order No': invoice.sales_order_no || '',
              'Proforma Invoice No': invoice.proforma_invoice_no || '',
              'Invoice Date': invoice.invoice_date || '',
              'Total Amount (₹)': formatCurrencyForExcel(invoice.total_amount),
              'Outstanding (₹)': formatCurrencyForExcel(invoice.outstanding)
            }));
            const invoiceSheet = XLSX.utils.json_to_sheet(invoiceData);
            XLSX.utils.book_append_sheet(workbook, invoiceSheet, 'Invoice Details');

            // Summary by Sales Order sheet
            if (allData.summary_by_so && allData.summary_by_so.length > 0) {
              const summaryData = allData.summary_by_so.map((row, index) => ({
                'S.No': index + 1,
                'Sales Order No': row.sales_order_no || '',
                'Customer': row.customer || '',
                'Total Invoice Value (₹)': formatCurrencyForExcel(row.total_invoice_value),
                'Total Received (₹)': formatCurrencyForExcel(row.total_received),
                'Outstanding (₹)': formatCurrencyForExcel(row.outstanding),
                '% Collected': row.collection_percentage || 0,
                'Last Payment Date': row.last_payment_date || 'N/A'
              }));
              const summarySheet = XLSX.utils.json_to_sheet(summaryData);
              XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary by SO');
            }

            // Summary totals sheet
            if (allData.summary) {
              const totalsData = [
                { 'Metric': 'Total Amount (₹)', 'Value': formatCurrencyForExcel(allData.summary.total_amount) },
                { 'Metric': 'Total Outstanding (₹)', 'Value': formatCurrencyForExcel(allData.summary.total_outstanding) },
                { 'Metric': 'Total Collected (₹)', 'Value': formatCurrencyForExcel(allData.summary.total_collected) },
                { 'Metric': 'Collection %', 'Value': `${allData.summary.collection_percentage || 0}%` }
              ];
              const totalsSheet = XLSX.utils.json_to_sheet(totalsData);
              XLSX.utils.book_append_sheet(workbook, totalsSheet, 'Summary');
            }
          } else {
            toast.error('No data available to export');
            return;
          }
          break;

        default:
          toast.error('Unknown report type');
          return;
      }

      // If worksheet was created (single sheet reports), add it to workbook
      if (worksheet && reportType !== 'accounts_receivable') {
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Report Data');
      }

      // Check if workbook has any sheets
      if (workbook.SheetNames.length === 0) {
        toast.error('No data available to export');
        return;
      }

      // Generate filename with date and report type
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `${reportName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

      // Write and download
      XLSX.writeFile(workbook, filename);
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export to Excel');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Fully Paid':
        return <span style={{ color: '#10b981' }}>✔</span>;
      case 'Partially Paid':
        return <span style={{ color: '#3b82f6' }}>▲</span>;
      case 'Missing PI':
        return <span style={{ color: '#f59e0b' }}>●</span>;
      case 'Not Paid':
        return <span style={{ color: '#ef4444' }}>X</span>;
      case 'Fully Billed':
        return <span style={{ color: '#6b7280' }}>✔</span>;
      case 'Partially Billed':
        return <span style={{ color: '#6b7280' }}>▲</span>;
      case 'Over Billed':
        return <span style={{ color: '#6b7280' }}>X</span>;
      case 'Over Paid':
        return <span style={{ color: '#6b7280' }}>!</span>;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Fully Paid':
        return '#10b981'; // Green
      case 'Partially Paid':
        return '#3b82f6'; // Blue
      case 'Missing PI':
        return '#f59e0b'; // Orange
      case 'Not Paid':
        return '#ef4444'; // Red
      case 'Fully Billed':
      case 'Partially Billed':
      case 'Over Billed':
      case 'Over Paid':
      default:
        return '#6b7280'; // Gray for other statuses
    }
  };

  const renderSaleOrderWiseReport = () => {
    if (!reportData?.sale_orders) return null;

    return (
      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1rem' 
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', margin: 0 }}>
            Sale Order Wise Report
          </h3>
          <button
            onClick={exportToExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
          >
            <Download size={18} />
            Export to Excel
          </button>
        </div>
        <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151', width: '60px' }}>S.No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>SO Number</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Customer</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>SO Value</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Invoiced Value</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Diff</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}># of PIs</th>
              </tr>
            </thead>
            <tbody>
              {reportData.sale_orders.map((row, index) => {
                const serialNo = (currentPage - 1) * itemsPerPage + index + 1;
                return (
                <tr key={index} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>{serialNo}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{row.so_number}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{row.customer}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.so_value)}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.total_pi_value)}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: row.diff >= 0 ? '#111827' : '#ef4444', textAlign: 'right', fontWeight: row.diff !== 0 ? '500' : 'normal' }}>
                    {formatCurrency(row.diff)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      fontSize: '0.875rem',
                      color: getStatusColor(row.status),
                      fontWeight: '500'
                    }}>
                      {getStatusIcon(row.status)}
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', color: '#111827' }}>{row.pi_count || 0}</td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCompanyWiseReport = () => {
    if (!reportData?.companies) return null;

    return (
      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1rem' 
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', margin: 0 }}>
            Company Wise Report
          </h3>
          <button
            onClick={exportToExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
          >
            <Download size={18} />
            Export to Excel
          </button>
        </div>
        <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>S.No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Company Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Total Sale Orders</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Total Quotations</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Total SO Value (₹)</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Invoiced Value (₹)</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Outstanding (₹)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.companies.map((row, index) => {
                const serialNo = (currentPage - 1) * itemsPerPage + index + 1;
                return (
                <tr key={index} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>{serialNo}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', fontWeight: '500' }}>{row.company_name}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'center' }}>{row.total_sale_orders || 0}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'center' }}>{row.total_quotations || 0}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.total_so_value)}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.total_pi_value)}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: row.total_outstanding > 0 ? '#ef4444' : '#10b981', textAlign: 'right', fontWeight: row.total_outstanding > 0 ? '500' : 'normal' }}>
                    {formatCurrency(row.total_outstanding)}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCompanyContactWiseReport = () => {
    if (!reportData?.company_contacts) return null;

    return (
      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1rem' 
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', margin: 0 }}>
            Company + Contact Person Wise Report
          </h3>
          <button
            onClick={exportToExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
          >
            <Download size={18} />
            Export to Excel
          </button>
        </div>
        <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151', width: '60px' }}>S.No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Company Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Contact Person</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Total Sale Orders</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Total Quotations</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Total SO Value (₹)</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Invoiced Value (₹)</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Outstanding (₹)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.company_contacts.map((row, index) => {
                const serialNo = (currentPage - 1) * itemsPerPage + index + 1;
                return (
                <tr key={index} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>{serialNo}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', fontWeight: '500' }}>{row.company_name}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{row.contact_person || 'N/A'}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'center' }}>{row.total_sale_orders || 0}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'center' }}>{row.total_quotations || 0}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.total_so_value)}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.total_pi_value)}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: row.total_outstanding > 0 ? '#ef4444' : '#10b981', textAlign: 'right', fontWeight: row.total_outstanding > 0 ? '500' : 'normal' }}>
                    {formatCurrency(row.total_outstanding)}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderQuotationWiseReport = () => {
    if (!reportData?.quotations) return null;

    return (
      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1rem' 
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', margin: 0 }}>
            Quotation Wise Report
          </h3>
          <button
            onClick={exportToExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
          >
            <Download size={18} />
            Export to Excel
          </button>
        </div>
        <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151', width: '60px' }}>S.No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Quotation No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Company Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Contact Person</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Quotation Value (₹)</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Sale Orders</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Proforma Invoices</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Total SO Value (₹)</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Invoiced Value (₹)</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Outstanding (₹)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.quotations.map((row, index) => {
                const serialNo = (currentPage - 1) * itemsPerPage + index + 1;
                return (
                <tr key={index} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>{serialNo}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', fontWeight: '500' }}>{row.quotation_no}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{row.company_name}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{row.contact_person || 'N/A'}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.grand_total)}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'center' }}>{row.total_sale_orders || 0}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'center' }}>{row.total_proforma_invoices || 0}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.total_so_value)}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.total_pi_value)}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: row.total_outstanding > 0 ? '#ef4444' : '#10b981', textAlign: 'right', fontWeight: row.total_outstanding > 0 ? '500' : 'normal' }}>
                    {formatCurrency(row.total_outstanding)}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAccountsReceivableReport = () => {
    if (!reportData?.invoices) return null;

    return (
      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1rem' 
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', margin: 0 }}>
            Accounts Receivable Summary Report
          </h3>
          <button
            onClick={exportToExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
          >
            <Download size={18} />
            Export to Excel
          </button>
        </div>
        
        {/* Invoice Details Table */}
        <div style={{ marginBottom: '2rem', overflowX: 'auto', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151', width: '60px' }}>S.No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Customer Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Sales Order No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Proforma Invoice No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Invoice Date</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Total Amount (₹)</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Outstanding (₹)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.invoices.map((invoice, index) => {
                const serialNo = (currentPage - 1) * itemsPerPage + index + 1;
                return (
                <tr key={index} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>{serialNo}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{invoice.customer_name}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{invoice.sales_order_no}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{invoice.proforma_invoice_no}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{invoice.invoice_date}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(invoice.total_amount)}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: invoice.outstanding > 0 ? '#ef4444' : '#10b981', textAlign: 'right', fontWeight: invoice.outstanding > 0 ? '500' : 'normal' }}>
                    {formatCurrency(invoice.outstanding)}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary by Sales Order */}
        {reportData.summary_by_so && reportData.summary_by_so.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>
              Summary by Sales Order
            </h4>
            <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151', width: '60px' }}>S.No</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Sales Order No</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Customer</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Total Invoice Value (₹)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Total Received (₹)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Outstanding (₹)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>% Collected</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Last Payment Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.summary_by_so.map((row, index) => {
                    const serialNo = index + 1;
                    return (
                    <tr key={index} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>{serialNo}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{row.sales_order_no}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{row.customer}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.total_invoice_value)}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.total_received)}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(row.outstanding)}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827', textAlign: 'center' }}>{row.collection_percentage}%</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{row.last_payment_date || 'N/A'}</td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {reportData.summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Total Amount</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>{formatCurrency(reportData.summary.total_amount)}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Total Outstanding</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>{formatCurrency(reportData.summary.total_outstanding)}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Total Collected</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>{formatCurrency(reportData.summary.total_collected)}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Collection %</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>{reportData.summary.collection_percentage}%</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="main-container" style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc'
    }}>
      <Sidebar />
      
      <div className="main-content" style={{ 
        flex: 1, 
        padding: '1.5rem'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#1f2937',
              marginBottom: '0.5rem'
            }}>
              Reports
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Generate and view various business reports
            </p>
          </div>
          <UserDropdown />
        </div>

        {/* Filters */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1.5rem', 
          borderRadius: '0.5rem', 
          border: '1px solid #e5e7eb',
          marginBottom: '1.5rem'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: showFilters ? '1rem' : '0',
            cursor: 'pointer'
          }} onClick={() => setShowFilters(!showFilters)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={18} />
              <span style={{ fontWeight: '600', color: '#374151' }}>Filters</span>
            </div>
            {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>

          {showFilters && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem' 
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  Report Type *
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="sale_order_wise">Sale Order Wise</option>
                  <option value="company_wise">Company Wise</option>
                  <option value="company_contact_wise">Company + Contact Person Wise</option>
                  <option value="quotation_wise">Quotation Wise</option>
                  <option value="accounts_receivable">Accounts Receivable Summary</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  Company
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => {
                    setSelectedCompany(e.target.value);
                    setSelectedContactPerson('');
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">All Companies</option>
                  {companies.map(company => (
                    <option key={company.value} value={company.value}>{company.label}</option>
                  ))}
                </select>
              </div>

              {(reportType === 'company_contact_wise') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Contact Person
                  </label>
                  <select
                    value={selectedContactPerson}
                    onChange={(e) => setSelectedContactPerson(e.target.value)}
                    disabled={!selectedCompany}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      backgroundColor: !selectedCompany ? '#f3f4f6' : 'white'
                    }}
                  >
                    <option value="">All Contact Persons</option>
                    {contactPersons.map(cp => (
                      <option key={cp.value} value={cp.value}>{cp.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  Financial Year
                </label>
                <select
                  value={selectedFinancialYear}
                  onChange={(e) => setSelectedFinancialYear(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">All Years</option>
                  {financialYears.map(year => (
                    <option key={year.value} value={year.value}>{year.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>


        {/* Report Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}></div>
            Loading report...
          </div>
        ) : reportData ? (
          <div>
            {reportType === 'sale_order_wise' && renderSaleOrderWiseReport()}
            {reportType === 'company_wise' && renderCompanyWiseReport()}
            {reportType === 'company_contact_wise' && renderCompanyContactWiseReport()}
            {reportType === 'quotation_wise' && renderQuotationWiseReport()}
            {reportType === 'accounts_receivable' && renderAccountsReceivableReport()}
            {!reportData.sale_orders && !reportData.invoices && !reportData.companies && !reportData.company_contacts && !reportData.quotations && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                No data available for the selected filters
              </div>
            )}

            {/* Pagination */}
            {(totalItems > 0) && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '2rem',
                padding: '1rem',
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Items per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
                      color: currentPage === 1 ? '#9ca3af' : '#374151',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Previous
                  </button>

                  {/* Page numbers */}
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
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
                          onClick={() => setCurrentPage(pageNum)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            backgroundColor: currentPage === pageNum ? '#3b82f6' : 'white',
                            color: currentPage === pageNum ? 'white' : '#374151',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            minWidth: '2.5rem'
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
                      color: currentPage === totalPages ? '#9ca3af' : '#374151',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            Select filters and generate a report
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Reports;

