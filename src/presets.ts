import { TaxRule } from "./index";

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