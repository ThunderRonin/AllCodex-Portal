"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2, AlertTriangle, Info } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function BrowserNotificationsCard() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkState() {
      if (typeof window === "undefined") return;

      const isSupported = "serviceWorker" in navigator && "PushManager" in window;
      if (!isSupported) {
        setSupported(false);
        setLoading(false);
        return;
      }
      setSupported(true);

      try {
        const res = await fetch("/api/notifications/vapid-public-key");
        if (!res.ok) throw new Error("Could not check VAPID key status");
        const data = await res.json();
        
        if (!data.publicKey) {
          setConfigured(false);
          setLoading(false);
          return;
        }
        
        setConfigured(true);
        setVapidKey(data.publicKey);

        // Check current subscription
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const sub = await registration.pushManager.getSubscription();
          setSubscribed(!!sub);
        }
        setPermission(Notification.permission);
      } catch (err: any) {
        setError(err.message || "Failed to initialize notifications configuration");
      } finally {
        setLoading(false);
      }
    }

    checkState();
  }, []);

  if (loading) {
    return (
      <div className="h-32 rounded-none border border-border/30 border-l-2 border-l-primary/60 bg-card/20 animate-pulse flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
      </div>
    );
  }

  // Gracefully degrade: return null if browser doesn't support push notifications
  if (supported === false) {
    return null;
  }

  // Display unconfigured state if server public key is null
  if (configured === false) {
    return (
      <div className="rounded-none border border-border/30 border-l-2 border-l-primary/30 bg-card/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/20 flex items-center gap-3">
          <BellOff className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>Browser Notifications</h3>
            <p className="text-[11px] text-muted-foreground">Web push notifications</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-start gap-2.5 text-xs text-muted-foreground/80 bg-muted/5 border border-border/20 p-3">
            <Info className="h-4 w-4 shrink-0 text-primary/70 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-primary/95">Not Configured on Server</p>
              <p>
                Push notifications are disabled because the VAPID keys are not configured on the server.
                To enable this feature, set the <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">VAPID_PUBLIC_KEY</code> and <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">VAPID_PRIVATE_KEY</code> environment variables.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isPermissionDenied = permission === "denied";

  async function handleToggle() {
    if (subscribed) {
      await handleUnsubscribe();
    } else {
      await handleSubscribe();
    }
  }

  async function handleSubscribe() {
    if (!vapidKey) return;
    setActionLoading(true);
    setError(null);
    try {
      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
      }
      setPermission(perm);
      
      if (perm !== "granted") {
        throw new Error("Permission to display notifications was denied.");
      }

      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const readyReg = await navigator.serviceWorker.ready;

      const sub = await readyReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource
      });

      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to register subscription on the server.");
      }

      setSubscribed(true);
    } catch (err: any) {
      console.error("Subscription error:", err);
      setError(err.message || "Failed to subscribe to notifications.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnsubscribe() {
    setActionLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();

      if (sub) {
        const res = await fetch("/api/notifications/unsubscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.warn("Server side unsubscribe failed:", data.error);
        }

        await sub.unsubscribe();
      }

      setSubscribed(false);
    } catch (err: any) {
      console.error("Unsubscription error:", err);
      setError(err.message || "Failed to unsubscribe from notifications.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="rounded-none border border-border/30 border-l-2 border-l-primary/60 bg-card/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>Browser Notifications</h3>
            <p className="text-[11px] text-muted-foreground">Subscribe to web push notifications for system events</p>
          </div>
        </div>
        
        <div>
          {subscribed ? (
            <span className="inline-flex items-center gap-1.5 rounded-none text-[11px] px-2.5 py-1 bg-accent/20 text-accent border border-accent/30">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-none text-[11px] px-2.5 py-1 border border-border/50 text-muted-foreground">
              Inactive
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enable browser notifications to receive real-time alerts when server background tasks complete, bulk lore imports finish, or AI operations require your attention.
        </p>

        {isPermissionDenied && (
          <div className="flex items-start gap-2.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Notification Permission Denied</p>
              <p>
                You have blocked notifications for this site. Please reset your browser site permissions to allow notifications and click the button again.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <Button
          onClick={handleToggle}
          disabled={actionLoading || (isPermissionDenied && !subscribed)}
          variant={subscribed ? "destructive" : "default"}
          className="w-full gap-2 rounded-none"
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {subscribed ? "Disable Browser Notifications" : "Enable Browser Notifications"}
        </Button>
      </div>
    </div>
  );
}
