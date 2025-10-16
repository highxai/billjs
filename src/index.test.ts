import { describe, it, expect } from "bun:test";
import { calculateBill, ValidationError, DiscountKind, ChargeKind } from "./index";

describe("calculateBill", () => {
  it("should calculate basic bill correctly", () => {
    const result = calculateBill({
      items: [
        { name: "Item1", qty: 1, unitPrice: 100 },
      ],
    });

    expect(result.total).toBe(100);
    expect(result.subtotal).toBe(100);
  });

  it("should apply item discount", () => {
    const result = calculateBill({
      items: [
        { name: "Item1", qty: 1, unitPrice: 100, discount: { kind: DiscountKind.PERCENT, value: 10 } },
      ],
    });

    expect(result.total).toBe(90);
    expect(result.totalItemDiscount).toBe(10);
  });

  it("should apply global discount", () => {
    const result = calculateBill({
      items: [
        { name: "Item1", qty: 1, unitPrice: 100 },
      ],
      config: {
        globalDiscount: { kind: DiscountKind.PERCENT, value: 10 },
      },
    });

    expect(result.total).toBe(90);
    expect(result.globalDiscount).toBe(10);
  });

  it("should apply charges", () => {
    const result = calculateBill({
      items: [
        { name: "Item1", qty: 1, unitPrice: 100 },
      ],
      charges: [
        { name: "Fee", kind: ChargeKind.FIXED, value: 5 },
      ],
    });

    expect(result.total).toBe(105);
    expect(result.charges[0].amount).toBe(5);
  });

  it("should apply taxes", () => {
    const result = calculateBill({
      items: [
        { name: "Item1", qty: 1, unitPrice: 100 },
      ],
      taxes: [
        { name: "Tax", rate: 10, inclusive: false },
      ],
    });

    expect(result.total).toBe(110);
    expect(result.taxes[0].amount).toBe(10);
  });

  it("should handle inclusive taxes", () => {
    const result = calculateBill({
      items: [
        { name: "Item1", qty: 1, unitPrice: 110 },
      ],
      taxes: [
        { name: "Tax", rate: 10, inclusive: true },
      ],
    });

    expect(result.total).toBe(110);
    expect(result.taxes[0].amount).toBe(10);
  });

  it("should throw ValidationError for invalid items", () => {
    expect(() => {
      calculateBill({
        items: [],
      });
    }).toThrow(ValidationError);
  });

  it("should throw ValidationError for negative qty", () => {
    expect(() => {
      calculateBill({
        items: [{ name: "Item1", qty: -1, unitPrice: 100 }],
      });
    }).toThrow(ValidationError);
  });

  it("should throw ValidationError for invalid discount percentage", () => {
    expect(() => {
      calculateBill({
        items: [{ name: "Item1", qty: 1, unitPrice: 100, discount: { kind: DiscountKind.PERCENT, value: 150 } }],
      });
    }).toThrow(ValidationError);
  });

  it("should handle rounding correctly", () => {
    const result = calculateBill({
      items: [
        { name: "Item1", qty: 1, unitPrice: 10.005 },
      ],
      config: {
        decimalPlaces: 2,
        roundOff: true,
      },
    });

    expect(result.total).toBe(10.01);
  });

  it("should handle multi-currency conversion", () => {
    const result = calculateBill({
      items: [
        { name: "Item1", qty: 1, unitPrice: 100, currency: "EUR" },
      ],
      config: {
        currency: "USD",
        exchangeRates: { EUR: 1.1 }, // 1 USD = 1.1 EUR
      },
    });

    expect(result.currency).toBe("USD");
    expect(result.total).toBe(90.91); // 100 / 1.1 ≈ 90.91
    expect(result.convertedTotals?.EUR).toBe(100);
  });

  it("should apply tax preset", () => {
    const result = calculateBill({
      items: [
        { name: "Item1", qty: 1, unitPrice: 100 },
      ],
      config: {
        taxPreset: "india",
      },
    });

    expect(result.taxes.length).toBe(2);
    expect(result.taxes[0].name).toBe("CGST");
    expect(result.taxes[1].name).toBe("SGST");
    // Since inclusive, total should be 100
    expect(result.total).toBe(100);
  });

  it("should throw for unknown tax preset", () => {
    expect(() => {
      calculateBill({
        items: [{ name: "Item1", qty: 1, unitPrice: 100 }],
        config: {
          taxPreset: "unknown",
        },
      });
    }).toThrow(ValidationError);
  });

  it("should handle tax threshold", () => {
    const result = calculateBill({
      items: [
        { name: "Item1", qty: 1, unitPrice: 50 }, // subtotal 50
      ],
      taxes: [
        { name: "Tax", rate: 10, threshold: 100 }, // should not apply
      ],
    });

    expect(result.taxes[0].amount).toBe(0);
    expect(result.total).toBe(50);
  });

  it("should handle compound taxes", () => {
    const result = calculateBill({
      items: [
        { name: "Item1", qty: 1, unitPrice: 100 },
      ],
      taxes: [
        { name: "Tax1", rate: 10, compound: false },
        { name: "Tax2", rate: 5, compound: true }, // apply on 100 + 10 = 110
      ],
    });

    expect(result.taxes[0].amount).toBe(10); // 100 * 0.1
    expect(result.taxes[1].amount).toBe(5.5); // 110 * 0.05
    expect(result.total).toBe(115.5);
  });
});