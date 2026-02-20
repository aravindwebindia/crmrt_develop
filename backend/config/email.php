<?php
class EmailConfig {
    private static $config = null;
    
    private static function getConfig() {
        if (self::$config === null) {
            require_once __DIR__ . '/common.php';
            self::$config = CommonConfig::getSmtpConfig();
        }
        return self::$config;
    }
    
    // SMTP Configuration
    public static $smtp_host = null;
    public static $smtp_port = null;
    public static $smtp_username = null;
    public static $smtp_password = null;
    public static $smtp_encryption = null;
    
    // Email settings
    public static $from_email = null;
    public static $from_name = null;
    
    public static function init() {
        $config = self::getConfig();
        self::$smtp_host = $config['smtp_host'];
        self::$smtp_port = $config['smtp_port'];
        self::$smtp_username = $config['smtp_username'];
        self::$smtp_password = $config['smtp_password'];
        self::$smtp_encryption = $config['smtp_encryption'];
        self::$from_email = $config['from_email'];
        self::$from_name = $config['from_name'];
    }
    
    /**
     * Get backend URL for assets
     */
    public static function getBackendUrl() {
        require_once __DIR__ . '/common.php';
        return CommonConfig::getBackendUrl();
    }
    
    // Email templates
    public static function getQuotationEmailTemplateWithBillCompany($quotation, $contactPerson, $company, $billCompany) {
   
        $quotationNo = $quotation['quotation_no'];
        $companyName = $company['company_name'];
        $contract_name=$quotation['contract_name'];
        $contactPersonName = $contactPerson['contact_person'];
        $grandTotal = number_format($quotation['grand_total'] ?? 0, 2);
        $fromDate = date('d-m-Y', strtotime($quotation['contract_from_date'] ));
        $toDate = date('d-m-Y', strtotime($quotation['contract_to_date']));
        
        // Billing company details
        $billCompanyName = (is_array($billCompany) && isset($billCompany['bc_name'])) ? $billCompany['bc_name'] : 'N/A';
        $billCompanyAddress = (is_array($billCompany) && isset($billCompany['bc_address'])) ? $billCompany['bc_address'] : '';
        $billCompanyGST = (is_array($billCompany) && isset($billCompany['bc_gst'])) ? $billCompany['bc_gst'] : '';
        $billCompanyMSME = (is_array($billCompany) && isset($billCompany['bc_msme'])) ? $billCompany['bc_msme'] : '';
        $billCompanyStateId = (is_array($billCompany) && isset($billCompany['bc_state_id'])) ? $billCompany['bc_state_id'] : null;
        $billCompanyCountryId = (is_array($billCompany) && isset($billCompany['bc_country_id'])) ? $billCompany['bc_country_id'] : null;
        $billCompanyBankName = (is_array($billCompany) && isset($billCompany['bc_bank_name'])) ? $billCompany['bc_bank_name'] : null;
        $billCompanyBankAcc = (is_array($billCompany) && isset($billCompany['bc_bank_acc_no'])) ? $billCompany['bc_bank_acc_no'] : null;
        $billCompanyIfsc = (is_array($billCompany) && isset($billCompany['bc_bank_ifsc'])) ? $billCompany['bc_bank_ifsc'] : null;
        $billCompanyBranch = (is_array($billCompany) && isset($billCompany['bc_bank_branch'])) ? $billCompany['bc_bank_branch'] : null;
        $billCompanyBankAddress = (is_array($billCompany) && isset($billCompany['bc_bank_address'])) ? $billCompany['bc_bank_address'] : null;
        
        // To company details
        $toCompanyAddress = $company['company_address'] ?? '';
        $toCompanyState = $company['state'] ?? '';
        $toCompanyCountry = $company['country'] ?? '';
        $quotationStateId = $quotation['state_id'] ?? null;
        $quotationCountryId = $quotation['country_id'] ?? null;
        
        // Determine GST calculation logic
        $gstLogic = '';
        if ($billCompanyCountryId && $quotationCountryId) {
            if ($billCompanyCountryId != $quotationCountryId) {
                $gstLogic = 'no_gst'; // Different countries - no GST
            } elseif ($billCompanyStateId && $quotationStateId && $billCompanyStateId == $quotationStateId) {
                $gstLogic = 'cgst_sgst'; // Same country, same state - CGST + SGST
            } else {
                $gstLogic = 'igst'; // Same country, different state - IGST
            }
        } else {
            $gstLogic = 'no_gst'; // Default to no GST if data missing
        }
        
        // Calculate totals
        $subTotal = 0;
        $totalCGST = 0;
        $totalSGST = 0;
        $totalIGST = 0;
        $grandTotalAmount = 0;
        
        // Process services for calculations
        if (isset($quotation['services']) && is_array($quotation['services'])) {
            foreach ($quotation['services'] as $service) {
                $amount = $service['amount'] ?? 0;
                $subTotal += $amount;
                
                if ($gstLogic === 'cgst_sgst') {
                    $totalCGST += $service['cgst_amount'];
                    $totalSGST += $service['sgst_amount'];
                } elseif ($gstLogic === 'igst') {
                    $totalIGST += $service['igst_amount'];
                }
            }
        }
        
        $grandTotalAmount = $subTotal + $totalCGST + $totalSGST + $totalIGST;
        
        // Generate services table rows
        $servicesTableRows = '';
        if (isset($quotation['services']) && is_array($quotation['services'])) {
            $rowNumber = 1;
            foreach ($quotation['services'] as $service) {
                $amount = $service['amount'] ?? 0;
                $taxRate = $service['igst'] ?? 0;
                $taxCgst = $service['cgst'] ?? 0;
                $taxSgst = $service['sgst'] ?? 0;

                $serviceName = htmlspecialchars($service['service_name'] ?? '');
                $description = $service['description'] ?? '';
                // Ensure proper UTF-8 encoding for PDF rendering (preserve currency symbols)
                // Convert to UTF-8 if not already
                $description = mb_convert_encoding($description, 'UTF-8', mb_detect_encoding($description, 'UTF-8, ISO-8859-1, Windows-1252', true) ?: 'UTF-8');
                // Decode any HTML entities to get raw UTF-8 characters (especially currency symbols)
                $description = html_entity_decode($description, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                // Escape HTML special characters first (currency symbols pass through unchanged)
                $description = htmlspecialchars($description, ENT_QUOTES, 'UTF-8');
                // Wrap currency symbols (₹) with font-family span for PDF rendering (after escaping)
                $description = preg_replace('/(₹)/u', '<span style="font-family: DejaVu Sans, Arial, sans-serif;">$1</span>', $description);
                $quantity = $service['quantity'] ?? 1;
                $rate = $service['rate'] ?? 0;
                $hsnCode = $service['hsn_sac'] ?? '';
                
                
                if ($gstLogic === 'cgst_sgst') {
                    $cgstRate = $taxCgst;
                    $sgstRate = $taxSgst;
                    $cgstAmount = $service['cgst_amount'];
                    $sgstAmount = $service['sgst_amount'];
                } elseif ($gstLogic === 'igst') {
                    $igstAmount = $service['igst_amount'];
                }
                
                        $servicesTableRows .= "
                        <tr>
                            <td style='border:1px solid #000; padding:6px; text-align:center;'>$rowNumber</td>
                            <td style='border:1px solid #000; padding:6px; text-align:left;'>$serviceName<br>Qty:" . number_format($quantity, 2) . " <br>Rate per qty:" . number_format($rate, 2) . "<br>$description</td>
                            <td style='border:1px solid #000; padding:6px; text-align:center;'>$hsnCode</td>";
                            if ($gstLogic === 'cgst_sgst') {
        $servicesTableRows .= "<td style='border:1px solid #000; padding:6px; text-align:center;'>" . ( number_format($cgstRate, 1) . '%' ) . "</td>
                            <td style='border:1px solid #000; padding:6px; text-align:right;'>" . number_format($cgstAmount, 2) . "</td>
                            <td style='border:1px solid #000; padding:6px; text-align:center;'>" . (number_format($sgstRate, 1) . '%') . "</td>
                            <td style='border:1px solid #000; padding:6px; text-align:right;'>" . number_format($sgstAmount, 2) . "</td>";
                            
                        }elseif ($gstLogic === 'igst') {
        $servicesTableRows .= "<td style='border:1px solid #000; padding:6px; text-align:center;'>" . ( number_format($taxRate, 1) . '%' ) . "</td>
                            <td style='border:1px solid #000; padding:6px; text-align:right;'>" . number_format($igstAmount, 2) . "</td>";
                        }else{

                        }
           $servicesTableRows .= "<td style='border:1px solid #000; padding:6px; text-align:right;'>" . number_format($amount, 2) . "</td>                    
                        </tr>";
                $rowNumber++;
            }
        }
        
        // Convert number to words (simplified version)
        if (!function_exists('numberToWords')) {
        function numberToWords($number) {
            $ones = array('', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen');
            $tens = array('', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety');
            
            if ($number < 20) return $ones[$number];
            if ($number < 100) return $tens[floor($number/10)] . ($number%10 ? ' ' . $ones[$number%10] : '');
            if ($number < 1000) return $ones[floor($number/100)] . ' Hundred' . ($number%100 ? ' ' . numberToWords($number%100) : '');
            if ($number < 100000) return numberToWords(floor($number/1000)) . ' Thousand' . ($number%1000 ? ' ' . numberToWords($number%1000) : '');
            if ($number < 10000000) return numberToWords(floor($number/100000)) . ' Lakh' . ($number%100000 ? ' ' . numberToWords($number%100000) : '');
            return numberToWords(floor($number/10000000)) . ' Crore' . ($number%10000000 ? ' ' . numberToWords($number%10000000) : '');
            }
        
        function convertAmountToWords($amount) {
            // Split amount into rupees and paisa
            $rupees = floor($amount);
            $paisa = round(($amount - $rupees) * 100);
            
            // Convert rupees to words
            $rupeesWords = numberToWords($rupees) . ' Rupee' . ($rupees != 1 ? 's' : '');
            
            // Convert paisa to words if exists
            if ($paisa > 0) {
                $paisaWords = numberToWords($paisa) . ' Paisa' . ($paisa != 1 ? '' : '');
                return $rupeesWords . ' and ' . $paisaWords . ' Only';
            }
            
            return $rupeesWords . ' Only';
        }
        }
        
        $amountInWords = convertAmountToWords($grandTotalAmount);
        
        // Get backend URL for images
        $backendUrl = self::getBackendUrl();
        
        // For PDF generation, use base64 encoded images
        $isForPdf = isset($quotation['_for_pdf']) && $quotation['_for_pdf'] === true;
        if ($isForPdf) {
            $imageBaseUrl = '';
            // Pre-encode images for PDF
            $logoDataUri = '';
            $signatureDataUri = '';
            
            if (is_array($billCompany) && isset($billCompany['bc_logo']) && $billCompany['bc_logo']) {
                $logoPath = __DIR__ . '/../' . $billCompany['bc_logo'];
                if (file_exists($logoPath)) {
                    $logoData = file_get_contents($logoPath);
                    $logoMimeType = mime_content_type($logoPath);
                    $logoDataUri = 'data:' . $logoMimeType . ';base64,' . base64_encode($logoData);
                }
            }
            
            if (is_array($billCompany) && isset($billCompany['bc_seal']) && $billCompany['bc_seal']) {
                $signaturePath = __DIR__ . '/../' . $billCompany['bc_seal'];
                if (file_exists($signaturePath)) {
                    $signatureData = file_get_contents($signaturePath);
                    $signatureMimeType = mime_content_type($signaturePath);
                    $signatureDataUri = 'data:' . $signatureMimeType . ';base64,' . base64_encode($signatureData);
                }
            }
        } else {
            $imageBaseUrl = $backendUrl . '/';
            $logoDataUri = '';
            $signatureDataUri = '';
        }
        
        $html = "
        <!DOCTYPE html>
        <html lang='en'>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
          <style>
            @media only screen and (max-width: 600px) {
                .mobile-header { display: block !important; }
                .desktop-header { display: none !important; }
                .mobile-table { display: block !important; }
                .desktop-table { display: none !important; }
                .mobile-totals { display: block !important; }
                .desktop-totals { display: none !important; }
                .container { padding: 5px !important; margin: 5px !important; }
                .mobile-service-item { 
                    border: 1px solid #000 !important; 
                    margin-bottom: 10px !important; 
                    padding: 10px !important; 
                    background: #f9f9f9 !important;
                }
            }
            @media only screen and (min-width: 601px) {
                .mobile-header { display: none !important; }
                .desktop-header { display: block !important; }
                .mobile-table { display: none !important; }
                .desktop-table { display: block !important; }
                .mobile-totals { display: none !important; }
                .desktop-totals { display: block !important; }
            }
          </style>
        </head>
        <body style='font-family:Arial, sans-serif; font-size:14px; margin:0; padding:10px; background-color:#f5f5f5;'>

            <div style='border:1px solid #000; padding:15px; background-color:white; max-width:800px; margin:0 auto;'>

                <!-- Desktop Header -->
                <div class='desktop-header'>
                <table style='width:100%; border-collapse:collapse; margin-bottom:15px;'>
                    <tr>
                        <!-- Logo -->
                        <td style='width:35%; vertical-align:top; text-align:center;'>
                        " . (is_array($billCompany) && isset($billCompany['bc_logo']) && $billCompany['bc_logo'] ? "<img src='" . ($logoDataUri ?: $imageBaseUrl . $billCompany['bc_logo']) . "' alt='Company Logo' style='max-width:150px; height:auto; display:block; margin:0 auto;'>" : "") . "
                        </td>
                        <!-- Company Info -->
                        <td style='width:50%; vertical-align:top; padding-left:10px;'>
                        <b><h2 style='margin:0; font-size:16px; line-height:1.2;'>$billCompanyName</h2></b>
                        <p style='margin:5px 0; font-size:12px; line-height:1.3;'>
                            $billCompanyAddress<br>
                            " . ($billCompanyGST ? "GST no: $billCompanyGST" : "") . "
                        </p>
                        </td>
                        <!-- Quote Label -->
                        <td style='width:15%; text-align:center; vertical-align:middle;'>
                        <div style='font-size:20px; font-weight:bold; color:#333;'>Quotation</div>
                        </td>
                    </tr>
                </table>
                </div>

                <!-- Mobile Header -->
                <div class='mobile-header' style='text-align:center; margin-bottom:15px;'>
                    " . (is_array($billCompany) && isset($billCompany['bc_logo']) && $billCompany['bc_logo'] ? "<img src='" . ($logoDataUri ?: $imageBaseUrl . $billCompany['bc_logo']) . "' alt='Company Logo' style='max-width:120px; height:auto; margin-bottom:10px;'>" : "") . "
                    <h2 style='margin:5px 0; font-size:18px;'>$billCompanyName</h2>
                    <p style='margin:5px 0; font-size:12px; color:#666;'>
                        $billCompanyAddress<br>
                        " . ($billCompanyGST ? "GST no: $billCompanyGST" : "") . "
                    </p>
                    <div style='font-size:24px; font-weight:bold; color:#333; margin-top:10px;'>Quotation</div>
                </div>

                <!-- Quote details -->
                <table style='width:100%; border-collapse:collapse; margin-top:10px; border:1px solid #000;'>
                    <tr>
                        <td style='border:1px solid #000; padding:6px; width:33%;'>
                        Quotation No: <b>$quotationNo</b>
                            <br>
                            <br>
                        Quotation Date:<b> " . date('d/m/Y') . "</b><br>
                        Contract Year:<b> " . $contract_name . "</b><br>
                        </td>
                        <td style='border:1px solid #000; padding:6px; width:34%;'>
                        Place Of Supply:<b>$toCompanyState</b> 
                        </td>
                    </tr>
                </table>


                <!-- Bill To -->
                <table style='width:100%; border:1px solid #000; border-collapse:collapse; margin-top:10px;'>
                    <tr>
                        <td style='padding:6px; background-color: #f2f2f2;'>
                        <b>Bill To</b><br>
                        </td>
                       
                    </tr>
                    <tr>
                    
                        <td style='padding:6px;'>
                        $companyName<br>
                        $toCompanyAddress<br>
                        $toCompanyState<br>
                        $toCompanyCountry<br>
                        </td>
                    </tr>
                </table>

                <!-- Desktop Services Table -->
                <div class='desktop-table'>
                <table style='width:100%; border-collapse:collapse; margin-top:15px; font-size:12px;'>
                    <thead>
                        <tr>
                        <th style='border:1px solid #000; padding:8px 4px; background:#f2f2f2; width:8%; text-align:center; font-size:11px;'>#</th>
                        <th style='border:1px solid #000; padding:8px 4px; background:#f2f2f2; width:45%; text-align:left; font-size:11px;'>Item & Description</th>
                        <th style='border:1px solid #000; padding:8px 4px; background:#f2f2f2; width:15%; text-align:center; font-size:11px;'>HSN/SAC</th>";
                        if ($gstLogic === 'cgst_sgst') {
                    $html .="<th style='border:1px solid #000; padding:8px 4px; background:#f2f2f2; width:8%; text-align:center; font-size:11px;' colspan='2'>CGST</th>
                        <th style='border:1px solid #000; padding:8px 4px; background:#f2f2f2; width:8%; text-align:center; font-size:11px;' colspan='2'>SGST</th>
                        <th style='border:1px solid #000; padding:8px 4px; background:#f2f2f2; width:16%; text-align:right; font-size:11px;'>Amount</th>
                        </tr>
                        <tr>
                        <th style='border-left:1px solid #000; padding:4px; background:#f2f2f2;'></th>
                        <th style='padding:4px; border-left:1px solid #000; background-color:#f2f2f2;'></th>
                        <th style='padding:4px; border-left:1px solid #000; background-color:#f2f2f2;'></th>
                        <th style='border:1px solid #000; padding:4px; font-size:10px; text-align:center;'>%</th>
                        <th style='border:1px solid #000; padding:4px; font-size:10px; text-align:right;'>Amt</th>
                        <th style='border:1px solid #000; padding:4px; font-size:10px; text-align:center;'>%</th>
                        <th style='border:1px solid #000; padding:4px; font-size:10px; text-align:right;'>Amt</th>
                        <th style='border:1px solid #000; border-top:none; background-color:#f2f2f2; padding:4px;'></th>";
                        }elseif ($gstLogic === 'igst') {
                    $html .="<th style='border:1px solid #000; padding:8px 4px; background:#f2f2f2; width:16%; text-align:center; font-size:11px;' colspan='2'>IGST</th>
                            <th style='border:1px solid #000; padding:8px 4px; background:#f2f2f2; width:16%; text-align:right; font-size:11px;'>Amount</th>
                        </tr>
                        <tr>
                        <th style='border-left:1px solid #000; padding:4px; background:#f2f2f2;'></th>
                        <th style='padding:4px; border-left:1px solid #000; background-color:#f2f2f2;'></th>
                        <th style='padding:4px; border-left:1px solid #000; background-color:#f2f2f2;'></th>
                        <th style='border:1px solid #000; padding:4px; font-size:10px; text-align:center;'>%</th>
                        <th style='border:1px solid #000; padding:4px; font-size:10px; text-align:right;'>Amt</th>
                        <th style='border:1px solid #000; border-top:none; background-color:#f2f2f2; padding:4px;'></th>";
                        }else{
                    $html .="<th style='border:1px solid #000; padding:8px 4px; background:#f2f2f2; width:32%; text-align:right; font-size:11px;'>Amount</th>
                        </tr>
                        <tr>
                        <th style='border-left:1px solid #000; padding:4px; background:#f2f2f2;'></th>
                        <th style='padding:4px; border-left:1px solid #000; background-color:#f2f2f2;'></th>
                        <th style='padding:4px; border-left:1px solid #000; background-color:#f2f2f2;'></th>
                        <th style='border:1px solid #000; border-top:none; background-color:#f2f2f2; padding:4px;'></th>";
                        }

                        
                   $html .="</tr>
                    </thead>
                    <tbody>
                        $servicesTableRows
                    </tbody>
                </table>
                </div>

                <!-- Mobile Services List -->
                <div class='mobile-table'>";
                
                // Generate mobile-friendly service items
                if (isset($quotation['services']) && is_array($quotation['services'])) {
                    $rowNumber = 1;
                    foreach ($quotation['services'] as $service) {
                        $amount = $service['amount'] ?? 0;
                        $taxRate = $service['igst'] ?? 0;
                        $serviceName = htmlspecialchars($service['service_name'] ?? '');
                        $quantity = $service['quantity'] ?? 1;
                        $rate = $service['rate'] ?? 0;
                        $hsnCode = $service['hsn_code'] ?? '';
                        $description = htmlspecialchars($service['description'] ?? '');
                        
                        $cgstRate = 0;
                        $sgstRate = 0;
                        $cgstAmount = 0;
                        $sgstAmount = 0;
                        $igstAmount = 0;
                        
                        if ($gstLogic === 'cgst_sgst') {
                            $cgstRate = $service['cgst'] ?? 0;
                            $sgstRate = $service['sgst'] ?? 0;
                            $cgstAmount = $service['cgst_amount'] ?? 0;
                            $sgstAmount = $service['sgst_amount'] ?? 0;
                        } elseif ($gstLogic === 'igst') {
                            $igstAmount = $service['igst_amount'] ?? 0;
                        }
                        
                        $html .= "
                        <div class='mobile-service-item' style='border:1px solid #000; margin-bottom:10px; padding:10px; background:#f9f9f9;'>
                            <div style='font-weight:bold; font-size:14px; margin-bottom:5px;'>$rowNumber. $serviceName</div>
                            <div style='font-size:12px; color:#666; margin-bottom:3px;'>HSN/SAC: $hsnCode</div>
                            <div style='font-size:12px; color:#666; margin-bottom:3px;'>Qty: " . number_format($quantity, 2) . " | Rate: <span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($rate, 2) . "</span></div>";
                            
                        if ($description) {
                            $html .= "<div style='font-size:11px; color:#888; margin-bottom:5px;'>$description</div>";
                        }
                        
                        if ($gstLogic === 'cgst_sgst') {
                            $html .= "<div style='font-size:12px; margin-top:5px;'>
                                <div>CGST: " . number_format($cgstRate, 1) . "% = <span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($cgstAmount, 2) . "</span></div>
                                <div>SGST: " . number_format($sgstRate, 1) . "% = <span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($sgstAmount, 2) . "</span></div>
                            </div>";
                        } elseif ($gstLogic === 'igst') {
                            $html .= "<div style='font-size:12px; margin-top:5px;'>
                                <div>IGST: " . number_format($taxRate, 1) . "% = <span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($igstAmount, 2) . "</span></div>
                            </div>";
                        }
                        
                        $html .= "<div style='font-weight:bold; font-size:14px; margin-top:5px; text-align:right;'>Total: <span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($amount, 2) . "</span></div>
                        </div>";
                        
                        $rowNumber++;
                    }
                }
                
                $html .= "</div>

                <!-- Desktop Totals -->
                <div class='desktop-totals'>
                <table style='width:100%; border-collapse:collapse; margin-top:15px; font-size:12px;'>
                    <tr>
                        <td style='border:1px solid #000; padding:10px; width:60%; vertical-align:top; background-color:#f9f9f9;'>
                        <b style='font-size:13px;'>Total In Words</b><br>
                        <span style='font-size:11px; line-height:1.4;'>Indian Rupee $amountInWords</span>
                        </td>
                        <td style='border:1px solid #000; padding:8px; text-align: left; background-color:#f0f0f0;'><b style='font-size:12px;'>Sub Total</b></td>
                        <td style='border:1px solid #000; padding:8px; text-align: right; background-color:#f0f0f0;'><span style='font-size:12px; font-weight:bold; font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($subTotal, 2) . "</span></td>
                    </tr>";
                    if ($gstLogic === 'cgst_sgst') {
                    $html .="<tr>
                        <td style='border:1px solid #000; padding:8px; background-color:#f0f0f0;'></td>
                        <td style='border:1px solid #000; padding:8px; text-align: left; background-color:#f0f0f0;'><b style='font-size:12px;'>CGST (9%)</b></td>
                        <td style='border:1px solid #000; padding:8px; text-align: right; background-color:#f0f0f0;'><span style='font-size:12px; font-weight:bold; font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($totalCGST, 2) . "</span></td>
                    </tr>
                    <tr>
                        <td style='border:1px solid #000; padding:8px; background-color:#f0f0f0;'></td>
                        <td style='border:1px solid #000; padding:8px; text-align: left; background-color:#f0f0f0;'><b style='font-size:12px;'>SGST (9%)</b></td>
                        <td style='border:1px solid #000; padding:8px; text-align: right; background-color:#f0f0f0;'><span style='font-size:12px; font-weight:bold; font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($totalSGST, 2) . "</span></td>
                    </tr>";
                    }elseif ($gstLogic === 'igst') {
                    $html .="<tr>
                        <td style='border:1px solid #000; padding:8px; background-color:#f0f0f0;'></td>
                        <td style='border:1px solid #000; padding:8px; text-align: left; background-color:#f0f0f0;'><b style='font-size:12px;'>IGST (18%)</b></td>
                        <td style='border:1px solid #000; padding:8px; text-align: right; background-color:#f0f0f0;'><span style='font-size:12px; font-weight:bold; font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($totalIGST, 2) . "</span></td>
                    </tr>";
                    }else{

                    }
                    
                    $html .="<tr style='background-color:#e0e0e0;'>
                        <td style='border:1px solid #000; padding:10px; background-color:#e0e0e0;'></td>
                        <td style='border:1px solid #000; padding:10px; text-align: left;'><b style='font-size:14px; color:#333;'>Total</b></td>
                        <td style='border:1px solid #000; padding:10px; text-align: right;'><b style='font-size:14px; color:#d32f2f; font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($grandTotalAmount, 2) . "</b></td>
                    </tr>
                </table>
                        </div>

                <!-- Mobile Totals -->
                <div class='mobile-totals' style='margin-top:15px;'>
                    <div style='background:#f9f9f9; border:1px solid #000; padding:15px; margin-bottom:10px;'>
                        <div style='font-weight:bold; font-size:14px; margin-bottom:5px;'>Total In Words</div>
                        <div style='font-size:12px; color:#666;'>Indian Rupee $amountInWords</div>
                    </div>
                    
                    <div style='border:1px solid #000; background:#f0f0f0; padding:10px; margin-bottom:5px;'>
                        <div style='display:flex; justify-content:space-between; font-size:14px;'>
                            <span><b>Sub Total:</b></span>
                            <span><b style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($subTotal, 2) . "</b></span>
                        </div>
                    </div>";
                    
                    if ($gstLogic === 'cgst_sgst') {
                    $html .="<div style='border:1px solid #000; background:#f0f0f0; padding:10px; margin-bottom:5px;'>
                        <div style='display:flex; justify-content:space-between; font-size:14px;'>
                            <span><b>CGST (9%):</b></span>
                            <span><b style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($totalCGST, 2) . "</b></span>
                        </div>
                    </div>
                    <div style='border:1px solid #000; background:#f0f0f0; padding:10px; margin-bottom:5px;'>
                        <div style='display:flex; justify-content:space-between; font-size:14px;'>
                            <span><b>SGST (9%):</b></span>
                            <span><b style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($totalSGST, 2) . "</b></span>
                        </div>
                    </div>";
                    }elseif ($gstLogic === 'igst') {
                    $html .="<div style='border:1px solid #000; background:#f0f0f0; padding:10px; margin-bottom:5px;'>
                        <div style='display:flex; justify-content:space-between; font-size:14px;'>
                            <span><b>IGST (18%):</b></span>
                            <span><b style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($totalIGST, 2) . "</b></span>
                        </div>
                    </div>";
                    }
                    
                    $html .="<div style='border:2px solid #000; background:#e0e0e0; padding:15px;'>
                        <div style='display:flex; justify-content:space-between; font-size:16px; font-weight:bold; color:#d32f2f;'>
                            <span>TOTAL:</span>
                            <span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($grandTotalAmount, 2) . "</span>
                        </div>
                    </div>
                </div>
                <table style='width:100%; border-collapse:collapse; margin-top:15px;'>
                    <tr>
                    <!-- Notes & Bank Details -->
                        <td style='width:70%; vertical-align:top; padding-right:15px;'>
                    <div style='margin-top:15px; font-size:13px;'>
                                    <p style='margin:5px 0;'><b>Bank Details:</b><br></p>
                        <p style='margin:5px 0;'>
                                        Account Name:$billCompanyName<br>                            
                                        Account Number:$billCompanyBankAcc<br>
                                        IFSC Code:$billCompanyIfsc<br>
                                        $billCompanyBankAddress
                                        Bank Name:$billCompanyBankName <br>
                                        Branch: $billCompanyBranch
                                    </p>
                                 
                    </div>
                        </td>

                    <!-- Signature -->
                        <td style='width:30%; vertical-align:top; text-align:center;'>
                            <div style='border:1px solid #000; padding:15px; background-color:#fff;'>
                                " . (is_array($billCompany) && isset($billCompany['bc_seal']) && $billCompany['bc_seal'] ? "
                                <div style='margin-bottom:20px;'>
                                    <img src='" . ($signatureDataUri ?: $imageBaseUrl . $billCompany['bc_seal']) . "' alt='Authorized Signature' style='max-height:60px; width:auto; opacity:0.7;'>
                                </div>
                                " : "") . "
                                <div style='border-top:1px solid #000; margin-top:10px; padding-top:8px;'>
                                    <span style='font-size:12px; font-weight:bold;'>Authorized Signature</span>
                                </div>
                            </div>
                        </td>
                    </tr>
                </table>

                
                 <div style='margin-top:15px;font-size:13px;'>
                                
                                    <p style='margin: 5px 0;'><b>Terms & Conditions</b></p>
                                    <ul style='margin: 0; padding-left: 20px; line-height: 1.6; color: #374151; font-size: 0.7rem;'>
                                      <li>This quote is valid for 30 days from the date of issue.</li>
                                      <li>Services or renewals commence only after written/email approval and advance payment.</li>
                                      <li>Changes in scope may result in revised costs or timelines.</li>
                                      <li>Payment delays may lead to service suspension or delayed delivery.</li>
                                      <li>Renewal approvals must be received 30 days prior to the renewal date.</li>
                                      <li>Intellectual property rights remain with Webindia until full payment.</li>
                                      <li>Support and maintenance apply only under an active service agreement or AMC.</li>
                                    </ul>


                </div>

            </div>

        </body>
        </html>";
        
        return $html;
    }

    public static function getQuotationEmailTemplateWithCustomMessage($quotation, $contactPerson, $company, $billCompany, $customMessage = '', $loggedUserName = '') {
        $quotationNo = $quotation['quotation_no'];
        $companyName = $company['company_name'];
        $contactPersonName = $contactPerson['contact_person'];
        $grandTotal = number_format($quotation['grand_total'] ?? 0, 2);
        $quotationDate = date('d/m/Y');
        
        // Get service names
        $serviceNames = [];
        if (isset($quotation['services']) && is_array($quotation['services'])) {
            foreach ($quotation['services'] as $service) {
                $serviceNames[] = $service['service_name'] ?? '';
            }
        }
        $serviceNamesList = implode(', ', $serviceNames);
        
        // Billing company details
        $billCompanyName = (is_array($billCompany) && isset($billCompany['bc_name'])) ? $billCompany['bc_name'] : 'N/A';
        
        $html = "Dear $contactPersonName,<br><br>

Greetings from $billCompanyName!<br><br>

Please find attached the quotation for <b>$serviceNamesList</b>.<br><br>

<b>Quote Number:</b> $quotationNo<br>
<b>Quote Date:</b> $quotationDate<br>
<b>Total Amount:</b> ₹$grandTotal<br><br>

" . nl2br(htmlspecialchars($customMessage)) . "<br><br>

Should you have any questions or require clarification, please feel free to reach out to us.<br>
We look forward to your continued partnership.<br><br>

Warm regards,<br>
$loggedUserName";
        
        return $html;
    }



    // Proforma Invoice View Email Templates
    public static function getProformaInvoiceViewEmailTemplateWithCustomMessage($proformaData, $contactPerson, $company, $billingCompany, $customMessage = '', $loggedUserName = '') {
        $proformaInvoice = $proformaData['proforma_invoice'];
        $piNumber = $proformaInvoice['invoice_no'];
        $piDate = $proformaInvoice['inv_date'];
        $grandTotal = number_format($proformaInvoice['inv_grand_total'], 2);
        $companyName = $company['company_name'];
        
        // Get billing company name dynamically
        $billingCompanyName = (is_array($billingCompany) && isset($billingCompany['bc_name'])) ? $billingCompany['bc_name'] : 'Digicrew Solutions Private Limited';
        
        $html = "Dear $contactPerson[contact_person],<br><br>
            
   Greetings from $billingCompanyName! <br><br>

   Thank you for approving the quotation. Please find attached the Proforma Invoice for processing payment.<br><br>            
            
   <b>Proforma Invoice Number:</b> $piNumber<br>
   <b>Proforma Invoice Date:</b> " . date('d/m/Y', strtotime($piDate)) . "<br>
   <b>Total Amount:</b> ₹$grandTotal <br>
   <b>Payment Due:</b> Within 15 days from invoice date <br><br>

            <p>" . nl2br(htmlspecialchars($customMessage)) . "</p>
            
       Warm regards,<br>
        $loggedUserName ";
        
        return $html;
    }

    public static function getProformaInvoiceViewEmailTemplateWithBillCompany($proformaData, $contactPerson, $company, $billingCompany) {
        $proformaInvoice = $proformaData['proforma_invoice'];
        $proformaInvoiceDetails = $proformaData['proforma_invoice_details'];
        
        // Get backend URL from config
        $backendUrl = self::getBackendUrl();
        
        // For PDF generation, use base64 encoded images
        $isForPdf = true; // Always for PDF generation
        if ($isForPdf) {
            $imageBaseUrl = '';
            // Pre-encode images for PDF
            $logoDataUri = '';
            $signatureDataUri = '';
            
            if (isset($proformaInvoice['bc_logo']) && $proformaInvoice['bc_logo']) {
                $logoPath = __DIR__ . '/../' . $proformaInvoice['bc_logo'];
                if (file_exists($logoPath)) {
                    $logoData = file_get_contents($logoPath);
                    $logoMimeType = mime_content_type($logoPath);
                    $logoDataUri = 'data:' . $logoMimeType . ';base64,' . base64_encode($logoData);
                }
            }
            
            if (isset($proformaInvoice['bc_seal']) && $proformaInvoice['bc_seal']) {
                $signaturePath = __DIR__ . '/../' . $proformaInvoice['bc_seal'];
                if (file_exists($signaturePath)) {
                    $signatureData = file_get_contents($signaturePath);
                    $signatureMimeType = mime_content_type($signaturePath);
                    $signatureDataUri = 'data:' . $signatureMimeType . ';base64,' . base64_encode($signatureData);
                }
            }
        } else {
            $imageBaseUrl = $backendUrl . '/';
            $logoDataUri = '';
            $signatureDataUri = '';
        }
        
        // Calculate totals
        $subTotal = 0;
        $cgstAmount = 0;
        $sgstAmount = 0;
        $igstAmount = 0;
        $grandTotal = 0;
        
        foreach ($proformaInvoiceDetails as $detail) {
            $subTotal += floatval($detail['inv_bill_amount'] ?? $detail['inv_amount'] ?? 0);
            $cgstAmount += floatval($detail['cgst_amount'] ?? 0);
            $sgstAmount += floatval($detail['sgst_amount'] ?? 0);
            $igstAmount += floatval($detail['igst_amount'] ?? 0);
        }
        
        
        
        // Check if Tamil Nadu (for tax display)
        $isTamilNadu = ($proformaInvoice['place_of_supply'] ?? '') === 'Tamil Nadu';
        if ($isTamilNadu) {
            $grandTotal = $subTotal + $cgstAmount + $sgstAmount;
        }else{
            $grandTotal = $subTotal + $igstAmount;
        }
        
        // Helper function for number to words
        if (!function_exists('numberToWords')) {
            function numberToWords($number) {
                $ones = array(
                    0 => 'Zero', 1 => 'One', 2 => 'Two', 3 => 'Three', 4 => 'Four', 5 => 'Five',
                    6 => 'Six', 7 => 'Seven', 8 => 'Eight', 9 => 'Nine', 10 => 'Ten',
                    11 => 'Eleven', 12 => 'Twelve', 13 => 'Thirteen', 14 => 'Fourteen', 15 => 'Fifteen',
                    16 => 'Sixteen', 17 => 'Seventeen', 18 => 'Eighteen', 19 => 'Nineteen'
                );
                
                $tens = array(
                    20 => 'Twenty', 30 => 'Thirty', 40 => 'Forty', 50 => 'Fifty',
                    60 => 'Sixty', 70 => 'Seventy', 80 => 'Eighty', 90 => 'Ninety'
                );
                
                if ($number < 20) {
                    return $ones[$number];
                } elseif ($number < 100) {
                    $ten = intval($number / 10) * 10;
                    $one = $number % 10;
                    return $tens[$ten] . ($one > 0 ? ' ' . $ones[$one] : '');
                } elseif ($number < 1000) {
                    $hundred = intval($number / 100);
                    $remainder = $number % 100;
                    return $ones[$hundred] . ' Hundred' . ($remainder > 0 ? ' ' . numberToWords($remainder) : '');
                } elseif ($number < 100000) {
                    $thousand = intval($number / 1000);
                    $remainder = $number % 1000;
                    return numberToWords($thousand) . ' Thousand' . ($remainder > 0 ? ' ' . numberToWords($remainder) : '');
                } elseif ($number < 10000000) {
                    $lakh = intval($number / 100000);
                    $remainder = $number % 100000;
                    return numberToWords($lakh) . ' Lakh' . ($remainder > 0 ? ' ' . numberToWords($remainder) : '');
                } else {
                    $crore = intval($number / 10000000);
                    $remainder = $number % 10000000;
                    return numberToWords($crore) . ' Crore' . ($remainder > 0 ? ' ' . numberToWords($remainder) : '');
                }
            }
            
            function convertAmountToWords($amount) {
                // Split amount into rupees and paisa
                $rupees = floor($amount);
                $paisa = round(($amount - $rupees) * 100);
                
                // Convert rupees to words
                $rupeesWords = 'Indian Rupee ' . numberToWords($rupees);
                
                // Convert paisa to words if exists
                if ($paisa > 0) {
                    $paisaWords = numberToWords($paisa) . ' Paisa';
                    return $rupeesWords . ' and ' . $paisaWords . ' Only';
                }
                
                return $rupeesWords . ' Only';
            }
        }
        
        // Helper function for bill cycle text
        function getBillCycleText($cycleName, $cycleTerms, $billFollowup, $duration = null) {
            if (!$cycleName || !$cycleTerms) return '';
            
            $cycle = strtolower($cycleName);
            $followup = intval($billFollowup) ?: 1;
            
            $getOrdinalSuffix = function($num) {
                $j = $num % 10;
                $k = $num % 100;
                if ($j === 1 && $k !== 11) return $num . "st";
                if ($j === 2 && $k !== 12) return $num . "nd";
                if ($j === 3 && $k !== 13) return $num . "rd";
                return $num . "th";
            };
            
            if (strpos($cycle, 'half') !== false && strpos($cycle, 'yearly') !== false) {
                return $getOrdinalSuffix($followup) . ' Half yearly payment';
            } elseif (strpos($cycle, 'quarterly') !== false) {
                return $getOrdinalSuffix($followup) . ' Quarterly payment';
            } elseif (strpos($cycle, 'monthly') !== false) {
                return $getOrdinalSuffix($followup) . ' Monthly payment';
            } elseif (strpos($cycle, 'yearly') !== false || strpos($cycle, 'annual') !== false) {
                // For yearly cycles, check duration
                if ($duration && $duration >= 2 && $duration <= 10) {
                    return $duration . ' Years payment';
                }
                return 'Yearly payment';
            } else {
                return $cycleName . ' payment';
            }
        }
        
        // Helper function for item description
        function formatItemDescription($item) {
            $serviceName = $item['service_name'] ?? '';
            $qty = floatval($item['qty'] ?? 0);
            $rate = floatval($item['inv_rate'] ?? 0);
            $amount = floatval($item['inv_amount'] ?? 0);
            $duration = isset($item['duration']) ? intval($item['duration']) : null;
            $billCycle = getBillCycleText($item['cycle_name'] ?? '', $item['cycle_terms'] ?? '', $item['bill_followup'] ?? '', $duration);
            $fromDate = $item['bill_from_date'] ? date('d/m/Y', strtotime($item['bill_from_date'])) : '';
            $toDate = $item['bill_to_date'] ? date('d/m/Y', strtotime($item['bill_to_date'])) : '';
            $quotationServiceDescription = $item['quotation_service_description'] ?? '';
            
            $description = '<div style="text-align: left;">';
            $description .= '<div style="font-weight: bold; margin-bottom: 4px;">' . htmlspecialchars($serviceName) . '</div>';
            $description .= '<div style="font-size: 12px; line-height: 1.3;">';
            $description .= 'Qty: ' . number_format($qty, 2) . ' Rate per qty: <span style="font-family: DejaVu Sans, Arial, sans-serif;">₹' . number_format($rate, 2) . '</span><br />';
            $description .= 'Total Amt: <span style="font-family: DejaVu Sans, Arial, sans-serif;">₹' . number_format($amount, 2) . '</span><br />';
            if ($billCycle) {
                $description .= 'Bill cycle: ' . htmlspecialchars($billCycle) . '<br />';
            }
            if ($fromDate && $toDate) {
                $description .= 'From: ' . $fromDate . ' To: ' . $toDate . '<br />';
            }
            if ($quotationServiceDescription) {
                // Ensure proper UTF-8 encoding for PDF rendering (preserve currency symbols)
                $quotationServiceDescription = mb_convert_encoding($quotationServiceDescription, 'UTF-8', mb_detect_encoding($quotationServiceDescription, 'UTF-8, ISO-8859-1, Windows-1252', true) ?: 'UTF-8');
                // Decode any HTML entities to get raw UTF-8 characters (especially currency symbols)
                $quotationServiceDescription = html_entity_decode($quotationServiceDescription, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                // Escape HTML special characters first (currency symbols pass through unchanged)
                $quotationServiceDescription = htmlspecialchars($quotationServiceDescription, ENT_QUOTES, 'UTF-8');
                // Wrap currency symbols (₹) with font-family span for PDF rendering (after escaping)
                $quotationServiceDescription = preg_replace('/(₹)/u', '<span style="font-family: DejaVu Sans, Arial, sans-serif;">$1</span>', $quotationServiceDescription);
                $description .= $quotationServiceDescription;
            }
            $description .= '</div></div>';
            
            return $description;
        }
        
        $html = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <title>Proforma Invoice - " . htmlspecialchars($proformaInvoice['invoice_no']) . "</title>
            <style>
                body { font-family: DejaVu Sans, Arial, sans-serif; margin: 0; padding: 0; }
                .invoice-container { font-family: Arial, sans-serif; font-size: 14px; margin: 20px; border: 1px solid #000; padding: 10px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #000; padding: 6px; }
                .header-table td { border: none; }
                .logo-cell { width: 35%; vertical-align: top; }
                .company-cell { width: 50%; vertical-align: top; }
                .title-cell { width: 25%; text-align: right; vertical-align: bottom; }
                .bill-to-header { background-color: #f2f2f2; }
                .items-header { background: #f2f2f2; }
                .total-words { width: 70%; vertical-align: top; }
                .signature-table { width: 30%; border: 1px solid; margin-top: -1px; text-align: center; }
                .bank-details { margin-top: 15px; font-size: 13px; }
            </style>
        </head>
        <body>
            <div class='invoice-container'>
                <table class='header-table'>
                    <tr>
                        <td class='logo-cell'>
                            " . (isset($proformaInvoice['bc_logo']) && $proformaInvoice['bc_logo'] ? "<img src='" . ($logoDataUri ?: $imageBaseUrl . $proformaInvoice['bc_logo']) . "' alt='Company Logo' style='max-width: 180px; height: auto; display:block; margin:0 auto;'>" : "") . "
                            <div style='width: 180px; height: 80px; border: 2px solid #e5e7eb; border-radius: 8px; display: " . ((isset($proformaInvoice['bc_logo']) && $proformaInvoice['bc_logo']) ? 'none' : 'flex') . "; align-items: center; justify-content: center; background-color: #f9fafb; font-size: 14px; font-weight: bold; color: #374151; text-align: center;'>
                                " . htmlspecialchars($proformaInvoice['billing_company'] ?? 'Company Logo') . "
                            </div>
                        </td>
                        {/* Company Info */}
                        <td class='company-cell'>
                            <h2 style='margin: 0; font-weight: bold;'>" . htmlspecialchars($proformaInvoice['billing_company'] ?? 'Company Name') . "</h2>
                            <p style='margin: 5px 0;'>
                                " . htmlspecialchars($proformaInvoice['billing_address'] ?? 'Company Address') . "<br />
                                " . ($proformaInvoice['billing_gst'] ? 'GST no: ' . htmlspecialchars($proformaInvoice['billing_gst']) : '') . "
                            </p>
                        </td>
                        {/* Proforma Invoice Label */}
                        <td class='title-cell'>
                            <div style='font-size: 28px; font-weight: bold;'>Proforma Invoice</div>
                            </td>
                        </tr>
                    </table>

                <table style='margin-top: 10px;'>
                    <tr>
                        <td style='width: 33%;'>
                            Proforma Invoice No: <b>" . htmlspecialchars($proformaInvoice['invoice_no']) . "</b><br /><br />
                            Invoice Date: <b>" . date('d/m/Y', strtotime($proformaInvoice['inv_date'])) . "</b>
                        </td>
                        <td style='width: 34%;'>
                            Place Of Supply: <b>" . htmlspecialchars($proformaInvoice['place_of_supply'] ?? 'Tamil Nadu') . "</b>
                        </td>
                    </tr>
                </table>

                <table style='margin-top: 10px;'>
                    <tr>
                        <td class='bill-to-header'>
                            <b>Bill To</b><br />
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <strong>" . htmlspecialchars($proformaInvoice['company_name'] ?? 'Company Name') . "</strong><br />
                            " . ($proformaInvoice['first_name'] && $proformaInvoice['last_name'] ? htmlspecialchars($proformaInvoice['first_name'] . ' ' . $proformaInvoice['last_name']) . '<br />' : '') . "
                            " . ($proformaInvoice['company_address'] ? htmlspecialchars($proformaInvoice['company_address']) . '<br />' : '') . "
                            " . ($proformaInvoice['company_city'] ? htmlspecialchars($proformaInvoice['company_city']) . '<br />' : '') . "
                            " . ($proformaInvoice['place_of_supply'] ? htmlspecialchars($proformaInvoice['place_of_supply']) . '<br />' : '') . "
                            " . ($proformaInvoice['company_pincode'] ? htmlspecialchars($proformaInvoice['company_pincode']) . '<br />' : '') . "
                            India<br />
                            " . ($proformaInvoice['company_gst'] ? 'GST no: ' . htmlspecialchars($proformaInvoice['company_gst']) : '') . "
                        </td>
                    </tr>
                </table>

                <table style='margin-top: 15px; text-align: center;'>
                    <thead>
                        <tr>
                            <th class='items-header'>#</th>
                            <th class='items-header'>Item & Description</th>
                            <th class='items-header'>HSN / SAC</th>";
        
        if ($isTamilNadu) {
            $html .= "
                            <th class='items-header' colspan='2'>CGST</th>
                            <th class='items-header' colspan='2'>SGST</th>";
        } else {
            $html .= "
                            <th class='items-header' colspan='2'>IGST</th>";
        }
        
        $html .= "
                            <th class='items-header'>Amount</th>
                        </tr>
                        <tr>
                            <th class='items-header'></th>
                            <th class='items-header'></th>
                            <th class='items-header'></th>";
        
        if ($isTamilNadu) {
            $html .= "
                            <th>%</th>
                            <th>Amt</th>
                            <th>%</th>
                            <th>Amt</th>";
        } else {
            $html .= "
                            <th>%</th>
                            <th>Amt</th>";
        }
        
        $html .= "
                            <th class='items-header'></th>
                        </tr>
                    </thead>
                    <tbody>";
        
        foreach ($proformaInvoiceDetails as $index => $item) {
            $html .= "
                        <tr>
                            <td>" . ($index + 1) . "</td>
                            <td style='text-align: left;'>" . formatItemDescription($item) . "</td>
                            <td>" . htmlspecialchars($item['hsn_sac'] ?? '998315') . "</td>";
            
            if ($isTamilNadu) {
                $html .= "
                            <td>" . number_format(floatval($item['cgst'] ?? 0), 1) . "%</td>
                            <td><span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format(floatval($item['cgst_amount'] ?? 0), 2) . "</span></td>
                            <td>" . number_format(floatval($item['sgst'] ?? 0), 1) . "%</td>
                            <td><span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format(floatval($item['sgst_amount'] ?? 0), 2) . "</span></td>";
            } else {
                $html .= "
                            <td>" . number_format(floatval($item['igst'] ?? 0), 1) . "%</td>
                            <td><span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format(floatval($item['igst_amount'] ?? 0), 2) . "</span></td>";
            }
            
            $html .= "
                            <td><span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format(floatval($item['inv_bill_amount'] ?? $item['inv_amount'] ?? 0), 2) . "</span></td>
                        </tr>";
        }
        
        $html .= "
                    </tbody>
                </table>

                <table style='margin-top: 10px;'>
                    <tr>
                        <td class='total-words' rowspan='" . ($isTamilNadu ? '4' : '3') . "'>
                            <b>Total In Words</b><br />
                            " . convertAmountToWords($grandTotal) . "
                        </td>
                        <td style='text-align: right; white-space: nowrap;'><b>Sub Total</b></td>
                        <td style='text-align: right; white-space: nowrap;'><span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($subTotal, 2) . "</span></td>
                    </tr>";
        
        if ($isTamilNadu) {
            $html .= "
                    <tr>
                        <td style='text-align: right; white-space: nowrap;'><b>CGST (9%)</b></td>
                        <td style='text-align: right; white-space: nowrap;'><span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($cgstAmount, 2) . "</span></td>
                    </tr>
                    <tr>
                        <td style='text-align: right; white-space: nowrap;'><b>SGST (9%)</b></td>
                        <td style='text-align: right; white-space: nowrap;'><span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($sgstAmount, 2) . "</span></td>
                    </tr>";
        } else {
            $html .= "
                    <tr>
                        <td style='text-align: right; white-space: nowrap;'><b>IGST (18%)</b></td>
                        <td style='text-align: right; white-space: nowrap;'><span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($igstAmount, 2) . "</span></td>
                    </tr>";
        }
        
        $html .= "
                    <tr>
                        <td style='text-align: right; white-space: nowrap;'><b>Total</b></td>
                        <td style='text-align: right; white-space: nowrap;'><b><span style='font-family: DejaVu Sans, Arial, sans-serif;'>₹" . number_format($grandTotal, 2) . "</span></b></td>
                    </tr>
                </table>

                <table style='width:100%; border-collapse:collapse; margin-top:15px;'>
                    <tr>
                    <!-- Notes & Bank Details -->
                        <td style='width:70%; vertical-align:top; padding-right:15px;'>
                <div style='margin-top:15px; font-size:13px;'>
                        <p style='margin:5px 0;'><b>Bank Details:</b><br></p>
                        <p style='margin:5px 0;'>";
        if ($proformaInvoice['billing_company']) {
            $html .= "Account Name: " . htmlspecialchars($proformaInvoice['billing_company']);
        }
        if ($proformaInvoice['billing_company'] && $proformaInvoice['bc_bank_acc_no']) {
            $html .= "<br />";
        }
        if ($proformaInvoice['bc_bank_acc_no']) {
            $html .= "Account Number: " . htmlspecialchars($proformaInvoice['bc_bank_acc_no']);
        }
        if (($proformaInvoice['billing_company'] || $proformaInvoice['bc_bank_acc_no']) && $proformaInvoice['bc_bank_ifsc']) {
            $html .= "<br />";
        }
        if ($proformaInvoice['bc_bank_ifsc']) {
            $html .= "IFSC Code: " . htmlspecialchars($proformaInvoice['bc_bank_ifsc']);
        }
        if (($proformaInvoice['billing_company'] || $proformaInvoice['bc_bank_acc_no'] || $proformaInvoice['bc_bank_ifsc']) && $proformaInvoice['bc_bank_address']) {
            $html .= "<br />" . htmlspecialchars(str_replace('<br>', '', $proformaInvoice['bc_bank_address']));
        }
        if (($proformaInvoice['billing_company'] || $proformaInvoice['bc_bank_acc_no'] || $proformaInvoice['bc_bank_ifsc'] || $proformaInvoice['bc_bank_address']) && $proformaInvoice['bc_bank_name']) {
            $html .= "<br />Bank Name: " . htmlspecialchars($proformaInvoice['bc_bank_name']);
        }
        if (($proformaInvoice['billing_company'] || $proformaInvoice['bc_bank_acc_no'] || $proformaInvoice['bc_bank_ifsc'] || $proformaInvoice['bc_bank_address']) && $proformaInvoice['bc_bank_branch']) {
            $html .= "<br />Branch: " . htmlspecialchars($proformaInvoice['bc_bank_branch']);
        }
          $html .="</p>
                     
                </div>
                        </td>

                    <!-- Signature -->
                        <td style='width:30%; vertical-align:top; text-align:center;'>
                            <div style='border:1px solid #000; padding:15px; background-color:#fff;'>
                                " . (isset($proformaInvoice['bc_seal']) && $proformaInvoice['bc_seal'] ? "
                                <div style='margin-bottom:20px;'>
                                    <img src='" . ($signatureDataUri ?: $imageBaseUrl . $proformaInvoice['bc_seal']) . "' alt='Authorized Signature' style='max-height:60px; width:auto; opacity:0.7;'>
            </div>
                                " : "") . "
                                <div style='border-top:1px solid #000; margin-top:10px; padding-top:8px;'>
                                    <span style='font-size:12px; font-weight:bold;'>Authorized Signature</span>
                                </div>
                            </div>
                        </td>
                    </tr>
                </table>

                <div style='margin-top:15px;font-size:13px;'>
                                
                                    <p style='margin: 5px 0;'><b>Terms & Conditions</b></p>
                                    <ul style='margin: 0; padding-left: 20px; line-height: 1.6; color: #374151; font-size: 0.7rem;'>
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
        </body>
        </html>";
        
        return $html;
    }
}
?>
