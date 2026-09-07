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
    <div className="min-h-screen">
      <main className="above-grain mx-auto max-w-2xl px-6 pb-24 pt-12 md:px-10 md:pt-16">
        <p className="text-sm uppercase tracking-[0.18em] text-secondary">
          A new entry
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-foreground md:text-5xl">
          Add a pick
        </h1>
        <p className="mt-4 max-w-md font-serif text-lg italic leading-relaxed text-foreground/70">
          Find the place, put it on a shelf, and say why it earned the spot.
        </p>

        <div className="mt-12">
          <AddPickForm />
        </div>
      </main>
    </div>
  );
}
