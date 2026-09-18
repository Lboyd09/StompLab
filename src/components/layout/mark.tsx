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

/** Header lockup — cream SL sticker plus mixed-case wordmark. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Mark size="sm" />
      <span className="truncate text-[15px] font-semibold tracking-[-0.02em] sm:text-base">Stomp Lab</span>
    </span>
  );
}
