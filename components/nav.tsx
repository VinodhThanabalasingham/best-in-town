import SignOutButton from "@/app/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  return (
    <header className="above-grain border-b border-border/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-6 md:px-10">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-foreground md:text-2xl"
        >
          Best In Town
        </Link>

        <nav className="flex items-center gap-5 text-sm md:gap-7">
          <Link
            href={`/${profile?.username}`}
            className="hidden text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:inline"
          >
            Profile
          </Link>
          <Link
            href="/add-pick"
            className="hidden text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:inline"
          >
            Add a pick
          </Link>
          <Link
            href="/community"
            className="hidden text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:inline"
          >
            Community
          </Link>
          <Link
            href="/following"
            className="hidden text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:inline"
          >
            Following
          </Link>
          <Link
            href="/edit-profile"
            className="hidden text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:inline"
          >
            Edit profile
          </Link>
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
