# API Reference

## Core Functions

### `createBill(config: BillConfig): BillContext`

Creates a new bill context with the specified configuration.

#### Parameters

```typescript
interface BillConfig {
  currency: string;
  exchangeRate?: number;
  decimalPlaces?: number;
  roundOff?: boolean;
}
```

#### Returns

```typescript
interface BillContext {
  items: BillItem[];
  discounts: Discount[];
  taxes: TaxRule[];
  config: BillConfig;
  plugins: BillPlugin[];
  meta: Record<string, any>;
}
```

### `addItem(bill: BillContext, item: BillItem): BillContext`

Adds an item to the bill immutably.

#### Parameters

- `bill`: The current bill context
- `item`: The item to add

```typescript
interface BillItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  addons?: BillItem[];
  variations?: BillItem[];
  discounts?: Discount[];
}
```

### `addGlobalDiscount(bill: BillContext, discount: Discount): BillContext`

Adds a global discount to the bill.

#### Parameters

- `bill`: The current bill context
- `discount`: The discount to add

```typescript
interface Discount {
  id: string;
  type: "PERCENT" | "FIXED" | "TIERED";
  value?: number;
  tiers?: { minSubtotal: number; rate: number }[];
}
```

### `addTaxRule(bill: BillContext, tax: TaxRule): BillContext`

Adds a tax rule to the bill.

#### Parameters

- `bill`: The current bill context
- `tax`: The tax rule to add

```typescript
interface TaxRule {
  name: string;
  rate: number;
  applyOn?: "subtotal" | "taxableBase";
  inclusive?: boolean;
  compound?: boolean;
}
```

### `usePlugin(bill: BillContext, plugin: BillPlugin | BillPlugin[]): BillContext`

Adds one or more plugins to the bill.

#### Parameters

- `bill`: The current bill context
- `plugin`: The plugin(s) to add

```typescript
interface BillPlugin {
  name: string;
  version?: string;
  setup?: (bill: BillContext) => BillContext;
  transform?: (
    phase: "beforeCalc" | "afterCalc",
    bill: BillContext
  ) => BillContext;
}
```

### `setMeta(bill: BillContext, key: string, value: any): BillContext`

Sets metadata on the bill.

#### Parameters

- `bill`: The current bill context
- `key`: The metadata key
- `value`: The metadata value

### `calculateTotal(bill: BillContext): BillResult`

Calculates the total bill and returns the result.

#### Parameters

- `bill`: The bill context to calculate

#### Returns

```typescript
interface BillResult {
  subtotal: number;
  discounts: number;
  taxes: number;
  total: number;
  breakdown: {
    items: Array<{ id: string; name: string; total: number }>;
    taxBreakdown: Array<{
      name: string;
      rate: number;
      inclusive?: boolean;
      amount: number;
    }>;
    discountBreakdown?: Array<{
      id: string;
      type: string;
      amount: number;
    }>;
  };
  meta: Record<string, any>;
}
```

### `pipe<T>(initial: T, ...fns: Array<(arg: any) => any>): any`

Utility function for chaining operations.

#### Parameters

- `initial`: The initial value
- `...fns`: Functions to apply in sequence

## Plugins

### `loyaltyPointsPlugin(opts: { rate: number }): BillPlugin`

Plugin that adds loyalty points based on total.

#### Parameters

```typescript
{ rate: number } // Points per dollar spent
```

### `regionTaxPlugin(opts: { region: string; vatRates: Record<string, number> }): BillPlugin`

Plugin that applies regional VAT taxes.

#### Parameters

```typescript
{
  region: string; // Region code
  vatRates: Record<string, number>; // VAT rates by region
}
```

### `promoPlugin(opts: { code: string; validate: (code: string, bill: BillContext) => boolean; discount: Discount }): BillPlugin`

Plugin that applies promo code discounts.

#### Parameters

```typescript
{
  code: string; // Promo code
  validate: (code: string, bill: BillContext) => boolean; // Validation function
  discount: Discount; // Discount to apply
}
```

## Types

All types are fully typed with TypeScript for type safety.