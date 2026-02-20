# Sale Order Overall Amounts

## Overview
This document explains the new overall amount columns added to the `sale_orders` table and how they are calculated.

## New Columns Added

### `overall_amt` (DECIMAL(15,2))
- **Description**: Sum of all service amounts from quotation services
- **Calculation**: `SUM(amount)` from quotation_services table
- **Purpose**: Total service amount before tax

### `overall_gst` (DECIMAL(15,2))
- **Description**: Sum of all IGST amounts from quotation services
- **Calculation**: `SUM(igst_amount)` from frontend
- **Purpose**: Total IGST amount across all services

### `overall_total_amt` (DECIMAL(15,2))
- **Description**: Sum of all total amounts from quotation services
- **Calculation**: `SUM(total_amount)` from quotation_services table
- **Purpose**: Total amount including tax

## Formula
```
overall_amt + overall_gst = overall_total_amt
```

## Implementation Details

### Sale Order Creation API (`create-sale-order.php`)

1. **Calculation Process**:
   ```php
   $overall_amt = 0;
   $overall_gst = 0;
   $overall_total_amt = 0;
   
   foreach ($input['services'] as $service) {
       $overall_amt += $service['amount'] ?? 0;
       $overall_gst += $service['igst_amount'] ?? 0; // igst_amount from frontend
       $overall_total_amt += $service['total_amount'] ?? 0;
   }
   ```

2. **Database Insert**:
   ```sql
   INSERT INTO sale_orders (
       saleorder_no, 
       contact_id, 
       quotation_id, 
       bc_id, 
       sub_total, 
       grand_total, 
       overall_amt,        -- NEW
       overall_gst,        -- NEW
       overall_total_amt,  -- NEW
       date, 
       created_by, 
       is_invoiced, 
       status, 
       created_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
   ```

3. **Proforma Invoice Integration**:
   - Uses `overall_amt` as `inv_sub_total`
   - Uses `overall_total_amt` as `inv_grand_total`

### API Response
The API now returns overall amounts in the response:
```json
{
  "success": true,
  "message": "Sale order created successfully",
  "sale_order_id": 123,
  "saleorder_no": "SO-0001",
  "overall_amounts": {
    "overall_amt": 10000.00,
    "overall_gst": 1800.00,
    "overall_total_amt": 11800.00
  }
}
```

## Database Schema

### Table: `sale_orders`
```sql
ALTER TABLE sale_orders 
ADD COLUMN overall_amt DECIMAL(15,2) DEFAULT 0.00;

ALTER TABLE sale_orders 
ADD COLUMN overall_gst DECIMAL(15,2) DEFAULT 0.00;

ALTER TABLE sale_orders 
ADD COLUMN overall_total_amt DECIMAL(15,2) DEFAULT 0.00;
```

### Indexes
```sql
CREATE INDEX idx_sale_orders_overall_amt ON sale_orders(overall_amt);
CREATE INDEX idx_sale_orders_overall_gst ON sale_orders(overall_gst);
CREATE INDEX idx_sale_orders_overall_total_amt ON sale_orders(overall_total_amt);
```

## Benefits

1. **Accurate Totals**: Ensures overall amounts match the sum of individual service amounts
2. **Data Integrity**: Prevents discrepancies between service totals and order totals
3. **Performance**: Pre-calculated values reduce need for complex aggregations
4. **Audit Trail**: Clear separation between service-level and order-level amounts
5. **Reporting**: Easier to generate reports with accurate overall amounts

## Migration

To add these columns to existing databases, run:
```bash
mysql -u username -p database_name < backend/sql/add_overall_amounts_to_sale_orders.sql
```

## Example

### Input Services:
- Service 1: amount=5000, tax_amount=900 (IGST), total_amount=5900
- Service 2: amount=3000, tax_amount=540 (IGST), total_amount=3540

### Calculated Overall Amounts:
- `overall_amt` = 5000 + 3000 = 8000.00
- `overall_gst` = 900 + 540 = 1440.00 (IGST only)
- `overall_total_amt` = 5900 + 3540 = 9440.00

### Verification:
8000.00 + 1440.00 = 9440.00 ✅
