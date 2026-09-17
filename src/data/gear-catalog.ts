/** Common instruments/amps for the locker picker — names players actually type. */
export type GearSuggestion = { kind: "guitar" | "bass" | "amp" | "cab" | "pedal" | "pickup"; name: string };

export const GEAR_SUGGESTIONS: GearSuggestion[] = [
  { kind: "guitar", name: "Fender Stratocaster" },
  { kind: "guitar", name: "Fender Telecaster" },
  { kind: "guitar", name: "Fender Jazzmaster" },
  { kind: "guitar", name: "Fender Jaguar" },
  { kind: "guitar", name: "Gibson Les Paul Standard" },
  { kind: "guitar", name: "Gibson SG" },
  { kind: "guitar", name: "Gibson ES-335" },
  { kind: "guitar", name: "PRS Custom 24" },
  { kind: "guitar", name: "Gretsch 6120" },
  { kind: "guitar", name: "Rickenbacker 360" },
  { kind: "guitar", name: "Ibanez RG" },
  { kind: "guitar", name: "Ibanez JEM" },
  { kind: "guitar", name: "ESP Eclipse" },
  { kind: "guitar", name: "ESP Explorer" },
  { kind: "guitar", name: "Jackson Soloist" },
  { kind: "guitar", name: "Music Man Majesty" },
  { kind: "guitar", name: "Martin D-28" },
  { kind: "guitar", name: "Taylor 814ce" },
  { kind: "bass", name: "Fender Precision Bass" },
  { kind: "bass", name: "Fender Jazz Bass" },
  { kind: "bass", name: "Music Man StingRay" },
  { kind: "bass", name: "Rickenbacker 4003" },
  { kind: "bass", name: "Gibson Thunderbird" },
  { kind: "amp", name: "Marshall JCM800" },
  { kind: "amp", name: "Marshall Plexi" },
  { kind: "amp", name: "Fender Twin Reverb" },
  { kind: "amp", name: "Fender Deluxe Reverb" },
  { kind: "amp", name: "Vox AC30" },
  { kind: "amp", name: "Mesa Dual Rectifier" },
  { kind: "amp", name: "Mesa Mark IIC+" },
  { kind: "amp", name: "Soldano SLO-100" },
  { kind: "amp", name: "Hiwatt DR-103" },
  { kind: "amp", name: "Orange Rockerverb" },
  { kind: "amp", name: "Ampeg SVT" },
  { kind: "cab", name: "Marshall 1960 4×12" },
  { kind: "cab", name: "Mesa 4×12" },
  { kind: "cab", name: "Fender 2×12" },
  { kind: "pedal", name: "BOSS DS-1" },
  { kind: "pedal", name: "Ibanez TS808 / TS9" },
  { kind: "pedal", name: "Electro-Harmonix Big Muff" },
  { kind: "pedal", name: "Dunlop Cry Baby" },
  { kind: "pickup", name: "Seymour Duncan JB" },
  { kind: "pickup", name: "EMG 81" },
];

export function suggestionsFor(kind: GearSuggestion["kind"], q: string): GearSuggestion[] {
  const needle = q.trim().toLowerCase();
  const pool = GEAR_SUGGESTIONS.filter((g) => g.kind === kind);
  if (!needle) return pool.slice(0, 8);
  return pool.filter((g) => g.name.toLowerCase().includes(needle)).slice(0, 8);
}
