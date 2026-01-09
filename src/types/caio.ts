// src/types/caio.ts

// All BOS brains + EA overview
export type BrainId = "cfo" | "coo" | "cmo" | "chro" | "cpo" | "ea";

// Axis specification for charts
export interface AxisSpec {
  field: string;     // key in each data row
  label?: string;    // human-readable label for axis
  unit?: string;     // "currency", "index", "%", etc.
}

// Generic chart spec coming from backend tools.charts
export interface ChartSpec {
  id: string;
  brain: BrainId;
  type: "bar";       // later: "line" | "heatmap" | "pie" | ...
  title: string;

  x: AxisSpec;
  y: AxisSpec;

  data: Record<string, any>[];

  /**
   * Optional field indicating which property in each data row
   * defines the series (for grouped bars like Budget vs Actual).
   * Example: "kind" with values "Budget" / "Actual".
   */
  series_field?: string;
}

// -------------------------------------------------------------------
// Recommendation & per-brain payloads
// -------------------------------------------------------------------

export interface BrainRecommendation {
  summary?: string;

  actions_7d?: string[];
  actions_30d?: string[];
  actions_quarter?: string[];
  actions_half_year?: string[];
  actions_year?: string[];

  kpis_to_watch?: string[];
  risks?: string[];
  forecast_note?: string;
}

export interface BrainPayload {
  plan?: Record<string, any>;
  recommendation?: BrainRecommendation;
  confidence?: number;
  tools?: {
    charts?: ChartSpec[];
    // later we can add: tables, downloads, etc.
    [key: string]: any;
  };
  [key: string]: any;
}

// EA-level UI bundle
export interface EAUi {
  executive_summary?: string;
  cross_brain_actions_7d?: string[];
  cross_brain_actions_30d?: string[];
  top_risks?: string[];
  themes?: string[];
  tools?: {
    charts?: ChartSpec[];
    [key: string]: any;
  };
  [key: string]: any;
}

// Response shape from /run-ea backend endpoint
export interface RunEAResponse {
  ui: EAUi;
  per_brain: Partial<Record<Exclude<BrainId, "ea">, BrainPayload>>;
}
