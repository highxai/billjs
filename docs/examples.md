# Examples

## Basic Invoice

```typescript
import { createBill, addItem, calculateTotal, pipe } from "billjs";
```

## With Discounts

```typescript
const result = pipe(
  createBill({ currency: "USD" }),
  (bill) => addItem(bill, {
    id: "laptop",
    name: "Laptop",
    qty: 1,
    unitPrice: 1000,
    discounts: [{ id: "promo", type: "PERCENT", value: 10 }] // 10% off
  }),
  (bill) => addItem(bill, { id: "mouse", name: "Mouse", qty: 2, unitPrice: 50 }),
  (bill) => addGlobalDiscount(bill, { id: "bulk", type: "FIXED", value: 20 }), // $20 off entire bill
  calculateTotal
);

console.log(`Subtotal: $${result.subtotal}`); // $1100
console.log(`Discounts: $${result.discounts}`); // $120
console.log(`Total: $${result.total}`); // $980
```

## With Taxes

```typescript
const result = pipe(
  createBill({ currency: "USD" }),
  (bill) => addItem(bill, { id: "laptop", name: "Laptop", qty: 1, unitPrice: 1000 }),
  (bill) => addTaxRule(bill, { name: "GST", rate: 18 }),
  calculateTotal
);

console.log(`Tax: $${result.taxes}`); // $180
console.log(`Total: $${result.total}`); // $1180
```

## Inclusive Taxes

```typescript
const result = pipe(
  createBill({ currency: "USD" }),
  (bill) => addItem(bill, { id: "item", name: "Item", qty: 1, unitPrice: 118 }), // Price includes tax
  (bill) => addTaxRule(bill, { name: "GST", rate: 18, inclusive: true }),
  calculateTotal
);

console.log(`Tax Extracted: $${result.taxes}`); // $18
console.log(`Subtotal (net): $${result.subtotal}`); // $100
console.log(`Total: $${result.total}`); // $118
```

## Addons and Variations

```typescript
const result = pipe(
  createBill({ currency: "USD" }),
  (bill) => addItem(bill, {
    id: "pizza",
    name: "Pizza",
    qty: 2,
    unitPrice: 10,
    addons: [
      { id: "cheese", name: "Extra Cheese", qty: 1, unitPrice: 2 }
    ],
    variations: [
      { id: "size", name: "Large", qty: 1, unitPrice: 3 }
    ]
  }),
  calculateTotal
);

console.log(`Subtotal: $${result.subtotal}`); // $30 (2 * (10 + 2 + 3))
console.log(`Total: $${result.total}`); // $30
```

## Tiered Discounts

```typescript
const result = pipe(
  createBill({ currency: "USD" }),
  (bill) => addItem(bill, { id: "item", name: "Item", qty: 1, unitPrice: 1500 }),
  (bill) => addGlobalDiscount(bill, {
    id: "bulk",
    type: "TIERED",
    tiers: [
      { minSubtotal: 0, rate: 0 },
      { minSubtotal: 1000, rate: 5 },
      { minSubtotal: 2000, rate: 10 }
    ]
  }),
  calculateTotal
);

console.log(`Subtotal: $${result.subtotal}`); // $1500
console.log(`Discount: $${result.discounts}`); // $75 (5% of 1500)
console.log(`Total: $${result.total}`); // $1425
```

## Compound Taxes

```typescript
const result = pipe(
  createBill({ currency: "USD" }),
  (bill) => addItem(bill, { id: "item", name: "Item", qty: 1, unitPrice: 100 }),
  (bill) => addTaxRule(bill, { name: "GST", rate: 5 }),
  (bill) => addTaxRule(bill, { name: "PST", rate: 8, compound: true }),
  calculateTotal
);

console.log(`Subtotal: $${result.subtotal}`); // $100
console.log(`Taxes: $${result.taxes}`); // $13.4 (5 + 8.4)
console.log(`Total: $${result.total}`); // $113.4
```

## Multi-Currency

```typescript
const result = pipe(
  createBill({ currency: "EUR", exchangeRate: 1.1 }),
  (bill) => addItem(bill, { id: "item", name: "Item", qty: 1, unitPrice: 100 }),
  calculateTotal
);

console.log(`EUR Total: €${result.total}`); // €110
```

## Plugins

### Loyalty Points

```typescript
import { loyaltyPointsPlugin } from "billjs/plugins";
```

### Regional Tax

```typescript
import { regionTaxPlugin } from "billjs/plugins";
```

### Promo Code

```typescript
import { promoPlugin } from "billjs/plugins";
```

## E-commerce Example

```typescript
const result = pipe(
  createBill({ currency: "USD", decimalPlaces: 2 }),
  (bill) => addItem(bill, {
    id: "headphones",
    name: "Wireless Headphones",
    qty: 1,
    unitPrice: 199.99,
    discounts: [{ id: "sale", type: "PERCENT", value: 15 }]
  }),
  (bill) => addItem(bill, {
    id: "cable",
    name: "USB Cable",
    qty: 2,
    unitPrice: 9.99
  }),
  (bill) => addGlobalDiscount(bill, {
    id: "bulk",
    type: "TIERED",
    tiers: [
      { minSubtotal: 0, rate: 0 },
      { minSubtotal: 2000, rate: 5 }
    ]
  }),
  (bill) => addTaxRule(bill, { name: "Sales Tax", rate: 8.875 }),
  (bill) => usePlugin(bill, loyaltyPointsPlugin({ rate: 0.01 })),
  calculateTotal
);

console.log(`Subtotal: $${result.subtotal}`);
console.log(`Discounts: $${result.discounts}`);
console.log(`Taxes: $${result.taxes}`);
console.log(`Total: $${result.total}`);
console.log(`Loyalty Points: ${result.meta.loyaltyPoints}`);
```

## Restaurant POS Example

```typescript
const result = pipe(
  createBill({ currency: "USD" }),
  (bill) => addItem(bill, {
    id: "burger",
    name: "Burger",
    qty: 2,
    unitPrice: 12.99,
    addons: [
      { id: "bacon", name: "Extra Bacon", qty: 1, unitPrice: 2.5 },
      { id: "cheese", name: "Extra Cheese", qty: 1, unitPrice: 1.5 }
    ]
  }),
  (bill) => addItem(bill, {
    id: "fries",
    name: "French Fries",
    qty: 2,
    unitPrice: 4.99
  }),
  (bill) => addItem(bill, {
    id: "drink",
    name: "Soft Drink",
    qty: 2,
    unitPrice: 2.99
  }),
  (bill) => addTaxRule(bill, { name: "Sales Tax", rate: 7 }),
  calculateTotal
);

console.log(`Subtotal: $${result.subtotal}`); // $49.94
console.log(`Taxes: $${result.taxes}`); // $3.50
console.log(`Total: $${result.total}`); // $53.44
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