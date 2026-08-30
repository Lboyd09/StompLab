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
};

export function Knob({
  label,
  value,
  onChange,
  disabled,
  size = "md",
  onPress,
  showValue = true,
}: Props) {
  const start = useRef<{ y: number; v: number } | null>(null);
  const moved = useRef(false);
  const clamped = Math.max(0, Math.min(10, value));
  const angle = -135 + (clamped / 10) * 270;
  const dim = size === "lg" ? "size-16" : size === "sm" ? "size-[38px]" : "size-14";

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
    const next = start.current.v + dy / 18;
    onChange(Math.max(0, Math.min(10, Math.round(next * 10) / 10)));
  }
  function pointerUp() {
    if (!moved.current) {
      if (onPress) onPress();
      else if (onChange && !disabled) onChange(5);
    }
    start.current = null;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={label || "Knob"}
        disabled={disabled}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        className={cn("hx-knob relative rounded-full touch-none", dim, disabled && "opacity-40")}
      >
        <span className="pointer-events-none absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="hx-knob-tick absolute left-1/2 top-[5px] h-[8px] w-[2px] -translate-x-1/2 rounded-full" />
        </span>
      </button>
      {(label || (showValue && onChange)) && (
        <div className="text-center leading-tight">
          {label ? <div className="hx-silk">{label}</div> : null}
          {showValue && onChange ? (
            <div className="font-mono text-[11px] tabular-nums text-zinc-300">{clamped.toFixed(1)}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
