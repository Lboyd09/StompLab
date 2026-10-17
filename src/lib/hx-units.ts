import { SYNC_NOTES, type HxParam } from "@/data/hx-catalog";

/**
 * One mapping between the 0–10 knobs a preset stores and HX Edit's native values,
 * shared by the exporter and the replica readouts so the screen and the file agree.
 *
 * - On/off params: 5 and up is on.
 * - Whole-number params (note sync, mic, interval, mode) carry their native value as-is.
 * - 0–1 knobs: value / 10.
 * - dB faders (−60 … +6/+12/+36): 5 is unity, up is linear to max, down follows a fader taper.
 * - Symmetric EQ gains (−15 … +15): 5 is flat.
 * - Negative-only ranges (thresholds): linear across the range.
 * - Low cut: 20 Hz + 30 Hz per step (2.2 ≈ 86 Hz on a guitar cab); bass cabs are capped lower in hx-params.
 * - High cut: the linear 1.5–20.1 kHz curve presets were written against.
 * - Other frequencies: logarithmic across the range.
 * - Delay Time and reverb Predelay: value / 10 seconds (5 = 500 ms), as presets were tuned.
 * - Everything else: linear across the range.
 */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number, places = 4) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

export type ParamCurve =
  | "bool"
  | "int"
  | "unit"
  | "fader"
  | "eq"
  | "negative"
  | "lowcut"
  | "highcut"
  | "log"
  | "time"
  | "linear";

export function curveFor(p: HxParam): ParamCurve {
  if (p.type === "b") return "bool";
  if (p.type === "i") return "int";
  if (p.min === 0 && p.max === 1) return "unit";
  if (/low_cut/i.test(p.unit) || p.key === "LowCut") return "lowcut";
  if (/high_cut/i.test(p.unit) || p.key === "HighCut") return "highcut";
  if (/thresh/i.test(p.key)) return p.max <= 0 ? "negative" : "linear";
  if (p.unit === "volume" || p.unit === "volume_eq") {
    if (p.min < 0 && p.max > 0) {
      if (p.unit === "volume_eq" || Math.abs(p.min + p.max) < 1) return "eq";
      return "fader";
    }
    if (p.max <= 0) return "negative";
    return "linear";
  }
  if (p.unit === "frequency" && p.min > 0 && p.max / p.min > 8) return "log";
  if ((p.key === "Time" || p.key === "Predelay" || p.key === "PreDelay") && /^time_ms/.test(p.unit)) return "time";
  return "linear";
}

export function uiToNative(p: HxParam, ui: number | boolean): number | boolean {
  if (typeof ui === "boolean") {
    if (p.type === "b") return ui;
    ui = ui ? 10 : 0;
  }
  const n = Number.isFinite(ui) ? ui : 5;
  switch (curveFor(p)) {
    case "bool":
      return n >= 5;
    case "int":
      return clamp(Math.round(n), p.min, p.max);
    case "unit":
      return round(clamp(n / 10, 0, 1));
    case "fader": {
      const u = clamp(n, 0, 10);
      if (u >= 5) return round(((u - 5) / 5) * p.max, 2);
      if (u <= 0) return p.min;
      return round(Math.max(p.min, 20 * Math.log10(u / 5)), 2);
    }
    case "eq": {
      const u = clamp(n, 0, 10);
      const span = u >= 5 ? p.max : -p.min;
      return round(((u - 5) / 5) * span, 2);
    }
    case "negative":
      return round(p.min + (clamp(n, 0, 10) / 10) * (p.max - p.min), 2);
    case "lowcut":
      return round(clamp(20 + 30 * clamp(n, 0, 10), p.min, p.max), 1);
    case "highcut":
      return Math.round(clamp(1500 + clamp(n, 0, 10) * 1860, p.min, p.max));
    case "log": {
      const u = clamp(n, 0, 10) / 10;
      return round(p.min * (p.max / p.min) ** u, 1);
    }
    case "time":
      return round(clamp(clamp(n, 0, 10) / 10, p.min, p.max), 3);
    default:
      return round(p.min + (clamp(n, 0, 10) / 10) * (p.max - p.min), 3);
  }
}

export function nativeToUi(p: HxParam, native: number | boolean): number {
  if (typeof native === "boolean") return native ? 10 : 0;
  const v = native;
  const r1 = (n: number) => Math.round(clamp(n, 0, 10) * 10) / 10;
  switch (curveFor(p)) {
    case "bool":
      return v ? 10 : 0;
    case "int":
      return Math.round(v);
    case "unit":
      return r1(v * 10);
    case "fader":
      if (v >= 0) return r1(5 + (p.max ? (v / p.max) * 5 : 0));
      if (v <= p.min) return 0;
      return r1(5 * 10 ** (v / 20));
    case "eq": {
      const span = v >= 0 ? p.max : -p.min;
      return r1(5 + (span ? (v / span) * 5 : 0));
    }
    case "negative":
      return r1(((v - p.min) / (p.max - p.min)) * 10);
    case "lowcut":
      return r1((v - 20) / 30);
    case "highcut":
      return r1((v - 1500) / 1860);
    case "log":
      return r1((Math.log(v / p.min) / Math.log(p.max / p.min)) * 10);
    case "time":
      return r1(v * 10);
    default:
      return r1(((v - p.min) / (p.max - p.min || 1)) * 10);
  }
}

function fmtNum(n: number, places: number) {
  const s = n.toFixed(places);
  return s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** What HX Edit would show for this native value. */
export function formatNative(p: HxParam, native: number | boolean): string {
  if (p.type === "b") return native ? "On" : "Off";
  const v = typeof native === "number" ? native : native ? 1 : 0;
  if (p.unit === "sync_note") return SYNC_NOTES[Math.max(1, Math.min(19, Math.round(v))) - 1] ?? String(v);
  if (p.type === "i") return String(Math.round(v));
  if (p.unit === "volume" || p.unit === "volume_eq") {
    if (v <= -60 && p.min <= -60) return "−∞ dB";
    const sign = v > 0 ? "+" : v < 0 ? "−" : "";
    return `${sign}${fmtNum(Math.abs(v), 1)} dB`;
  }
  if (/cut|frequency/.test(p.unit) || /Hz$|Freq/.test(p.key)) {
    return v >= 1000 ? `${fmtNum(v / 1000, 1)} kHz` : `${fmtNum(v, 0)} Hz`;
  }
  if (/^time_ms|comp_attack|comp_release|comp_decay|comp_hold|time_ms/.test(p.unit)) {
    const ms = v * 1000;
    return ms >= 1000 ? `${fmtNum(ms / 1000, 2)} s` : `${fmtNum(ms, ms < 10 ? 1 : 0)} ms`;
  }
  if (p.unit === "percent") return `${Math.round(v * 100)}%`;
  if (p.min === 0 && p.max === 1) return fmtNum(v * 10, 1);
  if (p.unit === "cab_mic_distance") return `${fmtNum(v, 1)}"`;
  return fmtNum(v, 2);
}

/** Native value → stored with the right JSON type and inside the catalog range. */
export function coerceNative(p: HxParam, value: number | boolean): number | boolean {
  if (p.type === "b") return typeof value === "boolean" ? value : value >= 0.5;
  const n = typeof value === "boolean" ? (value ? 1 : 0) : value;
  if (!Number.isFinite(n)) return p.def;
  if (p.type === "i") return clamp(Math.round(n), p.min, p.max);
  return clamp(n, p.min, p.max);
}
