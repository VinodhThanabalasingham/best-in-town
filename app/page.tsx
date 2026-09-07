import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const links = [
    {
      href: `/${profile?.username}`,
      label: "My profile",
      description: "See your own picks, grouped by topic and category.",
    },
    {
      href: "/add-pick",
      label: "Add a pick",
      description: "Search a business and add it to a category.",
    },
    {
      href: "/community",
      label: "Community",
      description: "Browse everyone else's picks.",
    },
  ];

  return (
    <div className="min-h-screen">
      <main className="above-grain mx-auto max-w-4xl px-6 pb-24 pt-10 md:px-10 md:pt-14">
        <h1 className="font-serif text-3xl tracking-tight text-foreground md:text-4xl">
          Best In Town
        </h1>
        <p className="mt-2 text-muted-foreground">
          The best local business in every category, in your own words.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
            >
              <h2 className="font-serif text-lg text-foreground">
                {link.label}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
