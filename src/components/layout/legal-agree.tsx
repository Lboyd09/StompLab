import { Link } from "@tanstack/react-router";
import type { LegalKind } from "@/lib/legal";

export function LegalAgree({
  kind,
  checked,
  onChange,
  id = "legal-agree",
}: {
  kind: LegalKind;
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
}) {
  const label =
    kind === "subscribe"
      ? "I agree to the Terms, Privacy Policy, and the automatic-renewal subscription terms. Checking this box is my electronic signature. Polar will charge my card now and again each period until I cancel."
      : "I agree to the Terms of use and Privacy Policy. Checking this box is my electronic signature.";
  return (
    <label htmlFor={id} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-foreground"
        required
      />
      <span>
        {label}{" "}
        <Link to="/terms" className="text-foreground underline underline-offset-2">
          Terms
        </Link>
        {" · "}
        <Link to="/privacy" className="text-foreground underline underline-offset-2">
          Privacy
        </Link>
        {kind === "subscribe" ? (
          <>
            {" · "}
            <Link to="/terms" hash="price" className="text-foreground underline underline-offset-2">
              Renewal
            </Link>
          </>
        ) : null}
      </span>
    </label>
  );
}
