import { vi, beforeEach, afterEach, afterAll, describe, it, expect } from "vitest";

// Store the original localStorage if any (for cleanup)
const originalLocalStorage = globalThis.localStorage;

// Set up global localStorage mock using vi.hoisted before any imports run
const { mockStorage } = vi.hoisted(() => {
  const storage: Record<string, string> = {};
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: vi.fn((key) => storage[key] || null),
      setItem: vi.fn((key, val) => { storage[key] = val; }),
      removeItem: vi.fn((key) => { delete storage[key]; }),
      clear: vi.fn(() => { for (const k in storage) delete storage[k]; }),
      length: 0,
      key: vi.fn((index) => null),
    },
    configurable: true,
    writable: true,
  });
  return { mockStorage: storage };
});

import { useNotificationStore } from "./notification-store";

describe("useNotificationStore", () => {

  beforeEach(() => {
    // Reset Zustand store state before each test
    useNotificationStore.setState({
      notifications: [],
      toasts: [],
    });
    // Clear mock storage
    for (const key in mockStorage) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Ensure fake timers don't leak to subsequent tests
    vi.useRealTimers();
  });

  afterAll(() => {
    // Restore or clean up global localStorage mock to prevent leaking to other test files
    if (originalLocalStorage === undefined) {
      // @ts-ignore
      delete globalThis.localStorage;
    } else {
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      });
    }
  });

  it("watch registers pending notification", () => {
    const store = useNotificationStore.getState();
    const mockNotification = {
      id: "n-1",
      kind: "brain-dump" as const,
      title: "Syncing lore files",
      href: "/lore/detail",
    };

    store.watch(mockNotification);

    const notifications = useNotificationStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      id: "n-1",
      kind: "brain-dump",
      title: "Syncing lore files",
      status: "pending",
      href: "/lore/detail",
    });
    expect(notifications[0].createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("complete sets status to complete and fires success toast", () => {
    const store = useNotificationStore.getState();
    store.watch({
      id: "n-2",
      kind: "bulk-dump" as const,
      title: "Processing bulk dump",
    });

    store.complete("n-2", {
      summary: "Imported 10 notes successfully",
      href: "/dashboard",
    });

    const notifications = useNotificationStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      id: "n-2",
      status: "complete",
      summary: "Imported 10 notes successfully",
      href: "/dashboard",
    });
    expect(notifications[0].completedAt).toBeDefined();

    const toasts = useNotificationStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      type: "success",
      title: "Processing bulk dump",
      message: "Imported 10 notes successfully",
    });
  });

  it("fail sets status to error and fires error toast", () => {
    const store = useNotificationStore.getState();
    store.watch({
      id: "n-3",
      kind: "copilot-turn" as const,
      title: "Copilot generation",
    });

    store.fail("n-3", {
      error: "LLM rate limit reached",
    });

    const notifications = useNotificationStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      id: "n-3",
      status: "error",
      error: "LLM rate limit reached",
    });
    expect(notifications[0].completedAt).toBeDefined();

    const toasts = useNotificationStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      type: "error",
      title: "Copilot generation",
      message: "LLM rate limit reached",
    });
  });

  it("dismiss removes the notification from the list", () => {
    const store = useNotificationStore.getState();
    store.watch({ id: "n-4", kind: "review-commit" as const, title: "Review commit 1" });
    store.watch({ id: "n-5", kind: "review-commit" as const, title: "Review commit 2" });

    expect(useNotificationStore.getState().notifications).toHaveLength(2);

    store.dismiss("n-4");

    const notifications = useNotificationStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBe("n-5");
  });

  it("dismissAll clears all notifications", () => {
    const store = useNotificationStore.getState();
    store.watch({ id: "n-6", kind: "brain-dump" as const, title: "Dump 1" });
    store.watch({ id: "n-7", kind: "brain-dump" as const, title: "Dump 2" });

    expect(useNotificationStore.getState().notifications).toHaveLength(2);

    store.dismissAll();

    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("duplicate id on watch overwrites/updates the existing notification", () => {
    const store = useNotificationStore.getState();
    store.watch({
      id: "n-dup",
      kind: "brain-dump" as const,
      title: "Original Dump",
    });

    expect(useNotificationStore.getState().notifications).toHaveLength(1);

    store.watch({
      id: "n-dup",
      kind: "brain-dump" as const,
      title: "Updated Dump Title",
    });

    const notifications = useNotificationStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe("Updated Dump Title");
  });

  it("addToast auto-removes the toast after its duration", () => {
    vi.useFakeTimers();
    const store = useNotificationStore.getState();

    store.addToast({
      type: "info",
      title: "Self-destructing toast",
      message: "This will disappear in 1.5 seconds",
      duration: 1500,
    });

    expect(useNotificationStore.getState().toasts).toHaveLength(1);
    expect(useNotificationStore.getState().toasts[0].title).toBe("Self-destructing toast");

    // Advance timer by 1499ms (toast should still be there)
    vi.advanceTimersByTime(1499);
    expect(useNotificationStore.getState().toasts).toHaveLength(1);

    // Advance timer by 1ms (exactly 1500ms total, should disappear)
    vi.advanceTimersByTime(1);
    expect(useNotificationStore.getState().toasts).toHaveLength(0);
  });

  it("complete on unknown id does not crash the application", () => {
    const store = useNotificationStore.getState();
    store.watch({
      id: "n-exist",
      kind: "brain-dump" as const,
      title: "Existing",
    });

    // complete call on non-existent id
    expect(() => {
      store.complete("n-non-exist", { summary: "No crash please" });
    }).not.toThrow();

    // Verify existing list and toasts
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(useNotificationStore.getState().notifications[0].id).toBe("n-exist");
    // Ensure no toast was registered because the ID was not found
    expect(useNotificationStore.getState().toasts).toHaveLength(0);
  });
});
