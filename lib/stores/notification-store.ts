import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ToastMessage { id: string; type: "success"|"error"|"info"; title: string; message: string; duration?: number; }
export type NotificationKind = "brain-dump"|"bulk-dump"|"review-commit"|"copilot-turn";
export type NotificationStatus = "pending"|"complete"|"error";

export interface Notification {
  id: string; kind: NotificationKind; title: string; status: NotificationStatus;
  summary?: string; error?: string; href?: string;
  createdAt: number; completedAt?: number;
}

interface NotificationState {
  notifications: Notification[];
  toasts: ToastMessage[];
  watch: (opts: { id: string; kind: NotificationKind; title: string; href?: string }) => void;
  complete: (id: string, opts?: { summary?: string; href?: string }) => void;
  fail: (id: string, opts: { error: string }) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
}

const STALE_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes to assume orphaned pending operations are failed

export const useNotificationStore = create<NotificationState>()(
  persist((set, get) => ({
    notifications: [],
    toasts: [],
    watch: ({ id, kind, title, href }) => {
      const n: Notification = { id, kind, title, status: "pending", href, createdAt: Date.now() };
      set((s) => ({ notifications: [...s.notifications.filter((x) => x.id !== id), n] }));
    },
    complete: (id, opts) => {
      let completedNotification: Notification | undefined;
      set((s) => {
        const nextNotifications = s.notifications.map((n) => {
          if (n.id === id) {
            completedNotification = {
              ...n,
              status: "complete" as const,
              summary: opts?.summary,
              href: opts?.href ?? n.href,
              completedAt: Date.now()
            };
            return completedNotification;
          }
          return n;
        });
        return { notifications: nextNotifications };
      });
      
      if (completedNotification) {
        get().addToast({
          type: "success",
          title: completedNotification.title,
          message: opts?.summary ?? "Completed successfully."
        });
      }
    },
    fail: (id, { error }) => {
      let failedNotification: Notification | undefined;
      set((s) => {
        const nextNotifications = s.notifications.map((n) => {
          if (n.id === id) {
            failedNotification = {
              ...n,
              status: "error" as const,
              error,
              completedAt: Date.now()
            };
            return failedNotification;
          }
          return n;
        });
        return { notifications: nextNotifications };
      });

      if (failedNotification) {
        get().addToast({
          type: "error",
          title: failedNotification.title,
          message: error
        });
      }
    },
    dismiss: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
    dismissAll: () => set({ notifications: [] }),
    addToast: (toast) => {
      const id = crypto.randomUUID().slice(0, 8);
      set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
      setTimeout(() => get().removeToast(id), toast.duration ?? 6000);
    },
    removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  }), {
    name: "notification-store",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      notifications: state.notifications.filter(
        (n) => n.status === "pending" || !n.completedAt || Date.now() - n.completedAt < STALE_MS
      ),
    }),
    onRehydrateStorage: () => (state) => {
      if (state) {
        const now = Date.now();
        state.notifications = state.notifications
          .map((n) => {
            // Mark orphaned pending tasks as failed/interrupted on startup
            if (n.status === "pending" && now - n.createdAt > TIMEOUT_MS) {
              return {
                ...n,
                status: "error" as const,
                error: "Operation timed out or was interrupted.",
                completedAt: now
              };
            }
            return n;
          })
          .filter(
            (n) => n.status === "pending" || !n.completedAt || now - n.completedAt < STALE_MS
          );
      }
    }
  })
);
