import { MapPin } from "lucide-react";
import type { ReactNode } from "react";

export default function CategoryRow({
  label,
  count,
  accent,
  children,
}: {
  label: string;
  count: number;
  accent: "primary" | "secondary";
  children: ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
          {label}
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <MapPin aria-hidden="true" className="h-3 w-3" />
          {count}
        </span>
      </header>

      <div
        className="-mx-6 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 scrollbar-none md:-mx-10 md:px-10"
        style={{ ["--tile-accent" as string]: `var(--${accent})` }}
      >
        {children}
      </div>
    </section>
  );
}
