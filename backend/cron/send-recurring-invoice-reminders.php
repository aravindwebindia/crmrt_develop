<?php
/**
 * Daily reminder cron for recurring/proforma invoices approaching or past their due date.
 *
 * Intended to run once a day via Windows Task Scheduler (or any external scheduler),
 * e.g.:
 *   php.exe C:\laragon\www\crmrt_live2\backend\cron\send-recurring-invoice-reminders.php
 *
 * This is an internal-only alert: emails go to the admin address(es) configured in
 * the "recurring_invoice_reminder_settings" table (see reminder-settings.php / the
 * Settings page), never to the customer.
 *
 * Reminder window: starting `days_before_due` days before an invoice's due date,
 * one reminder per invoice per calendar day, continuing indefinitely into overdue
 * days once the due date has passed. An invoice stops being reminded once it is
 * tax-invoiced (finalized) or deleted.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "This script can only be run from the command line.\n";
    exit(1);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/EmailService.php';

function reminder_log($message) {
    echo '[' . date('Y-m-d H:i:s') . '] ' . $message . "\n";
}

try {
    $database = new Database();
    $pdo = $database->getConnection();
    if (!$pdo) {
        reminder_log('ERROR: Database connection failed');
        exit(1);
    }

    $settingsStmt = $pdo->prepare("SELECT * FROM recurring_invoice_reminder_settings WHERE id = 1");
    $settingsStmt->execute();
    $settings = $settingsStmt->fetch(PDO::FETCH_ASSOC);

    if (!$settings || intval($settings['is_active']) !== 1) {
        reminder_log('Reminders are disabled in admin settings. Nothing to do.');
        exit(0);
    }

    $daysBeforeDue = intval($settings['days_before_due']);
    $adminEmails = array_values(array_filter(array_map('trim', explode(',', $settings['admin_emails'] ?? ''))));

    if (empty($adminEmails)) {
        reminder_log('No admin email(s) configured. Nothing to do.');
        exit(0);
    }

    $today = date('Y-m-d');

    // One row per proforma invoice that still needs to be tax-invoiced, with its
    // due date derived from the latest billing period it covers (the same
    // bill_to_date + 1 day convention already used elsewhere for "next due date").
    $query = "SELECT
                pi.id as proforma_invoice_id,
                pi.invoice_no,
                pi.sale_order_id,
                pi.inv_grand_total,
                c.company as company_name,
                DATE_ADD(MAX(pid.bill_to_date), INTERVAL 1 DAY) as due_date
              FROM proforma_invoices pi
              INNER JOIN proforma_invoice_details pid ON pid.p_inv_id = pi.id
              LEFT JOIN sale_orders so ON pi.sale_order_id = so.id
              LEFT JOIN contacts c ON so.contact_id = c.ld_id
              WHERE pi.is_deleted = 0
                AND (pi.tax_invoice_no IS NULL OR pi.tax_invoice_no = '')
              GROUP BY pi.id, pi.invoice_no, pi.sale_order_id, pi.inv_grand_total, c.company
              HAVING DATEDIFF(due_date, ?) <= ?";

    $stmt = $pdo->prepare($query);
    $stmt->execute([$today, $daysBeforeDue]);
    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    reminder_log("Found " . count($candidates) . " invoice(s) within the reminder window (days_before_due={$daysBeforeDue}).");

    $emailService = new EmailService();
    $sentCount = 0;
    $skippedCount = 0;

    foreach ($candidates as $row) {
        $proformaInvoiceId = intval($row['proforma_invoice_id']);
        $dueDate = $row['due_date'];
        $daysOffset = (int) round((strtotime($dueDate) - strtotime($today)) / 86400);

        // Skip if a reminder was already sent for this invoice today.
        $checkStmt = $pdo->prepare("SELECT id FROM recurring_invoice_reminder_log WHERE proforma_invoice_id = ? AND sent_date = ?");
        $checkStmt->execute([$proformaInvoiceId, $today]);
        if ($checkStmt->fetch()) {
            $skippedCount++;
            continue;
        }

        if ($daysOffset > 0) {
            $statusPhrase = "is due in {$daysOffset} day(s)";
        } elseif ($daysOffset === 0) {
            $statusPhrase = "is due today";
        } else {
            $statusPhrase = "is overdue by " . abs($daysOffset) . " day(s)";
        }

        $companyName = $row['company_name'] ?: 'Unknown Company';
        $subject = "[Internal] Invoice {$row['invoice_no']} {$statusPhrase} - {$companyName}";
        $body = "Invoice: {$row['invoice_no']}\n"
              . "Company: {$companyName}\n"
              . "Amount: " . number_format((float)$row['inv_grand_total'], 2) . "\n"
              . "Due Date: {$dueDate}\n"
              . "Status: " . ucfirst($statusPhrase) . "\n\n"
              . "This is an automated internal reminder. No email has been sent to the customer.";

        $result = $emailService->sendRecurringInvoiceReminderEmail($adminEmails, $subject, $body);

        $logStmt = $pdo->prepare("INSERT INTO recurring_invoice_reminder_log
            (proforma_invoice_id, sale_order_id, due_date, days_offset, sent_date, email_to, status, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $logStmt->execute([
            $proformaInvoiceId,
            $row['sale_order_id'],
            $dueDate,
            $daysOffset,
            $today,
            implode(', ', $adminEmails),
            $result['success'] ? 'sent' : 'failed',
            $result['success'] ? null : ($result['message'] ?? 'Unknown error')
        ]);

        if ($result['success']) {
            $sentCount++;
            reminder_log("Sent reminder for {$row['invoice_no']} ({$statusPhrase}).");
        } else {
            reminder_log("FAILED reminder for {$row['invoice_no']}: " . ($result['message'] ?? 'Unknown error'));
        }
    }

    reminder_log("Done. Sent: {$sentCount}, already sent today (skipped): {$skippedCount}.");
    exit(0);

} catch (Exception $e) {
    reminder_log('ERROR: ' . $e->getMessage());
    exit(1);
}
