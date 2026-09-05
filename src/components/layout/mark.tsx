import { cn } from "@/lib/utils";

export function Mark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-md border border-border bg-mark font-display font-bold uppercase tracking-[-0.06em] text-mark-foreground",
        size === "sm" && "size-8 text-sm",
        size === "md" && "size-10 text-lg",
        size === "lg" && "size-12 text-xl",
        className,
      )}
    >
      SL
    </span>
  );
}
