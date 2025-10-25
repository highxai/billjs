import { describe, expect, test } from "bun:test";
import {
  addGlobalDiscount,
  addItem,
  addTaxRule,
  calculateTotal,
  createBill,
  pipe,
  setMeta,
  usePlugin,
} from "./index";
import { loyaltyPointsPlugin, promoPlugin, regionTaxPlugin } from "./index";

describe("Billing Engine - Core API", () => {
  test("createBill should initialize with default config", () => {
    const bill = createBill({ currency: "USD" });

    expect(bill.items).toEqual([]);
    expect(bill.discounts).toEqual([]);
    expect(bill.taxes).toEqual([]);
    expect(bill.config.currency).toBe("USD");
    expect(bill.config.decimalPlaces).toBe(2);
    expect(bill.config.roundOff).toBe(true);
    expect(bill.config.exchangeRate).toBe(1);
    expect(bill.plugins).toEqual([]);
    expect(bill.meta).toEqual({});
  });

  test("createBill should allow custom config", () => {
    const bill = createBill({
      currency: "EUR",
      decimalPlaces: 3,
      roundOff: false,
      exchangeRate: 1.1,
    });

    expect(bill.config.decimalPlaces).toBe(3);
    expect(bill.config.roundOff).toBe(false);
    expect(bill.config.exchangeRate).toBe(1.1);
  });

  test("addItem should add item immutably", () => {
    const bill1 = createBill({ currency: "USD" });
    const bill2 = addItem(bill1, {
      id: "item-1",
      name: "Product A",
      qty: 2,
      unitPrice: 50,
    });

    expect(bill1.items.length).toBe(0);
    expect(bill2.items.length).toBe(1);
    expect(bill2.items[0].name).toBe("Product A");
  });

  test("addGlobalDiscount should add discount immutably", () => {
    const bill1 = createBill({ currency: "USD" });
    const bill2 = addGlobalDiscount(bill1, {
      id: "disc-1",
      type: "PERCENT",
      value: 10,
    });

    expect(bill1.discounts.length).toBe(0);
    expect(bill2.discounts.length).toBe(1);
  });

  test("addTaxRule should add tax immutably", () => {
    const bill1 = createBill({ currency: "USD" });
    const bill2 = addTaxRule(bill1, {
      name: "Sales Tax",
      rate: 8.5,
    });

    expect(bill1.taxes.length).toBe(0);
    expect(bill2.taxes.length).toBe(1);
  });

  test("setMeta should set metadata immutably", () => {
    const bill1 = createBill({ currency: "USD" });
    const bill2 = setMeta(bill1, "orderId", "12345");

    expect(bill1.meta).toEqual({});
    expect(bill2.meta.orderId).toBe("12345");
  });
});

describe("Billing Engine - Basic Calculations", () => {
  test("should calculate simple subtotal", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item 1", qty: 2, unitPrice: 50 }),
      (b) => addItem(b, { id: "i2", name: "Item 2", qty: 1, unitPrice: 30 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(130);
    expect(result.discounts).toBe(0);
    expect(result.taxes).toBe(0);
    expect(result.total).toBe(130);
  });

  test("should calculate with decimal prices", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 3, unitPrice: 19.99 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(59.97);
    expect(result.total).toBe(59.97);
  });

  test("should handle zero quantity", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 0, unitPrice: 100 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });

  test("should handle zero price", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Free Item", qty: 5, unitPrice: 0 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe("Billing Engine - Discounts", () => {
  test("should apply PERCENT discount", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "PERCENT", value: 10 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(100);
    expect(result.discounts).toBe(10);
    expect(result.total).toBe(90);
  });

  test("should apply FIXED discount", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "FIXED", value: 15 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(100);
    expect(result.discounts).toBe(15);
    expect(result.total).toBe(85);
  });

  test("should apply TIERED discount - tier 0", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 500 }),
      (b) =>
        addGlobalDiscount(b, {
          id: "d1",
          type: "TIERED",
          tiers: [
            { minSubtotal: 0, rate: 0 },
            { minSubtotal: 1000, rate: 5 },
            { minSubtotal: 2000, rate: 10 },
          ],
        }),
      calculateTotal
    );

    expect(result.discounts).toBe(0);
    expect(result.total).toBe(500);
  });

  test("should apply TIERED discount - tier 1", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 1500 }),
      (b) =>
        addGlobalDiscount(b, {
          id: "d1",
          type: "TIERED",
          tiers: [
            { minSubtotal: 0, rate: 0 },
            { minSubtotal: 1000, rate: 5 },
            { minSubtotal: 2000, rate: 10 },
          ],
        }),
      calculateTotal
    );

    expect(result.discounts).toBe(75); // 5% of 1500
    expect(result.total).toBe(1425);
  });

  test("should apply TIERED discount - tier 2", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 2500 }),
      (b) =>
        addGlobalDiscount(b, {
          id: "d1",
          type: "TIERED",
          tiers: [
            { minSubtotal: 0, rate: 0 },
            { minSubtotal: 1000, rate: 5 },
            { minSubtotal: 2000, rate: 10 },
          ],
        }),
      calculateTotal
    );

    expect(result.discounts).toBe(250); // 10% of 2500
    expect(result.total).toBe(2250);
  });

  test("should apply multiple discounts", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "PERCENT", value: 10 }),
      (b) => addGlobalDiscount(b, { id: "d2", type: "FIXED", value: 5 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(100);
    expect(result.discounts).toBe(15);
    expect(result.total).toBe(85);
  });

  test("should apply item-level discount", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) =>
        addItem(b, {
          id: "i1",
          name: "Item",
          qty: 1,
          unitPrice: 100,
          discounts: [{ id: "d1", type: "PERCENT", value: 20 }],
        }),
      calculateTotal
    );

    expect(result.subtotal).toBe(80); // Item discount applied to subtotal
    expect(result.total).toBe(80);
  });

  test("should handle discount with undefined value", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "PERCENT" }),
      calculateTotal
    );

    expect(result.discounts).toBe(0);
    expect(result.total).toBe(100);
  });

  test("should handle tiered discount with empty tiers", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "TIERED", tiers: [] }),
      calculateTotal
    );

    expect(result.discounts).toBe(0);
    expect(result.total).toBe(100);
  });
});

describe("Billing Engine - Taxes", () => {
  test("should apply simple exclusive tax", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addTaxRule(b, { name: "Sales Tax", rate: 10 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(100);
    expect(result.taxes).toBe(10);
    expect(result.total).toBe(110);
  });

  test("should apply tax after discount", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "PERCENT", value: 10 }),
      (b) => addTaxRule(b, { name: "Sales Tax", rate: 10 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(100);
    expect(result.discounts).toBe(10);
    expect(result.taxes).toBe(9); // 10% of 90
    expect(result.total).toBe(99);
  });

  test("should apply inclusive tax", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 110 }),
      (b) => addTaxRule(b, { name: "VAT", rate: 10, inclusive: true }),
      calculateTotal
    );

    expect(result.subtotal).toBe(100); // Net amount
    expect(result.taxes).toBe(10); // Extracted tax
    expect(result.total).toBe(110); // Original price
  });

  test("should apply multiple inclusive taxes", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 120 }),
      (b) => addTaxRule(b, { name: "VAT", rate: 10, inclusive: true }),
      (b) => addTaxRule(b, { name: "Service", rate: 10, inclusive: true }),
      calculateTotal
    );

    expect(result.subtotal).toBe(100); // 120 / 1.20 = 100
    expect(result.taxes).toBe(20); // 120 - 100 = 20
    expect(result.total).toBe(120);
  });

  test("should apply compound tax", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addTaxRule(b, { name: "Tax 1", rate: 10, compound: false }),
      (b) => addTaxRule(b, { name: "Tax 2", rate: 5, compound: true }),
      calculateTotal
    );

    expect(result.subtotal).toBe(100);
    // Tax 1: 100 * 10% = 10
    // Tax 2: 110 * 5% = 5.5 (compounded on base + tax1)
    expect(result.taxes).toBe(15.5);
    expect(result.total).toBe(115.5);
  });

  test("should apply tax on subtotal vs taxableBase", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "PERCENT", value: 10 }),
      (b) =>
        addTaxRule(b, {
          name: "Tax on Subtotal",
          rate: 5,
          applyOn: "subtotal",
        }),
      (b) =>
        addTaxRule(b, { name: "Tax on Base", rate: 5, applyOn: "taxableBase" }),
      calculateTotal
    );

    // Subtotal: 100, Discount: 10, TaxableBase: 90
    // Tax1 (on subtotal): 100 * 5% = 5
    // Tax2 (on taxableBase): 90 * 5% = 4.5
    expect(result.taxes).toBe(9.5);
  });

  test("should combine inclusive and exclusive taxes", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 110 }),
      (b) => addTaxRule(b, { name: "VAT", rate: 10, inclusive: true }),
      (b) => addTaxRule(b, { name: "Sales Tax", rate: 5, inclusive: false }),
      calculateTotal
    );

    // Inclusive: 110 -> net 100, tax 10
    // Exclusive: 100 * 5% = 5
    expect(result.subtotal).toBe(100);
    expect(result.taxes).toBe(15);
    expect(result.total).toBe(115);
  });
});

describe("Billing Engine - Items with Addons and Variations", () => {
  test("should calculate item with addons", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) =>
        addItem(b, {
          id: "pizza",
          name: "Pizza",
          qty: 1,
          unitPrice: 10,
          addons: [
            { id: "cheese", name: "Extra Cheese", qty: 1, unitPrice: 2 },
            { id: "pepperoni", name: "Pepperoni", qty: 1, unitPrice: 3 },
          ],
        }),
      calculateTotal
    );

    expect(result.subtotal).toBe(15); // 10 + 2 + 3
    expect(result.total).toBe(15);
  });

  test("should calculate item with variations", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) =>
        addItem(b, {
          id: "shirt",
          name: "T-Shirt",
          qty: 1,
          unitPrice: 20,
          variations: [
            { id: "size", name: "Large Size", qty: 1, unitPrice: 3 },
          ],
        }),
      calculateTotal
    );

    expect(result.subtotal).toBe(23); // 20 + 3
    expect(result.total).toBe(23);
  });

  test("should calculate item with both addons and variations", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) =>
        addItem(b, {
          id: "burger",
          name: "Burger",
          qty: 2,
          unitPrice: 8,
          addons: [{ id: "bacon", name: "Bacon", qty: 1, unitPrice: 2 }],
          variations: [{ id: "large", name: "Large", qty: 1, unitPrice: 1 }],
        }),
      calculateTotal
    );

    expect(result.subtotal).toBe(22); // (8 + 2 + 1) * 2
    expect(result.total).toBe(22);
  });

  test("should apply item discount to total with addons", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) =>
        addItem(b, {
          id: "meal",
          name: "Meal",
          qty: 1,
          unitPrice: 10,
          addons: [{ id: "drink", name: "Drink", qty: 1, unitPrice: 5 }],
          discounts: [{ id: "d1", type: "PERCENT", value: 10 }],
        }),
      calculateTotal
    );

    // Base + addon = 15, discount 10% = 1.5, net = 13.5
    expect(result.subtotal).toBe(13.5);
    expect(result.total).toBe(13.5);
  });
});

describe("Billing Engine - Multi-currency", () => {
  test("should apply exchange rate", () => {
    const result = pipe(
      createBill({ currency: "EUR", exchangeRate: 1.2 }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(120); // 100 * 1.2
    expect(result.total).toBe(120);
  });

  test("should apply exchange rate to all components", () => {
    const result = pipe(
      createBill({ currency: "GBP", exchangeRate: 0.85 }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "FIXED", value: 10 }),
      (b) => addTaxRule(b, { name: "VAT", rate: 20 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(85); // 100 * 0.85
    expect(result.discounts).toBe(8.5); // 10 * 0.85
    expect(result.taxes).toBe(15.3); // (90 * 20%) * 0.85
    expect(result.total).toBe(91.8); // 108 * 0.85
  });
});

describe("Billing Engine - Rounding and Precision", () => {
  test("should round to 2 decimal places by default", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 3, unitPrice: 10.666 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(32); // 31.998 rounded
  });

  test("should respect custom decimal places", () => {
    const result = pipe(
      createBill({ currency: "USD", decimalPlaces: 3 }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 3, unitPrice: 10.6666 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(32); // 31.9998 rounded to 3 places
  });

  test("should not round when roundOff is false", () => {
    const result = pipe(
      createBill({ currency: "USD", roundOff: false }),
      (b) =>
        addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 10.123456789 }),
      calculateTotal
    );

    expect(result.subtotal).toBeCloseTo(10.123456789, 5);
  });

  test("should handle complex precision calculations", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 19.99 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "PERCENT", value: 7.5 }),
      (b) => addTaxRule(b, { name: "Tax", rate: 8.875 }),
      calculateTotal
    );

    // Subtotal: 19.99
    // Discount: 19.99 * 7.5% = 1.49925 -> 1.5
    // TaxableBase: 18.49
    // Tax: 18.49 * 8.875% = 1.641... -> 1.64
    // Total: 20.13
    expect(result.discounts).toBe(1.5);
    expect(result.taxes).toBe(1.64);
    expect(result.total).toBe(20.13);
  });
});

describe("Billing Engine - Plugins", () => {
  test("should execute loyalty points plugin", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => usePlugin(b, loyaltyPointsPlugin({ rate: 0.05 })),
      calculateTotal
    );

    expect(result.total).toBe(100);
    expect(result.meta.loyaltyPoints).toBe(5); // 100 * 0.05 = 5
  });

  test("should execute region tax plugin", () => {
    const result = pipe(
      createBill({ currency: "EUR" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) =>
        usePlugin(
          b,
          regionTaxPlugin({ region: "DE", vatRates: { DE: 19, FR: 20 } })
        ),
      calculateTotal
    );

    expect(result.taxes).toBe(19); // 19% VAT
    expect(result.total).toBe(119);
  });

  test("should execute promo plugin with valid code", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) =>
        usePlugin(
          b,
          promoPlugin({
            code: "SAVE10",
            validate: (code) => code === "SAVE10",
            discount: { id: "promo", type: "PERCENT", value: 10 },
          })
        ),
      calculateTotal
    );

    expect(result.discounts).toBe(10);
    expect(result.total).toBe(90);
    expect(result.meta.appliedPromo).toBe("SAVE10");
  });

  test("should not execute promo plugin with invalid code", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) =>
        usePlugin(
          b,
          promoPlugin({
            code: "INVALID",
            validate: (code) => code === "SAVE10",
            discount: { id: "promo", type: "PERCENT", value: 10 },
          })
        ),
      calculateTotal
    );

    expect(result.discounts).toBe(0);
    expect(result.total).toBe(100);
    expect(result.meta.appliedPromo).toBeUndefined();
  });

  test("should execute multiple plugins", () => {
    const result = pipe(
      createBill({ currency: "EUR" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) =>
        usePlugin(b, [
          loyaltyPointsPlugin({ rate: 0.05 }),
          regionTaxPlugin({ region: "FR", vatRates: { DE: 19, FR: 20 } }),
        ]),
      calculateTotal
    );

    expect(result.taxes).toBe(20); // 20% French VAT
    expect(result.total).toBe(120);
    expect(result.meta.loyaltyPoints).toBe(6); // 120 * 0.05 = 6
  });

  test("should pass context through plugin chain", () => {
    const customPlugin = {
      name: "custom",
      transform: (phase: "beforeCalc" | "afterCalc", ctx: any) => {
        if (phase === "beforeCalc") {
          return { ...ctx, meta: { ...ctx.meta, beforeCalc: true } };
        }
        if (phase === "afterCalc") {
          return { ...ctx, meta: { ...ctx.meta, afterCalc: true } };
        }
        return ctx;
      },
    };

    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => usePlugin(b, customPlugin),
      calculateTotal
    );

    expect(result.meta.beforeCalc).toBe(true);
    expect(result.meta.afterCalc).toBe(true);
  });
});

describe("Billing Engine - Breakdown", () => {
  test("should provide item breakdown", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item 1", qty: 2, unitPrice: 50 }),
      (b) => addItem(b, { id: "i2", name: "Item 2", qty: 1, unitPrice: 30 }),
      calculateTotal
    );

    expect(result.breakdown.items).toHaveLength(2);
    expect(result.breakdown.items[0]).toEqual({
      id: "i1",
      name: "Item 1",
      total: 100,
    });
    expect(result.breakdown.items[1]).toEqual({
      id: "i2",
      name: "Item 2",
      total: 30,
    });
  });

  test("should provide tax breakdown", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addTaxRule(b, { name: "State Tax", rate: 5 }),
      (b) => addTaxRule(b, { name: "City Tax", rate: 2 }),
      calculateTotal
    );

    expect(result.breakdown.taxBreakdown).toHaveLength(2);
    expect(result.breakdown.taxBreakdown[0]).toMatchObject({
      name: "State Tax",
      rate: 5,
      amount: 5,
    });
    expect(result.breakdown.taxBreakdown[1]).toMatchObject({
      name: "City Tax",
      rate: 2,
      amount: 2,
    });
  });

  test("should provide discount breakdown", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "PERCENT", value: 10 }),
      (b) => addGlobalDiscount(b, { id: "d2", type: "FIXED", value: 5 }),
      calculateTotal
    );

    expect(result.breakdown.discountBreakdown).toHaveLength(2);
    expect(result.breakdown.discountBreakdown[0]).toMatchObject({
      id: "d1",
      type: "PERCENT",
      amount: 10,
    });
    expect(result.breakdown.discountBreakdown[1]).toMatchObject({
      id: "d2",
      type: "FIXED",
      amount: 5,
    });
  });

  test("should indicate inclusive vs exclusive taxes in breakdown", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 110 }),
      (b) => addTaxRule(b, { name: "VAT", rate: 10, inclusive: true }),
      (b) => addTaxRule(b, { name: "Sales Tax", rate: 5, inclusive: false }),
      calculateTotal
    );

    expect(result.breakdown.taxBreakdown[0].inclusive).toBe(true);
    expect(result.breakdown.taxBreakdown[1].inclusive).toBe(false);
  });
});

describe("Billing Engine - Edge Cases", () => {
  test("should handle empty bill", () => {
    const result = pipe(createBill({ currency: "USD" }), calculateTotal);

    expect(result.subtotal).toBe(0);
    expect(result.discounts).toBe(0);
    expect(result.taxes).toBe(0);
    expect(result.total).toBe(0);
  });

  test("should handle bill with only taxes (no items)", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addTaxRule(b, { name: "Tax", rate: 10 }),
      calculateTotal
    );

    expect(result.total).toBe(0);
  });

  test("should handle negative discount (should not happen but handle gracefully)", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "FIXED", value: -10 }),
      calculateTotal
    );

    expect(result.discounts).toBe(-10);
    expect(result.total).toBe(110); // Price increases
  });

  test("should handle very large numbers", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) =>
        addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 999999999.99 }),
      (b) => addTaxRule(b, { name: "Tax", rate: 10 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(999999999.99);
    expect(result.taxes).toBeCloseTo(99999999.999, 2);
  });

  test("should handle very small numbers", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 0.01 }),
      (b) => addTaxRule(b, { name: "Tax", rate: 10 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(0.01);
    expect(result.total).toBe(0.01); // 0.001 rounds to 0.01
  });

  test("should handle fractional quantities", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 2.5, unitPrice: 10 }),
      calculateTotal
    );

    expect(result.subtotal).toBe(25);
  });

  test("should handle deeply nested addons", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) =>
        addItem(b, {
          id: "base",
          name: "Base",
          qty: 1,
          unitPrice: 10,
          addons: [
            {
              id: "addon1",
              name: "Addon 1",
              qty: 1,
              unitPrice: 5,
              addons: [
                {
                  id: "nested",
                  name: "Nested Addon",
                  qty: 1,
                  unitPrice: 2,
                },
              ],
            },
          ],
        }),
      calculateTotal
    );

    expect(result.subtotal).toBe(17); // 10 + 5 + 2
  });

  test("should handle discount larger than subtotal", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 50 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "FIXED", value: 100 }),
      calculateTotal
    );

    expect(result.discounts).toBe(100);
    expect(result.total).toBe(-50); // Negative total
  });

  test("should handle 100% discount", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "PERCENT", value: 100 }),
      calculateTotal
    );

    expect(result.discounts).toBe(100);
    expect(result.total).toBe(0);
  });

  test("should handle 0% tax rate", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addTaxRule(b, { name: "Zero Tax", rate: 0 }),
      calculateTotal
    );

    expect(result.taxes).toBe(0);
    expect(result.total).toBe(100);
  });
});

describe("Billing Engine - Real-world Scenarios", () => {
  test("E-commerce checkout scenario", () => {
    const result = pipe(
      createBill({ currency: "USD", decimalPlaces: 2 }),
      (b) =>
        addItem(b, {
          id: "laptop",
          name: "MacBook Pro",
          qty: 1,
          unitPrice: 2499,
        }),
      (b) =>
        addItem(b, { id: "mouse", name: "Magic Mouse", qty: 1, unitPrice: 79 }),
      (b) =>
        addItem(b, {
          id: "keyboard",
          name: "Magic Keyboard",
          qty: 1,
          unitPrice: 99,
        }),
      (b) =>
        addGlobalDiscount(b, {
          id: "bulk",
          type: "TIERED",
          tiers: [
            { minSubtotal: 0, rate: 0 },
            { minSubtotal: 2000, rate: 5 },
            { minSubtotal: 5000, rate: 10 },
          ],
        }),
      (b) => addTaxRule(b, { name: "Sales Tax", rate: 8.875 }),
      (b) => usePlugin(b, loyaltyPointsPlugin({ rate: 0.01 })),
      calculateTotal
    );

    // Subtotal: 2677
    // Discount: 5% = 133.85
    // Taxable: 2543.15
    // Tax: 8.875% = 225.7
    // Total: 2768.85

    expect(result.subtotal).toBe(2677);
    expect(result.discounts).toBe(133.85);
    expect(result.taxes).toBe(225.7);
    expect(result.total).toBe(2768.85);
    expect(result.meta.loyaltyPoints).toBe(27);
  });

  test("Restaurant POS scenario", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) =>
        addItem(b, {
          id: "burger",
          name: "Burger",
          qty: 2,
          unitPrice: 12.99,
          addons: [
            { id: "bacon", name: "Extra Bacon", qty: 1, unitPrice: 2.5 },
            { id: "cheese", name: "Extra Cheese", qty: 1, unitPrice: 1.5 },
          ],
        }),
      (b) =>
        addItem(b, {
          id: "fries",
          name: "French Fries",
          qty: 2,
          unitPrice: 4.99,
        }),
      (b) =>
        addItem(b, {
          id: "drink",
          name: "Soft Drink",
          qty: 2,
          unitPrice: 2.99,
        }),
      (b) => addTaxRule(b, { name: "Sales Tax", rate: 7 }),
      (b) =>
        addTaxRule(b, { name: "Service Charge", rate: 18, inclusive: false }),
      calculateTotal
    );

    // Items: (12.99 + 2.50 + 1.50) * 2 + 4.99 * 2 + 2.99 * 2
    // = 33.98 + 9.98 + 5.98 = 49.94
    expect(result.subtotal).toBe(49.94);
    // Sales Tax: 49.94 * 7% = 3.50
    // Service: 49.94 * 18% = 8.99
    expect(result.taxes).toBe(12.49);
    expect(result.total).toBe(62.43);
  });

  test("SaaS subscription with promo code", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) =>
        addItem(b, {
          id: "pro-plan",
          name: "Pro Plan (Annual)",
          qty: 1,
          unitPrice: 999,
        }),
      (b) =>
        usePlugin(
          b,
          promoPlugin({
            code: "NEWYEAR2025",
            validate: (code) => code === "NEWYEAR2025",
            discount: { id: "promo", type: "PERCENT", value: 20 },
          })
        ),
      (b) => addTaxRule(b, { name: "VAT", rate: 20, inclusive: false }),
      calculateTotal
    );

    expect(result.subtotal).toBe(999);
    expect(result.discounts).toBe(199.8); // 20%
    expect(result.taxes).toBe(159.84); // 20% on 799.2
    expect(result.total).toBe(959.04);
    expect(result.meta.appliedPromo).toBe("NEWYEAR2025");
  });

  test("European VAT scenario (inclusive)", () => {
    const result = pipe(
      createBill({ currency: "EUR" }),
      (b) =>
        addItem(b, { id: "product", name: "Product", qty: 1, unitPrice: 119 }),
      (b) => addTaxRule(b, { name: "German VAT", rate: 19, inclusive: true }),
      calculateTotal
    );

    // Price includes 19% VAT
    // Net: 119 / 1.19 = 100
    // VAT: 19
    expect(result.subtotal).toBe(100);
    expect(result.taxes).toBe(19);
    expect(result.total).toBe(119);
  });

  test("Multi-currency wholesale order", () => {
    const result = pipe(
      createBill({ currency: "EUR", exchangeRate: 0.92 }),
      (b) =>
        addItem(b, { id: "widget", name: "Widget", qty: 1000, unitPrice: 2.5 }),
      (b) =>
        addGlobalDiscount(b, { id: "wholesale", type: "PERCENT", value: 15 }),
      (b) => addTaxRule(b, { name: "Import Tax", rate: 5 }),
      calculateTotal
    );

    // USD prices converted to EUR
    // Subtotal: 2500 * 0.92 = 2300
    // Discount: 375 * 0.92 = 345
    // Tax: 106.25 * 0.92 = 97.75
    expect(result.subtotal).toBe(2300);
    expect(result.discounts).toBe(345);
    expect(result.taxes).toBe(97.75);
    expect(result.total).toBe(2052.75);
  });

  test("Complex tax jurisdiction (compound taxes)", () => {
    const result = pipe(
      createBill({ currency: "CAD" }),
      (b) =>
        addItem(b, { id: "product", name: "Product", qty: 1, unitPrice: 100 }),
      (b) => addTaxRule(b, { name: "GST", rate: 5, compound: false }),
      (b) => addTaxRule(b, { name: "PST", rate: 8, compound: true }),
      calculateTotal
    );

    // GST: 100 * 5% = 5
    // PST: 105 * 8% = 8.4 (compound on GST)
    expect(result.subtotal).toBe(100);
    expect(result.taxes).toBe(13.4);
    expect(result.total).toBe(113.4);
  });
});

describe("Billing Engine - Performance and Stress Tests", () => {
  test("should handle many items efficiently", () => {
    let bill = createBill({ currency: "USD" });

    for (let i = 0; i < 100; i++) {
      bill = addItem(bill, {
        id: `item-${i}`,
        name: `Item ${i}`,
        qty: 1,
        unitPrice: 10,
      });
    }

    const result = calculateTotal(bill);
    expect(result.subtotal).toBe(1000);
    expect(result.breakdown.items).toHaveLength(100);
  });

  test("should handle many discounts", () => {
    let bill = createBill({ currency: "USD" });
    bill = addItem(bill, { id: "i1", name: "Item", qty: 1, unitPrice: 1000 });

    for (let i = 0; i < 10; i++) {
      bill = addGlobalDiscount(bill, {
        id: `d${i}`,
        type: "PERCENT",
        value: 1,
      });
    }

    const result = calculateTotal(bill);
    expect(result.discounts).toBe(100); // 10 * 1% of 1000
  });

  test("should handle many taxes", () => {
    let bill = createBill({ currency: "USD" });
    bill = addItem(bill, { id: "i1", name: "Item", qty: 1, unitPrice: 100 });

    for (let i = 0; i < 10; i++) {
      bill = addTaxRule(bill, { name: `Tax ${i}`, rate: 1 });
    }

    const result = calculateTotal(bill);
    expect(result.taxes).toBe(10); // 10 * 1%
    expect(result.breakdown.taxBreakdown).toHaveLength(10);
  });

  test("should handle complex nested structure", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) =>
        addItem(b, {
          id: "bundle",
          name: "Bundle",
          qty: 1,
          unitPrice: 100,
          addons: Array.from({ length: 10 }, (_, i) => ({
            id: `addon-${i}`,
            name: `Addon ${i}`,
            qty: 1,
            unitPrice: 5,
            variations: [
              { id: `var-${i}`, name: `Variation ${i}`, qty: 1, unitPrice: 1 },
            ],
          })),
        }),
      calculateTotal
    );

    // 100 + 10 * (5 + 1) = 160
    expect(result.subtotal).toBe(160);
  });
});

describe("Billing Engine - Immutability Tests", () => {
  test("should not mutate original bill context", () => {
    const original = createBill({ currency: "USD" });
    const modified = addItem(original, {
      id: "i1",
      name: "Item",
      qty: 1,
      unitPrice: 100,
    });

    expect(original.items.length).toBe(0);
    expect(modified.items.length).toBe(1);
    expect(original).not.toBe(modified);
  });

  test("should not mutate when adding multiple items", () => {
    const bill1 = createBill({ currency: "USD" });
    const bill2 = addItem(bill1, {
      id: "i1",
      name: "Item 1",
      qty: 1,
      unitPrice: 50,
    });
    const bill3 = addItem(bill2, {
      id: "i2",
      name: "Item 2",
      qty: 1,
      unitPrice: 30,
    });

    expect(bill1.items.length).toBe(0);
    expect(bill2.items.length).toBe(1);
    expect(bill3.items.length).toBe(2);
  });

  test("should not mutate config object", () => {
    const config = { currency: "USD", decimalPlaces: 2 };
    const bill = createBill(config);

    expect(config).toEqual({ currency: "USD", decimalPlaces: 2 });
    expect(bill.config.roundOff).toBe(true);
  });

  test("should not mutate arrays in context", () => {
    const bill1 = createBill({ currency: "USD" });
    const bill2 = addItem(bill1, {
      id: "i1",
      name: "Item",
      qty: 1,
      unitPrice: 100,
    });

    expect(bill1.items).not.toBe(bill2.items);
    expect(bill1.discounts).not.toBe(bill2.discounts);
    expect(bill1.taxes).not.toBe(bill2.taxes);
  });
});

describe("Billing Engine - Type Safety", () => {
  test("should accept all valid discount types", () => {
    const bill = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addGlobalDiscount(b, { id: "d1", type: "PERCENT", value: 10 }),
      (b) => addGlobalDiscount(b, { id: "d2", type: "FIXED", value: 5 }),
      (b) =>
        addGlobalDiscount(b, {
          id: "d3",
          type: "TIERED",
          tiers: [{ minSubtotal: 0, rate: 0 }],
        }),
      calculateTotal
    );

    expect(bill.breakdown.discountBreakdown).toHaveLength(3);
  });

  test("should handle optional fields", () => {
    const result = pipe(
      createBill({ currency: "USD" }),
      (b) => addItem(b, { id: "i1", name: "Item", qty: 1, unitPrice: 100 }),
      (b) => addTaxRule(b, { name: "Tax", rate: 10 }), // No optional fields
      calculateTotal
    );

    expect(result.taxes).toBe(10);
  });
});
