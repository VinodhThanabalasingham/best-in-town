"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/auth");
        router.refresh();
      }}
      className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
    >
      Sign out
    </button>
  );
}
