import { Link } from "@tanstack/react-router";
import { AFFILIATE_DISCLOSURE, LEGAL_SHORT, LINE6_DISCLAIMER, UNOFFICIAL_DISCLAIMER } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function LegalFooter({ className, full }: { className?: string; full?: boolean }) {
  return (
    <div className={cn("space-y-2 text-[11px] leading-relaxed text-muted-foreground", className)}>
      {full ? (
        <>
          <p>{LINE6_DISCLAIMER}</p>
          <p>{UNOFFICIAL_DISCLAIMER}</p>
          <p>{AFFILIATE_DISCLOSURE}</p>
        </>
      ) : (
        <p>
          {LEGAL_SHORT}{" "}
          <Link to="/guide" className="text-foreground/80 underline underline-offset-2">
            Full legal
          </Link>
        </p>
      )}
    </div>
  );
}
