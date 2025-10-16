# API Reference

## Core Functions

### `calculateBill(payload: CalculateBillPayload): BillingResult`

Calculates the total bill with all components.

#### Parameters

```typescript
interface CalculateBillPayload {
  billingId?: string | null;
  config?: BillingConfig | null;
  items: BillItem[];
  charges?: Charge[] | null;
  taxes?: TaxRule[] | null;
  meta?: Record<string, any>;
}
```

#### Returns

```typescript
interface BillingResult {
  billingId: string;
  timestamp: string;
  currency: string;
  subtotal: Decimal;
  totalItemDiscount: Decimal;
  globalDiscount: Decimal;
  taxableBase: Decimal;
  charges: ChargeBreakdown[];
  taxes: TaxBreakdown[];
  roundOff: Decimal;
  total: Decimal;
  convertedTotals?: Record<string, Decimal>;
  items: ItemBreakdown[];
  formula: string[];
  meta?: Record<string, any>;
}
```

## Types

### Enums

```typescript
enum DiscountKind {
  FIXED = "fixed",
  PERCENT = "percentage"
}

enum ChargeKind {
  FIXED = "fixed",
  PERCENT = "percentage"
}
```

### Interfaces

#### BillItem

```typescript
interface BillItem {
  sku?: string;
  name: string;
  qty: number;
  unitPrice: number;
  currency?: string;
  taxFree?: boolean;
  discount?: ItemDiscount;
}
```

#### ItemDiscount

```typescript
type ItemDiscount =
  | { kind: DiscountKind.FIXED; value: number }
  | { kind: DiscountKind.PERCENT; value: number };
```

#### GlobalDiscount

```typescript
type GlobalDiscount =
  | { kind: DiscountKind.FIXED; value: number }
  | { kind: DiscountKind.PERCENT; value: number }
  | null;
```

#### Charge

```typescript
interface Charge {
  name: string;
  kind: ChargeKind;
  value: number;
  applyOn?: "subtotal" | "taxableBase" | "netAfterDiscount";
}
```

#### TaxRule

```typescript
interface TaxRule {
  name: string;
  rate: number;
  inclusive?: boolean;
  applyOn?: "taxableBase" | "subtotal" | "charges" | "netAfterDiscount";
  enabled?: boolean;
  threshold?: number;
  compound?: boolean;
}
```

#### BillingConfig

```typescript
interface BillingConfig {
  decimalPlaces?: number;
  roundOff?: boolean;
  globalDiscount?: GlobalDiscount;
  decimalInternalPrecision?: number;
  billingIdPrefix?: string;
  currency?: string;
  exchangeRates?: Record<string, number>;
  taxPreset?: TaxPreset;
}
```

#### ItemBreakdown

```typescript
interface ItemBreakdown {
  index: number;
  sku?: string;
  name: string;
  qty: number;
  unitPrice: Decimal;
  basePrice: Decimal;
  itemDiscount: Decimal;
  netPrice: Decimal;
  taxableAmount: Decimal;
  taxesApplied: { name: string; amount: Decimal; formula: string }[];
  total: Decimal;
  formula: string;
}
```

#### ChargeBreakdown

```typescript
interface ChargeBreakdown {
  name: string;
  kind: ChargeKind;
  value: number;
  applyOn: string;
  amount: Decimal;
  formula: string;
}
```

#### TaxBreakdown

```typescript
interface TaxBreakdown {
  name: string;
  rate: number;
  inclusive: boolean;
  applyOn: string;
  amount: Decimal;
  formula: string;
}
```

## Tax Presets

```typescript
type TaxPreset = keyof typeof taxPresets;

const taxPresets: Record<string, TaxRule[]> = {
  india: [/* CGST + SGST */],
  usa: [/* Sales Tax */],
  eu: [/* VAT */],
  uk: [/* VAT */],
  canada: [/* GST + PST */],
  australia: [/* GST */]
};
```

## Error Classes

```typescript
class BillingError extends Error {
  constructor(message: string, public code?: string);
}

class ValidationError extends BillingError {
  constructor(message: string, public field?: string);
}

class CalculationError extends BillingError {
  constructor(message: string);
}
```

## Types

```typescript
type Decimal = number;
type TaxPreset = "india" | "usa" | "eu" | "uk" | "canada" | "australia";
```