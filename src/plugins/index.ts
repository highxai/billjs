import type { BillContext, BillPlugin, Discount, TaxRule } from "../types";

export const loyaltyPointsPlugin = (opts: { rate: number }): BillPlugin => ({
  name: "loyalty",
  version: "1.0.0",
  transform: (phase, ctx) => {
    if (phase === "afterCalc" && ctx.result) {
      const points = Math.floor(ctx.result.total * opts.rate);
      return {
        ...ctx,
        meta: {
          ...ctx.meta,
          loyaltyPoints: points,
        },
      };
    }
    return ctx;
  },
});

export const regionTaxPlugin = (opts: {
  region: string;
  vatRates: Record<string, number>;
}): BillPlugin => ({
  name: "region-vat",
  version: "1.0.0",
  transform: (phase, ctx) => {
    if (phase === "beforeCalc") {
      const rate = opts.vatRates[opts.region] ?? 0;
      if (rate > 0) {
        const vatRule: TaxRule = {
          name: `${opts.region} VAT`,
          rate,
          compound: false,
          inclusive: false,
        };
        return {
          ...ctx,
          taxes: [...ctx.taxes, vatRule],
        };
      }
    }
    return ctx;
  },
});

export const promoPlugin = (opts: {
  code: string;
  validate: (code: string, bill: BillContext) => boolean;
  discount: Discount;
}): BillPlugin => ({
  name: "promo",
  version: "1.0.0",
  transform: (phase, ctx) => {
    if (phase === "beforeCalc" && opts.validate(opts.code, ctx)) {
      return {
        ...ctx,
        discounts: [...ctx.discounts, opts.discount],
        meta: {
          ...ctx.meta,
          appliedPromo: opts.code,
        },
      };
    }
    return ctx;
  },
});
