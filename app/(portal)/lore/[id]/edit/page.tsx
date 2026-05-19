"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoreEditor } from "@/components/editor/LoreEditor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Eye, EyeOff, ArrowLeft, Save, ImagePlus, Loader2, Link2, X } from "lucide-react";
import { TemplateDef, LORE_TEMPLATES } from "@/components/editor/TemplatePicker";
import { PromotedFields } from "@/components/editor/PromotedFields";
import { isPortraitRelationName } from "@/lib/lore-presentation";
import { getThemeSongStorageUrl, parseThemeSongUrl, THEME_SONG_LABEL_NAME } from "@/lib/theme-song";
import { CopilotTrigger } from "@/components/portal/CopilotTrigger";

interface Note {
  noteId: string;
  title: string;
  type: string;
  attributes?: Array<{ name: string; value: string; type: string; attributeId: string }>;
}

interface NoteSearchResult {
  noteId: string;
  title: string;
  type: string;
  loreType: string | null;
}

/**
 * Uploads an image file to the portrait image upload endpoint and returns the created image note information.
 *
 * @param file - The image file to upload. The file's MIME type must start with `image/`.
 * @returns An object containing `noteId` for the created image note and `url` for the uploaded image.
 * @throws Error - If the provided file is not an image (`"Only image uploads are supported"`).
 * @throws Error - If the upload request fails (`"Failed to upload portrait image"`).
 */
async function uploadPortraitImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported");
  }

  const response = await fetch("/api/lore/upload-image", {
    method: "POST",
    headers: {
      "content-type": file.type || "application/octet-stream",
      "x-vercel-filename": file.name || "portrait.png",
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error("Failed to upload portrait image");
  }

  return response.json() as Promise<{ noteId: string; url: string }>;
}

/**
 * Render the editor UI for modifying a lore entry and its metadata.
 *
 * Loads note metadata and content, initializes local editable state, and provides controls to
 * edit title, HTML content, template-backed attributes, portrait image (search or upload),
 * theme-song URL, visibility (draft/published), and destructive actions (delete). Saves and
 * synchronizes changes via the page API and updates client cache and navigation on success.
 *
 * @returns The rendered React element for the edit lore entry page.
 */
export default function EditLorePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [title, setTitle] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [draftAttrId, setDraftAttrId] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateDef | null>(null);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [portraitImageNoteId, setPortraitImageNoteId] = useState("");
  const [themeSongUrl, setThemeSongUrl] = useState("");
  const [portraitSearchQuery, setPortraitSearchQuery] = useState("");
  const [portraitSearchResults, setPortraitSearchResults] = useState<NoteSearchResult[]>([]);
  const [portraitSearchOpen, setPortraitSearchOpen] = useState(false);
  const [portraitSearchLoading, setPortraitSearchLoading] = useState(false);
  const [portraitUploadError, setPortraitUploadError] = useState<string | null>(null);

  const { isLoading: noteLoading, data: noteData } = useQuery<Note>({
    queryKey: ["note", id],
    queryFn: () => fetch(`/api/lore/${id}`).then((response) => response.json()),
  });

  const { isLoading: contentLoading, data: fetchedContent } = useQuery<string>({
    queryKey: ["note-content", id],
    queryFn: () => fetch(`/api/lore/${id}/content`).then((response) => response.text()),
  });

  // Sync note data into local state once (allow user edits to diverge)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!noteData || initializedRef.current) return;
    initializedRef.current = true;

    if (title === null) setTitle(noteData.title ?? "");

    const draftAttr = noteData.attributes?.find((attribute) => attribute.name === "draft");
    setIsDraft(!!draftAttr);
    setDraftAttrId(draftAttr?.attributeId || null);

    const portraitAttr = noteData.attributes?.find(
      (attribute) => attribute.type === "relation" && isPortraitRelationName(attribute.name),
    );
    setPortraitImageNoteId(portraitAttr?.value ?? "");
    const themeSongAttr = noteData.attributes?.find(
      (attribute) => attribute.type === "label" && attribute.name === THEME_SONG_LABEL_NAME,
    );
    setThemeSongUrl(themeSongAttr?.value ?? "");

    if (template === null) {
      const loreTypeAttr = noteData.attributes?.find((attribute) => attribute.name === "loreType");
      const foundTemplate = LORE_TEMPLATES.find((candidate) => candidate.value === loreTypeAttr?.value) || null;
      setTemplate(foundTemplate);

      if (foundTemplate && Object.keys(attributeValues).length === 0) {
        const initialValues: Record<string, string> = {};
        foundTemplate.attributes.forEach((attr) => {
          const sanitizedKey = attr.replace(/\s+/g, "_");
          const attrData = noteData.attributes?.find((attribute) => attribute.name === sanitizedKey);
          if (attrData) {
            initialValues[attr] = attrData.value;
          }
        });
        setAttributeValues(initialValues);
      }
    }
  }, [noteData]);

  useEffect(() => {
    if (fetchedContent !== undefined && content === null) {
      setContent(fetchedContent);
    }
  }, [fetchedContent]);

  useEffect(() => {
    const query = portraitSearchQuery.trim();

    if (query.length < 2) {
      setPortraitSearchResults([]);
      setPortraitSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    setPortraitSearchLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/lore/note-search?q=${encodeURIComponent(query)}&type=image`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to search image notes");
        }

        const results = (await response.json()) as NoteSearchResult[];
        setPortraitSearchResults(results);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setPortraitSearchResults([]);
        }
      } finally {
        setPortraitSearchLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [portraitSearchQuery]);

  const isLoading = noteLoading || contentLoading;
  const parsedThemeSong = parseThemeSongUrl(themeSongUrl);
  const themeSongPreviewLabel = parsedThemeSong
    ? parsedThemeSong.provider === "appleMusic"
      ? "Apple Music"
      : parsedThemeSong.provider
    : null;

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: async () => {
      setSaveError(null);
      const trimmedThemeSongUrl = themeSongUrl.trim();
      const storageThemeSongUrl = getThemeSongStorageUrl(trimmedThemeSongUrl);

      if (trimmedThemeSongUrl && !storageThemeSongUrl) {
        throw new Error("Theme song must be a supported HTTPS URL from Spotify, YouTube, SoundCloud, or Apple Music.");
      }

      if (title !== null) {
        const response = await fetch(`/api/lore/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (!response.ok) {
          throw new Error("Failed to save title");
        }
      }

      const cachedNote = qc.getQueryData<Note>(["note", id]) ?? noteData;

      if (template) {

        for (const attr of template.attributes) {
          const sanitizedKey = attr.replace(/\s+/g, "_");
          const existingAttr = cachedNote?.attributes?.find(
            (attribute) => attribute.name === sanitizedKey && attribute.type === "label",
          );
          const newValue = attributeValues[attr] || "";

          if (existingAttr) {
            if (newValue.trim() === "") {
              await fetch(`/api/lore/${id}/attributes?attrId=${existingAttr.attributeId}`, { method: "DELETE" });
            } else if (existingAttr.value !== newValue.trim()) {
              await fetch(`/api/lore/${id}/attributes?attrId=${existingAttr.attributeId}`, { method: "DELETE" });
              await fetch(`/api/lore/${id}/attributes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "label", name: sanitizedKey, value: newValue.trim() }),
              });
            }
          } else if (newValue.trim() !== "") {
            await fetch(`/api/lore/${id}/attributes`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "label", name: sanitizedKey, value: newValue.trim() }),
            });
          }
        }

      }

      const normalizedPortraitId = portraitImageNoteId.trim();
      const existingPortraitAttr = cachedNote?.attributes?.find(
        (attribute) => attribute.type === "relation" && isPortraitRelationName(attribute.name),
      );
      const existingThemeSongAttrs = cachedNote?.attributes?.filter(
        (attribute) => attribute.type === "label" && attribute.name === THEME_SONG_LABEL_NAME,
      ) ?? [];

      if (
        existingPortraitAttr &&
        (!normalizedPortraitId || existingPortraitAttr.value !== normalizedPortraitId || existingPortraitAttr.name !== "portraitImage")
      ) {
        await fetch(`/api/lore/${id}/attributes?attrId=${existingPortraitAttr.attributeId}`, { method: "DELETE" });
      }

      if (
        normalizedPortraitId &&
        (!existingPortraitAttr || existingPortraitAttr.value !== normalizedPortraitId || existingPortraitAttr.name !== "portraitImage")
      ) {
        await fetch(`/api/lore/${id}/attributes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "relation", name: "portraitImage", value: normalizedPortraitId }),
        });
      }

      for (const attribute of existingThemeSongAttrs) {
        await fetch(`/api/lore/${id}/attributes?attrId=${attribute.attributeId}`, { method: "DELETE" });
      }

      if (storageThemeSongUrl) {
        await fetch(`/api/lore/${id}/attributes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "label", name: THEME_SONG_LABEL_NAME, value: storageThemeSongUrl }),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["note", id] });
      qc.invalidateQueries({ queryKey: ["note-content", id] });
      router.push(`/lore/${id}`);
    },
    onError: (error: Error) => setSaveError(error.message),
  });

  const { mutate: uploadPortrait, isPending: portraitUploading } = useMutation({
    mutationFn: uploadPortraitImage,
    onMutate: () => {
      setPortraitUploadError(null);
    },
    onSuccess: ({ noteId }) => {
      setPortraitImageNoteId(noteId);
    },
    onError: (error: Error) => {
      setPortraitUploadError(error.message);
    },
  });

  const { mutate: toggleDraft, isPending: togglingDraft } = useMutation({
    onMutate: () => {
      setIsDraft((current) => !current);
    },
    mutationFn: async () => {
      if (isDraft && draftAttrId) {
        const response = await fetch(`/api/lore/${id}/attributes?attrId=${draftAttrId}`, { method: "DELETE" });
        if (!response.ok) {
          throw new Error("Failed to publish");
        }
      } else {
        const response = await fetch(`/api/lore/${id}/attributes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "label", name: "draft", value: "" }),
        });
        if (!response.ok) {
          throw new Error("Failed to set as draft");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["note", id] });
    },
    onError: (error: Error) => {
      setIsDraft((current) => !current);
      setSaveError(error.message);
    },
  });

  const { mutate: deleteNote, isPending: deleting } = useMutation({
    mutationFn: () =>
      fetch(`/api/lore/${id}`, { method: "DELETE" }).then((response) => {
        if (!response.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => router.push("/lore"),
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1500px] space-y-8">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-14 w-96 max-w-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[680px] w-full rounded-[1.75rem]" />
          <Skeleton className="h-[420px] w-full rounded-[1.5rem]" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-8">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.35em] text-primary/70" style={{ fontFamily: "var(--font-cinzel)" }}>
            Archivist&apos;s Manuscript
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary md:text-3xl" style={{ fontFamily: "var(--font-cinzel)" }}>
              Edit Lore Entry
            </h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{id}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(`/lore/${id}`)}
            disabled={deleting}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Entry
          </Button>
          <Button
            variant="outline"
            onClick={() => toggleDraft()}
            disabled={saving || deleting || togglingDraft}
            className="gap-2 border-amber-500/30 text-amber-600/80 hover:bg-amber-500/10"
          >
            {isDraft ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {isDraft ? "Publish" : "Revert to Draft"}
          </Button>
          <CopilotTrigger noteId={id} />
          <Button
            variant="default"
            onClick={() => save()}
            disabled={saving || deleting || togglingDraft}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving Metadata..." : "Save Metadata"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-border/70 bg-card/50 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.18)] sm:p-8">
            <div className="mb-6 border-b border-border/50 pb-6">
              <div className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>
                Canon Entry Title
              </div>
              <Input
                id="title"
                value={title ?? ""}
                onChange={(event) => setTitle(event.target.value)}
                disabled={saving}
                placeholder="Name this entry"
                className="h-auto border-none bg-transparent px-0 py-0 text-4xl font-bold text-primary shadow-none focus-visible:ring-0 md:text-5xl"
                style={{ fontFamily: "var(--font-cinzel)" }}
              />
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Compose the manuscript in block form. Content autosaves as HTML for AllCodex compatibility while metadata stays explicit here.
              </p>
            </div>

            <LoreEditor
              initialContent={content ?? ""}
              onSave={async (html) => {
                try {
                  const res = await fetch(`/api/lore/${id}/content`, {
                    method: "PUT",
                    headers: { "Content-Type": "text/html" },
                    body: html,
                  });
                  if (!res.ok) {
                    setSaveError("Failed to save content. Please try again.");
                  }
                } catch {
                  setSaveError("Unable to reach server. Content not saved.");
                }
              }}
            />
          </div>

          {saveError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {saveError}
            </div>
          )}
        </section>

        <aside className="self-start space-y-4 xl:sticky xl:top-6">
          <div className="rounded-[1.5rem] border border-border/70 bg-card/60 p-5">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>
              Entry Properties
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Template</div>
                <div className="mt-1 font-medium text-foreground">{template?.label ?? "General Lore"}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {template?.description ?? "A freeform lore entry without a template-bound schema."}
                </p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Visibility</div>
                <div className="mt-1 inline-flex rounded-full border border-border/70 px-3 py-1 text-xs uppercase tracking-[0.25em] text-foreground">
                  {isDraft ? "Draft" : "Published"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Portrait</div>
                <div className="mt-1 font-medium text-foreground">
                  {portraitImageNoteId ? `Image note ${portraitImageNoteId}` : "No portrait attached"}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Saved as a `portraitImage` relation so the lore detail rail can render a dedicated portrait.
                </p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Theme Song</div>
                <div className="mt-1 font-medium text-foreground">
                  {themeSongUrl.trim() ? themeSongUrl.trim() : "No theme song linked"}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Stored as a `themeSongUrl` label and rendered as a provider-safe embed under the portrait.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-card/60 p-5">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>
                Portrait Image
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Use an existing image note ID or upload a new portrait directly from here.
              </p>
            </div>

            {portraitImageNoteId && (
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                <div className="relative aspect-[4/5]">
                  <Image
                    src={`/api/lore/${portraitImageNoteId}/image`}
                    alt={`${title ?? noteData?.title ?? "Lore entry"} portrait preview`}
                    fill
                    sizes="320px"
                    unoptimized
                    className="object-cover"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="portrait-search">Find existing image note</Label>
              <div className="relative">
                <Input
                  id="portrait-search"
                  value={portraitSearchQuery}
                  onChange={(event) => {
                    setPortraitSearchQuery(event.target.value);
                    setPortraitSearchOpen(true);
                  }}
                  onFocus={() => setPortraitSearchOpen(true)}
                  disabled={saving || portraitUploading}
                  placeholder="Search uploaded portraits by title"
                />

                {portraitSearchOpen && portraitSearchQuery.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-md border border-border/50 bg-popover shadow-md">
                    {portraitSearchLoading ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Searching image notes...</div>
                    ) : portraitSearchResults.length > 0 ? (
                      portraitSearchResults.map((result) => (
                        <button
                          key={result.noteId}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                          onClick={() => {
                            setPortraitImageNoteId(result.noteId);
                            setPortraitSearchQuery(result.title);
                            setPortraitSearchOpen(false);
                          }}
                        >
                          <span className="truncate pr-2">{result.title}</span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{result.type}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No image notes matched that title.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portrait-note-id">Portrait image note ID</Label>
              <div className="flex gap-2">
                <Input
                  id="portrait-note-id"
                  value={portraitImageNoteId}
                  onChange={(event) => setPortraitImageNoteId(event.target.value)}
                  disabled={saving || portraitUploading}
                  placeholder="image-note-id"
                />
                {portraitImageNoteId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setPortraitImageNoteId("");
                      setPortraitSearchQuery("");
                    }}
                    disabled={saving || portraitUploading}
                    aria-label="Clear portrait image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portrait-upload">Upload portrait image</Label>
              <Input
                id="portrait-upload"
                type="file"
                accept="image/*"
                disabled={saving || portraitUploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  uploadPortrait(file);
                  event.currentTarget.value = "";
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme-song-url">Theme song URL</Label>
              <Input
                id="theme-song-url"
                value={themeSongUrl}
                onChange={(event) => setThemeSongUrl(event.target.value)}
                disabled={saving || portraitUploading}
                placeholder="https://open.spotify.com/track/... or Spotify iframe embed code"
              />
              <p className="text-sm text-muted-foreground">
                Supports Spotify, YouTube, SoundCloud, Apple Music HTTPS links, and Spotify iframe embed code. Iframe input stores only the sanitized URL.
              </p>
              {themeSongUrl.trim() && !parsedThemeSong && (
                <p className="text-sm text-red-300">
                  This URL will not save until it matches a supported provider.
                </p>
              )}
              {parsedThemeSong && (
                <p className="text-sm text-muted-foreground">
                  Preview provider: {themeSongPreviewLabel}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {portraitUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading portrait...
                </>
              ) : (
                <>
                  <ImagePlus className="h-3.5 w-3.5" />
                  Uploaded portraits are stored as image notes and linked on save.
                </>
              )}
            </div>

            {portraitImageNoteId && (
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">
                <Link2 className="h-3 w-3" />
                Pending portrait relation: {portraitImageNoteId}
              </div>
            )}

            {portraitUploadError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {portraitUploadError}
              </div>
            )}
          </div>

          {template && (
            <div className="rounded-[1.5rem] border border-border/70 bg-card/60 p-5">
              <PromotedFields
                template={template}
                values={attributeValues}
                onChange={(key, value) => setAttributeValues((prev) => ({ ...prev, [key]: value }))}
                disabled={saving}
              />
            </div>
          )}

          <div className="rounded-[1.5rem] border border-border/70 bg-card/60 p-5">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>
              Dangerous Actions
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Removing an entry deletes the manuscript and its metadata from the codex.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Delete this entry permanently?")) deleteNote();
              }}
              disabled={saving || deleting}
              className="mt-4 w-full gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Entry
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
