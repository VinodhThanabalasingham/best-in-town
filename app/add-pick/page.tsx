import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AddPickForm from "./add-pick-form";

export default async function AddPickPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-2xl font-semibold">Add a pick</h1>
        <AddPickForm />
      </div>
    </div>
  );
}
