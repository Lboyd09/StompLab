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
  if (tag) url.searchParams.set("tag", tag);
  return url.toString();
}

export function sweetwaterSearchUrl(query: string, affiliateId = sweetwaterAffiliateId()): string {
  const q = query.trim();
  if (!q) return "https://www.sweetwater.com/";
  const url = new URL("https://www.sweetwater.com/store/search.php");
  url.searchParams.set("s", q);
  if (affiliateId) url.searchParams.set("utm_source", "stomplab");
  if (affiliateId) url.searchParams.set("utm_medium", "affiliate");
  if (affiliateId) url.searchParams.set("utm_campaign", affiliateId);
  return url.toString();
}

export function shopQueryFor(name: string, basedOn?: string): string {
  const raw = (basedOn && basedOn.toLowerCase() !== "line 6 original" ? basedOn : name).trim();
  return raw.replace(/\s+/g, " ").slice(0, 80);
}
