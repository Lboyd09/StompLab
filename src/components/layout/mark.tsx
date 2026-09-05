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

/** Header lockup — white SL tile plus Stomp Lab. The tile alone is the app icon. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Mark />
      <span className="truncate font-display text-sm font-semibold uppercase tracking-[0.16em] sm:text-base sm:tracking-[0.2em]">
        Stomp Lab
      </span>
    </span>
  );
}
