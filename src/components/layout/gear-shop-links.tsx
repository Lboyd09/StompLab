import { amazonSearchUrl, shopQueryFor, shopQueryForUserItem } from "@/lib/affiliate";
import { recordAffiliateClick } from "@/lib/billing";
import { AFFILIATE_DISCLOSURE } from "@/lib/copy";

export function GearShopLinks({
  name,
  basedOn,
  compact,
  source = "catalog",
}: {
  name: string;
  basedOn?: string;
  compact?: boolean;
  source?: "catalog" | "user";
}) {
  const q = source === "user" || basedOn === undefined ? shopQueryForUserItem(name) : shopQueryFor(name, basedOn);
  if (!q) return null;

  function track() {
    void recordAffiliateClick({ data: { vendor: "amazon", query: q } }).catch(() => undefined);
  }

  return (
    <div className={compact ? "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1" : "mt-1.5 flex flex-wrap items-center gap-2"}>
      <a
        href={amazonSearchUrl(q)}
        target="_blank"
        rel="noopener noreferrer sponsored nofollow"
        className="text-xs text-primary underline-offset-2 hover:underline"
        onClick={track}
      >
        Shop on Amazon
      </a>
    </div>
  );
}

export function AffiliateNote({ className }: { className?: string }) {
  return <p className={className ?? "text-[11px] leading-relaxed text-muted-foreground"}>{AFFILIATE_DISCLOSURE}</p>;
}
