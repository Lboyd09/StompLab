import { cn } from "@/lib/utils";

export function PageHeader({
  kicker,
  title,
  children,
  className,
}: {
  kicker?: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-3", className)}>
      {kicker ? <p className="sl-kicker sl-enter sl-enter-1">{kicker}</p> : null}
      <h1 className="sl-enter sl-enter-2 font-display text-4xl font-semibold uppercase leading-[0.9] tracking-tight">
        {title}
      </h1>
      {children ? (
        <div className="sl-enter sl-enter-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      ) : null}
    </header>
  );
}
