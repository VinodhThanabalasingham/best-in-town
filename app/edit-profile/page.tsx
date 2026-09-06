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
    <div className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Edit profile</h1>
      <EditProfileForm profile={profile} />
    </div>
  );
}
