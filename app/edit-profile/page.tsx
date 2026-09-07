import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EditProfileForm from "./edit-profile-form";

export default async function EditProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/auth");
  }

  return (
    <div className="min-h-screen">
      <main className="above-grain mx-auto max-w-md px-6 pb-24 pt-12 md:px-10 md:pt-16">
        <p className="text-sm uppercase tracking-[0.18em] text-secondary">
          Your shelf
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-foreground md:text-5xl">
          Edit profile
        </h1>

        <div className="mt-10">
          <EditProfileForm profile={profile} />
        </div>
      </main>
    </div>
  );
}
