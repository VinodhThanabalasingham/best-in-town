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
    <nav className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <Link href={`/${profile?.username}`} className="font-semibold">
        Best In Town
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href={`/${profile?.username}`} className="underline">
          Profile
        </Link>
        <Link href="/add-pick" className="underline">
          Add a pick
        </Link>
        <Link href="/edit-profile" className="underline">
          Edit profile
        </Link>
        <SignOutButton />
      </div>
    </nav>
  );
}
