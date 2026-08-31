export const RESEARCH_STEPS = [
  { at: 8, label: "Finding the record" },
  { at: 24, label: "Reading the original rig" },
  { at: 42, label: "Mapping amps and pedals" },
  { at: 63, label: "Programming the Stomp" },
  { at: 81, label: "Writing snapshots" },
  { at: 94, label: "Checking factory models" },
] as const;

export function researchLabel(pct: number): string {
  let label: string = RESEARCH_STEPS[0].label;
  for (const step of RESEARCH_STEPS) {
    if (pct >= step.at) label = step.label;
  }
  return label;
}
