"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { BrowserNotificationsCard } from "@/components/portal/BrowserNotificationsCard";
import { TokenBudgetCard } from "@/components/portal/TokenBudgetCard";
import {
  CheckCircle2,
  Loader2,
  Link2,
  Unlink,
  Key,
  Lock,
  Brain,
  Scroll,
  UserPlus,
  LogIn,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Settings2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ConnState = "unknown" | "checking" | "connected" | "disconnected" | "error";

interface StatusPayload {
  allcodex: { ok: boolean; configured: boolean; url: string | null; version?: string; error?: string };
  allknower: { ok: boolean; configured: boolean; url: string | null; error?: string };
}

/**
 * Render the AllCodex configuration card with connection controls, status badge, and an advanced override panel.
 *
 * The card shows current connection state and version, allows connecting via ETAPI token or Trilium password, supports disconnecting, and exposes an advanced section to override the service URL. Displays loading state and errors inline.
 *
 * @param initialStatus - Optional initial status object from `/api/config/status` for the AllCodex integration used to seed connection state and URL
 * @returns The AllCodex configuration card JSX element
 */

function AllCodexCard({ initialStatus }: { initialStatus?: StatusPayload["allcodex"] }) {
  const [state, setState] = useState<ConnState>(
    initialStatus?.ok ? "connected" : initialStatus?.configured ? "error" : "disconnected"
  );
  const [version, setVersion] = useState(initialStatus?.version);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [url, setUrl] = useState(initialStatus?.url ?? "http://localhost:8080");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isConnected = state === "connected";

  /**
   * Attempts to connect to AllCodex using the current `url` and `token`, then updates component state and version based on the resulting system status.
   *
   * While the operation runs the component's loading state is toggled. On success the connection state is set to `"connected"` and the `version` is updated; on failure the connection state is set to `"error"` and the error message is recorded.
   */
  async function handleConnectToken() {
    if (!url || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/allcodex/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: url, token }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
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

  /**
   * Attempt to authenticate to AllKnower using the current `url` and `password`, then update the card's connection state and AllCodex version.
   *
   * Requires `url` and `password` to be set before calling. On success this sets the connection state to `"connected"`, clears the stored password, and updates the stored AllCodex `version` from the system status. On failure it sets the connection state to `"error"` and records the error message. Also manages the component's loading and error indicators.
   */
  async function handleLoginPassword() {
    if (!url || !password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/config/allknower-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState("connected");
      setPassword("");
      const status = await fetch("/api/config/status").then((r) => r.json());
      setVersion(status.allcodex.version);
    } catch (e) {
      setState("error");
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Disconnects the AllCodex integration and resets the component's connection state.
   *
   * Attempts to remove the AllCodex integration on the server and then clears local
   * connection-related state (connection state, version, credentials, and error).
   * Network or server errors during the disconnect request are ignored and do not
   * prevent the local state reset.
   */
  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch("/api/integrations/allcodex", { method: "DELETE" });
    } catch {}
    setState("disconnected");
    setVersion(undefined);
    setToken("");
    setPassword("");
    setError(null);
    setLoading(false);
  }

  return (
    <div className="rounded-none border border-border/30 border-l-2 border-l-primary/60 bg-card/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Scroll className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>AllCodex</h3>
            <p className="text-[11px] text-muted-foreground">Trilium notes — ETAPI</p>
          </div>
        </div>
        <StatusBadge state={state} version={version} />
      </div>

      <div className="px-5 py-4 space-y-4">
        {isConnected && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Auto-connected via AllKnower bootstrap</span>
            {url && <span className="font-mono text-xs opacity-60">({url})</span>}
          </div>
        )}

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Settings2 className="h-3 w-3" />
          Advanced / Override
        </button>

        {showAdvanced && (
          <div className="space-y-4 border-t border-border/20 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="allcodex-url">Service URL</Label>
              <Input
                id="allcodex-url"
                type="url"
                placeholder="http://localhost:8080"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="rounded-none bg-transparent border-x-0 border-t-0 border-b border-border/50 focus-visible:ring-0 px-0 h-9"
              />
            </div>

            {!isConnected && (
              <Tabs defaultValue="token" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-none">
                  <TabsTrigger value="token" className="rounded-none">
                    <Key className="h-3.5 w-3.5 mr-1.5" /> ETAPI Token
                  </TabsTrigger>
                  <TabsTrigger value="password" className="rounded-none">
                    <Lock className="h-3.5 w-3.5 mr-1.5" /> Password Login
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="token" className="space-y-3 mt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="allcodex-token">ETAPI Token</Label>
                    <Input id="allcodex-token" type="password" placeholder="Trilium → Settings → ETAPI" value={token} onChange={(e) => setToken(e.target.value)} disabled={loading} className="rounded-none bg-transparent border-x-0 border-t-0 border-b border-border/50 focus-visible:ring-0 px-0 h-9" />
                  </div>
                  <Button className="w-full gap-2 rounded-none" onClick={handleConnectToken} disabled={loading || !url || !token}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Connect
                  </Button>
                </TabsContent>

                <TabsContent value="password" className="space-y-3 mt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="allcodex-password">Trilium Password</Label>
                    <Input id="allcodex-password" type="password" placeholder="Your Trilium login password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} className="rounded-none bg-transparent border-x-0 border-t-0 border-b border-border/50 focus-visible:ring-0 px-0 h-9" />
                  </div>
                  <Button className="w-full gap-2 rounded-none" onClick={handleLoginPassword} disabled={loading || !url || !password}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Login &amp; Connect
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            {isConnected && (
              <Button variant="destructive" className="w-full gap-2 rounded-none" onClick={handleDisconnect} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                Disconnect
              </Button>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive rounded-none bg-destructive/10 border border-destructive/20 p-2">{error}</p>
        )}
      </div>
    </div>
  );
}

// ── AllKnower card ─────────────────────────────────────────────────────────────

type AkMode = "idle" | "login" | "register";

/**
 * Render the AllKnower configuration card that displays connection status and provides controls
 * to override the service URL, log in, register, or disconnect.
 *
 * The card manages its own local form and connection state (connected, disconnected, error)
 * and exposes UI for an advanced override section with login/register flows and a disconnect action.
 *
 * @param initialStatus - Optional initial status payload for AllKnower (used to derive the initial connection state and URL)
 * @returns The AllKnower configuration card as a React element
 */
function AllKnowerCard({ initialStatus }: { initialStatus?: StatusPayload["allknower"] }) {
  const [state, setState] = useState<ConnState>(
    initialStatus?.ok ? "connected" : initialStatus?.configured ? "error" : "disconnected"
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [url, setUrl] = useState(initialStatus?.url ?? "http://localhost:3001");
  const [mode, setMode] = useState<AkMode>("idle");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isConnected = state === "connected";

  function resetForm() { setEmail(""); setName(""); setPassword(""); setError(null); }
  function switchMode(next: AkMode) { resetForm(); setMode(next); }

  async function handleLogin() {
    if (!url || !email || !password) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState("connected"); resetForm(); setMode("idle");
    } catch (e) { setState("error"); setError(String(e)); } finally { setLoading(false); }
  }

  async function handleRegister() {
    if (!url || !email || !name || !password) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, email, name, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState("connected"); resetForm(); setMode("idle");
    } catch (e) { setState("error"); setError(String(e)); } finally { setLoading(false); }
  }

  async function handleDisconnect() {
    setLoading(true);
    await fetch("/api/config/disconnect?service=allknower", { method: "DELETE" });
    setState("disconnected"); resetForm(); setMode("idle"); setLoading(false);
  }

  return (
    <div className="rounded-none border border-border/30 border-l-2 border-l-[var(--accent)]/60 bg-card/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Brain className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--accent)]" style={{ fontFamily: "var(--font-cinzel)" }}>AllKnower</h3>
            <p className="text-[11px] text-muted-foreground">AI knowledge service</p>
          </div>
        </div>
        <StatusBadge state={state} />
      </div>

      <div className="px-5 py-4 space-y-4">
        {isConnected && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Auto-provisioned session</span>
            {url && <span className="font-mono text-xs opacity-60">({url})</span>}
          </div>
        )}

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Settings2 className="h-3 w-3" />
          Advanced / Override
        </button>

        {showAdvanced && (
          <div className="space-y-4 border-t border-border/20 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="allknower-url">Service URL</Label>
              <Input id="allknower-url" type="url" placeholder="http://localhost:3001" value={url} onChange={(e) => setUrl(e.target.value)} disabled={isConnected || loading} className="rounded-none bg-transparent border-x-0 border-t-0 border-b border-border/50 focus-visible:ring-0 px-0 h-9" />
            </div>

            {!isConnected && mode === "idle" && (
              <div className="flex gap-2">
                <Button className="flex-1 gap-2 rounded-none" onClick={() => switchMode("login")} disabled={!url}>
                  <LogIn className="h-4 w-4" /> Login
                </Button>
                <Button variant="outline" className="flex-1 gap-2 rounded-none" onClick={() => switchMode("register")} disabled={!url}>
                  <UserPlus className="h-4 w-4" /> Register
                </Button>
              </div>
            )}

            {!isConnected && mode === "login" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ak-login-email">Email</Label>
                  <Input id="ak-login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} autoComplete="email" className="rounded-none bg-transparent border-x-0 border-t-0 border-b border-border/50 focus-visible:ring-0 px-0 h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ak-login-password">Password</Label>
                  <Input id="ak-login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} autoComplete="current-password" className="rounded-none bg-transparent border-x-0 border-t-0 border-b border-border/50 focus-visible:ring-0 px-0 h-9" />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2 rounded-none" onClick={handleLogin} disabled={loading || !url || !email || !password}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Login
                  </Button>
                  <Button variant="ghost" className="gap-2 rounded-none" onClick={() => switchMode("idle")} disabled={loading}>Cancel</Button>
                </div>
              </div>
            )}

            {!isConnected && mode === "register" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ak-reg-name">Name</Label>
                  <Input id="ak-reg-name" type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} autoComplete="name" className="rounded-none bg-transparent border-x-0 border-t-0 border-b border-border/50 focus-visible:ring-0 px-0 h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ak-reg-email">Email</Label>
                  <Input id="ak-reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} autoComplete="email" className="rounded-none bg-transparent border-x-0 border-t-0 border-b border-border/50 focus-visible:ring-0 px-0 h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ak-reg-password">Password</Label>
                  <Input id="ak-reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} autoComplete="new-password" className="rounded-none bg-transparent border-x-0 border-t-0 border-b border-border/50 focus-visible:ring-0 px-0 h-9" />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2 rounded-none" onClick={handleRegister} disabled={loading || !url || !email || !name || !password}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Register
                  </Button>
                  <Button variant="ghost" className="gap-2 rounded-none" onClick={() => switchMode("idle")} disabled={loading}>Cancel</Button>
                </div>
              </div>
            )}

            {isConnected && (
              <Button variant="destructive" className="w-full gap-2 rounded-none" onClick={handleDisconnect} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />} Disconnect
              </Button>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive rounded-none bg-destructive/10 border border-destructive/20 p-2">{error}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the Share Configuration card which displays the current public share root and lets the user set a new share root note ID.
 *
 * Fetches the current share configuration on mount. Provides an input to enter a note ID and a Save action that persists the value to the server, updates the displayed current configuration on success, shows save/saving UI states, and surfaces any server errors.
 */

function ShareConfigCard() {
  const [noteId, setNoteId] = useState("");
  const [current, setCurrent] = useState<{ noteId: string; title: string; alias: string | null; url: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/share")
      .then((r) => r.json())
      .then((d) => { if (d.configured) setCurrent(d); })
      .catch(() => {});
  }, []);

  /**
   * Persist the entered public share root note ID to the server and update the local share state.
   *
   * If the note ID is empty (after trimming) the function returns immediately. While saving it sets the saving flag; on success it refreshes the current share configuration, clears the input, and sets a transient saved indicator for 2 seconds. On failure it records the error message. The saving flag is cleared when the operation completes.
   */
  async function handleSave() {
    if (!noteId.trim()) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await fetch("/api/share", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId: noteId.trim() }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      const updated = await fetch("/api/share").then((r) => r.json());
      if (updated.configured) setCurrent(updated);
      setNoteId(""); setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }

  return (
    <div className="rounded-none border border-border/30 border-l-2 border-l-primary/40 bg-card/40 overflow-hidden col-span-full">
      <div className="px-5 py-4 border-b border-border/20 flex items-center gap-3">
        <Globe className="h-4 w-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>Share Configuration</h3>
          <p className="text-[11px] text-muted-foreground">Configure which note is the public share root.</p>
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">
        {current && (
          <div className="border-l-2 border-border/40 bg-muted/20 p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Current share root</p>
            <p className="text-sm font-medium">{current.title}</p>
            <p className="text-xs font-mono text-muted-foreground">{current.noteId}</p>
            {current.url && (
              <a href={current.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors mt-1">
                <ExternalLink className="h-3 w-3" />{current.url}
              </a>
            )}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="share-root-id">Set Share Root Note ID</Label>
          <div className="flex gap-2">
            <Input id="share-root-id" placeholder="Enter a note ID" value={noteId} onChange={(e) => setNoteId(e.target.value)} className="font-mono text-sm" disabled={saving} />
            <Button onClick={handleSave} disabled={saving || !noteId.trim()} className="shrink-0 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : "Save"}
            </Button>
          </div>
        </div>
        {error && <p className="text-xs text-destructive rounded-none bg-destructive/10 border border-destructive/20 p-2">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Render the Portal Configuration card for viewing and updating the portal's lore root note ID.
 *
 * The card fetches the current `loreRootNoteId` on mount and allows the user to edit and save a new ID,
 * persisting changes to the server and showing loading, success, and error states.
 *
 * @returns The React element for the Portal Configuration card UI.
 */
function PortalConfigCard() {
  const [loreRootId, setLoreRootId] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config/portal").then((r) => r.json()).then((d) => setLoreRootId(d.loreRootNoteId ?? "")).catch(() => {});
  }, []);

  async function handleSave() {
    setLoading(true); setError(null); setSaved(false);
    try {
      const res = await fetch("/api/config/portal", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loreRootNoteId: loreRootId }) });
      if (!res.ok) throw new Error((await res.json()).error);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }

  return (
    <div className="rounded-none border border-border/30 border-l-2 border-l-secondary/60 bg-card/40 overflow-hidden col-span-full">
      <div className="px-5 py-4 border-b border-border/20 flex items-center gap-3">
        <Scroll className="h-4 w-4 text-secondary-foreground" />
        <div>
          <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-cinzel)" }}>Portal Configuration</h3>
          <p className="text-[11px] text-muted-foreground">Control how the Portal connects to your lore structure.</p>
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="lore-root-id">Lore Root Note ID</Label>
          <div className="flex gap-2">
            <Input id="lore-root-id" placeholder="root (default) or a specific note ID" value={loreRootId} onChange={(e) => setLoreRootId(e.target.value)} className="font-mono text-sm rounded-none bg-transparent border-x-0 border-t-0 border-b border-border/50 focus-visible:ring-0 px-0 h-9" disabled={loading} />
            <Button onClick={handleSave} disabled={loading} className="shrink-0 gap-2 rounded-none">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : "Save"}
            </Button>
          </div>
        </div>
        {error && <p className="text-xs text-destructive rounded-none bg-destructive/10 border border-destructive/20 p-2">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Render a development/debug card that exposes a destructive "wipe" operation.
 *
 * Provides a button which, after explicit user confirmation, calls the wipe API and displays success or error feedback to the user.
 *
 * @returns The React element for the Dev / Debug card containing the destructive control and status message.
 */
function DevDebugCard() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleWipeDB() {
    if (!confirm("Are you sure you want to wipe ALL lore notes and the entire RAG database? This action cannot be undone.")) return;
    setLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/config/wipe", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Wipe failed");
      setMessage("Success: Database and Lore wiped.");
    } catch (e: any) { setMessage(`Error: ${e.message}`); } finally { setLoading(false); }
  }

  return (
    <div className="rounded-2xl border border-destructive/30 bg-card/80 p-6 shadow-lg shadow-destructive/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10"><Brain className="w-24 h-24 text-destructive" /></div>
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10"><Brain className="h-5 w-5 text-destructive" /></div>
          <div>
            <h2 className="text-lg font-bold text-destructive" style={{ fontFamily: "var(--font-cinzel)" }}>Dev / Debug Options</h2>
            <p className="text-sm text-muted-foreground">Dangerous operations for development and debugging</p>
          </div>
        </div>
        <div className="pt-4 space-y-3">
          <Button variant="destructive" onClick={handleWipeDB} disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Wipe DB Lore & RAG
          </Button>
          {message && (
            <p className={`text-xs mt-2 p-2 rounded ${message.startsWith("Error") ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Render the Settings page, fetch the system connection status on mount, and display configuration cards for integrations and tools.
 *
 * The component shows a loading skeleton while status is being fetched and renders AllKnower, AllCodex, Portal, Share, and Dev/Debug cards once loaded. It also updates the page header when both services are connected.
 *
 * @returns The Settings page React element
 */

export default function SettingsPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch("/api/config/status").then((r) => r.json());
      setStatus(data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const bothConnected = status?.allcodex?.ok && status?.allknower?.ok;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1" style={{ fontFamily: "var(--font-cinzel)" }}>System</p>
        <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>Service Connections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {bothConnected
            ? "All services connected and operational. Credentials were auto-provisioned."
            : "Configure AllCodex and AllKnower connections."}
        </p>
      </div>

      {loading ? (
        <div className="space-y-5">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 border border-border/30 bg-card/20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <AllKnowerCard initialStatus={status?.allknower} />
          <AllCodexCard initialStatus={status?.allcodex} />
          <BrowserNotificationsCard />
          <PortalConfigCard />
          <ShareConfigCard />
          <TokenBudgetCard />
          <DevDebugCard />
        </div>
      )}
    </div>
  );
}
