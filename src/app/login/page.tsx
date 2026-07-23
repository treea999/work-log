"use client";

import Image from "next/image";
import { Archivo } from "next/font/google";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";

const workLogFont = Archivo({
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function attemptDevelopmentBypass() {
      try {
        const response = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "bypass" }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        router.replace("/dashboard");
        router.refresh();
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Development bypass failed", error);
        }
      }
    }

    void attemptDevelopmentBypass();
    return () => controller.abort();
  }, [router]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", name, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Sign in failed");
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--canvas-soft)] flex items-center justify-center p-4">
      <Toaster position="bottom-right" />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/tird-logo.png"
            alt="TIRD company logo"
            width={1082}
            height={633}
            priority
            className="mx-auto mb-5 h-auto w-48 sm:w-56 object-contain mix-blend-multiply"
          />
          <h1 className={`${workLogFont.className} text-3xl font-extrabold text-[var(--ink)] tracking-[-0.045em]`}>
            Work Log
          </h1>
        </div>

        <div className="bg-[var(--canvas)] rounded-[var(--radius-lg)] shadow-[var(--shadow-hairline),var(--shadow-level-2)] p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-[var(--ink)] mb-1.5">Username</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="username"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                autoFocus
                className="w-full border border-[var(--hairline)] rounded-[var(--radius-sm)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--canvas)] outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-[var(--ink)] mb-1.5">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full border border-[var(--hairline)] rounded-[var(--radius-sm)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--canvas)] outline-none focus:border-[var(--primary)] transition-colors placeholder:text-[var(--mute)]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--primary)] text-white rounded-[var(--radius-sm)] py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
