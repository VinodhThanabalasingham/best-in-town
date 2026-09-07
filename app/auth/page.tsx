"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "signup" | "login";
type Method = "password" | "magic-link";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [method, setMethod] = useState<Method>("magic-link");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    const supabase = createClient();

    try {
      if (mode === "signup") {
        const normalizedUsername = username.trim();

        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", normalizedUsername)
          .maybeSingle();

        if (existing) {
          setError("That username is already taken.");
          setStatus("idle");
          return;
        }

        if (method === "password") {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username: normalizedUsername } },
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              data: { username: normalizedUsername },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });
          if (error) throw error;
        }
      } else {
        if (method === "password") {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          router.push("/");
          router.refresh();
          return;
        } else {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: false,
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });
          if (error) throw error;
        }
      }

      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="above-grain flex min-h-screen flex-1 items-center justify-center px-6">
        <p className="max-w-sm text-center font-serif text-lg italic leading-relaxed text-foreground/80">
          Check <span className="not-italic font-medium">{email}</span> for a
          confirmation link to finish{" "}
          {mode === "signup" ? "signing up" : "logging in"}.
        </p>
      </div>
    );
  }

  const isSignup = mode === "signup";

  return (
    <div className="above-grain flex min-h-screen flex-col px-6 py-8 md:px-10">
      <span className="font-serif text-xl tracking-tight text-foreground md:text-2xl">
        Best In Town
      </span>

      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-balance font-serif text-4xl leading-tight tracking-tight text-foreground md:text-5xl">
            {isSignup ? "Keep a shelf of your own." : "Welcome back to your shelf."}
          </h1>
          <p className="mt-4 font-serif text-lg italic leading-relaxed text-foreground/70">
            The best places in town, remembered properly — and shared only
            when you mean it.
          </p>

          <div className="mt-10 inline-flex rounded-sm border border-border bg-popover p-1">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-[2px] px-6 py-2 text-sm transition-colors ${
                mode === "signup"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-[2px] px-6 py-2 text-sm transition-colors ${
                mode === "login"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Log in
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <fieldset>
              <legend className="sr-only">Sign-in method</legend>
              <div className="flex gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="method"
                    checked={method === "magic-link"}
                    onChange={() => setMethod("magic-link")}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  Magic link
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="method"
                    checked={method === "password"}
                    onChange={() => setMethod("password")}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  Password
                </label>
              </div>
            </fieldset>

            <input
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-sm border border-input bg-popover px-4 py-3 text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {isSignup && (
              <input
                type="text"
                required
                placeholder="a name for your shelf"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-sm border border-input bg-popover px-4 py-3 text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}

            {method === "password" && (
              <input
                type="password"
                required
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-sm border border-input bg-popover px-4 py-3 text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-sm bg-primary px-6 py-3.5 font-serif text-lg text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "loading"
                ? "Working..."
                : isSignup
                ? "Sign up"
                : "Log in"}
            </button>

            {method === "magic-link" && (
              <p className="text-center text-sm text-muted-foreground">
                We&apos;ll send a link to your inbox. No password to forget.
              </p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
