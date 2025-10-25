export interface BillItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  addons?: BillItem[];
  variations?: BillItem[];
  discounts?: Discount[];
}

export interface Discount {
  id: string;
  type: "PERCENT" | "FIXED" | "TIERED";
  value?: number;
  tiers?: { minSubtotal: number; rate: number }[];
}

export interface TaxRule {
  name: string;
  rate: number;
  applyOn?: "subtotal" | "taxableBase";
  inclusive?: boolean;
  compound?: boolean;
}

export interface BillConfig {
  currency: string;
  exchangeRate?: number;
  decimalPlaces?: number;
  roundOff?: boolean;
}

export interface BillPlugin {
  name: string;
  version?: string;
  setup?: (bill: BillContext) => BillContext;
  transform?: (
    phase: "beforeCalc" | "afterCalc",
    bill: BillContext
  ) => BillContext;
}

export interface BillResult {
  subtotal: number;
  discounts: number;
  taxes: number;
  total: number;
  breakdown: {
    items: Array<{ id: string; name: string; total: number }>;
    taxBreakdown: Array<{
      name: string;
      rate: number;
      inclusive?: boolean;
      amount: number;
    }>;
    discountBreakdown?: Array<{
      id: string;
      type: string;
      amount: number;
    }>;
  };
  meta: Record<string, any>;
}

export interface BillContext {
  items: BillItem[];
  discounts: Discount[];
  taxes: TaxRule[];
  config: BillConfig;
  plugins: BillPlugin[];
  meta: Record<string, any>;
  result?: BillResult;
}
