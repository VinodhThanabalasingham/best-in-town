import { createClient } from "@/lib/supabase/server";
import { ArrowUpRight, Pencil, Plus, User, Users } from "lucide-react";
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
    .select("username, display_name")
    .eq("id", user.id)
    .single();

  const firstName = (profile?.display_name || profile?.username || "").split(
    /\s+/
  )[0];

  const actions = [
    {
      href: `/${profile?.username}`,
      title: "My profile",
      description: "Your shelves and every pick you have made.",
      Icon: User,
      accent: "primary" as const,
    },
    {
      href: "/add-pick",
      title: "Add a pick",
      description: "Log a new best-in-town spot onto a shelf.",
      Icon: Plus,
      accent: "moss" as const,
    },
    {
      href: "/community",
      title: "Community",
      description: "See what everyone else is recommending.",
      Icon: Users,
      accent: "primary" as const,
    },
    {
      href: "/edit-profile",
      title: "Edit profile",
      description: "Update your name, handle, and photo.",
      Icon: Pencil,
      accent: "moss" as const,
    },
  ];

  return (
    <div className="above-grain flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 md:px-10">
        <section className="max-w-xl">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Welcome back
          </p>
          <h1 className="mt-3 text-balance font-serif text-4xl leading-tight tracking-tight text-foreground md:text-5xl">
            Where to next{firstName ? `, ${firstName}` : ""}?
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Keep a personal guide to the best of everything — one shelf, one
            pick at a time.
          </p>
        </section>

        <nav className="mt-12 grid gap-4 sm:grid-cols-2">
          {actions.map(({ href, title, description, Icon, accent }) => (
            <Link
              key={href}
              href={href}
              className="elevate group flex flex-col gap-6 rounded-3xl border border-border/70 bg-card p-6 transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <span
                  className={
                    accent === "primary"
                      ? "flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"
                      : "flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent"
                  }
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <ArrowUpRight
                  className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
