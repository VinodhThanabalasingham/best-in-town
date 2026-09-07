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
    <nav className="flex items-center justify-between border-b border-border px-4 py-3 md:px-10">
      <Link href="/" className="font-serif text-xl tracking-tight text-primary">
        Best In Town
      </Link>
      <div className="flex items-center gap-5 text-sm text-muted-foreground">
        <Link href={`/${profile?.username}`} className="hover:text-foreground">
          Profile
        </Link>
        <Link href="/add-pick" className="hover:text-foreground">
          Add a pick
        </Link>
        <Link href="/community" className="hover:text-foreground">
          Community
        </Link>
        <Link href="/edit-profile" className="hover:text-foreground">
          Edit profile
        </Link>
        <SignOutButton />
      </div>
    </nav>
  );
}
