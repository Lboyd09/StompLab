import { Link } from "@tanstack/react-router";
import {
  HELP_COPY,
  LEGAL_SHORT,
  LINE6_DISCLAIMER,
  PRIVACY_SHORT,
  UNOFFICIAL_DISCLAIMER,
} from "@/lib/copy";
import { PUBLIC_SUPPORT_EMAIL } from "@/lib/plan";
import { cn } from "@/lib/utils";

export function LegalFooter({ className, full }: { className?: string; full?: boolean }) {
  return (
    <footer className={cn("space-y-4 text-[11px] leading-relaxed text-muted-foreground", className)}>
      <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.14em]">
        <Link to="/terms" className="text-foreground/80 underline-offset-2 hover:underline">
          Terms
        </Link>
        <Link to="/privacy" className="text-foreground/80 underline-offset-2 hover:underline">
          Privacy
        </Link>
        <Link to="/guide" hash="help" className="text-foreground/80 underline-offset-2 hover:underline">
          Help
        </Link>
        <a href={`mailto:${PUBLIC_SUPPORT_EMAIL}`} className="text-foreground/80 underline-offset-2 hover:underline">
          {PUBLIC_SUPPORT_EMAIL}
        </a>
      </nav>
      {full ? (
        <>
          <p id="help">{HELP_COPY}</p>
          <p id="privacy">{PRIVACY_SHORT}</p>
          <p>{LINE6_DISCLAIMER}</p>
          <p>{UNOFFICIAL_DISCLAIMER}</p>
        </>
      ) : (
        <p>
          {LEGAL_SHORT} {HELP_COPY}{" "}
          <Link to="/privacy" className="text-foreground/80 underline underline-offset-2">
            Privacy
          </Link>
          {" · "}
          <Link to="/terms" className="text-foreground/80 underline underline-offset-2">
            Terms
          </Link>
        </p>
      )}
    </footer>
  );
}
