import { cn } from "@/lib/utils";

const SIZE = {
  sm: "size-8 text-sm",
  md: "size-10 text-lg",
  lg: "size-12 text-xl",
} as const;

/** Cream SL sticker — the same mark as the physical sticker and the app icon. */
export function Mark({
  className,
  size = "md",
}: {
  className?: string;
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "sl-sticker grid shrink-0 place-items-center font-display font-bold uppercase text-mark-foreground",
        SIZE[size],
        className,
      )}
    >
      SL
    </span>
  );
}

/** Header lockup — cream SL sticker plus Stomp Lab. The tile is the app icon. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Mark size="sm" />
      <span className="truncate font-display text-sm font-semibold uppercase tracking-[0.16em] sm:text-base sm:tracking-[0.2em]">
        Stomp Lab
      </span>
    </span>
  );
}
