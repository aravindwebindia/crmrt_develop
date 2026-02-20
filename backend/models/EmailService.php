<?php
require_once __DIR__ . '/../config/email.php';

// Check if PHPMailer is available
$phpmailer_available = false;
if (file_exists(__DIR__ . '/../vendor/phpmailer/PHPMailer.php')) {
    require_once __DIR__ . '/../vendor/phpmailer/PHPMailer.php';
    $phpmailer_available = true;
}

// Check if dompdf is available
$dompdf_available = false;
if (file_exists(__DIR__ . '/../vendor/dompdf/src/Dompdf.php')) {
    // Simple autoloader for dompdf and dependencies
    spl_autoload_register(function ($class) {
        // Handle Dompdf classes
        $prefix = 'Dompdf\\';
        $base_dir = __DIR__ . '/../vendor/dompdf/src/';
        
        $len = strlen($prefix);
        if (strncmp($prefix, $class, $len) === 0) {
            $relative_class = substr($class, $len);
            $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
            
            if (file_exists($file)) {
                require $file;
            }
            return;
        }
        
        // Handle Masterminds classes
        $prefix = 'Masterminds\\';
        $base_dir = __DIR__ . '/../vendor/masterminds/';
        
        $len = strlen($prefix);
        if (strncmp($prefix, $class, $len) === 0) {
            $relative_class = substr($class, $len);
            $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
            
            if (file_exists($file)) {
                require $file;
            }
            return;
        }
        
        // Handle SVG classes
        $prefix = 'Svg\\';
        $base_dir = __DIR__ . '/../vendor/svg/';
        
        $len = strlen($prefix);
        if (strncmp($prefix, $class, $len) === 0) {
            $relative_class = substr($class, $len);
            $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
            
            if (file_exists($file)) {
                require $file;
            }
            return;
        }
        
        // Handle FontLib classes
        $prefix = 'FontLib\\';
        $base_dir = __DIR__ . '/../vendor/dompdf/lib/fonts/';
        
        $len = strlen($prefix);
        if (strncmp($prefix, $class, $len) === 0) {
            $relative_class = substr($class, $len);
            $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
            
            if (file_exists($file)) {
                require $file;
            }
            return;
        }
    });
    
    // Include FontLib stub classes
    require_once __DIR__ . '/../vendor/dompdf/lib/FontLib.php';
    
    // Include the main lib file
    require_once __DIR__ . '/../vendor/dompdf/lib/Cpdf.php';
    $dompdf_available = true;
}

class EmailService {
    private $smtp_host;
    private $smtp_port;
    private $smtp_username;
    private $smtp_password;
    private $smtp_encryption;
    private $from_email;
    private $from_name;
    private $phpmailer_available;
    private $dompdf_available;

    public function __construct() {
        EmailConfig::init();
        $this->smtp_host = EmailConfig::$smtp_host;
        $this->smtp_port = EmailConfig::$smtp_port;
        $this->smtp_username = EmailConfig::$smtp_username;
        $this->smtp_password = EmailConfig::$smtp_password;
        $this->smtp_encryption = EmailConfig::$smtp_encryption;
        $this->from_email = EmailConfig::$from_email;
        $this->from_name = EmailConfig::$from_name;
        $this->phpmailer_available = $GLOBALS['phpmailer_available'] ?? false;
        $this->dompdf_available = $GLOBALS['dompdf_available'] ?? false;
    }

    public function sendQuotationEmailWithCustomMessage($quotation, $contactPerson, $company, $billCompany, $customMessage = '', $loggedUserName = '', $toEmails = [], $ccEmails = [], $sendToCustomer = false) {
        try {
            // Set primary recipient based on checkbox (parity with proforma behavior)
            if ($sendToCustomer && !empty($contactPerson['contact_email'])) {
                // Checkbox is checked - send to contact person
                $to_email = $contactPerson['contact_email'];
                $to_name = $contactPerson['contact_person'];
            } else {
                // Checkbox is unchecked - send to the first provided TO email only
                $toEmails = array_unique(array_filter($toEmails));
                if (!empty($toEmails) && !empty($toEmails[0])) {
                    $to_email = $toEmails[0];
                    $to_name = 'Recipient';
                } else {
                    return [
                        'success' => false,
                        'message' => 'Recipient email missing. The quotation won’t be sent unless selected.'
                    ];
                }
            }
            $subject = "Quotation " . $quotation['quotation_no'] . " - " . $company['company_name'];
            
            // Generate custom email body (HTML)
            $html_body = EmailConfig::getQuotationEmailTemplateWithCustomMessage($quotation, $contactPerson, $company, $billCompany, $customMessage, $loggedUserName);
            
            // If sending to customer, also include contact email in TO list to make it visible to all
            if ($sendToCustomer && !empty($contactPerson['contact_email'])) {
                $toEmails[] = $contactPerson['contact_email'];
                $toEmails = array_unique(array_filter($toEmails));
            }
            
            // Generate PDF attachment using the detailed template
            $pdf_path = null;
            if ($this->dompdf_available) {
                // Create a copy of quotation data with PDF flag for local image paths
                $quotation_for_pdf = $quotation;
                $quotation_for_pdf['_for_pdf'] = true;
                $pdf_html = EmailConfig::getQuotationEmailTemplateWithBillCompany($quotation_for_pdf, $contactPerson, $company, $billCompany);
                $pdf_path = $this->generatePDF($pdf_html, $quotation['quotation_no'], 'quotation');
            }
            
            // Use PHPMailer if available, otherwise fall back to mail()
            $result = null;
            if ($this->phpmailer_available) {
                $result = $this->sendWithPHPMailer($to_email, $to_name, $subject, $html_body, $pdf_path, $toEmails, $ccEmails, $quotation['quotation_no'], 'quotation');
            } else {
                $result = $this->sendWithMailFunction($to_email, $to_name, $subject, $html_body, $pdf_path, $toEmails, $ccEmails, $quotation['quotation_no'], 'quotation');
            }
            
            // Add PDF path to result for quotation deletion
            if ($result && isset($result['success']) && $result['success']) {
                $result['pdf_path'] = $pdf_path;
            }
            
            return $result;
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Email error: ' . $e->getMessage()
            ];
        }
    }

    private function generatePDF($html_content, $quotation_no, $document_type = 'quotation') {
        try {
            if (!$this->dompdf_available) {
                return null;
            }

            $dompdf = new \Dompdf\Dompdf();
            $dompdf->loadHtml($html_content);
            $dompdf->setPaper('A4', 'portrait');
            
            // Enable remote file access for local images
            $dompdf->getOptions()->setIsRemoteEnabled(true);
            $dompdf->getOptions()->setIsHtml5ParserEnabled(true);
            
            // Set default font for better Unicode support
            $dompdf->getOptions()->setDefaultFont('DejaVu Sans');
            
            $dompdf->render();

            // Create uploads directory if it doesn't exist
            $upload_dir = __DIR__ . '/../uploads/quotations/';
            if (!file_exists($upload_dir)) {
                mkdir($upload_dir, 0755, true);
            }

            // Generate unique filename based on document type
            if ($document_type === 'proforma_invoice') {
                $filename = ($quotation_no ? 'ProformaInvoice_' . $quotation_no : 'ProformaInvoice_document') . '_' . time() . '.pdf';
            } else {
                $filename = ($quotation_no ? 'Quotation_' . $quotation_no : 'Quotation_document') . '_' . time() . '.pdf';
            }
            $file_path = $upload_dir . $filename;

            // Save PDF to file
            file_put_contents($file_path, $dompdf->output());

            return $file_path;
        } catch (Exception $e) {
            error_log('PDF generation error: ' . $e->getMessage());
            return null;
        }
    }

    private function sendWithPHPMailer($to_email, $to_name, $subject, $html_body, $pdf_path = null, $toEmails = [], $ccEmails = [], $quotation_no = '', $document_type = 'quotation') {
        try {
            // Use the working SMTP method
            return $this->sendWithWorkingSMTP($to_email, $to_name, $subject, $html_body, $pdf_path, $toEmails, $ccEmails, $quotation_no, $document_type);
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'SMTP error: ' . $e->getMessage()
            ];
        }
    }

    private function sendWithPHPMailerPlainText($to_email, $to_name, $subject, $text_body, $pdf_path = null, $toEmails = [], $ccEmails = []) {
        try {
            // Use the working SMTP method for plain text
            return $this->sendWithWorkingSMTPPlainText($to_email, $to_name, $subject, $text_body, $pdf_path, $toEmails, $ccEmails);
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'SMTP error: ' . $e->getMessage()
            ];
        }
    }

    private function sendWithWorkingSMTP($to_email, $to_name, $subject, $html_body, $pdf_path = null, $toEmails = [], $ccEmails = [], $quotation_no = '', $document_type = 'quotation') {
        try {
            $smtp_host = $this->smtp_host;
            $smtp_port = $this->smtp_port;
            $username = $this->smtp_username;
            $password = $this->smtp_password;

            // Connect to SMTP server with shorter timeout
            $fp = fsockopen($smtp_host, $smtp_port, $errno, $errstr, 10);
            if (!$fp) {
                throw new Exception("Failed to connect to SMTP server: $errstr ($errno)");
            }
            
            // Set socket timeout
            stream_set_timeout($fp, 10);

        // Function to read multi-line SMTP response with timeout check
        $readSMTPResponse = function($fp) {
            $response = '';
            while (($line = fgets($fp, 512)) !== false) {
                $response .= $line;
                if (substr($line, 3, 1) === ' ') {
                    break; // Last line of multi-line response
                }
                
                // Check for timeout
                $info = stream_get_meta_data($fp);
                if ($info['timed_out']) {
                    error_log("SMTP read timeout");
                    break;
                }
            }
            return $response;
        };

        // Read initial response
        $response = $readSMTPResponse($fp);
        if (substr($response, 0, 3) !== '220') {
            fclose($fp);
            throw new Exception("SMTP server error: $response");
        }

        // Send EHLO
        fwrite($fp, "EHLO localhost\r\n");
        $readSMTPResponse($fp);

        // Start TLS
        fwrite($fp, "STARTTLS\r\n");
        $response = $readSMTPResponse($fp);
        if (substr($response, 0, 3) !== '220') {
            fclose($fp);
            throw new Exception("STARTTLS failed: $response");
        }

        // Enable TLS encryption
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($fp);
            throw new Exception('Failed to enable TLS encryption');
        }

        // Send EHLO again after TLS
        fwrite($fp, "EHLO localhost\r\n");
        $readSMTPResponse($fp);

        // Authenticate
        fwrite($fp, "AUTH LOGIN\r\n");
        $response = $readSMTPResponse($fp);
        if (substr($response, 0, 3) !== '334') {
            fclose($fp);
            throw new Exception("AUTH LOGIN failed: $response");
        }

        // Send username
        fwrite($fp, base64_encode($username) . "\r\n");
        $response = $readSMTPResponse($fp);
        if (substr($response, 0, 3) !== '334') {
            fclose($fp);
            throw new Exception("Username rejected: $response");
        }

        // Send password
        fwrite($fp, base64_encode($password) . "\r\n");
        $response = $readSMTPResponse($fp);
        if (substr($response, 0, 3) !== '235') {
            fclose($fp);
            throw new Exception("Authentication failed: $response");
        }

        // Send email
        fwrite($fp, "MAIL FROM: <$username>\r\n");
        $readSMTPResponse($fp);

        // Send to primary recipient
        fwrite($fp, "RCPT TO: <$to_email>\r\n");
        $readSMTPResponse($fp);
        
        // Send to additional TO recipients
        foreach ($toEmails as $email) {
            if (!empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                fwrite($fp, "RCPT TO: <$email>\r\n");
                $readSMTPResponse($fp);
            }
        }
        
        // Send to CC recipients
        foreach ($ccEmails as $email) {
            if (!empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                fwrite($fp, "RCPT TO: <$email>\r\n");
                $readSMTPResponse($fp);
            }
        }

        fwrite($fp, "DATA\r\n");
        $readSMTPResponse($fp);

        // Send email content
        $boundary = md5(uniqid(time()));
        
        $email_data = "From: {$this->from_name} <{$this->from_email}>\r\n";
        
        // Build TO recipients list
        $toList = "$to_name <$to_email>";
        if (!empty($toEmails)) {
            $additionalTo = implode(', ', array_filter($toEmails, function($email) {
                return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
            }));
            if (!empty($additionalTo)) {
                $toList .= ", $additionalTo";
            }
        }
        $email_data .= "To: $toList\r\n";
        
        // Add CC recipients
        if (!empty($ccEmails)) {
            $ccList = implode(', ', array_filter($ccEmails, function($email) {
                return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
            }));
            if (!empty($ccList)) {
                $email_data .= "Cc: $ccList\r\n";
            }
        }
        
        $email_data .= "Subject: $subject\r\n";
        $email_data .= "MIME-Version: 1.0\r\n";
        
        if ($pdf_path && file_exists($pdf_path)) {
            // Multipart email with PDF attachment
            $email_data .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";
            $email_data .= "\r\n";
            $email_data .= "--$boundary\r\n";
            $email_data .= "Content-Type: text/html; charset=UTF-8\r\n";
            $email_data .= "\r\n";
            $email_data .= "$html_body\r\n";
            $email_data .= "\r\n";
            $email_data .= "--$boundary\r\n";
            // Generate PDF filename based on document type
            if ($document_type === 'proforma_invoice') {
                $pdf_filename = ($quotation_no ? 'ProformaInvoice_' . $quotation_no : 'ProformaInvoice_document') . '.pdf';
            } else {
                $pdf_filename = ($quotation_no ? 'Quotation_' . $quotation_no : 'Quotation_document') . '.pdf';
            }
            $email_data .= "Content-Type: application/pdf; name=\"$pdf_filename\"\r\n";
            $email_data .= "Content-Transfer-Encoding: base64\r\n";
            $email_data .= "Content-Disposition: attachment; filename=\"$pdf_filename\"\r\n";
            $email_data .= "\r\n";
            $email_data .= chunk_split(base64_encode(file_get_contents($pdf_path))) . "\r\n";
            $email_data .= "--$boundary--\r\n";
        } else {
            // Simple HTML email without attachment
        $email_data .= "Content-Type: text/html; charset=UTF-8\r\n";
        $email_data .= "\r\n";
        $email_data .= "$html_body\r\n";
        }
        
        $email_data .= ".\r\n";

        fwrite($fp, $email_data);
        $response = $readSMTPResponse($fp);

        fwrite($fp, "QUIT\r\n");
        $readSMTPResponse($fp);

        fclose($fp);

        // More robust SMTP response checking
        $responseLines = explode("\n", $response);
        $lastLine = trim(end($responseLines));
        $isSuccess = (strpos($lastLine, '250') === 0);

        // Also check if any line in the response contains 250 (for multi-line responses)
        if (!$isSuccess) {
            foreach ($responseLines as $line) {
                $line = trim($line);
                if (strpos($line, '250') === 0) {
                    $isSuccess = true;
                    break;
                }
            }
        }

        if ($isSuccess) {
            return [
                'success' => true,
                'message' => ($document_type === 'quotation' ? 'Quotation' : ($document_type === 'proforma_invoice' ? 'Proforma invoice' : 'Email')) . ' sent successfully to ' . $to_email
            ];
        } else {
            throw new Exception("Email sending failed: $response");
        }
        
        } catch (Exception $e) {
            error_log("SMTP Error: " . $e->getMessage());
            return [
                'success' => false,
                'message' => 'SMTP error: ' . $e->getMessage()
            ];
        }
    }

    private function sendWithMailFunction($to_email, $to_name, $subject, $html_body, $pdf_path = null, $toEmails = [], $ccEmails = [], $quotation_no = '', $document_type = 'quotation') {
        $boundary = md5(uniqid(time()));
        
        if ($pdf_path && file_exists($pdf_path)) {
            // Multipart email with PDF attachment
            $headers = [
                'MIME-Version: 1.0',
                'From: ' . $this->from_name . ' <' . $this->from_email . '>',
                'Reply-To: ' . $this->from_email,
                'X-Mailer: PHP/' . phpversion(),
                'Content-Type: multipart/mixed; boundary="' . $boundary . '"'
            ];
            
            // Add additional TO recipients
            if (!empty($toEmails)) {
                $additionalTo = implode(', ', array_filter($toEmails, function($email) {
                    return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
                }));
                if (!empty($additionalTo)) {
                    $headers[] = 'To: ' . $to_name . ' <' . $to_email . '>, ' . $additionalTo;
                }
            }
            
            // Add CC recipients
            if (!empty($ccEmails)) {
                $ccList = implode(', ', array_filter($ccEmails, function($email) {
                    return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
                }));
                if (!empty($ccList)) {
                    $headers[] = 'Cc: ' . $ccList;
                }
            }
            
            $message = "--$boundary\r\n";
            $message .= "Content-Type: text/html; charset=UTF-8\r\n";
            $message .= "\r\n";
            $message .= $html_body . "\r\n";
            $message .= "\r\n";
            $message .= "--$boundary\r\n";
            // Generate PDF filename based on document type
            if ($document_type === 'proforma_invoice') {
                $pdf_filename = ($quotation_no ? 'ProformaInvoice_' . $quotation_no : 'ProformaInvoice_document') . '.pdf';
            } else {
                $pdf_filename = ($quotation_no ? 'Quotation_' . $quotation_no : 'Quotation_document') . '.pdf';
            }
            $message .= "Content-Type: application/pdf; name=\"$pdf_filename\"\r\n";
            $message .= "Content-Transfer-Encoding: base64\r\n";
            $message .= "Content-Disposition: attachment; filename=\"$pdf_filename\"\r\n";
            $message .= "\r\n";
            $message .= chunk_split(base64_encode(file_get_contents($pdf_path))) . "\r\n";
            $message .= "--$boundary--\r\n";
        } else {
            // Simple HTML email without attachment
            $headers = [
                'MIME-Version: 1.0',
                'Content-type: text/html; charset=UTF-8',
                'From: ' . $this->from_name . ' <' . $this->from_email . '>',
                'Reply-To: ' . $this->from_email,
                'X-Mailer: PHP/' . phpversion()
            ];
            
            // Add additional TO recipients
            if (!empty($toEmails)) {
                $additionalTo = implode(', ', array_filter($toEmails, function($email) {
                    return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
                }));
                if (!empty($additionalTo)) {
                    $headers[] = 'To: ' . $to_name . ' <' . $to_email . '>, ' . $additionalTo;
                }
            }
            
            // Add CC recipients
            if (!empty($ccEmails)) {
                $ccList = implode(', ', array_filter($ccEmails, function($email) {
                    return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
                }));
                if (!empty($ccList)) {
                    $headers[] = 'Cc: ' . $ccList;
                }
            }
            
            $message = $html_body;
        }
        
        // Send email using PHP's mail function
        $mail_sent = mail($to_email, $subject, $message, implode("\r\n", $headers));
        
        if ($mail_sent) {
            return [
                'success' => true,
                'message' => ($document_type === 'quotation' ? 'Quotation' : ($document_type === 'proforma_invoice' ? 'Proforma invoice' : 'Email')) . ' sent successfully to ' . $to_email
            ];
        } else {
            return [
                'success' => false,
                'message' => 'Failed to send email. Please check your email configuration.'
            ];
        }
    }

    private function sendWithWorkingSMTPPlainText($to_email, $to_name, $subject, $text_body, $pdf_path = null, $toEmails = [], $ccEmails = []) {
        $smtp_host = $this->smtp_host;
        $smtp_port = $this->smtp_port;
        $username = $this->smtp_username;
        $password = $this->smtp_password;
        $from_email = $this->from_email;
        $from_name = $this->from_name;

        // Connect to SMTP server
        $fp = fsockopen($smtp_host, $smtp_port, $errno, $errstr, 30);
        if (!$fp) {
            throw new Exception("Failed to connect to SMTP server: $errstr ($errno)");
        }

        // Function to read multi-line SMTP response
        $readSMTPResponse = function($fp) {
            $response = '';
            while (($line = fgets($fp, 512)) !== false) {
                $response .= $line;
                if (substr($line, 3, 1) === ' ') {
                    break; // Last line of multi-line response
                }
            }
            return $response;
        };

        // Read initial response
        $response = $readSMTPResponse($fp);
        if (substr($response, 0, 3) !== '220') {
            fclose($fp);
            throw new Exception("SMTP server error: $response");
        }

        // Send EHLO
        fwrite($fp, "EHLO localhost\r\n");
        $readSMTPResponse($fp);

        // Start TLS
        fwrite($fp, "STARTTLS\r\n");
        $response = $readSMTPResponse($fp);
        if (substr($response, 0, 3) !== '220') {
            fclose($fp);
            throw new Exception("STARTTLS failed: $response");
        }

        // Enable crypto
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($fp);
            throw new Exception("Failed to enable TLS encryption");
        }

        // Send EHLO again after TLS
        fwrite($fp, "EHLO localhost\r\n");
        $readSMTPResponse($fp);

        // Authenticate
        fwrite($fp, "AUTH LOGIN\r\n");
        $response = $readSMTPResponse($fp);
        if (substr($response, 0, 3) !== '334') {
            fclose($fp);
            throw new Exception("AUTH LOGIN failed: $response");
        }

        fwrite($fp, base64_encode($username) . "\r\n");
        $response = $readSMTPResponse($fp);
        if (substr($response, 0, 3) !== '334') {
            fclose($fp);
            throw new Exception("Username authentication failed: $response");
        }

        fwrite($fp, base64_encode($password) . "\r\n");
        $response = $readSMTPResponse($fp);
        if (substr($response, 0, 3) !== '235') {
            fclose($fp);
            throw new Exception("Password authentication failed: $response");
        }

        fwrite($fp, "MAIL FROM: <$from_email>\r\n");
        $readSMTPResponse($fp);

        // Send to primary recipient
        fwrite($fp, "RCPT TO: <$to_email>\r\n");
        $readSMTPResponse($fp);
        
        // Send to additional TO recipients
        foreach ($toEmails as $email) {
            if (!empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                fwrite($fp, "RCPT TO: <$email>\r\n");
                $readSMTPResponse($fp);
            }
        }
        
        // Send to CC recipients
        foreach ($ccEmails as $email) {
            if (!empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                fwrite($fp, "RCPT TO: <$email>\r\n");
                $readSMTPResponse($fp);
            }
        }

        fwrite($fp, "DATA\r\n");
        $readSMTPResponse($fp);

        // Send email content
        $boundary = md5(uniqid(time()));
        
        $email_data = "From: {$from_name} <{$from_email}>\r\n";
        
        // Build TO recipients list
        $toList = "$to_name <$to_email>";
        if (!empty($toEmails)) {
            $additionalTo = implode(', ', array_filter($toEmails, function($email) {
                return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
            }));
            if (!empty($additionalTo)) {
                $toList .= ", $additionalTo";
            }
        }
        $email_data .= "To: $toList\r\n";
        
        // Add CC recipients
        if (!empty($ccEmails)) {
            $ccList = implode(', ', array_filter($ccEmails, function($email) {
                return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
            }));
            if (!empty($ccList)) {
                $email_data .= "Cc: $ccList\r\n";
            }
        }
        
        $email_data .= "Subject: $subject\r\n";
        $email_data .= "MIME-Version: 1.0\r\n";
        
        if ($pdf_path && file_exists($pdf_path)) {
            // Multipart email with PDF attachment
            $email_data .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";
            $email_data .= "\r\n";
            $email_data .= "--$boundary\r\n";
            $email_data .= "Content-Type: text/plain; charset=UTF-8\r\n";
            $email_data .= "\r\n";
            $email_data .= "$text_body\r\n";
            $email_data .= "\r\n";
            $email_data .= "--$boundary\r\n";
            // Generate PDF filename based on document type
            if ($document_type === 'proforma_invoice') {
                $pdf_filename = ($quotation_no ? 'ProformaInvoice_' . $quotation_no : 'ProformaInvoice_document') . '.pdf';
            } else {
                $pdf_filename = ($quotation_no ? 'Quotation_' . $quotation_no : 'Quotation_document') . '.pdf';
            }
            $email_data .= "Content-Type: application/pdf; name=\"$pdf_filename\"\r\n";
            $email_data .= "Content-Transfer-Encoding: base64\r\n";
            $email_data .= "Content-Disposition: attachment; filename=\"$pdf_filename\"\r\n";
            $email_data .= "\r\n";
            $email_data .= chunk_split(base64_encode(file_get_contents($pdf_path))) . "\r\n";
            $email_data .= "--$boundary--\r\n";
        } else {
            // Simple plain text email without attachment
            $email_data .= "Content-Type: text/plain; charset=UTF-8\r\n";
            $email_data .= "\r\n";
            $email_data .= "$text_body\r\n";
        }
        
        $email_data .= ".\r\n";

        fwrite($fp, $email_data);
        $response = $readSMTPResponse($fp);

        fwrite($fp, "QUIT\r\n");
        $readSMTPResponse($fp);

        fclose($fp);

        if (substr($response, 0, 3) === '250') {
            return [
                'success' => true,
                'message' => ($document_type === 'quotation' ? 'Quotation' : ($document_type === 'proforma_invoice' ? 'Proforma invoice' : 'Email')) . ' sent successfully to ' . $to_email
            ];
        } else {
            throw new Exception("Email sending failed: $response");
        }
    }

    private function sendWithMailFunctionPlainText($to_email, $to_name, $subject, $text_body, $pdf_path = null, $toEmails = [], $ccEmails = []) {
        $boundary = md5(uniqid(time()));
        
        if ($pdf_path && file_exists($pdf_path)) {
            // Multipart email with PDF attachment
            $headers = [
                'MIME-Version: 1.0',
                'From: ' . $this->from_name . ' <' . $this->from_email . '>',
                'Reply-To: ' . $this->from_email,
                'X-Mailer: PHP/' . phpversion(),
                'Content-Type: multipart/mixed; boundary="' . $boundary . '"'
            ];
            
            // Add additional TO recipients
            if (!empty($toEmails)) {
                $additionalTo = implode(', ', array_filter($toEmails, function($email) {
                    return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
                }));
                if (!empty($additionalTo)) {
                    $headers[] = 'To: ' . $to_name . ' <' . $to_email . '>, ' . $additionalTo;
                }
            }
            
            // Add CC recipients
            if (!empty($ccEmails)) {
                $ccList = implode(', ', array_filter($ccEmails, function($email) {
                    return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
                }));
                if (!empty($ccList)) {
                    $headers[] = 'Cc: ' . $ccList;
                }
            }
            
            $message = "--$boundary\r\n";
            $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
            $message .= "\r\n";
            $message .= $text_body . "\r\n";
            $message .= "\r\n";
            $message .= "--$boundary\r\n";
            // Generate PDF filename based on document type
            if ($document_type === 'proforma_invoice') {
                $pdf_filename = ($quotation_no ? 'ProformaInvoice_' . $quotation_no : 'ProformaInvoice_document') . '.pdf';
            } else {
                $pdf_filename = ($quotation_no ? 'Quotation_' . $quotation_no : 'Quotation_document') . '.pdf';
            }
            $message .= "Content-Type: application/pdf; name=\"$pdf_filename\"\r\n";
            $message .= "Content-Transfer-Encoding: base64\r\n";
            $message .= "Content-Disposition: attachment; filename=\"$pdf_filename\"\r\n";
            $message .= "\r\n";
            $message .= chunk_split(base64_encode(file_get_contents($pdf_path))) . "\r\n";
            $message .= "--$boundary--\r\n";
        } else {
            // Simple plain text email without attachment
        $headers = [
            'MIME-Version: 1.0',
                'Content-type: text/plain; charset=UTF-8',
            'From: ' . $this->from_name . ' <' . $this->from_email . '>',
            'Reply-To: ' . $this->from_email,
            'X-Mailer: PHP/' . phpversion()
        ];
            
            // Add additional TO recipients
            if (!empty($toEmails)) {
                $additionalTo = implode(', ', array_filter($toEmails, function($email) {
                    return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
                }));
                if (!empty($additionalTo)) {
                    $headers[] = 'To: ' . $to_name . ' <' . $to_email . '>, ' . $additionalTo;
                }
            }
            
            // Add CC recipients
            if (!empty($ccEmails)) {
                $ccList = implode(', ', array_filter($ccEmails, function($email) {
                    return !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
                }));
                if (!empty($ccList)) {
                    $headers[] = 'Cc: ' . $ccList;
                }
            }
            
            $message = $text_body;
        }
        
        // Send email using PHP's mail function
        $mail_sent = mail($to_email, $subject, $message, implode("\r\n", $headers));
        
        if ($mail_sent) {
            return [
                'success' => true,
                'message' => ($document_type === 'quotation' ? 'Quotation' : ($document_type === 'proforma_invoice' ? 'Proforma invoice' : 'Email')) . ' sent successfully to ' . $to_email
            ];
        } else {
            return [
                'success' => false,
                'message' => 'Failed to send email. Please check your email configuration.'
            ];
        }
    }

    // Send proforma invoice email with custom message
    public function sendProformaInvoiceEmailWithCustomMessage($proformaData, $contactPerson, $company, $billingCompany, $customMessage = '', $loggedUserName = '', $toEmails = [], $ccEmails = [], $sendToCustomer = false) {
        try {
            // Set primary recipient based on checkbox
            if ($sendToCustomer && !empty($contactPerson['contact_email'])) {
                // Checkbox is checked - send to contact person
                $to_email = $contactPerson['contact_email'];
                $to_name = $contactPerson['contact_person'];
            } else {
                // Checkbox is unchecked - don't send to contact person
                // Clean up toEmails array first
                $toEmails = array_unique(array_filter($toEmails));
                
                // Use first email from toEmails array if available
                if (!empty($toEmails) && !empty($toEmails[0])) {
                    $to_email = $toEmails[0];
                    $to_name = 'Recipient';
                } else {
                    // No toEmails provided and checkbox unchecked - return error
                    return [
                        'success' => false,
                        'message' => 'No recipient emails provided when checkbox is unchecked'
                    ];
                }
            }
            
            $subject = "Proforma Invoice " . $proformaData['proforma_invoice']['invoice_no'] . " - " . $company['company_name'];
            
            // If sendToCustomer is true, add contact person email to toEmails array
            if ($sendToCustomer && !empty($contactPerson['contact_email'])) {
                $toEmails[] = $contactPerson['contact_email'];
                $toEmails = array_unique(array_filter($toEmails)); // Remove duplicates and empty values
            }
            
            // Generate custom email body (HTML)
            $html_body = EmailConfig::getProformaInvoiceViewEmailTemplateWithCustomMessage($proformaData, $contactPerson, $company, $billingCompany, $customMessage, $loggedUserName);
            
            // Generate PDF attachment using the detailed template
            $pdf_path = null;
            if ($this->dompdf_available) {
                $pdf_html = EmailConfig::getProformaInvoiceViewEmailTemplateWithBillCompany($proformaData, $contactPerson, $company, $billingCompany);
                $pdf_path = $this->generatePDF($pdf_html, $proformaData['proforma_invoice']['invoice_no'], 'proforma_invoice');
            }
            
            // Send email
            $result = null;
            if ($this->phpmailer_available) {
                $result = $this->sendWithPHPMailer($to_email, $to_name, $subject, $html_body, $pdf_path, $toEmails, $ccEmails, $proformaData['proforma_invoice']['invoice_no'], 'proforma_invoice');
            } else {
                $result = $this->sendWithMailFunction($to_email, $to_name, $subject, $html_body, $pdf_path, $toEmails, $ccEmails, $proformaData['proforma_invoice']['invoice_no'], 'proforma_invoice');
            }
            
            // Add PDF path to result for proforma invoice deletion
            if ($result && isset($result['success'])) {
                $result['pdf_path'] = $pdf_path;
            }
            
            return $result;
        } catch (Exception $e) {
            error_log("Error sending proforma invoice email: " . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Failed to send email. Please check your email configuration.'
            ];
        }
    }

    // Send proforma invoice view email with custom message
    public function sendProformaInvoiceViewEmailWithCustomMessage($proformaData, $contactPerson, $company, $billingCompany, $customMessage = '', $loggedUserName = '', $toEmails = [], $ccEmails = [], $sendToCustomer = false) {
        try {
            // Set primary recipient based on checkbox
            if ($sendToCustomer && !empty($contactPerson['contact_email'])) {
                // Checkbox is checked - send to contact person
                $to_email = $contactPerson['contact_email'];
                $to_name = $contactPerson['contact_person'];
            } else {
                // Checkbox is unchecked - don't send to contact person
                // Clean up toEmails array first
                $toEmails = array_unique(array_filter($toEmails));
                
                // Use first email from toEmails array if available
                if (!empty($toEmails) && !empty($toEmails[0])) {
                    $to_email = $toEmails[0];
                    $to_name = 'Recipient';
                } else {
                    // No toEmails provided and checkbox unchecked - return error
                    return [
                        'success' => false,
                        'message' => 'Recipient email missing. The proforma invoice won’t be sent unless selected.'
                    ];
                }
            }
            
            $subject = "Proforma Invoice " . $proformaData['proforma_invoice']['invoice_no'] . " - " . $company['company_name'];
            
            // If sendToCustomer is true, add contact person email to toEmails array
            if ($sendToCustomer && !empty($contactPerson['contact_email'])) {
                $toEmails[] = $contactPerson['contact_email'];
                $toEmails = array_unique(array_filter($toEmails)); // Remove duplicates and empty values
            }
            
            // Generate custom email body (HTML)
            $html_body = EmailConfig::getProformaInvoiceViewEmailTemplateWithCustomMessage($proformaData, $contactPerson, $company, $billingCompany, $customMessage, $loggedUserName);
            
            // Generate PDF attachment using the detailed template
            $pdf_path = null;
            if ($this->dompdf_available) {
                $pdf_html = EmailConfig::getProformaInvoiceViewEmailTemplateWithBillCompany($proformaData, $contactPerson, $company, $billingCompany);
                $pdf_path = $this->generatePDF($pdf_html, $proformaData['proforma_invoice']['invoice_no'], 'proforma_invoice');
            }
            
            // Send email
            $result = null;
            if ($this->phpmailer_available) {
                $result = $this->sendWithPHPMailer($to_email, $to_name, $subject, $html_body, $pdf_path, $toEmails, $ccEmails, $proformaData['proforma_invoice']['invoice_no'], 'proforma_invoice');
            } else {
                $result = $this->sendWithMailFunction($to_email, $to_name, $subject, $html_body, $pdf_path, $toEmails, $ccEmails, $proformaData['proforma_invoice']['invoice_no'], 'proforma_invoice');
            }
            
            // Add PDF path to result for proforma invoice deletion
            if ($result && isset($result['success'])) {
                $result['pdf_path'] = $pdf_path;
            }
            
            return $result;
        } catch (Exception $e) {
            error_log("Error sending proforma invoice view email: " . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Failed to send email. Please check your email configuration.'
            ];
        }
    }
}
?>
