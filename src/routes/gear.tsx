import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { newId } from "@/lib/preset-utils";
import { useAppStore } from "@/store/app-store";
import type { UserGear } from "@/data/types";

export const Route = createFileRoute("/gear")({ component: GearPage });

const KINDS: UserGear["kind"][] = ["guitar", "bass", "amp", "cab", "pedal", "pickup"];

function GearPage() {
  const gear = useAppStore((s) => s.gear);
  const addGear = useAppStore((s) => s.addGear);
  const removeGear = useAppStore((s) => s.removeGear);
  const [kind, setKind] = useState<UserGear["kind"]>("guitar");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addGear({ id: newId("gear"), kind, name: name.trim(), notes: notes.trim() });
    setName("");
    setNotes("");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Your locker</h1>
        <p className="text-sm text-muted-foreground">
          Add the guitars, basses, amps, and pedals you actually own. Song research will tell you
          which piece to grab — and when to skip the Stomp amp and run four-cable method into a real
          head.
        </p>
      </header>

      <form onSubmit={onAdd} className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`h-8 rounded-full px-3 text-xs capitalize ${
                kind === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gname">Name</Label>
          <Input
            id="gname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="1962 Strat, Jazz Bass, AC30, real Tube Screamer…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gnotes">Notes</Label>
          <Textarea
            id="gnotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="SSS, 7.25 radius, Texas Specials. Or: 50W JCM800 into Greenbacks."
            className="min-h-24"
          />
        </div>
        <Button type="submit">Add to locker</Button>
      </form>

      {gear.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Empty locker. Add at least a guitar or bass so recommendations have something to aim at.
        </p>
      ) : (
        <ul className="space-y-2">
          {gear.map((g) => (
            <li
              key={g.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{g.kind}</div>
                <div className="font-medium">{g.name}</div>
                {g.notes ? <p className="mt-1 text-sm text-muted-foreground">{g.notes}</p> : null}
              </div>
              <Button variant="ghost" size="icon" aria-label={`Remove ${g.name}`} onClick={() => removeGear(g.id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
