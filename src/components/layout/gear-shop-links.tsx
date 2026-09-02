import { amazonSearchUrl, shopQueryFor, sweetwaterSearchUrl } from "@/lib/affiliate";
import { AFFILIATE_DISCLOSURE } from "@/lib/copy";

export function GearShopLinks({
  name,
  basedOn,
  compact,
}: {
  name: string;
  basedOn?: string;
  compact?: boolean;
}) {
  const q = shopQueryFor(name, basedOn);
  if (!q) return null;
  return (
    <div className={compact ? "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1" : "mt-1.5 flex flex-wrap items-center gap-2"}>
      <a
        href={amazonSearchUrl(q)}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="text-xs text-primary underline-offset-2 hover:underline"
      >
        Amazon
      </a>
      <span className="text-xs text-muted-foreground">·</span>
      <a
        href={sweetwaterSearchUrl(q)}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="text-xs text-primary underline-offset-2 hover:underline"
      >
        Sweetwater
      </a>
    </div>
  );
}

export function AffiliateNote({ className }: { className?: string }) {
  return <p className={className ?? "text-[11px] leading-relaxed text-muted-foreground"}>{AFFILIATE_DISCLOSURE}</p>;
}
