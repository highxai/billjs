# Examples

## Basic Invoice

```typescript
import { calculateBill } from "billjs";

const result = calculateBill({
  items: [
    { name: "Laptop", qty: 1, unitPrice: 1000 },
    { name: "Mouse", qty: 2, unitPrice: 50 }
  ]
});

console.log(`Total: $${result.total}`); // Total: $1100
```

## With Discounts

```typescript
const result = calculateBill({
  items: [
    {
      name: "Laptop",
      qty: 1,
      unitPrice: 1000,
      discount: { kind: "percentage", value: 10 } // 10% off
    },
    { name: "Mouse", qty: 2, unitPrice: 50 }
  ],
  config: {
    globalDiscount: { kind: "fixed", value: 20 } // $20 off entire bill
  }
});

console.log(`Subtotal: $${result.subtotal}`); // $1100
console.log(`Discounts: $${result.totalItemDiscount + result.globalDiscount}`); // $120
console.log(`Total: $${result.total}`); // $980
```

## With Taxes

```typescript
const result = calculateBill({
  items: [
    { name: "Laptop", qty: 1, unitPrice: 1000 }
  ],
  taxes: [
    { name: "GST", rate: 18, inclusive: false }
  ]
});

console.log(`Tax: $${result.taxes[0].amount}`); // $180
console.log(`Total: $${result.total}`); // $1180
```

## Inclusive Taxes

```typescript
const result = calculateBill({
  items: [
    { name: "Item", qty: 1, unitPrice: 118 } // Price includes tax
  ],
  taxes: [
    { name: "GST", rate: 18, inclusive: true }
  ]
});

console.log(`Tax Extracted: $${result.taxes[0].amount}`); // $18
console.log(`Net Price: $${result.items[0].netPrice}`); // $100
console.log(`Total: $${result.total}`); // $118
```

## Charges

```typescript
const result = calculateBill({
  items: [
    { name: "Item", qty: 1, unitPrice: 100 }
  ],
  charges: [
    { name: "Delivery", kind: "fixed", value: 10 },
    { name: "Service Fee", kind: "percentage", value: 5 }
  ]
});

console.log(`Charges: $${result.charges.reduce((sum, c) => sum + c.amount, 0)}`); // $15
console.log(`Total: $${result.total}`); // $115
```

## Multi-Currency

```typescript
const result = calculateBill({
  items: [
    { name: "Item", qty: 1, unitPrice: 100, currency: "EUR" }
  ],
  config: {
    currency: "USD",
    exchangeRates: { EUR: 1.1 } // 1 USD = 1.1 EUR
  }
});

console.log(`USD Total: $${result.total}`); // $90.91
console.log(`EUR Total: €${result.convertedTotals?.EUR}`); // €100
```

## Tax Presets

```typescript
// India GST
const indiaResult = calculateBill({
  items: [{ name: "Item", qty: 1, unitPrice: 100 }],
  config: { taxPreset: "india" }
});

console.log(indiaResult.taxes); // CGST 9%, SGST 9%

// EU VAT
const euResult = calculateBill({
  items: [{ name: "Item", qty: 1, unitPrice: 100 }],
  config: { taxPreset: "eu" }
});

console.log(euResult.taxes); // VAT 20%
```

## Complex Taxes

```typescript
const result = calculateBill({
  items: [
    { name: "Small Item", qty: 1, unitPrice: 50 }, // Below threshold
    { name: "Large Item", qty: 1, unitPrice: 200 }
  ],
  taxes: [
    { name: "Basic Tax", rate: 10, threshold: 100 }, // Only on large item
    { name: "Surcharge", rate: 5, compound: true } // On base + basic tax
  ]
});

console.log(`Basic Tax: $${result.taxes[0].amount}`); // $20 (10% of 200)
console.log(`Surcharge: $${result.taxes[1].amount}`); // $11 (5% of 220)
console.log(`Total: $${result.total}`); // $281
```

## Error Handling

```typescript
import { ValidationError } from "billjs";

try {
  const result = calculateBill({
    items: [{ name: "", qty: -1, unitPrice: 100 }] // Invalid
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`Validation Error: ${error.message}`);
    console.log(`Field: ${error.field}`);
  }
}
// Output:
// Validation Error: Item 0: name is required and must be a non-empty string
// Field: items[0].name
```

## Custom Tax Rules

```typescript
const result = calculateBill({
  items: [{ name: "Item", qty: 1, unitPrice: 1000 }],
  taxes: [
    {
      name: "Progressive Tax",
      rate: 10,
      applyOn: "taxableBase",
      threshold: 500 // Only on amount over 500
    }
  ]
});

// Note: Threshold implementation applies tax only if total base >= threshold
// For true progressive brackets, combine multiple rules
```

## Full E-commerce Example

```typescript
const order = {
  items: [
    {
      name: "Wireless Headphones",
      sku: "WH-001",
      qty: 1,
      unitPrice: 199.99,
      discount: { kind: "percentage", value: 15 }
    },
    {
      name: "USB Cable",
      sku: "USB-005",
      qty: 2,
      unitPrice: 9.99
    }
  ],
  charges: [
    { name: "Shipping", kind: "fixed", value: 5.99 },
    { name: "Processing Fee", kind: "percentage", value: 2.9 }
  ],
  taxes: [
    { name: "Sales Tax", rate: 8.25, applyOn: "netAfterDiscount" }
  ],
  config: {
    billingIdPrefix: "ORD",
    currency: "USD",
    roundOff: true
  }
};

const result = calculateBill(order);

console.log(`Order ID: ${result.billingId}`);
console.log(`Items: ${result.items.length}`);
console.log(`Subtotal: $${result.subtotal}`);
console.log(`Discounts: $${result.totalItemDiscount}`);
console.log(`Charges: $${result.charges.reduce((sum, c) => sum + c.amount, 0)}`);
console.log(`Taxes: $${result.taxes.reduce((sum, t) => sum + t.amount, 0)}`);
console.log(`Total: $${result.total}`);
console.log(`Formula Steps:`);
result.formula.forEach(step => console.log(`  ${step}`));
```