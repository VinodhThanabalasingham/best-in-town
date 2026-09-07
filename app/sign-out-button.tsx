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
      className="rounded-full border border-foreground/20 px-4 py-2 text-sm text-foreground transition-colors hover:border-foreground/40 hover:bg-foreground/5"
    >
      Sign out
    </button>
  );
}
