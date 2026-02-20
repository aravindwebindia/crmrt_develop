# Billing Completion Logic

## Overview
This document explains the billing completion logic implemented for proforma invoices with recurring billing cycles.

## How It Works

### 1. Billing Cycle Terms
- **Quarterly**: `cycle_terms = 4` (4 payments per year)
- **Half-yearly**: `cycle_terms = 2` (2 payments per year)  
- **Monthly**: `cycle_terms = 12` (12 payments per year)
- **Yearly**: `cycle_terms = 1` (1 payment per year)

### 2. Bill Follow-up Tracking
- Each proforma invoice detail has a `bill_followup` column that tracks the current follow-up number
- Starts at `bill_followup = 1` for the first payment
- Increments by 1 for each subsequent follow-up

### 3. Completion Logic
When creating the next bill follow-up (`create-next-bill-followup.php`):

1. **Check Completion**: Compare `new_bill_followup` with `cycle_terms`
   - If `new_bill_followup >= cycle_terms` → Mark as `completed`
   - If `new_bill_followup < cycle_terms` → Mark as `active`

2. **Status Updates**:
   - `active`: Billing cycle is ongoing
   - `followed`: Previous follow-up has been processed
   - `completed`: Final follow-up reached, billing cycle complete

### 4. Example: Quarterly Payment (cycle_terms = 4)

| Follow-up | bill_followup | Status | Description |
|-----------|---------------|--------|-------------|
| 1st       | 1             | active | First quarterly payment |
| 2nd       | 2             | active | Second quarterly payment |
| 3rd       | 3             | active | Third quarterly payment |
| 4th       | 4             | completed | Final quarterly payment - Billing cycle complete |

### 5. API Response Changes

#### create-next-bill-followup.php
```json
{
  "success": true,
  "message": "Final bill followup created successfully and billing cycle completed",
  "data": {
    "new_invoice_id": 123,
    "new_invoice_number": "PI-0001",
    "new_bill_followup": 4,
    "cycle_terms": 4,
    "is_final_followup": true,
    "status": "completed",
    "old_detail_id": 456,
    "old_status_updated": "followed"
  }
}
```

#### check-bill-followup-count.php
```json
{
  "success": true,
  "data": {
    "service_info": {
      "cycle_name": "Quarterly",
      "cycle_terms": 4,
      "current_followup": 4
    },
    "followup_summary": {
      "total_followups": 4,
      "max_followup_number": 4,
      "is_complete": true,
      "has_completed_followup": true,
      "remaining_followups": 0,
      "completion_percentage": 100.0
    },
    "all_followups": [
      {
        "invoice_no": "PI-0001",
        "bill_followup": 1,
        "status": "followed"
      },
      {
        "invoice_no": "PI-0002", 
        "bill_followup": 2,
        "status": "followed"
      },
      {
        "invoice_no": "PI-0003",
        "bill_followup": 3, 
        "status": "followed"
      },
      {
        "invoice_no": "PI-0004",
        "bill_followup": 4,
        "status": "completed"
      }
    ]
  }
}
```

## Database Schema
The `proforma_invoice_details` table now includes:
- `status` VARCHAR(20) DEFAULT 'active'
- `bill_followup` INT - tracks current follow-up number

## Testing
To test the billing completion logic:
1. Create a sale order with quarterly billing (cycle_terms = 4)
2. Generate proforma invoice (bill_followup = 1, status = 'active')
3. Create next bill follow-up 3 times
4. On the 4th follow-up, status should be 'completed'

