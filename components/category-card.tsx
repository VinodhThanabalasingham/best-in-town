import type { ReactNode } from "react";

export default function CategoryCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h4 className="mb-4 font-serif text-lg text-foreground">{label}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
