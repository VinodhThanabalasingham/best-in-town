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
      <div className="flex flex-1 items-center justify-center">
        <p className="max-w-sm text-center text-lg">
          Check <span className="font-medium">{email}</span> for a
          confirmation link to finish{" "}
          {mode === "signup" ? "signing up" : "logging in"}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              mode === "signup"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                : ""
            }`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              mode === "login"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                : ""
            }`}
          >
            Log in
          </button>
        </div>

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={method === "magic-link"}
              onChange={() => setMethod("magic-link")}
            />
            Magic link
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={method === "password"}
              onChange={() => setMethod("password")}
            />
            Password
          </label>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
          />

          {mode === "signup" && (
            <input
              type="text"
              required
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
            />
          )}

          {method === "password" && (
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {status === "loading"
              ? "Working..."
              : mode === "signup"
              ? "Sign up"
              : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
