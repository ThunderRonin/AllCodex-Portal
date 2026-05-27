"use client";

import { useNotificationStore, type ToastMessage } from "@/lib/stores/notification-store";
import { X, CheckCircle, AlertTriangle, Info } from "lucide-react";

export function ToastsContainer() {
  const toasts = useNotificationStore((s) => s.toasts);
  const removeToast = useNotificationStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-80 max-w-[calc(100vw-3rem)]">
      {toasts.map((toast) => {
        let Icon;
        if (toast.type === "success") Icon = CheckCircle;
        else if (toast.type === "error") Icon = AlertTriangle;
        else Icon = Info;

        let colorClasses;
        if (toast.type === "success") colorClasses = "border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-950/50 text-emerald-300";
        else if (toast.type === "error") colorClasses = "border-rose-500/40 bg-rose-950/40 hover:bg-rose-950/50 text-rose-300";
        else colorClasses = "border-amber-500/40 bg-amber-950/40 hover:bg-amber-950/50 text-amber-300";

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-none border backdrop-blur-md shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${colorClasses}`}
            role="alert"
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0 opacity-90" />
            <div className="flex-1 min-w-0">
              <p 
                className="text-xs font-bold uppercase tracking-wider opacity-95"
                style={{ fontFamily: "var(--font-cinzel)" }}
              >
                {toast.title}
              </p>
              <p className="text-xs mt-1 leading-normal text-foreground/80">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss"
              className="p-0.5 rounded-sm hover:bg-white/10 opacity-60 hover:opacity-100 transition-all shrink-0 -mt-1 -mr-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
