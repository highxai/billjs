export type Decimal = number; // numeric values; rounding controlled by config

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
}

// Config for calculation behavior
export interface BillingConfig {
  decimalPlaces?: number; // final rounding decimals (default 2)
  roundOff?: boolean; // apply rounding to final total (default true)
  globalDiscount?: GlobalDiscount;
  decimalInternalPrecision?: number; // internal precision (default 6)
  billingIdPrefix?: string; // prefix for auto-generated billing id
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
  subtotal: Decimal; // sum of basePrices
  totalItemDiscount: Decimal; // sum of item discounts
  globalDiscount: Decimal; // global discount applied (absolute)
  taxableBase: Decimal; // base for taxes (after discounts, before charges or as configured)
  charges: ChargeBreakdown[];
  taxes: TaxBreakdown[];
  roundOff: Decimal;
  total: Decimal;
  items: ItemBreakdown[];
  formula: string[]; // human-readable formula steps
  meta?: Record<string, any>;
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
  // defaults
  const config: BillingConfig = {
    decimalPlaces: 2,
    roundOff: true,
    globalDiscount: null,
    decimalInternalPrecision: 6,
    billingIdPrefix: "BILL",
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
  const taxes = (payload.taxes || []).filter((t) => t.enabled !== false); // default enabled

  // Step 1: per-item processing
  const itemBreakdowns: ItemBreakdown[] = [];
  let subtotal = 0;
  let totalItemDiscount = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const qty = it.qty ?? 0;
    const unitPrice = it.unitPrice ?? 0;
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
      unitPrice: roundTo(unitPrice, decimalPlaces),
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

  // Step 4: compute taxes (respecting applyOn: taxableBase|subtotal|charges|netAfterDiscount)
  const taxBreakdowns: TaxBreakdown[] = [];
  let totalTaxes = 0;

  for (const t of taxes) {
    const applyOn = t.applyOn ?? "taxableBase";
    let base = 0;
    if (applyOn === "subtotal") base = subtotal;
    else if (applyOn === "taxableBase") base = netAfterGlobalDiscount;
    else if (applyOn === "charges") base = totalCharges;
    else base = netAfterGlobalDiscount + totalCharges; // netAfterDiscount + charges

    let taxAmount = 0;
    if (t.inclusive) {
      // if inclusive, we assume base is already inclusive of this tax; extract portion
      const netBase = internalRound(
        base / (1 + t.rate / 100),
        internalPrecision
      );
      taxAmount = internalRound(base - netBase, internalPrecision);
      taxBreakdowns.push({
        name: t.name,
        rate: t.rate,
        inclusive: true,
        applyOn,
        amount: roundTo(taxAmount, decimalPlaces),
        formula: `Inclusive: ${base} - (${base} ÷ (1 + ${t.rate}/100)) = ${taxAmount}`,
      });
    } else {
      taxAmount = internalRound(base * (t.rate / 100), internalPrecision);
      taxBreakdowns.push({
        name: t.name,
        rate: t.rate,
        inclusive: false,
        applyOn,
        amount: roundTo(taxAmount, decimalPlaces),
        formula: `${base} × ${t.rate}/100 = ${taxAmount}`,
      });
    }
    totalTaxes += taxAmount;
  }

  totalTaxes = internalRound(totalTaxes, internalPrecision);

  // Step 5: final total (net + charges + taxes)
  // Note: if taxes were inclusive, they were already embedded in 'base' for that tax — but for totals we include tax amounts explicitly.
  const beforeRoundTotal = internalRound(
    netAfterGlobalDiscount + totalCharges + totalTaxes,
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
  if (totalTaxes > 0)
    formulaSteps.push(`Total taxes = ${roundTo(totalTaxes, decimalPlaces)}`);
  formulaSteps.push(
    `Total (before rounding) = ${roundTo(beforeRoundTotal, decimalPlaces)}`
  );
  if (config.roundOff)
    formulaSteps.push(
      `Round off (difference) = ${roundTo(roundDiff, decimalPlaces)}`
    );
  formulaSteps.push(`Final total = ${roundTo(finalTotal, decimalPlaces)}`);

  // Assemble result
  const result: BillingResult = {
    billingId,
    timestamp: ts,
    subtotal: roundTo(subtotal, decimalPlaces),
    totalItemDiscount: roundTo(totalItemDiscount, decimalPlaces),
    globalDiscount: roundTo(globalDiscountAbs, decimalPlaces),
    taxableBase: roundTo(netAfterGlobalDiscount, decimalPlaces),
    charges: chargeBreakdowns,
    taxes: taxBreakdowns,
    roundOff: roundTo(roundDiff, decimalPlaces),
    total: roundTo(finalTotal, decimalPlaces),
    items: itemBreakdowns,
    formula: formulaSteps,
    meta: payload.meta ?? {},
  };

  return result;
}
