"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, Loader2, Sparkles, XCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ServiceBanner } from "@/components/portal/ServiceBanner";
import { useSSEStream } from "@/hooks/use-sse-stream";
import { fetchJsonOrThrow } from "@/lib/fetch-json";
import { sanitizeLoreHtml } from "@/lib/sanitize";
import { useCopilotStore } from "@/lib/stores/copilot-store";
import { useNotificationStore } from "@/lib/stores/notification-store";
import type { CopilotApplyResult, CopilotChatResponse, CopilotProposalTarget } from "@/lib/allknower-schemas";

type ExistingTargetSnapshot = {
  title: string;
  loreType: string;
  contentHtml: string;
  parentNoteIds: string[];
};

/**
 * Produce a short UI label describing a proposal target's role relative to a note.
 *
 * @param noteId - The current note's id used to determine if a target refers to this note
 * @param target - The proposal target whose `kind` and `targetId` determine the label
 * @returns `"new linked note"` if `target.kind` is `"create"`, `"current"` if `target.targetId` equals `noteId`, `"linked existing"` otherwise
 */
function targetRoleLabel(noteId: string, target: CopilotProposalTarget) {
  if (target.kind === "create") return "new linked note";
  if (target.targetId === noteId) return "current";
  return "linked existing";
}

/**
 * Fetches a note's metadata and HTML content and returns a snapshot for proposal previews.
 *
 * @returns An ExistingTargetSnapshot containing `title`, `loreType` (defaults to `'lore'` if absent), `contentHtml`, and `parentNoteIds` (empty array if absent).
 *
 * @throws If either the note metadata or content request fails.
 */
async function fetchTargetSnapshot(noteId: string): Promise<ExistingTargetSnapshot> {
  const [note, contentHtml] = await Promise.all([
    fetchJsonOrThrow<{
      title: string;
      parentNoteIds?: string[];
      attributes: Array<{ name: string; value: string }>;
    }>(`/api/lore/${noteId}`),
    fetch(`/api/lore/${noteId}/content`).then((response) => {
      if (!response.ok) throw new Error(`Content fetch failed: ${response.status}`);
      return response.text();
    }),
  ]);

  return {
    title: note.title,
    loreType: note.attributes.find((attribute) => attribute.name === "loreType")?.value ?? "lore",
    contentHtml,
    parentNoteIds: note.parentNoteIds ?? [],
  };
}

/**
 * Renders a selectable review card for a single copilot proposal target, showing before/after title and content, label and relation changes, and rationale.
 *
 * @param noteId - The current note's ID (used to compute the target role label).
 * @param target - The proposal target to display (create or update) including title, content, rationale, label and relation diffs.
 * @param checked - Whether the target is currently selected.
 * @param onCheckedChange - Callback invoked with the new checked state when the selection checkbox changes.
 * @param snapshot - Optional cached "before" snapshot for existing targets (provides title and HTML content).
 * @param newNoteParentLabel - Human-readable parent label to display for `create` targets.
 * @returns A JSX element rendering the proposal card with diffs and selectable checkbox.
 */
function ProposalCard({
  noteId,
  target,
  checked,
  onCheckedChange,
  snapshot,
  newNoteParentLabel,
}: {
  noteId: string;
  target: CopilotProposalTarget;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  snapshot?: ExistingTargetSnapshot;
  newNoteParentLabel: string;
}) {
  const titleBefore = snapshot?.title ?? (target.kind === "create" ? "New note" : "Loading...");
  const titleAfter = target.title ?? titleBefore;
  const contentBefore = snapshot?.contentHtml ?? "";
  const contentAfter = target.contentHtml ?? contentBefore;

  return (
    <Card className="border-accent/20 bg-background/80">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{titleAfter}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {targetRoleLabel(noteId, target)}
                </p>
              </div>
              {target.kind === "create" && (
                <span className="text-xs text-muted-foreground">Parent: {newNoteParentLabel}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{target.rationale}</p>
          </div>
        </div>

        {titleBefore !== titleAfter && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Title Before</p>
              <p className="rounded-md border border-border/60 p-2 text-sm">{titleBefore}</p>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Title After</p>
              <p className="rounded-md border border-accent/30 p-2 text-sm">{titleAfter}</p>
            </div>
          </div>
        )}

        {target.contentHtml && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Content Before</p>
              <div
                className="max-h-40 overflow-auto rounded-md border border-border/60 p-3 text-sm lore-content"
                dangerouslySetInnerHTML={{ __html: sanitizeLoreHtml(contentBefore || "<p>No content.</p>") }}
              />
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Content After</p>
              <div
                className="max-h-40 overflow-auto rounded-md border border-accent/30 p-3 text-sm lore-content"
                dangerouslySetInnerHTML={{ __html: sanitizeLoreHtml(contentAfter) }}
              />
            </div>
          </div>
        )}

        {(target.labelUpserts.length > 0 || target.labelDeletes.length > 0) && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Label Adds</p>
              <div className="rounded-md border border-border/60 p-2 text-sm">
                {target.labelUpserts.length > 0 ? target.labelUpserts.map((label) => (
                  <p key={`${label.name}:${label.value}`}>{label.name}{label.value ? ` = ${label.value}` : ""}</p>
                )) : <p className="text-muted-foreground">None</p>}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Label Removes</p>
              <div className="rounded-md border border-border/60 p-2 text-sm">
                {target.labelDeletes.length > 0 ? target.labelDeletes.map((label) => (
                  <p key={label}>{label}</p>
                )) : <p className="text-muted-foreground">None</p>}
              </div>
            </div>
          </div>
        )}

        {(target.relationAdds.length > 0 || target.relationDeletes.length > 0) && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Relation Adds</p>
              <div className="rounded-md border border-border/60 p-2 text-sm">
                {target.relationAdds.length > 0 ? target.relationAdds.map((relation, index) => (
                  <p key={`${relation.relationshipType}:${relation.targetId}:${index}`}>
                    {relation.relationshipType} → {relation.targetId} ({relation.targetKind})
                  </p>
                )) : <p className="text-muted-foreground">None</p>}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Relation Removes</p>
              <div className="rounded-md border border-border/60 p-2 text-sm">
                {target.relationDeletes.length > 0 ? target.relationDeletes.map((relation) => (
                  <p key={`${relation.relationshipType}:${relation.targetId}`}>
                    {relation.relationshipType} → {relation.targetId}
                  </p>
                )) : <p className="text-muted-foreground">None</p>}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Renders the article-scoped copilot panel that provides a chat interface, proposal review UI, and workflows to apply or redirect suggested changes.
 *
 * The panel streams assistant responses, displays grounding citations and a pending proposal with selectable targets, fetches "before" snapshots for update targets, and can apply selected changes to the backend or submit a redirect instruction. When there is no active note ID, the component returns `null`.
 *
 * @returns The component's rendered sheet UI for the active note, or `null` when no active note is available.
 */
export function ArticleCopilot() {
  const store = useCopilotStore();
  const noteId = store.activeNoteId;
  const conv = noteId ? store.conversations[noteId] : null;

  const [draft, setDraft] = useState("");
  const [redirectDraft, setRedirectDraft] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [targetSnapshots, setTargetSnapshots] = useState<Record<string, ExistingTargetSnapshot>>({});
  const [newNoteParentLabel, setNewNoteParentLabel] = useState("current article primary parent");
  const [isSending, setIsSending] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [errorService, setErrorService] = useState<"AllKnower" | "AllCodex">("AllKnower");
  const [lastResponse, setLastResponse] = useState<CopilotChatResponse | null>(null);
  const [applyResult, setApplyResult] = useState<CopilotApplyResult | null>(null);
  const queryClient = useQueryClient();
  const { stream, cancel: cancelStream } = useSSEStream();

  const messages = conv?.messages ?? [];
  const pendingProposal = conv?.pendingProposal ?? null;
  const selectedTargetIds = conv?.selectedTargetIds ?? [];
  const selectedCount = selectedTargetIds.length;
  const orderedTargets = pendingProposal?.targets ?? [];
  const hasConversation = messages.length > 0;
  const citations = useMemo(() => lastResponse?.citations ?? [], [lastResponse]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!pendingProposal || !noteId) {
      setTargetSnapshots({});
      return;
    }

    const existingTargets = pendingProposal.targets.filter((target) => target.kind === "update");
    const hasCreateTargets = pendingProposal.targets.some((target) => target.kind === "create");

    let cancelled = false;
    void (async () => {
      const [entries, currentSnapshot] = await Promise.all([
        Promise.all(existingTargets.map(async (target) => {
          const snapshot = await fetchTargetSnapshot(target.targetId).catch(() => null);
          return snapshot ? [target.targetId, snapshot] as const : null;
        })),
        hasCreateTargets ? fetchTargetSnapshot(noteId).catch(() => null) : Promise.resolve(null),
      ]);

      if (cancelled) return;

      setTargetSnapshots(Object.fromEntries(entries.filter((entry): entry is readonly [string, ExistingTargetSnapshot] => entry !== null)));
      const parentId = currentSnapshot?.parentNoteIds[0];
      if (!parentId) return;

      const parent = await fetchJsonOrThrow<{ title: string }>(`/api/lore/${parentId}`).catch(() => null);
      if (!cancelled) setNewNoteParentLabel(parent ? `${parent.title} (${parentId})` : parentId);
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingProposal, noteId]);

  useEffect(() => {
    if (store.isOpen) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, pendingProposal, applyResult, store.isOpen]);

  async function sendMessage(contentOverride?: string) {
    if (!noteId) return;
    const content = contentOverride ?? draft.trim();
    if (!content || isSending) return;

    if (!contentOverride) {
      setDraft("");
    }

    const myRequestId = ++requestIdRef.current;
    const isStale = () => requestIdRef.current !== myRequestId;

    const watchId = "copilot-" + Date.now();
    useNotificationStore.getState().watch({
      id: watchId,
      kind: "copilot-turn",
      title: "Copilot Chat",
      href: window.location.pathname,
    });
    let watchResolved = false;

    const currentMessages = useCopilotStore.getState().conversations[noteId]?.messages || [];
    const nextMessages = [...currentMessages, { role: "user" as const, content }];

    store.sendMessage(noteId, content);
    store.addMessage(noteId, { role: "assistant", content: "" });
    setIsSending(true);
    setApplyResult(null);

    try {
      const sessionId = useCopilotStore.getState().conversations[noteId]?.sessionId;
      let accumulated = "";
      for await (const event of stream(`/api/lore/${noteId}/copilot/stream`, { messages: nextMessages, sessionId: sessionId ?? undefined })) {
        if (isStale()) break;
        if (event.event === "token") {
          accumulated += (event.data as { content: string }).content;
          store.updateLastMessage(noteId, accumulated);
        } else if (event.event === "result") {
          const response = event.data as CopilotChatResponse;
          store.updateLastMessage(noteId, response.assistantMessage);
          store.setPendingProposal(noteId, response.proposal ?? null);
          if (response.sessionId) {
            store.setSessionId(noteId, response.sessionId);
          }
          setLastResponse(response);
          setIsRedirecting(false);
          setRedirectDraft("");
          watchResolved = true;
          useNotificationStore.getState().complete(watchId, { summary: "Assistant replied." });
        } else if (event.event === "error") {
          const errData = event.data as { error: string };
          store.updateLastMessage(noteId, `Error: ${errData.error}`);
          setErrorService("AllKnower");
          store.setLastError({ message: errData.error });
          watchResolved = true;
          useNotificationStore.getState().fail(watchId, { error: errData.error || "Copilot failed." });
        }
      }
    } catch (error: any) {
      if (isStale()) return;
      if (error.name === "AbortError") {
        watchResolved = true;
        useNotificationStore.getState().dismiss(watchId);
      } else {
        setErrorService("AllKnower");
        store.setLastError(error as { message: string });
        watchResolved = true;
        useNotificationStore.getState().fail(watchId, { error: error.message || "Copilot failed." });
      }
    } finally {
      if (!isStale()) {
        setIsSending(false);
        if (!watchResolved) {
          useNotificationStore.getState().complete(watchId, { summary: "Stream ended." });
        }
      }
    }
  }

  async function handleRedirect() {
    if (!noteId) return;
    const instructions = redirectDraft.trim();
    if (!instructions) return;
    store.redirectWithInstructions(noteId, instructions);
    // Send it immediately
    await sendMessage(`I'm rejecting the previous proposal. Instead: ${instructions}`);
  }

  async function applySelectedChanges() {
    if (!pendingProposal || selectedTargetIds.length === 0 || isApplying || !noteId) return;

    const watchId = "copilot-apply-" + Date.now();
    useNotificationStore.getState().watch({
      id: watchId,
      kind: "review-commit",
      title: "Apply Proposal",
      href: window.location.pathname,
    });

    setIsApplying(true);
    store.setLastError(null);

    try {
      const response = await fetchJsonOrThrow<{ applied: CopilotApplyResult }>(`/api/lore/${noteId}/copilot/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal: pendingProposal,
          approvedTargetIds: selectedTargetIds,
        }),
      });

      setApplyResult(response.applied);
      setConfirmApplyOpen(false);
      
      // Clear proposal explicitly
      store.setAssistantResponse(noteId, "Changes successfully applied to AllCodex.", null);

      const touchedNoteIds = new Set([
        noteId,
        ...response.applied.updatedNoteIds,
        ...response.applied.createdNoteIds,
      ]);
      for (const touchedNoteId of touchedNoteIds) {
        void queryClient.invalidateQueries({ queryKey: ["note", touchedNoteId] });
        void queryClient.invalidateQueries({ queryKey: ["note-content", touchedNoteId] });
        void queryClient.invalidateQueries({ queryKey: ["backlinks", touchedNoteId] });
      }
      void queryClient.invalidateQueries({ queryKey: ["lore"] });

      useNotificationStore.getState().complete(watchId, { summary: "Applied changes to AllCodex." });
    } catch (error: any) {
      setErrorService("AllCodex");
      store.setLastError(error as { message: string });
      useNotificationStore.getState().fail(watchId, { error: error.message || "Apply failed." });
    } finally {
      setIsApplying(false);
    }
  }

  if (!noteId) return null;

  return (
    <Sheet open={store.isOpen} onOpenChange={(val) => {
      if (!val) {
        cancelStream();
        store.close();
      }
    }}>
      <SheetContent side="right" className="w-full border-l-border/60 bg-background/95 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Article-Scoped Copilot
          </SheetTitle>
          <SheetDescription>
            Discuss the current article, review explicit proposals, and apply only the changes you approve.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex h-[calc(100vh-8rem)] flex-col gap-4">
          {store.lastError ? <ServiceBanner service={errorService} error={store.lastError} /> : null}

          <ScrollArea className="flex-1 rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="space-y-4">
              {!hasConversation && (
                <p className="text-sm text-muted-foreground">
                  Ask for revisions, expansions, linked-note updates, or a draft new note tied to this article.
                </p>
              )}

              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-lg border p-3 text-sm ${
                    message.role === "assistant"
                      ? "border-accent/20 bg-accent/5"
                      : "border-border/60 bg-background/80"
                  }`}
                >
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{message.role}</p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}

              {citations.length > 0 && (
                <Card className="border-border/60 bg-background/70">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Grounding</p>
                    {citations.map((citation) => (
                      <p key={`${citation.source}:${citation.noteId}`} className="text-sm">
                        {citation.title} <span className="text-muted-foreground">({citation.source})</span>
                      </p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {pendingProposal && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Review Proposal</p>
                      <p className="text-xs text-muted-foreground">{selectedCount} selected for apply</p>
                    </div>
                  </div>

                  {orderedTargets.map((target) => (
                    <ProposalCard
                      key={target.targetId}
                      noteId={noteId}
                      target={target}
                      checked={selectedTargetIds.includes(target.targetId)}
                      onCheckedChange={() => store.toggleTargetSelection(noteId, target.targetId)}
                      snapshot={targetSnapshots[target.targetId]}
                      newNoteParentLabel={newNoteParentLabel}
                    />
                  ))}

                  <Card className="border-border/60 bg-background/80 mt-4">
                    <CardContent className="p-4 space-y-4">
                      {isRedirecting ? (
                        <div className="space-y-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Redirect Instructions</p>
                          <Textarea
                            value={redirectDraft}
                            onChange={(e) => setRedirectDraft(e.target.value)}
                            placeholder="Instead of this proposal, please..."
                            className="min-h-24"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setIsRedirecting(false)}>
                              Nevermind
                            </Button>
                            <Button size="sm" onClick={handleRedirect} disabled={isSending || !redirectDraft.trim()}>
                              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                              Send Revision
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="default"
                            onClick={() => setConfirmApplyOpen(true)}
                            disabled={selectedTargetIds.length === 0 || isApplying}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Apply Selected
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => store.dismissProposal(noteId)}
                          >
                            <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                            Cancel
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setIsRedirecting(true)}
                            className="border-accent/40 text-accent hover:bg-accent/10"
                          >
                            <Sparkles className="mr-2 h-4 w-4" />
                            Cancel + Redirect...
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {applyResult && (
                <Card className="border-emerald-500/30 bg-emerald-500/10">
                  <CardContent className="space-y-2 p-4 text-sm">
                    <div className="flex items-center gap-2 text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Apply completed
                    </div>
                    <p>Updated: {applyResult.updatedNoteIds.join(", ") || "none"}</p>
                    <p>Created: {applyResult.createdNoteIds.join(", ") || "none"}</p>
                    {applyResult.skipped.length > 0 && <p>Skipped: {applyResult.skipped.join(", ")}</p>}
                    {applyResult.failed && applyResult.failed.length > 0 && <p className="text-red-300">Failed: {applyResult.failed.join(", ")}</p>}
                  </CardContent>
                </Card>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="space-y-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask for article edits, linked-note updates, or a reviewable proposal."
              className="min-h-28"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Copilot context is preserved while navigating.
              </div>
              <Button variant="outline" onClick={() => sendMessage()} disabled={isSending || !draft.trim()}>
                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Send
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
      <Dialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply selected copilot changes?</DialogTitle>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>This will write {selectedTargetIds.length} selected target{selectedTargetIds.length === 1 ? "" : "s"} to AllCodex.</p>
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-red-300 font-medium text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 shrink-0" />
                This action cannot be undone.
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApplyOpen(false)} disabled={isApplying}>
              Cancel
            </Button>
            <Button onClick={applySelectedChanges} disabled={isApplying}>
              {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Write to Codex
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
