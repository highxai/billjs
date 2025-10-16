export type Decimal = number; // numeric values; rounding controlled by config

// ---------- Custom Errors for DX ----------
export class BillingError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'BillingError';
  }
}

export class ValidationError extends BillingError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class CalculationError extends BillingError {
  constructor(message: string) {
    super(message, 'CALCULATION_ERROR');
    this.name = 'CalculationError';
  }
}

// ---------- Enums & Helpers ----------
export enum DiscountKind {
  FIXED = "fixed",
  PERCENT = "percentage",
}
export enum ChargeKind {
  FIXED = "fixed",
  PERCENT = "percentage",
}

function nowIso(): string {
  return new Date().toISOString();
}

function genBillingId(prefix = "BILL"): string {
  // Format: PREFIX-YYYYMMDD-HHMMSS-xxxx
  const d = new Date();
  const y = d.getFullYear().toString().padStart(4, "0");
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const h = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000).toString(10);
  return `${prefix}-${y}${m}${day}-${h}${min}${s}-${rand}`;
}

// safe rounding helper: intermediate precision + final rounding
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// Use a slightly higher internal precision to avoid repeated floating errors.
function internalRound(value: number, decimalsExtra = 6): number {
  return roundTo(value, decimalsExtra);
}

// ---------- Types ----------

// Item-level discount (optional)
export type ItemDiscount =
  | { kind: DiscountKind.FIXED; value: number } // absolute value
  | { kind: DiscountKind.PERCENT; value: number }; // percentage (0-100)

// Item model
export interface BillItem {
  sku?: string; // optional SKU / identifier
  name: string;
  qty: number; // must be >= 0
  unitPrice: number; // price per unit (currency)
  currency?: string; // currency code, defaults to config.currency
  taxFree?: boolean; // if true, item is not subject to configured taxes
  discount?: ItemDiscount; // optional item-level discount
  // optional per-item flags to override applyOn for charges/taxes can be added later
}

// Global discount (applied after item-level discounts, before charges/taxes)
export type GlobalDiscount =
  | { kind: DiscountKind.FIXED; value: number }
  | { kind: DiscountKind.PERCENT; value: number }
  | null;

// Charges (applied after discounts; applyOn: 'taxableBase' | 'subtotal')
export interface Charge {
  name: string;
  kind: ChargeKind;
  value: number; // fixed amount or percent (0-100)
  applyOn?: "subtotal" | "taxableBase" | "netAfterDiscount"; // default netAfterDiscount
  // note: taxes/charges can be applied to different bases as configured
}

// Tax rule (fully configurable; supports inclusive/exclusive)
export interface TaxRule {
  name: string;
  rate: number; // percent e.g., 18 for 18%
  inclusive?: boolean; // if true, configured base values are GST-inclusive
  applyOn?: "taxableBase" | "subtotal" | "charges" | "netAfterDiscount"; // default taxableBase
  enabled?: boolean; // toggle tax on/off
  threshold?: number; // minimum base amount to apply tax
  compound?: boolean; // if true, apply on base + previous taxes
}

// Config for calculation behavior
export interface BillingConfig {
  decimalPlaces?: number; // final rounding decimals (default 2)
  roundOff?: boolean; // apply rounding to final total (default true)
  globalDiscount?: GlobalDiscount;
  decimalInternalPrecision?: number; // internal precision (default 6)
  billingIdPrefix?: string; // prefix for auto-generated billing id
  currency?: string; // base currency code (default 'USD')
  exchangeRates?: Record<string, number>; // exchange rates from base to other currencies
  taxPreset?: string; // predefined tax regime (e.g., 'india', 'usa')
}

// ---------- Output Types ----------

export interface ItemBreakdown {
  index: number;
  sku?: string;
  name: string;
  qty: number;
  unitPrice: Decimal;
  basePrice: Decimal; // qty * unitPrice
  itemDiscount: Decimal; // absolute value
  netPrice: Decimal; // basePrice - itemDiscount
  taxableAmount: Decimal; // 0 if taxFree true, else netPrice (for per-item taxes)
  taxesApplied: { name: string; amount: Decimal; formula: string }[];
  total: Decimal; // netPrice + taxes (if taxes applied at item-level)
  formula: string;
}

export interface ChargeBreakdown {
  name: string;
  kind: ChargeKind;
  value: number;
  applyOn: string;
  amount: Decimal;
  formula: string;
}

export interface TaxBreakdown {
  name: string;
  rate: number;
  inclusive: boolean;
  applyOn: string;
  amount: Decimal;
  formula: string;
}

export interface BillingResult {
  billingId: string;
  timestamp: string;
  currency: string; // base currency
  subtotal: Decimal; // sum of basePrices
  totalItemDiscount: Decimal; // sum of item discounts
  globalDiscount: Decimal; // global discount applied (absolute)
  taxableBase: Decimal; // base for taxes (after discounts, before charges or as configured)
  charges: ChargeBreakdown[];
  taxes: TaxBreakdown[];
  roundOff: Decimal;
  total: Decimal;
  convertedTotals?: Record<string, Decimal>; // totals in other currencies
  items: ItemBreakdown[];
  formula: string[]; // human-readable formula steps
  meta?: Record<string, any>;
}

// ---------- Tax Presets ----------
export const taxPresets: Record<string, TaxRule[]> = {
  india: [
    { name: "CGST", rate: 9, inclusive: true, applyOn: "netAfterDiscount" },
    { name: "SGST", rate: 9, inclusive: true, applyOn: "netAfterDiscount" },
  ],
  usa: [
    { name: "Sales Tax", rate: 8.25, inclusive: false, applyOn: "taxableBase" }, // example for CA
  ],
  eu: [
    { name: "VAT", rate: 20, inclusive: false, applyOn: "taxableBase" }, // standard rate
  ],
  uk: [
    { name: "VAT", rate: 20, inclusive: false, applyOn: "taxableBase" },
  ],
  canada: [
    { name: "GST", rate: 5, inclusive: false, applyOn: "taxableBase" },
    { name: "PST", rate: 7, inclusive: false, applyOn: "taxableBase" }, // example for BC
  ],
  australia: [
    { name: "GST", rate: 10, inclusive: false, applyOn: "taxableBase" },
  ],
};

export type TaxPreset = keyof typeof taxPresets;


// ---------- Validation Helpers ----------
function validatePayload(payload: {
  billingId?: string | null;
  config?: BillingConfig | null;
  items: BillItem[];
  charges?: Charge[] | null;
  taxes?: TaxRule[] | null;
  meta?: Record<string, any>;
}): void {
  if (!payload.items || !Array.isArray(payload.items)) {
    throw new ValidationError('Items must be a non-empty array', 'items');
  }
  if (payload.items.length === 0) {
    throw new ValidationError('At least one item is required', 'items');
  }

  payload.items.forEach((item, index) => {
    if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) {
      throw new ValidationError(`Item ${index}: name is required and must be a non-empty string`, `items[${index}].name`);
    }
    if (typeof item.qty !== 'number' || item.qty < 0) {
      throw new ValidationError(`Item ${index}: qty must be a non-negative number`, `items[${index}].qty`);
    }
    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
      throw new ValidationError(`Item ${index}: unitPrice must be a non-negative number`, `items[${index}].unitPrice`);
    }
    if (item.discount) {
      if (item.discount.kind === DiscountKind.PERCENT && (item.discount.value < 0 || item.discount.value > 100)) {
        throw new ValidationError(`Item ${index}: discount percentage must be between 0 and 100`, `items[${index}].discount.value`);
      }
      if (item.discount.kind === DiscountKind.FIXED && item.discount.value < 0) {
        throw new ValidationError(`Item ${index}: discount fixed value must be non-negative`, `items[${index}].discount.value`);
      }
    }
  });

  if (payload.charges) {
    payload.charges.forEach((charge, index) => {
      if (!charge.name || typeof charge.name !== 'string' || charge.name.trim().length === 0) {
        throw new ValidationError(`Charge ${index}: name is required and must be a non-empty string`, `charges[${index}].name`);
      }
      if (typeof charge.value !== 'number' || charge.value < 0) {
        throw new ValidationError(`Charge ${index}: value must be a non-negative number`, `charges[${index}].value`);
      }
      if (charge.applyOn && !['subtotal', 'taxableBase', 'netAfterDiscount'].includes(charge.applyOn)) {
        throw new ValidationError(`Charge ${index}: applyOn must be one of 'subtotal', 'taxableBase', 'netAfterDiscount'`, `charges[${index}].applyOn`);
      }
    });
  }

  if (payload.taxes) {
    payload.taxes.forEach((tax, index) => {
      if (!tax.name || typeof tax.name !== 'string' || tax.name.trim().length === 0) {
        throw new ValidationError(`Tax ${index}: name is required and must be a non-empty string`, `taxes[${index}].name`);
      }
      if (typeof tax.rate !== 'number' || tax.rate < 0) {
        throw new ValidationError(`Tax ${index}: rate must be a non-negative number`, `taxes[${index}].rate`);
      }
      if (tax.applyOn && !['subtotal', 'taxableBase', 'charges', 'netAfterDiscount'].includes(tax.applyOn)) {
        throw new ValidationError(`Tax ${index}: applyOn must be one of 'subtotal', 'taxableBase', 'charges', 'netAfterDiscount'`, `taxes[${index}].applyOn`);
      }
    });
  }

  if (payload.config) {
    const config = payload.config;
    if (config.decimalPlaces !== undefined && (typeof config.decimalPlaces !== 'number' || config.decimalPlaces < 0 || config.decimalPlaces > 10)) {
      throw new ValidationError('Config: decimalPlaces must be a number between 0 and 10', 'config.decimalPlaces');
    }
    if (config.decimalInternalPrecision !== undefined && (typeof config.decimalInternalPrecision !== 'number' || config.decimalInternalPrecision < 0 || config.decimalInternalPrecision > 15)) {
      throw new ValidationError('Config: decimalInternalPrecision must be a number between 0 and 15', 'config.decimalInternalPrecision');
    }
    if (config.globalDiscount) {
      const g = config.globalDiscount;
      if (g.kind === DiscountKind.PERCENT && (g.value < 0 || g.value > 100)) {
        throw new ValidationError('Config: globalDiscount percentage must be between 0 and 100', 'config.globalDiscount.value');
      }
      if (g.kind === DiscountKind.FIXED && g.value < 0) {
        throw new ValidationError('Config: globalDiscount fixed value must be non-negative', 'config.globalDiscount.value');
      }
    }
    if (config.exchangeRates) {
      for (const [curr, rate] of Object.entries(config.exchangeRates)) {
        if (typeof rate !== 'number' || rate <= 0) {
          throw new ValidationError(`Config: exchangeRates.${curr} must be a positive number`, `config.exchangeRates.${curr}`);
        }
      }
    }
    if (config.taxPreset && !taxPresets[config.taxPreset]) {
      throw new ValidationError(`Config: unknown tax preset '${config.taxPreset}'`, 'config.taxPreset');
    }
  }
}

// ---------- Core Calculation Function ----------

export function calculateBill(payload: {
  billingId?: string | null;
  config?: BillingConfig | null;
  items: BillItem[];
  charges?: Charge[] | null;
  taxes?: TaxRule[] | null;
  meta?: Record<string, any>;
}): BillingResult {
  validatePayload(payload);
  // defaults
  const config: BillingConfig = {
    decimalPlaces: 2,
    roundOff: true,
    globalDiscount: null,
    decimalInternalPrecision: 6,
    billingIdPrefix: "BILL",
    currency: "USD",
    ...(payload.config || {}),
  };

  const decimalPlaces = config.decimalPlaces ?? 2;
  const internalPrecision = config.decimalInternalPrecision ?? 6;

  const billingId =
    payload.billingId && payload.billingId.trim().length > 0
      ? payload.billingId
      : genBillingId(config.billingIdPrefix);

  const ts = nowIso();

  const items = payload.items || [];
  const charges = payload.charges || [];
  let taxes = (payload.taxes || []).filter((t) => t.enabled !== false); // default enabled

  // Merge tax preset
  if (config.taxPreset) {
    if (!taxPresets[config.taxPreset]) {
      throw new ValidationError(`Unknown tax preset: ${config.taxPreset}`, 'config.taxPreset');
    }
    taxes = taxes.concat(taxPresets[config.taxPreset].filter((t) => t.enabled !== false));
  }

  // Step 1: per-item processing
  const itemBreakdowns: ItemBreakdown[] = [];
  let subtotal = 0;
  let totalItemDiscount = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const originalUnitPrice = it.unitPrice ?? 0;
    let unitPrice = originalUnitPrice;
    // Convert to base currency if different
    if (it.currency && it.currency !== config.currency && config.exchangeRates?.[it.currency]) {
      unitPrice = unitPrice / config.exchangeRates[it.currency];
    }
    const qty = it.qty ?? 0;
    const basePriceRaw = qty * unitPrice;
    const basePrice = internalRound(basePriceRaw, internalPrecision);

    // item-level discount absolute
    let itemDiscountAbs = 0;
    if (it.discount) {
      if (it.discount.kind === DiscountKind.FIXED) {
        itemDiscountAbs = it.discount.value;
      } else {
        itemDiscountAbs = basePrice * (it.discount.value / 100);
      }
      itemDiscountAbs = internalRound(itemDiscountAbs, internalPrecision);
      // guard: discount cannot exceed basePrice
      if (itemDiscountAbs > basePrice) itemDiscountAbs = basePrice;
    }

    const netPrice = internalRound(
      basePrice - itemDiscountAbs,
      internalPrecision
    );
    const taxableAmount = it.taxFree ? 0 : netPrice;

    // taxes applied at item level if tax rules configure applyOn 'taxableBase' with per-item basis.
    // For simplicity, we capture taxes per-item only if tax.applyOn === 'taxableBase' (per-item)
    const taxesApplied: { name: string; amount: number; formula: string }[] =
      [];
    for (const t of taxes) {
      // Only apply per-item when tax.applyOn is 'taxableBase' (per-item) OR when applyOn indicates per-item behavior
      const applyOn = t.applyOn ?? "taxableBase";
      if (applyOn !== "taxableBase") continue;

      if (taxableAmount <= 0) {
        taxesApplied.push({
          name: t.name,
          amount: 0,
          formula: "Tax exempt or zero taxable amount",
        });
        continue;
      }

      if (t.inclusive) {
        // If inclusive, extract tax portion from taxableAmount (consider taxableAmount is inclusive)
        // netTaxable = taxableAmount / (1 + rate/100)
        const netBase = internalRound(
          taxableAmount / (1 + t.rate / 100),
          internalPrecision
        );
        const taxAmount = internalRound(
          taxableAmount - netBase,
          internalPrecision
        );
        taxesApplied.push({
          name: t.name,
          amount: taxAmount,
          formula: `Inclusive: ${taxableAmount} - (${taxableAmount} ÷ (1 + ${t.rate}/100)) = ${taxAmount}`,
        });
      } else {
        const taxAmount = internalRound(
          taxableAmount * (t.rate / 100),
          internalPrecision
        );
        taxesApplied.push({
          name: t.name,
          amount: taxAmount,
          formula: `${taxableAmount} × ${t.rate}/100 = ${taxAmount}`,
        });
      }
    }

    // item total = netPrice + sum(item-level taxes)
    const itemTaxesSum = taxesApplied.reduce((s, x) => s + x.amount, 0);
    const itemTotal = internalRound(netPrice + itemTaxesSum, internalPrecision);

    itemBreakdowns.push({
      index: i,
      sku: it.sku,
      name: it.name,
      qty,
      unitPrice: roundTo(originalUnitPrice, decimalPlaces),
      basePrice: roundTo(basePrice, decimalPlaces),
      itemDiscount: roundTo(itemDiscountAbs, decimalPlaces),
      netPrice: roundTo(netPrice, decimalPlaces),
      taxableAmount: roundTo(taxableAmount, decimalPlaces),
      taxesApplied: taxesApplied.map((t) => ({
        name: t.name,
        amount: roundTo(t.amount, decimalPlaces),
        formula: t.formula,
      })),
      total: roundTo(itemTotal, decimalPlaces),
      formula: `(${basePrice} - ${itemDiscountAbs}) + taxes`,
    });

    subtotal += basePrice;
    totalItemDiscount += itemDiscountAbs;
  }

  subtotal = internalRound(subtotal, internalPrecision);
  totalItemDiscount = internalRound(totalItemDiscount, internalPrecision);

  // Step 2: global discount (applied on net after item discounts)
  const netAfterItemDiscounts = internalRound(
    subtotal - totalItemDiscount,
    internalPrecision
  );

  let globalDiscountAbs = 0;
  if (config.globalDiscount) {
    const g = config.globalDiscount;
    if (g.kind === DiscountKind.FIXED) {
      globalDiscountAbs = g.value;
    } else {
      globalDiscountAbs = internalRound(
        netAfterItemDiscounts * (g.value / 100),
        internalPrecision
      );
    }
    if (globalDiscountAbs > netAfterItemDiscounts)
      globalDiscountAbs = netAfterItemDiscounts;
  }

  const netAfterGlobalDiscount = internalRound(
    netAfterItemDiscounts - globalDiscountAbs,
    internalPrecision
  );

  // taxableBase: by default, taxes apply on netAfterGlobalDiscount unless tax rule specifies otherwise
  // We'll compute taxes later with applyOn semantics.

  // Step 3: compute charges
  const chargeBreakdowns: ChargeBreakdown[] = [];
  let totalCharges = 0;
  for (const ch of charges) {
    const applyOn = ch.applyOn ?? "netAfterDiscount";
    let baseForCharge = 0;
    if (applyOn === "subtotal") baseForCharge = subtotal;
    else if (applyOn === "taxableBase") baseForCharge = netAfterGlobalDiscount;
    else baseForCharge = netAfterGlobalDiscount;

    let amount = 0;
    if (ch.kind === ChargeKind.FIXED) amount = ch.value;
    else
      amount = internalRound(
        baseForCharge * (ch.value / 100),
        internalPrecision
      );

    amount = internalRound(amount, internalPrecision);
    chargeBreakdowns.push({
      name: ch.name,
      kind: ch.kind,
      value: ch.value,
      applyOn,
      amount: roundTo(amount, decimalPlaces),
      formula:
        ch.kind === ChargeKind.FIXED
          ? `${ch.value}`
          : `${baseForCharge} × ${ch.value}/100 = ${amount}`,
    });
    totalCharges += amount;
  }
  totalCharges = internalRound(totalCharges, internalPrecision);

  // Step 4: compute taxes (respecting applyOn)
  const taxBreakdowns: TaxBreakdown[] = [];
  let totalExclusiveTaxes = 0;
  let totalInclusiveTaxes = 0; // just for reporting, already embedded
  let totalTaxSoFar = 0;

  for (const t of taxes) {
    const applyOn = t.applyOn ?? "taxableBase";
    let base = 0;
    if (applyOn === "subtotal") base = subtotal;
    else if (applyOn === "taxableBase") base = netAfterGlobalDiscount;
    else if (applyOn === "charges") base = totalCharges;
    else base = netAfterGlobalDiscount + totalCharges; // netAfterDiscount + charges

    let effectiveBase = base;
    if (t.compound) effectiveBase += totalTaxSoFar;

    // Check threshold
    if (t.threshold && effectiveBase < t.threshold) {
      taxBreakdowns.push({
        name: t.name,
        rate: t.rate,
        inclusive: t.inclusive ?? false,
        applyOn,
        amount: 0,
        formula: `Below threshold: ${effectiveBase} < ${t.threshold}`,
      });
      continue;
    }

    let taxAmount = 0;
    if (t.inclusive) {
      // Extract tax portion
      const netBase = internalRound(
        effectiveBase / (1 + t.rate / 100),
        internalPrecision
      );
      taxAmount = internalRound(effectiveBase - netBase, internalPrecision);
      totalInclusiveTaxes += taxAmount;
      taxBreakdowns.push({
        name: t.name,
        rate: t.rate,
        inclusive: true,
        applyOn,
        amount: roundTo(taxAmount, decimalPlaces),
        formula: `Inclusive${t.compound ? ' (compound)' : ''}: ${effectiveBase} - (${effectiveBase} ÷ (1 + ${t.rate}/100)) = ${taxAmount}`,
      });
    } else {
      // Additive tax
      taxAmount = internalRound(effectiveBase * (t.rate / 100), internalPrecision);
      totalExclusiveTaxes += taxAmount;
      taxBreakdowns.push({
        name: t.name,
        rate: t.rate,
        inclusive: false,
        applyOn,
        amount: roundTo(taxAmount, decimalPlaces),
        formula: `${effectiveBase} × ${t.rate}/100${t.compound ? ' (compound)' : ''} = ${taxAmount}`,
      });
    }
    totalTaxSoFar += taxAmount;
  }

  totalExclusiveTaxes = internalRound(totalExclusiveTaxes, internalPrecision);
  totalInclusiveTaxes = internalRound(totalInclusiveTaxes, internalPrecision);

  // Step 5: final total
  // Inclusive taxes are already inside netAfterGlobalDiscount + charges
  const beforeRoundTotal = internalRound(
    netAfterGlobalDiscount + totalCharges + totalExclusiveTaxes,
    internalPrecision
  );

  let finalTotal = beforeRoundTotal;
  let roundDiff = 0;
  if (config.roundOff) {
    const rounded = roundTo(finalTotal, decimalPlaces);
    roundDiff = internalRound(rounded - finalTotal, internalPrecision);
    finalTotal = rounded;
  } else {
    finalTotal = roundTo(finalTotal, decimalPlaces);
  }

  // Build formulas (human-readable steps)
  const formulaSteps: string[] = [];
  formulaSteps.push(
    `Subtotal = sum(qty × unitPrice) = ${roundTo(subtotal, decimalPlaces)}`
  );
  formulaSteps.push(
    `Total item discounts = ${roundTo(totalItemDiscount, decimalPlaces)}`
  );
  if (globalDiscountAbs > 0) {
    formulaSteps.push(
      `Global discount = ${roundTo(globalDiscountAbs, decimalPlaces)}`
    );
  }
  formulaSteps.push(
    `Net after discounts = ${roundTo(netAfterGlobalDiscount, decimalPlaces)}`
  );
  if (totalCharges > 0)
    formulaSteps.push(
      `Total charges = ${roundTo(totalCharges, decimalPlaces)}`
    );
  if (totalInclusiveTaxes > 0)
    formulaSteps.push(
      `Inclusive taxes (already in price) = ${roundTo(
        totalInclusiveTaxes,
        decimalPlaces
      )}`
    );
  if (totalExclusiveTaxes > 0)
    formulaSteps.push(
      `Exclusive taxes (added) = ${roundTo(totalExclusiveTaxes, decimalPlaces)}`
    );
  formulaSteps.push(
    `Total (before rounding) = ${roundTo(beforeRoundTotal, decimalPlaces)}`
  );
  if (config.roundOff)
    formulaSteps.push(
      `Round off (difference) = ${roundTo(roundDiff, decimalPlaces)}`
    );
  formulaSteps.push(`Final total = ${roundTo(finalTotal, decimalPlaces)}`);

  // Compute converted totals if exchange rates provided
  let convertedTotals: Record<string, Decimal> | undefined;
  if (config.exchangeRates) {
    convertedTotals = {};
    for (const [curr, rate] of Object.entries(config.exchangeRates)) {
      convertedTotals[curr] = roundTo(finalTotal * rate, decimalPlaces);
    }
  }

  // Assemble result
  const result: BillingResult = {
    billingId,
    timestamp: ts,
    currency: config.currency!,
    subtotal: roundTo(subtotal, decimalPlaces),
    totalItemDiscount: roundTo(totalItemDiscount, decimalPlaces),
    globalDiscount: roundTo(globalDiscountAbs, decimalPlaces),
    taxableBase: roundTo(netAfterGlobalDiscount, decimalPlaces),
    charges: chargeBreakdowns,
    taxes: taxBreakdowns,
    roundOff: roundTo(roundDiff, decimalPlaces),
    total: roundTo(finalTotal, decimalPlaces),
    convertedTotals,
    items: itemBreakdowns,
    formula: formulaSteps,
    meta: payload.meta ?? {},
  };

  return result;
}
