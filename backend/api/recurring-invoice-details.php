<?php
header('Content-Type: application/json');
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/jwt.php';

function isLastDayOfMonth(DateTime $date) {
    return intval($date->format('d')) === intval($date->format('t'));
}

function getMonthsToAdd(array $serviceRow) {
    $monthTerms = isset($serviceRow['month_terms']) ? intval($serviceRow['month_terms']) : 0;
    if ($monthTerms > 0) {
        return $monthTerms;
    }

    $cycleTerms = isset($serviceRow['cycle_terms']) ? intval($serviceRow['cycle_terms']) : 0;
    if ($cycleTerms > 0) {
        return max(1, intval(round(12 / $cycleTerms)));
    }

    return 0;
}

function calculateNextPeriod(array $serviceRow) {
    $oldToDate = new DateTime($serviceRow['bill_to_date']);
    $nextFromDate = clone $oldToDate;
    $nextFromDate->add(new DateInterval('P1D'));

    $monthsToAdd = getMonthsToAdd($serviceRow);
    if ($monthsToAdd <= 0) {
        return [
            'next_from_date' => $nextFromDate->format('Y-m-d'),
            'next_to_date' => $nextFromDate->format('Y-m-d'),
            'months_to_add' => 0
        ];
    }

    $nextToDate = clone $nextFromDate;
    $nextToDate->add(new DateInterval('P' . $monthsToAdd . 'M'));
    $nextToDate->sub(new DateInterval('P1D'));

    if (isLastDayOfMonth($oldToDate)) {
        $nextToDate->modify('last day of this month');
    }

    return [
        'next_from_date' => $nextFromDate->format('Y-m-d'),
        'next_to_date' => $nextToDate->format('Y-m-d'),
        'months_to_add' => $monthsToAdd
    ];
}

function isOneTimeService(array $serviceRow) {
    $cycleName = strtolower(trim($serviceRow['cycle_name'] ?? ''));
    $monthTerms = isset($serviceRow['month_terms']) ? intval($serviceRow['month_terms']) : 0;
    return $monthTerms <= 0 || strpos($cycleName, 'one time') !== false || strpos($cycleName, 'onetime') !== false;
}

function isYearlyService(array $serviceRow) {
    $cycleName = strtolower(trim($serviceRow['cycle_name'] ?? ''));
    $monthTerms = isset($serviceRow['month_terms']) ? intval($serviceRow['month_terms']) : 0;
    $cycleTerms = isset($serviceRow['cycle_terms']) ? intval($serviceRow['cycle_terms']) : 0;

    if ($monthTerms === 12 || $cycleTerms === 1) {
        return true;
    }

    return strpos($cycleName, 'yearly') !== false && strpos($cycleName, 'half') === false;
}

try {
    $jwt = new JWT();
    $database = new Database();
    $pdo = $database->getConnection();

    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }

    // Get JWT token from header
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']);
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $token = str_replace('Bearer ', '', $_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }

    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'No token provided']);
        exit();
    }

    // Verify token
    $decoded = $jwt->validate($token);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $invoice_id = isset($_GET['invoice_id']) ? intval($_GET['invoice_id']) : null;
        $today = new DateTime(date('Y-m-d'));

        if (!$invoice_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invoice ID is required']);
            exit;
        }

        $baseInvoiceStmt = $pdo->prepare("SELECT sale_order_id FROM proforma_invoices WHERE id = ? LIMIT 1");
        $baseInvoiceStmt->execute([$invoice_id]);
        $baseInvoice = $baseInvoiceStmt->fetch(PDO::FETCH_ASSOC);
        $saleOrderId = intval($baseInvoice['sale_order_id'] ?? 0);
        if ($saleOrderId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid invoice or missing sale order']);
            exit;
        }

        $query = "SELECT 
                    pid.id,
                    pid.p_inv_id,
                    pid.sale_order_detail_id,
                    pid.service_id,
                    pid.service_name,
                    pid.qty,
                    pid.inv_rate,
                    pid.inv_amount,
                    pid.igst,
                    pid.cgst,
                    pid.sgst,
                    pid.igst_amount,
                    pid.cgst_amount,
                    pid.sgst_amount,
                    pid.inv_bill_amount,
                    pid.inv_total_amount,
                    pid.bill_from_date,
                    pid.bill_to_date,
                    pid.bill_followup,
                    pid.bill_cycle_id,
                    pid.status,
                    bc.cycle_name,
                    bc.month_terms,
                    bc.cycle_terms,
                    s.hsn_sac,
                    t.tax_name,
                    pi.invoice_no,
                    pi.sale_order_id,
                    EXISTS(
                        SELECT 1
                        FROM proforma_invoice_details pid2
                        INNER JOIN proforma_invoices pi2 ON pid2.p_inv_id = pi2.id
                        LEFT JOIN bill_cycles bc2 ON pid2.bill_cycle_id = bc2.id
                        WHERE pid2.sale_order_detail_id = pid.sale_order_detail_id
                          AND pid2.status = 'invoiced'
                          AND (bc2.cycle_terms IS NULL OR pid2.bill_followup < bc2.cycle_terms)
                          AND pid2.id > pid.id
                    ) as has_newer_invoiced
                  FROM proforma_invoice_details pid
                  INNER JOIN (
                      SELECT
                        CASE
                          WHEN pidx.sale_order_detail_id IS NULL OR pidx.sale_order_detail_id = 0
                            THEN CONCAT('PID-', pidx.id)
                          ELSE CONCAT('SOD-', pidx.sale_order_detail_id)
                        END as service_stream_key,
                        MAX(pidx.id) as latest_id
                      FROM proforma_invoice_details pidx
                      INNER JOIN proforma_invoices pix ON pidx.p_inv_id = pix.id
                      LEFT JOIN bill_cycles bcx ON pidx.bill_cycle_id = bcx.id
                      WHERE pix.sale_order_id = ?
                        AND pidx.status = 'invoiced'
                        AND (bcx.cycle_terms IS NULL OR pidx.bill_followup < bcx.cycle_terms)
                      GROUP BY service_stream_key
                  ) latest_service ON latest_service.latest_id = pid.id
                  INNER JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
                  LEFT JOIN bill_cycles bc ON pid.bill_cycle_id = bc.id
                  LEFT JOIN services s ON pid.service_id = s.id
                  LEFT JOIN tax t ON pid.tax_id = t.tax_id
                  WHERE pid.status = 'invoiced'
                    AND (bc.cycle_terms IS NULL OR pid.bill_followup < bc.cycle_terms)
                  ORDER BY pid.id ASC";

        $stmt = $pdo->prepare($query);
        $stmt->execute([$saleOrderId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $latestInvoiceStmt = $pdo->prepare("SELECT id, invoice_no
                                            FROM proforma_invoices
                                            WHERE sale_order_id = ? AND is_deleted = 0
                                            ORDER BY id DESC
                                            LIMIT 1");
        $latestInvoiceStmt->execute([$saleOrderId]);
        $latestInvoice = $latestInvoiceStmt->fetch(PDO::FETCH_ASSOC);
        $latestInvoiceId = intval($latestInvoice['id'] ?? 0);
        $latestInvoiceNo = $latestInvoice['invoice_no'] ?? null;

        $latestMonthlyFollowup = 0;
        foreach ($rows as $row) {
            $monthTerms = intval($row['month_terms'] ?? 0);
            if ($monthTerms === 1 && !isOneTimeService($row)) {
                $latestMonthlyFollowup = max($latestMonthlyFollowup, intval($row['bill_followup'] ?? 0));
            }
        }

        $serviceDetails = [];
        foreach ($rows as $row) {
            $period = calculateNextPeriod($row);
            $nextFromDate = DateTime::createFromFormat('Y-m-d', $period['next_from_date']);
            $eligibilityOpenDate = clone $nextFromDate;
            $eligibilityOpenDate->sub(new DateInterval('P30D'));
            $isOneTime = isOneTimeService($row);
            $isYearly = isYearlyService($row);
            $hasNewerInvoiced = intval($row['has_newer_invoiced'] ?? 0) === 1;
            $isEligible = $isOneTime ? false : ($today >= $eligibilityOpenDate);
            if ($isYearly) {
                $isEligible = false;
            }
            $monthlyGateReason = '';
            $monthTerms = intval($row['month_terms'] ?? 0);

            // For quarterly/half-yearly, enable only when monthly followup reached the required month milestone.
            if ($monthTerms > 1 && $monthTerms < 12 && $latestMonthlyFollowup > 0) {
                $requiredMonthlyFollowup = intval($row['bill_followup'] ?? 1) * $monthTerms;
                if ($latestMonthlyFollowup < $requiredMonthlyFollowup) {
                    $isEligible = false;
                    $monthlyGateReason = 'Will enable after monthly followup ' . $requiredMonthlyFollowup . '/12';
                }
            }

            if ($hasNewerInvoiced) {
                $isEligible = false;
            }
            $isDateEditable = $isEligible && !$isYearly;

            $row['next_from_date'] = $period['next_from_date'];
            $row['next_to_date'] = $period['next_to_date'];
            $row['months_to_add'] = $period['months_to_add'];
            $row['eligibility_open_date'] = $eligibilityOpenDate->format('Y-m-d');
            $row['is_eligible'] = $isEligible ? 1 : 0;
            $row['is_one_time'] = $isOneTime ? 1 : 0;
            $row['is_yearly'] = $isYearly ? 1 : 0;
            $row['is_date_editable'] = $isDateEditable ? 1 : 0;
            $row['eligibility_reason'] = $isOneTime
                ? 'One-time service is view-only (not allowed for recurring generation)'
                : ($isYearly
                ? 'Yearly service is view-only (not allowed for recurring generation)'
                : ($hasNewerInvoiced
                ? 'Already billed in newer PI (latest followup only)'
                : (!empty($monthlyGateReason)
                    ? $monthlyGateReason
                : ($isEligible
                    ? 'Eligible (within 30 days before next period start)'
                    : 'Enabled 30 days before next period start'))));

            $serviceDetails[] = $row;
        }

        $previousDetails = [];
        if ($latestInvoiceId > 0) {
            $previousQuery = "SELECT
                                pi.invoice_no,
                                pid.service_name,
                                pid.inv_total_amount
                              FROM proforma_invoice_details pid
                              INNER JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
                              WHERE pi.sale_order_id = ?
                                AND pi.is_deleted = 0
                                AND pi.id <> ?
                              ORDER BY pi.id DESC, pid.id ASC";
            $previousStmt = $pdo->prepare($previousQuery);
            $previousStmt->execute([$saleOrderId, $latestInvoiceId]);
            $previousDetails = $previousStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        echo json_encode([
            'success' => true,
            'data' => $serviceDetails,
            'previous_details' => $previousDetails,
            'meta' => [
                'reference_date' => $today->format('Y-m-d'),
                'latest_invoice_id' => $latestInvoiceId,
                'latest_invoice_no' => $latestInvoiceNo,
                'latest_monthly_followup' => $latestMonthlyFollowup,
                'eligible_count' => count(array_filter($serviceDetails, function($item) { return intval($item['is_eligible']) === 1; })),
                'total_count' => count($serviceDetails)
            ]
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $invoice_id = isset($input['invoice_id']) ? intval($input['invoice_id']) : 0;
        $selected_detail_ids = isset($input['selected_detail_ids']) && is_array($input['selected_detail_ids']) ? $input['selected_detail_ids'] : [];
        $service_close_ids = isset($input['service_close_ids']) && is_array($input['service_close_ids']) ? $input['service_close_ids'] : [];
        $custom_periods = isset($input['custom_periods']) && is_array($input['custom_periods']) ? $input['custom_periods'] : [];
        $inv_date = $input['inv_date'] ?? null;
        $today = new DateTime(date('Y-m-d'));

        if (!$invoice_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invoice ID is required']);
            exit;
        }

        $selectedIds = array_values(array_unique(array_map('intval', $selected_detail_ids)));
        $selectedIds = array_values(array_filter($selectedIds, function($id) { return $id > 0; }));
        $closeIds = array_values(array_unique(array_map('intval', $service_close_ids)));
        $closeIds = array_values(array_filter($closeIds, function($id) { return $id > 0; }));

        if (empty($selectedIds) && empty($closeIds)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Please select at least one service to create or close']);
            exit;
        }

        if (!empty($selectedIds) && (!$inv_date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $inv_date))) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid inv_date format. Please use YYYY-MM-DD']);
            exit;
        }

        $intersection = array_values(array_intersect($selectedIds, $closeIds));
        if (!empty($intersection)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'A service cannot be selected for create and close at the same time']);
            exit;
        }

        $baseInvoiceStmt = $pdo->prepare("SELECT sale_order_id FROM proforma_invoices WHERE id = ? LIMIT 1");
        $baseInvoiceStmt->execute([$invoice_id]);
        $baseInvoice = $baseInvoiceStmt->fetch(PDO::FETCH_ASSOC);
        $saleOrderId = intval($baseInvoice['sale_order_id'] ?? 0);
        if ($saleOrderId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid invoice or missing sale order']);
            exit;
        }

        $selectedDetails = [];
        if (!empty($selectedIds)) {
            $placeholders = implode(',', array_fill(0, count($selectedIds), '?'));
            $detailQuery = "SELECT
                                pid.*,
                                pi.sale_order_id,
                                pi.contact_id,
                                pi.bc_id,
                                bc.cycle_name,
                                bc.month_terms,
                                bc.cycle_terms
                            FROM proforma_invoice_details pid
                            INNER JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
                            LEFT JOIN bill_cycles bc ON pid.bill_cycle_id = bc.id
                            WHERE pi.sale_order_id = ?
                              AND pid.status = 'invoiced'
                              AND pid.id IN ($placeholders)
                            ORDER BY pid.id ASC";
            $detailParams = array_merge([$saleOrderId], $selectedIds);
            $detailStmt = $pdo->prepare($detailQuery);
            $detailStmt->execute($detailParams);
            $selectedDetails = $detailStmt->fetchAll(PDO::FETCH_ASSOC);

            if (count($selectedDetails) !== count($selectedIds)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Some selected services are invalid or not invoice-ready']);
                exit;
            }
        }

        $closeDetails = [];
        if (!empty($closeIds)) {
            $closePlaceholders = implode(',', array_fill(0, count($closeIds), '?'));
            $closeQuery = "SELECT pid.id
                           FROM proforma_invoice_details pid
                           INNER JOIN proforma_invoices pi ON pid.p_inv_id = pi.id
                           WHERE pi.sale_order_id = ?
                             AND pid.status = 'invoiced'
                             AND pid.id IN ($closePlaceholders)";
            $closeParams = array_merge([$saleOrderId], $closeIds);
            $closeStmt = $pdo->prepare($closeQuery);
            $closeStmt->execute($closeParams);
            $closeDetails = $closeStmt->fetchAll(PDO::FETCH_ASSOC);

            if (count($closeDetails) !== count($closeIds)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Some close services are invalid or not invoice-ready']);
                exit;
            }
        }

        $pdo->beginTransaction();
        try {
            $closedCount = 0;
            if (!empty($closeDetails)) {
                $closeUpdateStmt = $pdo->prepare("UPDATE proforma_invoice_details SET status = 'closed' WHERE id = ?");
                foreach ($closeDetails as $closeDetail) {
                    $closeUpdateStmt->execute([intval($closeDetail['id'])]);
                    $closedCount++;
                }
            }

            if (empty($selectedDetails)) {
                $pdo->commit();
                echo json_encode([
                    'success' => true,
                    'message' => 'Service close updated successfully',
                    'data' => [
                        'closed_count' => $closedCount
                    ]
                ]);
                exit;
            }

            // If any selected service already reached followup limit, mark it completed and stop creation.
            $alreadyCompletedIds = [];
            foreach ($selectedDetails as $detail) {
                $cycleTerms = intval($detail['cycle_terms'] ?? 0);
                $followup = intval($detail['bill_followup'] ?? 0);
                if ($cycleTerms > 0 && $followup >= $cycleTerms) {
                    $alreadyCompletedIds[] = intval($detail['id']);
                }
            }
            if (!empty($alreadyCompletedIds)) {
                $completeStmt = $pdo->prepare("UPDATE proforma_invoice_details SET status = 'completed' WHERE id = ?");
                foreach ($alreadyCompletedIds as $completedId) {
                    $completeStmt->execute([$completedId]);
                }
                throw new Exception('Some selected services already reached cycle terms and were marked completed. Please refresh and try again.');
            }

            $first = $selectedDetails[0];
            $bcStmt = $pdo->prepare("SELECT bc_prefix FROM bill_company WHERE bc_id = ?");
            $bcStmt->execute([$first['bc_id']]);
            $bcPrefix = $bcStmt->fetch(PDO::FETCH_ASSOC)['bc_prefix'] ?? 'XX';

            $currentYear = date('Y');
            $invoiceNumberQuery = "SELECT MAX(CAST(SUBSTRING(invoice_no, LENGTH('PI-{$bcPrefix}-{$currentYear}-') + 1) AS UNSIGNED)) as max_num
                                  FROM proforma_invoices
                                  WHERE invoice_no LIKE 'PI-{$bcPrefix}-{$currentYear}-%'";
            $invoiceNumberStmt = $pdo->prepare($invoiceNumberQuery);
            $invoiceNumberStmt->execute();
            $nextNum = intval($invoiceNumberStmt->fetch(PDO::FETCH_ASSOC)['max_num'] ?? 0) + 1;
            $newInvoiceNumber = 'PI-' . $bcPrefix . '-' . $currentYear . '-' . str_pad($nextNum, 3, '0', STR_PAD_LEFT);

            $subTotal = 0.0;
            $grandTotal = 0.0;
            foreach ($selectedDetails as $detail) {
                $subTotal += floatval($detail['inv_bill_amount']);
                $grandTotal += floatval($detail['inv_total_amount']);
            }

            $newInvStmt = $pdo->prepare("INSERT INTO proforma_invoices
                (sale_order_id, contact_id, bc_id, invoice_no, inv_date, inv_sub_total, inv_grand_total, created_by, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $newInvStmt->execute([
                $first['sale_order_id'],
                $first['contact_id'],
                $first['bc_id'],
                $newInvoiceNumber,
                $inv_date,
                $subTotal,
                $grandTotal,
                $decoded['user_id'],
                'active'
            ]);
            $newInvoiceId = $pdo->lastInsertId();

            $insertDetailStmt = $pdo->prepare("INSERT INTO proforma_invoice_details
                (p_inv_id, sale_order_detail_id, service_id, service_name, qty, inv_rate, inv_amount,
                 tax_id, igst, cgst, sgst, igst_amount, cgst_amount, sgst_amount,
                 inv_bill_amount, inv_total_amount, bill_cycle_id, bill_from_date, bill_to_date, bill_followup, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            $updateOldStmt = $pdo->prepare("UPDATE proforma_invoice_details SET status = 'followed' WHERE id = ?");

            foreach ($selectedDetails as $detail) {
                $period = calculateNextPeriod($detail);
                $detailIdKey = strval($detail['id']);
                $isYearly = isYearlyService($detail);
                $isOneTime = isOneTimeService($detail);
                if ($isYearly) {
                    throw new Exception('Yearly services cannot be generated as recurring invoices');
                }
                if ($isOneTime) {
                    throw new Exception('One-time services cannot be generated as recurring invoices');
                }
                $newerCheckStmt = $pdo->prepare("SELECT EXISTS(
                    SELECT 1 FROM proforma_invoice_details pid2
                    LEFT JOIN bill_cycles bc2 ON pid2.bill_cycle_id = bc2.id
                    WHERE pid2.sale_order_detail_id = ?
                      AND pid2.status = 'invoiced'
                      AND (bc2.cycle_terms IS NULL OR pid2.bill_followup < bc2.cycle_terms)
                      AND pid2.id > ?
                ) as has_newer");
                $newerCheckStmt->execute([$detail['sale_order_detail_id'], $detail['id']]);
                $hasNewerInvoiced = intval($newerCheckStmt->fetch(PDO::FETCH_ASSOC)['has_newer'] ?? 0) === 1;
                if ($hasNewerInvoiced) {
                    throw new Exception('Selected service already billed in a newer proforma invoice');
                }
                $nextFromDate = DateTime::createFromFormat('Y-m-d', $period['next_from_date']);
                $eligibilityOpenDate = clone $nextFromDate;
                $eligibilityOpenDate->sub(new DateInterval('P30D'));
                $isEligible = $isOneTime ? false : ($today >= $eligibilityOpenDate);
                $isDateEditable = $isEligible && !$isYearly;

                if ($isDateEditable && isset($custom_periods[$detailIdKey]) && is_array($custom_periods[$detailIdKey])) {
                    $customFrom = $custom_periods[$detailIdKey]['next_from_date'] ?? null;
                    $customTo = $custom_periods[$detailIdKey]['next_to_date'] ?? null;

                    if ($customFrom && $customTo) {
                        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $customFrom) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $customTo)) {
                            throw new Exception('Invalid custom period date format for service ID ' . $detail['id']);
                        }
                        $fromDateObj = DateTime::createFromFormat('Y-m-d', $customFrom);
                        $toDateObj = DateTime::createFromFormat('Y-m-d', $customTo);
                        if (!$fromDateObj || !$toDateObj || $toDateObj < $fromDateObj) {
                            throw new Exception('Invalid custom period range for service ID ' . $detail['id']);
                        }
                        $period['next_from_date'] = $customFrom;
                        $period['next_to_date'] = $customTo;
                    }
                }

                $newFollowup = intval($detail['bill_followup'] ?? 1) + 1;
                $cycleTerms = intval($detail['cycle_terms'] ?? 0);
                $newStatus = ($cycleTerms > 0 && $newFollowup >= $cycleTerms) ? 'completed' : 'invoiced';

                $insertDetailStmt->execute([
                    $newInvoiceId,
                    $detail['sale_order_detail_id'],
                    $detail['service_id'],
                    $detail['service_name'],
                    $detail['qty'],
                    $detail['inv_rate'],
                    $detail['inv_amount'],
                    $detail['tax_id'],
                    $detail['igst'],
                    $detail['cgst'],
                    $detail['sgst'],
                    $detail['igst_amount'],
                    $detail['cgst_amount'],
                    $detail['sgst_amount'],
                    $detail['inv_bill_amount'],
                    $detail['inv_total_amount'],
                    $detail['bill_cycle_id'],
                    $period['next_from_date'],
                    $period['next_to_date'],
                    $newFollowup,
                    $newStatus
                ]);

                $updateOldStmt->execute([$detail['id']]);
            }

            $pdo->commit();

            echo json_encode([
                'success' => true,
                'message' => 'Recurring proforma invoice created successfully',
                'data' => [
                    'new_invoice_id' => $newInvoiceId,
                    'new_invoice_number' => $newInvoiceNumber,
                    'service_count' => count($selectedDetails),
                    'closed_count' => $closedCount,
                    'sub_total' => $subTotal,
                    'grand_total' => $grandTotal
                ]
            ]);
            exit;
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            exit;
        }
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
}
?>
