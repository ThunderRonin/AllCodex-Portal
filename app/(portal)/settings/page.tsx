"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Link2,
  Unlink,
  Key,
  Lock,
  BookOpen,
  Brain,
  Scroll,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ConnState = "unknown" | "checking" | "connected" | "disconnected" | "error";

interface StatusPayload {
  allcodex: { ok: boolean; configured: boolean; url: string | null; version?: string; error?: string };
  allknower: { ok: boolean; configured: boolean; url: string | null; error?: string };
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ state, version }: { state: ConnState; version?: string }) {
  if (state === "connected")
    return (
      <Badge className="gap-1 bg-green-500/20 text-green-400 border-green-500/30">
        <CheckCircle2 className="h-3 w-3" />
        Connected{version ? ` · v${version}` : ""}
      </Badge>
    );
  if (state === "checking")
    return (
      <Badge className="gap-1 bg-blue-500/20 text-blue-400 border-blue-500/30">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking…
      </Badge>
    );
  if (state === "error")
    return (
      <Badge className="gap-1 bg-red-500/20 text-red-400 border-red-500/30">
        <XCircle className="h-3 w-3" />
        Error
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      Disconnected
    </Badge>
  );
}

// ── AllCodex card ──────────────────────────────────────────────────────────────

function AllCodexCard({ initialStatus }: { initialStatus?: StatusPayload["allcodex"] }) {
  const [state, setState] = useState<ConnState>(
    initialStatus?.ok ? "connected" : initialStatus?.configured ? "error" : "disconnected"
  );
  const [version, setVersion] = useState(initialStatus?.version);
  const [url, setUrl] = useState(initialStatus?.url ?? "http://localhost:8080");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isConnected = state === "connected";

  async function handleConnectToken() {
    if (!url || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/config/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allcodex: { url, token } }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      // probe
      const status = await fetch("/api/config/status").then((r) => r.json());
      if (status.allcodex.ok) {
        setState("connected");
        setVersion(status.allcodex.version);
      } else {
        setState("error");
        setError(status.allcodex.error ?? "Could not reach AllCodex");
      }
    } catch (e) {
      setState("error");
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginPassword() {
    if (!url || !password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/config/allcodex-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState("connected");
      setPassword("");
      // refresh version from status
      const status = await fetch("/api/config/status").then((r) => r.json());
      setVersion(status.allcodex.version);
    } catch (e) {
      setState("error");
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    await fetch("/api/config/disconnect?service=allcodex", { method: "DELETE" });
    setState("disconnected");
    setVersion(undefined);
    setToken("");
    setPassword("");
    setError(null);
    setLoading(false);
  }

  return (
    <Card className="relative border-border/60 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Scroll className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle style={{ fontFamily: "var(--font-cinzel)" }}>AllCodex</CardTitle>
              <CardDescription>Trilium notes — ETAPI</CardDescription>
            </div>
          </div>
          <StatusBadge state={state} version={version} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="allcodex-url">Service URL</Label>
          <Input
            id="allcodex-url"
            type="url"
            placeholder="http://localhost:8080"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isConnected || loading}
          />
        </div>

        {!isConnected && (
          <Tabs defaultValue="token" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="token">
                <Key className="h-3.5 w-3.5 mr-1.5" /> ETAPI Token
              </TabsTrigger>
              <TabsTrigger value="password">
                <Lock className="h-3.5 w-3.5 mr-1.5" /> Password Login
              </TabsTrigger>
            </TabsList>

            <TabsContent value="token" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="allcodex-token">ETAPI Token</Label>
                <Input
                  id="allcodex-token"
                  type="password"
                  placeholder="Trilium → Settings → ETAPI"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleConnectToken}
                disabled={loading || !url || !token}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Connect
              </Button>
            </TabsContent>

            <TabsContent value="password" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="allcodex-password">Trilium Password</Label>
                <Input
                  id="allcodex-password"
                  type="password"
                  placeholder="Your Trilium login password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The portal will call Trilium&apos;s login endpoint to obtain an ETAPI token automatically.
              </p>
              <Button
                className="w-full gap-2"
                onClick={handleLoginPassword}
                disabled={loading || !url || !password}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Login &amp; Connect
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {isConnected && (
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={handleDisconnect}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
            Disconnect
          </Button>
        )}

        {error && (
          <p className="text-xs text-red-400 rounded-md bg-red-500/10 border border-red-500/20 p-2">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── AllKnower card ─────────────────────────────────────────────────────────────

function AllKnowerCard({ initialStatus }: { initialStatus?: StatusPayload["allknower"] }) {
  const [state, setState] = useState<ConnState>(
    initialStatus?.ok ? "connected" : initialStatus?.configured ? "error" : "disconnected"
  );
  const [url, setUrl] = useState(initialStatus?.url ?? "http://localhost:3001");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isConnected = state === "connected";

  async function handleConnectToken() {
    if (!url || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/config/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allknower: { url, token } }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const status = await fetch("/api/config/status").then((r) => r.json());
      if (status.allknower.ok) {
        setState("connected");
      } else {
        setState("error");
        setError(status.allknower.error ?? "Could not reach AllKnower");
      }
    } catch (e) {
      setState("error");
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    if (!url || !email || !password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/config/allknower-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState("connected");
      setEmail("");
      setPassword("");
    } catch (e) {
      setState("error");
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    await fetch("/api/config/disconnect?service=allknower", { method: "DELETE" });
    setState("disconnected");
    setToken("");
    setEmail("");
    setPassword("");
    setError(null);
    setLoading(false);
  }

  return (
    <Card className="relative border-border/60 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent pointer-events-none" />
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/30 border border-accent-foreground/10">
              <Brain className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle style={{ fontFamily: "var(--font-cinzel)" }}>AllKnower</CardTitle>
              <CardDescription>AI knowledge service</CardDescription>
            </div>
          </div>
          <StatusBadge state={state} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="allknower-url">Service URL</Label>
          <Input
            id="allknower-url"
            type="url"
            placeholder="http://localhost:3001"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isConnected || loading}
          />
        </div>

        {!isConnected && (
          <Tabs defaultValue="token" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="token">
                <Key className="h-3.5 w-3.5 mr-1.5" /> Bearer Token
              </TabsTrigger>
              <TabsTrigger value="signin">
                <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Sign In
              </TabsTrigger>
            </TabsList>

            <TabsContent value="token" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="allknower-token">Bearer Token</Label>
                <Input
                  id="allknower-token"
                  type="password"
                  placeholder="Paste your AllKnower bearer token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleConnectToken}
                disabled={loading || !url || !token}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Connect
              </Button>
            </TabsContent>

            <TabsContent value="signin" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="allknower-email">Email</Label>
                <Input
                  id="allknower-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="allknower-password">Password</Label>
                <Input
                  id="allknower-password"
                  type="password"
                  placeholder="Your AllKnower password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Signs in via AllKnower (better-auth) and stores the session token automatically.
              </p>
              <Button
                className="w-full gap-2"
                onClick={handleSignIn}
                disabled={loading || !url || !email || !password}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Sign In &amp; Connect
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {isConnected && (
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={handleDisconnect}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
            Disconnect
          </Button>
        )}

        {error && (
          <p className="text-xs text-red-400 rounded-md bg-red-500/10 border border-red-500/20 p-2">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch("/api/config/status").then((r) => r.json());
      setStatus(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1
          className="text-3xl font-bold tracking-tight text-primary"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Service Connections
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure AllCodex and AllKnower connections. Credentials are stored as secure cookies — no need
          to set environment variables.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-72 rounded-xl border border-border/60 bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <AllCodexCard initialStatus={status?.allcodex} />
          <AllKnowerCard initialStatus={status?.allknower} />
        </div>
      )}

      <div className="rounded-lg border border-border/40 bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground/70 uppercase tracking-wider text-[10px]">Environment variables (optional override)</p>
        <p>
          If you prefer, you can still set <code className="bg-muted px-1 rounded">ALLCODEX_URL</code>,{" "}
          <code className="bg-muted px-1 rounded">ALLCODEX_ETAPI_TOKEN</code>,{" "}
          <code className="bg-muted px-1 rounded">ALLKNOWER_URL</code>, and{" "}
          <code className="bg-muted px-1 rounded">ALLKNOWER_BEARER_TOKEN</code> in{" "}
          <code className="bg-muted px-1 rounded">.env.local</code>. Cookie settings take priority when present.
        </p>
      </div>
    </div>
  );
}
