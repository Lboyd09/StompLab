import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GEAR_SUGGESTIONS, type GearSuggestion } from "@/data/gear-catalog";

export function GearPicker({
  kind,
  name,
  onName,
}: {
  kind: GearSuggestion["kind"];
  name: string;
  onName: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const ignoreBlur = useRef(false);

  const hits = useMemo(() => {
    const needle = name.trim().toLowerCase();
    const pool = GEAR_SUGGESTIONS.filter((g) => g.kind === kind);
    if (!needle) return pool.slice(0, 8);
    return pool.filter((g) => g.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [kind, name]);

  useEffect(() => {
    setHi(0);
  }, [kind, name]);

  function pick(value: string) {
    ignoreBlur.current = true;
    onName(value);
    setOpen(false);
    window.setTimeout(() => {
      ignoreBlur.current = false;
    }, 200);
  }

  return (
    <div className="relative space-y-1.5" ref={box}>
      <Label htmlFor="gname">Name</Label>
      <Input
        id="gname"
        value={name}
        onChange={(e) => {
          onName(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            if (!ignoreBlur.current) setOpen(false);
          }, 180);
        }}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((i) => (i + 1) % hits.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((i) => (i - 1 + hits.length) % hits.length);
          } else if (e.key === "Enter" && hits[hi]) {
            e.preventDefault();
            pick(hits[hi].name);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Start typing — Strat, Les Paul, Dual Rectifier…"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="gear-suggest-list"
      />
      {open && hits.length ? (
        <ul
          id="gear-suggest-list"
          role="listbox"
          className="sl-menu absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {hits.map((g, i) => (
            <li key={g.name} role="option" aria-selected={i === hi}>
              <button
                type="button"
                className={`flex min-h-11 w-full items-center px-3 py-2 text-left text-sm ${
                  i === hi ? "bg-secondary" : "hover:bg-secondary"
                }`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(g.name);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  pick(g.name);
                }}
              >
                {g.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Pick a known model from the list or type your own. Research uses this name when it recommends
        what to grab.
      </p>
    </div>
  );
}
