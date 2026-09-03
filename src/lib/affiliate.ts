function envString(name: string): string {
  try {
    const meta = import.meta as { env?: Record<string, string | undefined> };
    return String(meta.env?.[name] ?? "").trim();
  } catch {
    return "";
  }
}

export function amazonAssociateTag(): string {
  return envString("VITE_AMAZON_ASSOCIATE_TAG");
}

export function sweetwaterAffiliateId(): string {
  return envString("VITE_SWEETWATER_AFFILIATE_ID");
}

export function amazonSearchUrl(query: string, tag = amazonAssociateTag()): string {
  const q = query.trim();
  if (!q) return "https://www.amazon.com/";
  const url = new URL("https://www.amazon.com/s");
  url.searchParams.set("k", q);
  if (tag) {
    url.searchParams.set("tag", tag);
    url.searchParams.set("linkCode", "ll2");
  }
  return url.toString();
}

export function sweetwaterSearchUrl(query: string, affiliateId = sweetwaterAffiliateId()): string {
  const q = query.trim();
  if (!q) return "https://www.sweetwater.com/";
  const url = new URL("https://www.sweetwater.com/store/search.php");
  url.searchParams.set("s", q);
  if (affiliateId) {
    url.searchParams.set("utm_source", "stomplab");
    url.searchParams.set("utm_medium", "affiliate");
    url.searchParams.set("utm_campaign", affiliateId);
  }
  return url.toString();
}

/** Line 6 HX names are DSP models — not products you can buy. */
export function isShoppableGear(basedOn: string | undefined | null): boolean {
  const raw = (basedOn ?? "").trim();
  if (raw.length < 4) return false;
  if (/^line\s*6/i.test(raw)) return false;
  if (/original$/i.test(raw) && /line\s*6|helix|hx\b/i.test(raw)) return false;
  if (/\b(helix|hx stomp|hx effects|pod go|stadium)\b/i.test(raw)) return false;
  if (/computer[- ]generated|digital model|hx model/i.test(raw)) return false;
  return true;
}

/**
 * Search the real-world pedal/amp. Never the Line 6 nickname
 * (Deez One, Scream 808) — those are not for sale.
 */
export function shopQueryFor(name: string, basedOn?: string): string {
  const raw = (basedOn ?? "").trim();
  if (!isShoppableGear(raw)) return "";
  return raw
    .replace(/\s*\([^)]*\)/g, " ")
    .replace(/\s*\/\s*.*$/, "")
    .replace(/\s+family$/i, "")
    .replace(/\s+with\s+.+$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function shopQueryForUserItem(name: string): string {
  const raw = name.trim();
  if (raw.length < 3) return "";
  if (!isShoppableGear(raw) && /^line\s*6/i.test(raw)) return "";
  return raw.slice(0, 80);
}
