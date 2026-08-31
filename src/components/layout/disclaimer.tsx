import { RIG_DISCLAIMER } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function RigDisclaimer({ className }: { className?: string }) {
  return <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>{RIG_DISCLAIMER}</p>;
}
