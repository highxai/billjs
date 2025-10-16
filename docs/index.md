# BillJS Documentation

## Overview

BillJS is a comprehensive TypeScript billing engine designed for invoices, receipts, and point-of-sale systems. It provides robust support for complex billing scenarios including multi-currency, international tax regimes, discounts, charges, and detailed calculation breakdowns.

## Key Features

- **Multi-Currency Support**: Handle multiple currencies with automatic exchange rate conversions
- **Tax Localization**: Built-in presets for major tax regimes (GST, VAT, Sales Tax)
- **Complex Tax Calculations**: Inclusive/exclusive taxes, thresholds, compound taxes
- **Flexible Discounts & Charges**: Item-level and global discounts, configurable charges
- **Developer Experience**: Strong TypeScript types, comprehensive validation, detailed error messages
- **Safe Calculations**: Precision handling and rounding for financial accuracy

## Installation

```bash
npm install billjs
```

## Quick Start

```typescript
import { calculateBill, DiscountKind, ChargeKind } from "billjs";

const result = calculateBill({
  items: [
    {
      name: "Laptop",
      qty: 1,
      unitPrice: 1000,
      discount: { kind: DiscountKind.PERCENT, value: 10 }, // 10% off
    },
    { name: "Mouse", qty: 2, unitPrice: 50 },
  ],
  charges: [
    { name: "Delivery", kind: ChargeKind.FIXED, value: 20 },
    { name: "Service Fee", kind: ChargeKind.PERCENT, value: 2 },
  ],
  taxes: [
    { name: "GST", rate: 18, inclusive: false, applyOn: "netAfterDiscount" },
  ],
  config: {
    billingIdPrefix: "INV",
    decimalPlaces: 2,
    roundOff: true,
    taxPreset: "india", // Use India tax preset
    currency: "USD",
    exchangeRates: { EUR: 0.85 }, // Convert to EUR
  },
});

console.log(result.total);       // → Final total in USD
console.log(result.convertedTotals?.EUR); // → Total in EUR
console.log(result.items);       // → Per-item breakdown
console.log(result.taxes);       // → Applied tax breakdown
console.log(result.formula);     // → Human-readable steps
```

## Concepts

### Items

Each item represents a billable product or service:

```typescript
interface BillItem {
  sku?: string; // Optional SKU
  name: string; // Required item name
  qty: number; // Quantity (must be >= 0)
  unitPrice: number; // Price per unit
  currency?: string; // Currency code (defaults to config.currency)
  taxFree?: boolean; // Exempt from taxes
  discount?: ItemDiscount; // Item-level discount
}
```

### Discounts

Discounts can be applied at item level or globally:

```typescript
// Item-level discount
discount: { kind: DiscountKind.FIXED, value: 50 } // $50 off
discount: { kind: DiscountKind.PERCENT, value: 10 } // 10% off

// Global discount in config
globalDiscount: { kind: DiscountKind.PERCENT, value: 5 }
```

### Charges

Additional fees applied to the bill:

```typescript
charges: [
  { name: "Delivery", kind: ChargeKind.FIXED, value: 20 },
  { name: "Service Fee", kind: ChargeKind.PERCENT, value: 2, applyOn: "subtotal" }
]
```

### Taxes

Flexible tax configuration:

```typescript
taxes: [
  {
    name: "GST",
    rate: 18,
    inclusive: false, // true if price includes tax
    applyOn: "netAfterDiscount", // where to apply
    threshold: 100, // minimum amount
    compound: false // apply on top of other taxes
  }
]
```

### Configuration

```typescript
interface BillingConfig {
  decimalPlaces?: number; // Rounding precision
  roundOff?: boolean; // Final rounding
  globalDiscount?: GlobalDiscount;
  currency?: string; // Base currency
  exchangeRates?: Record<string, number>; // Conversion rates
  taxPreset?: TaxPreset; // Predefined tax regime
}
```

## Advanced Features

### Multi-Currency

```typescript
// Item in different currency
items: [
  { name: "Item", qty: 1, unitPrice: 100, currency: "EUR" }
]

// Config with exchange rates
config: {
  currency: "USD",
  exchangeRates: { EUR: 1.1 } // 1 USD = 1.1 EUR
}

// Result includes conversions
result.convertedTotals // { EUR: 90.91 }
```

### Tax Presets

Use predefined tax configurations:

```typescript
config: { taxPreset: "india" } // CGST 9% + SGST 9%
config: { taxPreset: "eu" }    // VAT 20%
config: { taxPreset: "usa" }   // Sales Tax 8.25%
```

Available presets: `india`, `usa`, `eu`, `uk`, `canada`, `australia`

### Complex Taxes

```typescript
taxes: [
  // Threshold: only apply if base >= 100
  { name: "Tax", rate: 10, threshold: 100 },

  // Compound: apply on base + previous taxes
  { name: "Surcharge", rate: 5, compound: true }
]
```

## Error Handling

BillJS provides detailed validation and error messages:

```typescript
try {
  const result = calculateBill(payload);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.message); // Detailed validation message
    console.log(error.field);   // Specific field that failed
  }
}
```

## API Reference

See [API Documentation](./api.md) for complete type definitions and method signatures.

## Examples

See [Examples](./examples.md) for comprehensive usage examples.

## Contributing

Contributions welcome! Please ensure all tests pass and add tests for new features.

## License

MIT