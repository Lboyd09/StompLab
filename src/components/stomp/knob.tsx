import { useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  onPress?: () => void;
  showValue?: boolean;
  /** Range of the stored value (0–10 for knobs; a choice's real range otherwise). */
  min?: number;
  max?: number;
  step?: number;
  /** What HX Edit shows for the value (dB, Hz, ms, note…). Defaults to the number. */
  display?: string;
  /** Accessible name when the knob has no printed label. */
  ariaLabel?: string;
};

/**
 * Replica encoder. Drag up/down or use arrow keys (Page Up/Down for big steps, Home/End for the ends).
 * A tap never changes the value — it used to reset the knob to noon and wipe a tuned setting.
 */
export function Knob({
  label,
  value,
  onChange,
  disabled,
  size = "md",
  onPress,
  showValue = true,
  min = 0,
  max = 10,
  step = 0.1,
  display,
  ariaLabel,
}: Props) {
  const start = useRef<{ y: number; v: number } | null>(null);
  const moved = useRef(false);
  const span = max - min || 1;
  const clamped = Math.max(min, Math.min(max, value));
  const angle = -135 + ((clamped - min) / span) * 270;
  const dim = size === "lg" ? "size-16" : size === "sm" ? "size-11" : "size-14";
  const snap = (v: number) => {
    const s = Math.round((v - min) / step) * step + min;
    return Math.max(min, Math.min(max, Math.round(s * 1000) / 1000));
  };
  const text = display ?? clamped.toFixed(step >= 1 ? 0 : 1);

  function pointerDown(e: React.PointerEvent) {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, v: value };
    moved.current = false;
  }
  function pointerMove(e: React.PointerEvent) {
    if (!start.current || !onChange) return;
    const dy = start.current.y - e.clientY;
    if (Math.abs(dy) > 3) moved.current = true;
    if (!moved.current) return;
    // About 180px of travel sweeps the whole range, like a hardware encoder.
    onChange(snap(start.current.v + (dy / 180) * span));
  }
  function pointerUp() {
    if (!moved.current && onPress) onPress();
    start.current = null;
  }
  function keyDown(e: React.KeyboardEvent) {
    if (disabled || !onChange) return;
    const big = Math.max(step, span / 10);
    const next =
      e.key === "ArrowUp" || e.key === "ArrowRight"
        ? value + step
        : e.key === "ArrowDown" || e.key === "ArrowLeft"
          ? value - step
          : e.key === "PageUp"
            ? value + big
            : e.key === "PageDown"
              ? value - big
              : e.key === "Home"
                ? min
                : e.key === "End"
                  ? max
                  : null;
    if (next === null) return;
    e.preventDefault();
    onChange(snap(next));
  }

  const isSlider = Boolean(onChange);
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        role={isSlider ? "slider" : undefined}
        aria-label={ariaLabel ?? (label || (onPress ? "Select" : "Knob"))}
        aria-valuemin={isSlider ? min : undefined}
        aria-valuemax={isSlider ? max : undefined}
        aria-valuenow={isSlider ? clamped : undefined}
        aria-valuetext={isSlider ? text : undefined}
        disabled={disabled}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={() => (start.current = null)}
        onKeyDown={keyDown}
        className={cn("hx-knob relative rounded-full touch-none", dim, disabled && "opacity-40")}
      >
        <span className="pointer-events-none absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="hx-knob-tick absolute left-1/2 top-[5px] h-[8px] w-[2px] -translate-x-1/2 rounded-full" />
        </span>
      </button>
      {(label || (showValue && onChange)) && (
        <div className="max-w-[5.5rem] text-center leading-tight">
          {label ? <div className="hx-silk truncate">{label}</div> : null}
          {showValue && onChange ? (
            <div className="truncate font-mono text-[11px] tabular-nums text-zinc-300">{text}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
