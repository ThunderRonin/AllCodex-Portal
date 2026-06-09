"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Scroll } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNextPath } from "@/lib/safe-next-path";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Login failed");
      router.replace(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <form onSubmit={handleSubmit} className="w-full max-w-sm border border-border/40 bg-card/60 p-6">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <Scroll className="h-5 w-5 text-primary" />
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
            AllCodex
          </span>
        </Link>
        <div className="mb-5">
          <h1 className="text-xl font-bold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
            Owner Login
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Writer tools require root account access.</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" disabled={loading} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={loading} required />
          </div>
          {error && <p className="border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full gap-2 rounded-none" disabled={loading || !email || !password}>
            <Lock className="h-4 w-4" />
            {loading ? "Checking..." : "Enter"}
          </Button>
        </div>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
