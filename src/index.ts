import Decimal from "decimal.js";
import type {
  BillConfig,
  BillContext,
  BillItem,
  BillPlugin,
  BillResult,
  Discount,
  TaxRule,
} from "./types";
export * from "./plugins";

export function createBill(config: BillConfig): BillContext {
  return {
    items: [],
    discounts: [],
    taxes: [],
    config: {
      decimalPlaces: 2,
      roundOff: true,
      exchangeRate: 1,
      ...config,
    },
    plugins: [],
    meta: {},
  };
}

export function addItem(bill: BillContext, item: BillItem): BillContext {
  return {
    ...bill,
    items: [...bill.items, item],
    // Ensure new array instances even for empty arrays
    discounts: [...bill.discounts],
    taxes: [...bill.taxes],
  };
}

export function addGlobalDiscount(
  bill: BillContext,
  discount: Discount
): BillContext {
  return {
    ...bill,
    discounts: [...bill.discounts, discount],
    // Ensure new array instances
    items: [...bill.items],
    taxes: [...bill.taxes],
  };
}

export function addTaxRule(bill: BillContext, tax: TaxRule): BillContext {
  return {
    ...bill,
    taxes: [...bill.taxes, tax],
    // Ensure new array instances
    items: [...bill.items],
    discounts: [...bill.discounts],
  };
}

export function usePlugin(
  bill: BillContext,
  plugin: BillPlugin | BillPlugin[]
): BillContext {
  const plugins = Array.isArray(plugin) ? plugin : [plugin];
  return {
    ...bill,
    plugins: [...bill.plugins, ...plugins],
  };
}

export function setMeta(
  bill: BillContext,
  key: string,
  value: any
): BillContext {
  return {
    ...bill,
    meta: { ...bill.meta, [key]: value },
  };
}

function calculateItemTotal(item: BillItem): Decimal {
  const basePrice = new Decimal(item.unitPrice);

  // Add addons (not multiplied by item qty - they're per-item additions)
  let addonsTotal = new Decimal(0);
  if (item.addons && item.addons.length > 0) {
    addonsTotal = item.addons.reduce(
      (sum, addon) => sum.add(calculateItemTotal(addon)),
      new Decimal(0)
    );
  }

  // Add variations (not multiplied by item qty - they're per-item additions)
  let variationsTotal = new Decimal(0);
  if (item.variations && item.variations.length > 0) {
    variationsTotal = item.variations.reduce(
      (sum, variation) => sum.add(calculateItemTotal(variation)),
      new Decimal(0)
    );
  }

  // Calculate total per unit, then multiply by quantity
  let perUnitTotal = basePrice.add(addonsTotal).add(variationsTotal);
  let itemTotal = perUnitTotal.mul(item.qty);

  // Apply item-level discounts
  if (item.discounts && item.discounts.length > 0) {
    for (const discount of item.discounts) {
      const discountAmount = calculateDiscountAmount(discount, itemTotal);
      itemTotal = itemTotal.minus(discountAmount);
    }
  }

  return itemTotal;
}

function calculateDiscountAmount(
  discount: Discount,
  subtotal: Decimal
): Decimal {
  switch (discount.type) {
    case "PERCENT":
      if (discount.value === undefined) return new Decimal(0);
      return subtotal.mul(discount.value).div(100);

    case "FIXED":
      if (discount.value === undefined) return new Decimal(0);
      return new Decimal(discount.value);

    case "TIERED":
      if (!discount.tiers || discount.tiers.length === 0) return new Decimal(0);

      const subtotalNum = subtotal.toNumber();
      let applicableRate = 0;

      // Sort tiers by minSubtotal descending to find the highest applicable tier
      const sortedTiers = [...discount.tiers].sort(
        (a, b) => b.minSubtotal - a.minSubtotal
      );

      for (const tier of sortedTiers) {
        if (subtotalNum >= tier.minSubtotal) {
          applicableRate = tier.rate;
          break;
        }
      }

      return subtotal.mul(applicableRate).div(100);

    default:
      return new Decimal(0);
  }
}

function coreCalculate(bill: BillContext): BillResult {
  // Set higher precision for intermediate calculations
  Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

  // Calculate subtotal from all items
  let subtotalDecimal = bill.items.reduce(
    (sum, item) => sum.add(calculateItemTotal(item)),
    new Decimal(0)
  );

  // Store original gross subtotal for inclusive tax calculation
  const originalSubtotal = subtotalDecimal;

  // Separate inclusive and exclusive taxes
  const inclusiveTaxes = bill.taxes.filter((t) => t.inclusive);
  const exclusiveTaxes = bill.taxes.filter((t) => !t.inclusive);

  // Extract inclusive taxes from subtotal (reverse calculation)
  let inclusiveTaxTotal = new Decimal(0);
  if (inclusiveTaxes.length > 0) {
    const totalInclusiveRate = inclusiveTaxes.reduce(
      (sum, tax) => sum.add(new Decimal(tax.rate)),
      new Decimal(0)
    );

    const divisor = new Decimal(1).add(totalInclusiveRate.div(100));
    const netAmount = subtotalDecimal.div(divisor);
    inclusiveTaxTotal = subtotalDecimal.minus(netAmount);

    // Adjust subtotal to be net of inclusive taxes
    subtotalDecimal = netAmount;
  }

  // Apply global discounts (on net subtotal) - keep as Decimal for precision
  let discountsDecimal = new Decimal(0);
  const discountBreakdownDecimal: Array<{
    id: string;
    type: string;
    amount: Decimal;
  }> = [];

  for (const discount of bill.discounts) {
    const discountAmount = calculateDiscountAmount(discount, subtotalDecimal);
    discountsDecimal = discountsDecimal.add(discountAmount);
    discountBreakdownDecimal.push({
      id: discount.id,
      type: discount.type,
      amount: discountAmount,
    });
  }

  const taxableBase = subtotalDecimal.minus(discountsDecimal);

  // Build tax breakdown in original order - store as Decimal for precision
  const taxBreakdownDecimal: Array<{
    name: string;
    rate: number;
    inclusive?: boolean;
    amount: Decimal;
  }> = [];

  // Add inclusive tax breakdown first (if any)
  if (inclusiveTaxes.length > 0) {
    const totalInclusiveRate = inclusiveTaxes.reduce(
      (sum, tax) => sum.add(new Decimal(tax.rate)),
      new Decimal(0)
    );
    for (const tax of inclusiveTaxes) {
      const proportion = new Decimal(tax.rate).div(totalInclusiveRate);
      const taxAmount = inclusiveTaxTotal.mul(proportion);
      taxBreakdownDecimal.push({
        name: tax.name,
        rate: tax.rate,
        inclusive: true,
        amount: taxAmount,
      });
    }
  }

  // Calculate exclusive taxes
  let exclusiveTaxTotal = new Decimal(0);
  let currentBase = taxableBase;
  let accumulatedTaxes = new Decimal(0);

  for (const tax of exclusiveTaxes) {
    let baseAmount: Decimal;

    if (tax.applyOn === "subtotal") {
      // Apply on original subtotal (before discounts)
      baseAmount = subtotalDecimal;
    } else if (tax.compound) {
      // Compound tax: apply on taxable base + accumulated taxes
      baseAmount = currentBase.add(accumulatedTaxes);
    } else {
      // Non-compound tax: apply on taxable base only
      baseAmount = currentBase;
    }

    const taxAmount = baseAmount.mul(tax.rate).div(100);
    exclusiveTaxTotal = exclusiveTaxTotal.add(taxAmount);
    accumulatedTaxes = accumulatedTaxes.add(taxAmount);

    taxBreakdownDecimal.push({
      name: tax.name,
      rate: tax.rate,
      inclusive: false,
      amount: taxAmount,
    });
  }

  // Total taxes = inclusive + exclusive
  const totalTaxes = inclusiveTaxTotal.add(exclusiveTaxTotal);

  // Calculate total
  const totalDecimal = taxableBase
    .add(exclusiveTaxTotal)
    .add(inclusiveTaxTotal);

  // Apply exchange rate
  const exchangeRate = new Decimal(bill.config.exchangeRate || 1);

  // Round based on config - apply rounding ONLY at the final conversion step
  const decimalPlaces = bill.config.decimalPlaces ?? 2;
  const roundFn = (d: Decimal): number => {
    const withExchangeRate = d.mul(exchangeRate);
    if (bill.config.roundOff) {
      // Use Decimal.js's built-in rounding which is more accurate than JavaScript's Math.round
      return withExchangeRate
        .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
        .toNumber();
    }
    return withExchangeRate.toNumber();
  };

  // Convert to numbers with exchange rate applied and rounding
  const subtotal = roundFn(subtotalDecimal);
  const discounts = roundFn(discountsDecimal);
  const taxes = roundFn(totalTaxes);
  const total = roundFn(totalDecimal);

  return {
    subtotal,
    discounts,
    taxes,
    total,
    breakdown: {
      items: bill.items.map((item) => ({
        id: item.id,
        name: item.name,
        total: roundFn(calculateItemTotal(item)),
      })),
      taxBreakdown: taxBreakdownDecimal.map((t) => ({
        name: t.name,
        rate: t.rate,
        inclusive: t.inclusive,
        amount: roundFn(t.amount),
      })),
      discountBreakdown: discountBreakdownDecimal.map((d) => ({
        id: d.id,
        type: d.type,
        amount: roundFn(d.amount),
      })),
    },
    meta: {},
  };
}

export function calculateTotal(bill: BillContext): BillResult {
  // Execute setup for plugins if defined
  let transformedBill = bill.plugins.reduce(
    (ctx, plugin) => plugin.setup?.(ctx) ?? ctx,
    bill
  );

  // Execute beforeCalc plugins
  transformedBill = transformedBill.plugins.reduce(
    (ctx, plugin) => plugin.transform?.("beforeCalc", ctx) ?? ctx,
    transformedBill
  );

  // Perform core calculation
  const result = coreCalculate(transformedBill);

  // Execute afterCalc plugins
  const finalCtx = transformedBill.plugins.reduce(
    (ctx, plugin) => plugin.transform?.("afterCalc", { ...ctx, result }) ?? ctx,
    { ...transformedBill, result }
  );

  // Merge plugin meta into result meta
  return {
    ...finalCtx.result!,
    meta: {
      ...finalCtx.result!.meta,
      ...finalCtx.meta,
    },
  };
}

// Utilities
export function pipe<T>(initial: T, ...fns: Array<(arg: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), initial);
}
