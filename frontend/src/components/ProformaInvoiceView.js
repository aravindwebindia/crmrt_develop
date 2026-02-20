import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/axiosConfig';
import { X, Download, Printer } from 'lucide-react';

const ProformaInvoiceView = ({ proformaInvoiceId, onClose }) => {
  const [proformaInvoice, setProformaInvoice] = useState(null);
  const [proformaInvoiceDetails, setProformaInvoiceDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProformaInvoiceDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/proforma-invoice-details.php?id=${proformaInvoiceId}`);
      
      if (response.data.success) {
        setProformaInvoice(response.data.data.proforma_invoice);
        setProformaInvoiceDetails(response.data.data.proforma_invoice_details);
      } else {
        toast.error('Failed to fetch proforma invoice details');
      }
    } catch (error) {
      toast.error('Failed to fetch proforma invoice details');
    } finally {
      setLoading(false);
    }
  }, [proformaInvoiceId]);

  useEffect(() => {
    if (proformaInvoiceId) {
      fetchProformaInvoiceDetails();
    }
  }, [proformaInvoiceId, fetchProformaInvoiceDetails]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN');
  };

  const getBillCycleText = (cycleName, cycleTerms, billFollowup, duration) => {
    if (!cycleName || !cycleTerms) return '';
    
    const cycle = cycleName.toLowerCase();
    const followup = parseInt(billFollowup) || 1; // Default to 1 if not provided
    
    // Get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
    const getOrdinalSuffix = (num) => {
      const j = num % 10;
      const k = num % 100;
      if (j === 1 && k !== 11) return num + "st";
      if (j === 2 && k !== 12) return num + "nd";
      if (j === 3 && k !== 13) return num + "rd";
      return num + "th";
    };
    
    // Check for more specific cases first
    if (cycle.includes('half') && cycle.includes('yearly')) {
      return `${getOrdinalSuffix(followup)} Half yearly payment`;
    } else if (cycle.includes('quarterly')) {
      return `${getOrdinalSuffix(followup)} Quarterly payment`;
    } else if (cycle.includes('monthly')) {
      return `${getOrdinalSuffix(followup)} Monthly payment`;
    } else if (cycle.includes('yearly') || cycle.includes('annual')) {
      // For yearly cycles, check duration
      if (duration && duration >= 2 && duration <= 10) {
        return `${duration} Years payment`;
      }
      return 'Yearly payment';
    } else {
      return `${cycleName} payment`;
    }
  };

  const formatItemDescription = (item) => {
    const serviceName = item.service_name || '';
    const qty = parseFloat(item.qty || 0);
    const rate = parseFloat(item.inv_rate || 0);
    const amount = parseFloat(item.inv_amount || 0);
    const billCycle = getBillCycleText(item.cycle_name, item.cycle_terms, item.bill_followup, item.duration);
    const fromDate = formatDate(item.bill_from_date);
    const toDate = formatDate(item.bill_to_date);
    const quotationServiceDescription = item.quotation_service_description || '';
    
    return (
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{serviceName}</div>
        <div style={{ fontSize: '12px', lineHeight: '1.3' }}>
          Qty: {qty.toFixed(2)} Rate per qty: {formatCurrency(rate)}<br />
          Total Amt: {formatCurrency(amount)}<br />
          {billCycle && <span>Bill cycle: {billCycle}<br /></span>}
          {fromDate && toDate && (
            <span>From: {fromDate} To: {toDate}<br /></span>
          )}
          {quotationServiceDescription && (
            <span>{quotationServiceDescription}</span>
          )}
        </div>
      </div>
    );
  };


  const numberToWords = (num) => {
    // Simple number to words conversion for Indian currency
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    if (num === 0) return 'Zero';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
    if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
    if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
    return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
  };

  // Helper function to convert amount to words with paisa support
  const convertAmountToWords = (amount) => {
    const rupees = Math.floor(amount);
    const paisa = Math.round((amount - rupees) * 100);
    
    let result = `Indian Rupee ${numberToWords(rupees)}`;
    
    if (paisa > 0) {
      result += ` and ${numberToWords(paisa)} Paisa`;
    }
    
    result += ' Only';
    return result;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get(`/generate-proforma-invoice-pdf.php?id=${proformaInvoiceId}`, {
        responseType: 'blob' // Important for PDF download
      });
      
      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `proforma-invoice-${proformaInvoice?.invoice_no || 'unknown'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Proforma invoice PDF downloaded successfully!');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const handleDownload = () => {
    const element = document.getElementById('proforma-invoice-content');
    const html = element.innerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proforma-invoice-${proformaInvoice?.invoice_no || 'unknown'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Invoice downloaded successfully!');
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '0.5rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          Loading proforma invoice...
        </div>
      </div>
    );
  }

  if (!proformaInvoice) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '0.5rem',
          textAlign: 'center'
        }}>
          <p>Proforma invoice not found</p>
          <button onClick={onClose} style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer'
          }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const subTotal = parseFloat(proformaInvoice.inv_sub_total || 0);
  const grandTotal = parseFloat(proformaInvoice.inv_grand_total || 0);
  const taxAmount = grandTotal - subTotal;

  // Debug logging
  // Check if place of supply is Tamil Nadu (state ID 35 or state name contains Tamil Nadu)
  const isTamilNadu = proformaInvoice.place_of_supply?.toLowerCase().includes('tamil') || 
                      proformaInvoice.company_state === '35' || 
                      proformaInvoice.place_of_supply?.toLowerCase().includes('tamil nadu');
  
  // Calculate tax amounts based on state
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  
  if (isTamilNadu) {
    // For Tamil Nadu, use CGST and SGST
    cgstAmount = taxAmount / 2;
    sgstAmount = taxAmount / 2;
  } else {
    // For other states, use IGST
    igstAmount = taxAmount;
  }

  return (
    <>
      {/* Print Styles */}
      <style>
        {`
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body * {
              visibility: hidden;
            }
            #proforma-invoice-content, #proforma-invoice-content * {
              visibility: visible;
            }
            #proforma-invoice-content {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              overflow: visible !important;
            }
            .print-hide {
              display: none !important;
            }
            .page-break {
              page-break-before: always;
            }
            .no-break {
              page-break-inside: avoid;
            }
            table {
              page-break-inside: avoid;
            }
            tr {
              page-break-inside: avoid;
            }
          }
        `}
      </style>
      
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: 0
      }}>
      <div style={{
        backgroundColor: 'white',
        width: '100%',
        height: '100vh',
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* Close and Download buttons */}
        <div className="print-hide" style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          zIndex: 10,
          display: 'flex',
          gap: '0.5rem'
        }}>
          <button
            onClick={handleDownloadPDF}
            style={{
              padding: '0.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            title="Download PDF"
          >
            <Download size={16} />
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Invoice Content */}
        <div id="proforma-invoice-content" className="no-break" style={{ padding: '1rem' }}>
          <div style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            margin: '20px',
            border: '1px solid #000',
            padding: '10px'
          }}>
            {/* Header */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tr>
                {/* Logo */}
                <td style={{ width: '35%', verticalAlign: 'top' }}>
                  {proformaInvoice.bc_logo ? (
                    <img 
                      src={proformaInvoice.bc_logo} 
                      alt="Company Logo" 
                      style={{ maxWidth: '180px', height: 'auto' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        // Show fallback text
                        const fallback = e.target.nextSibling;
                        if (fallback) fallback.style.display = 'block';
                      }}
                      onLoad={() => {
                        }}
                    />
                  ) : null}
                  <div style={{
                    width: '180px',
                    height: '80px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    display: proformaInvoice.bc_logo ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f9fafb',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#374151',
                    textAlign: 'center'
                  }}>
                    {proformaInvoice.billing_company || 'Company Logo'}
                  </div>
                </td>
                {/* Company Info */}
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  <h2 style={{ margin: 0, fontWeight: 'bold' }}>
                    {proformaInvoice.billing_company || 'Company Name'}
                  </h2>
                  <p style={{ margin: '5px 0' }}>
                    {proformaInvoice.billing_address || 'Company Address'}<br />
                    {proformaInvoice.billing_gst && `GST no: ${proformaInvoice.billing_gst}`}
                  </p>
                </td>
                {/* Proforma Invoice Label */}
                <td style={{ width: '25%', textAlign: 'right', verticalAlign: 'bottom' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold' }}>Proforma Invoice</div>
                </td>
              </tr>
            </table>

            {/* Invoice details */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', border: '1px solid #000' }}>
              <tr>
                <td style={{ border: '1px solid #000', padding: '6px', width: '33%' }}>
                  #: <b>{proformaInvoice.invoice_no}</b><br /><br />
                  Invoice Date: <b>{formatDate(proformaInvoice.inv_date)}</b>
                </td>
                <td style={{ border: '1px solid #000', padding: '6px', width: '34%' }}>
                  Place Of Supply: <b>{proformaInvoice.place_of_supply || 'Tamil Nadu'}</b>
                </td>
              </tr>
            </table>

            {/* Bill To */}
            <table style={{ width: '100%', border: '1px solid #000', borderCollapse: 'collapse', marginTop: '10px' }}>
              <tr>
                <td style={{ padding: '6px', backgroundColor: '#f2f2f2' }}>
                  <b>Bill To</b><br />
                </td>
              </tr>
              <tr>
                <td style={{ padding: '6px' }}>
                  <strong>{proformaInvoice.company_name || 'Company Name'}</strong><br />
                  {proformaInvoice.first_name && proformaInvoice.last_name && (
                    <span>{proformaInvoice.first_name} {proformaInvoice.last_name}<br /></span>
                  )}
                  {proformaInvoice.company_address && (
                    <span>{proformaInvoice.company_address}<br /></span>
                  )}
                  {proformaInvoice.company_city && (
                    <span>{proformaInvoice.company_city}<br /></span>
                  )}
                  {proformaInvoice.place_of_supply && (
                    <span>{proformaInvoice.place_of_supply}<br /></span>
                  )}
                  {proformaInvoice.company_pincode && (
                    <span>{proformaInvoice.company_pincode}<br /></span>
                  )}
                  India<br />
                  {proformaInvoice.company_gst && `GST no: ${proformaInvoice.company_gst}`}
                </td>
              </tr>
            </table>

            {/* Items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', textAlign: 'center' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', borderBottom: 'none', padding: '6px', background: '#f2f2f2' }}>#</th>
                  <th style={{ border: '1px solid #000', borderBottom: 'none', padding: '6px', background: '#f2f2f2' }}>Item & Description</th>
                  <th style={{ border: '1px solid #000', borderBottom: 'none', padding: '6px', background: '#f2f2f2' }}>HSN / SAC</th>
                  {isTamilNadu ? (
                    <>
                      <th style={{ border: '1px solid #000', padding: '6px', background: '#f2f2f2' }} colSpan="2">CGST</th>
                      <th style={{ border: '1px solid #000', padding: '6px', background: '#f2f2f2' }} colSpan="2">SGST</th>
                    </>
                  ) : (
                    <th style={{ border: '1px solid #000', padding: '6px', background: '#f2f2f2' }} colSpan="2">IGST</th>
                  )}
                  <th style={{ border: '1px solid #000', borderBottom: 'none', padding: '6px', background: '#f2f2f2' }}>Amount</th>
                </tr>
                <tr>
                  <th style={{ borderLeft: '1px solid #000', padding: '6px', background: '#f2f2f2' }}></th>
                  <th style={{ padding: '6px', borderLeft: '1px solid #000', backgroundColor: '#f2f2f2' }}></th>
                  <th style={{ padding: '6px', borderLeft: '1px solid #000', backgroundColor: '#f2f2f2' }}></th>
                  {isTamilNadu ? (
                    <>
                      <th style={{ border: '1px solid #000', padding: '6px' }}>%</th>
                      <th style={{ border: '1px solid #000', padding: '6px' }}>Amt</th>
                      <th style={{ border: '1px solid #000', padding: '6px' }}>%</th>
                      <th style={{ border: '1px solid #000', padding: '6px' }}>Amt</th>
                    </>
                  ) : (
                    <>
                      <th style={{ border: '1px solid #000', padding: '6px' }}>%</th>
                      <th style={{ border: '1px solid #000', padding: '6px' }}>Amt</th>
                    </>
                  )}
                  <th style={{ border: '1px solid #000', borderTop: 'none', backgroundColor: '#f2f2f2', padding: '6px' }}></th>
                </tr>
              </thead>
              <tbody>
                {proformaInvoiceDetails.map((item, index) => (
                  <tr key={item.id}>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{index + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>
                      {formatItemDescription(item)}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{item.hsn_sac || '998315'}</td>
                    {isTamilNadu ? (
                      <>
                        <td style={{ border: '1px solid #000', padding: '6px' }}>{parseFloat(item.cgst || 0).toFixed(1)}%</td>
                        <td style={{ border: '1px solid #000', padding: '6px' }}>{formatCurrency(parseFloat(item.cgst_amount || 0))}</td>
                        <td style={{ border: '1px solid #000', padding: '6px' }}>{parseFloat(item.sgst || 0).toFixed(1)}%</td>
                        <td style={{ border: '1px solid #000', padding: '6px' }}>{formatCurrency(parseFloat(item.sgst_amount || 0))}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ border: '1px solid #000', padding: '6px' }}>{parseFloat(item.igst || 0).toFixed(1)}%</td>
                        <td style={{ border: '1px solid #000', padding: '6px' }}>{formatCurrency(parseFloat(item.igst_amount || 0))}</td>
                      </>
                    )}
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{formatCurrency(parseFloat(item.inv_bill_amount || item.inv_amount || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <tr>
                <td style={{ border: '1px solid #000', padding: '6px', width: '70%', verticalAlign: 'top' }} rowSpan={isTamilNadu ? "4" : "3"}>
                  <b>Total In Words</b><br />
                  {convertAmountToWords(grandTotal)}
                </td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}><b>Sub Total</b></td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{formatCurrency(subTotal)}</td>
              </tr>
              {isTamilNadu ? (
                <>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}><b>CGST (9%)</b></td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{formatCurrency(cgstAmount)}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}><b>SGST (9%)</b></td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{formatCurrency(sgstAmount)}</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}><b>IGST (18%)</b></td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{formatCurrency(igstAmount)}</td>
                </tr>
              )}
              <tr>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}><b>Total</b></td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}><b>{formatCurrency(grandTotal)}</b></td>
              </tr>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {/* Notes & Bank Details */}
              <div style={{ marginTop: '15px', fontSize: '13px' }}>
               
                <p style={{ margin: '5px 0' }}>
                  <b>Bank Details</b><br />    </p>
                <p style={{ margin: '5px 0' }}>
                  {proformaInvoice.billing_company && `Account Name: ${proformaInvoice.billing_company}`}
                  {proformaInvoice.billing_company && proformaInvoice.bc_bank_acc_no && <br />}
                  {proformaInvoice.bc_bank_acc_no && `Account Number: ${proformaInvoice.bc_bank_acc_no}`}
                  {(proformaInvoice.billing_company || proformaInvoice.bc_bank_acc_no) && proformaInvoice.bc_bank_ifsc && <br />}
                  {proformaInvoice.bc_bank_ifsc && `IFSC Code: ${proformaInvoice.bc_bank_ifsc}`}
                  {(proformaInvoice.billing_company || proformaInvoice.bc_bank_acc_no || proformaInvoice.bc_bank_ifsc) && proformaInvoice.bc_bank_address && <br />}
                  {proformaInvoice.bc_bank_address && proformaInvoice.bc_bank_address.replace(/<br\s*\/?>/gi, '')}
                  {(proformaInvoice.billing_company || proformaInvoice.bc_bank_acc_no || proformaInvoice.bc_bank_ifsc || proformaInvoice.bc_bank_address) && proformaInvoice.bc_bank_name && <br />}
                  {proformaInvoice.bc_bank_name && `Bank Name: ${proformaInvoice.bc_bank_name}`}
                  {(proformaInvoice.billing_company || proformaInvoice.bc_bank_acc_no || proformaInvoice.bc_bank_ifsc || proformaInvoice.bc_bank_address) && proformaInvoice.bc_bank_branch && <br />}
                  {proformaInvoice.bc_bank_branch && `Branch: ${proformaInvoice.bc_bank_branch}`}
                </p>
                
              </div>

              {/* Signature */}
              <table style={{ width: '30%', border: '1px solid', marginTop: '-1px', textAlign: 'center' }}>
                <tr>
                  <td style={{ textAlign: 'center', padding: '20px' }}>
                    {proformaInvoice.bc_seal ? (
                      <img 
                        src={proformaInvoice.bc_seal} 
                        alt="Company Seal" 
                        style={{ width: '88%', height: 'auto' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                        onLoad={() => {
                          }}
                      />
                    ) : (
                      <div style={{
                        width: '88%',
                        height: '60px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f9fafb',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#374151',
                        margin: '0 auto'
                      }}>
                        Company Seal
                      </div>
                    )}
                    <b>Authorized Signature</b>
                  </td>
                </tr>
              </table>
            </div>
            <div style={{ marginTop: '15px', fontSize: '15px' }}>
                                
                      <p style={{ margin: '5px 0' }}><b>Terms & Conditions</b></p>
                      <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6', color: '#374151', fontSize: '0.9rem' }}>
                        <li>This proforma invoice is issued for reference and payment processing only.</li>
                        <li>Payments must be made to the bank account mentioned in this invoice.</li>
                        <li>Services, licenses, or subscriptions will commence only after payment confirmation.</li>
                        <li>Payment should be released within 15 days; delays may affect service delivery.</li>
                        <li>Taxes and duties, if applicable, will be charged as per prevailing laws.</li>
                        <li>No refund or adjustment will be made once the service or license period has started.</li>
                        <li>Any disputes are subject to the jurisdiction of Chennai, India.</li>
                        <li>Verify all details before payment; report discrepancies immediately.</li>
                      </ul>


              </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default ProformaInvoiceView;
