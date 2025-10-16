import { calculateBill, DiscountKind, ChargeKind } from "./src/index";

const result = calculateBill({
  items: [
    {
      name: "chicken tikka (Chicken)",
      qty: 1,
      unitPrice: 70.0,
      //   discount: { kind: DiscountKind.PERCENT, value: 10 }, // 10% off
    //   taxFree: true
    },
    // { name: "Mouse", qty: 2, unitPrice: 50 },
  ],
  charges: [
    // { name: "Delivery", kind: ChargeKind.FIXED, value: 20 },
    // { name: "Service Fee", kind: ChargeKind.PERCENT, value: 2 },
  ],
  taxes: [
    { name: "GST", rate: 18, inclusive: true, applyOn: "netAfterDiscount" },
  ],
  config: {
    // billingIdPrefix: "INV",
    decimalPlaces: 2,
    roundOff: true,
    globalDiscount: { kind: DiscountKind.PERCENT, value: 13 },
  },
});

console.log(result); // → Final total
// console.log(result.items); // → Per-item breakdown
// console.log(result.taxes); // → Applied tax breakdown
// console.log(result.formula); // → Human-readable steps
