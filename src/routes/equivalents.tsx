import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GeminiHint } from "@/components/layout/gemini-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_MAP } from "@/data/categories";
import { MODEL_MAP, findEquivalents } from "@/data/catalog";
import { notifyResearchError, notifyResearchSource } from "@/lib/notify";
import { lookupEquivalent } from "@/lib/research";
import { useAppStore } from "@/store/app-store";

export const Route = createFileRoute("/equivalents")({ component: EquivalentsPage });

export function EquivalentsPage() {
  const navigate = useNavigate();
  const geminiKey = useAppStore((s) => s.geminiKey);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiHits, setAiHits] = useState<
    { modelId: string; closeness: string; how: string }[] | null
  >(null);

  const local = useMemo(() => findEquivalents(query, 8), [query]);

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true);
    try {
      const result = await lookupEquivalent({ query: query.trim(), apiKey: geminiKey });
      if (!result.ok) {
        notifyResearchError(result, () => void navigate({ to: "/settings" }));
        return;
      }
      setAiHits(result.matches);
      notifyResearchSource(result.source);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Real pedal → HX model</h1>
        <p className="text-sm text-muted-foreground">
          Type a pedal or amp you know — Tube Screamer, Klon, SVT, Dual Rectifier — and get the Line 6
          name plus how close the model actually is. Instant matches are local. Explain uses Gemini
          only if this pedal is not already in the shared library.
        </p>
      </header>

      <form onSubmit={onAsk} className="space-y-3">
        <Label htmlFor="eq">Pedal or amp</Label>
        <div className="flex gap-2">
          <Input
            id="eq"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAiHits(null);
            }}
            placeholder="Ibanez TS808, Klon Centaur, Ampeg SVT…"
          />
          <Button type="submit" disabled={busy || query.trim().length < 2}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Explain"}
          </Button>
        </div>
        <GeminiHint />
      </form>

      {aiHits?.length ? (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">From research</h2>
          {aiHits.map((h) => {
            const m = MODEL_MAP[h.modelId];
            if (!m) return null;
            return (
              <article key={h.modelId} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display font-semibold">{m.name}</h3>
                  <Badge>{h.closeness}</Badge>
                  <span className="text-xs text-muted-foreground">{CATEGORY_MAP[m.category].label}</span>
                </div>
                <p className="mt-1 text-xs text-foreground/80">Based on {m.basedOn}</p>
                <p className="mt-2 text-sm text-muted-foreground">{h.how}</p>
              </article>
            );
          })}
        </section>
      ) : null}

      {local.length ? (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Instant matches</h2>
          {local.map((h) => {
            const m = MODEL_MAP[h.modelId];
            if (!m) return null;
            return (
              <article key={h.modelId} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display font-semibold">{m.name}</h3>
                  <span className="font-mono text-[10px] text-muted-foreground">{h.score}</span>
                </div>
                <p className="mt-1 text-xs">Based on {m.basedOn}</p>
                <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{h.reason}</p>
              </article>
            );
          })}
        </section>
      ) : query.trim().length >= 2 && !busy ? (
        <p className="text-sm text-muted-foreground">
          No instant match. Hit Explain to research an equivalent.
        </p>
      ) : null}
    </div>
  );
}
