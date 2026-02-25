"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, X, BookOpen } from "lucide-react";
import Link from "next/link";

const LORE_TYPES = [
  { value: "character", label: "Character" },
  { value: "location", label: "Location" },
  { value: "faction", label: "Faction" },
  { value: "creature", label: "Creature" },
  { value: "event", label: "Event" },
  { value: "manuscript", label: "Manuscript" },
  { value: "item", label: "Item" },
  { value: "lore", label: "General Lore" },
];

export default function NewLorePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [loreType, setLoreType] = useState("");
  const [parentId, setParentId] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutate: createNote, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/lore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          loreType: loreType || "lore",
          parentNoteId: parentId.trim() || undefined,
          content: content || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data: { note?: { noteId?: string }; noteId?: string }) => {
      const id = data?.note?.noteId ?? (data as any).noteId;
      router.push(id ? `/lore/${id}` : "/lore");
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-primary" />
        <div>
          <h1
            className="text-2xl font-bold text-primary"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            New Lore Entry
          </h1>
          <p className="text-sm text-muted-foreground">
            Add a new entry to the chronicle.
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border/60 bg-card/60 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g. Aldric Stonehaven"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={loreType}
              onValueChange={setLoreType}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                {LORE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="parentId">
              Parent Note ID{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="parentId"
              placeholder="root or note ID"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={isPending}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="content">
            Initial Content{" "}
            <span className="text-muted-foreground text-xs">
              (optional, plain text or HTML)
            </span>
          </Label>
          <Textarea
            id="content"
            placeholder="Write the initial lore content…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="resize-none"
            disabled={isPending}
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outline" size="sm" asChild disabled={isPending}>
            <Link href="/lore">
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => createNote()}
            disabled={!title.trim() || isPending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            Create Entry
          </Button>
        </div>
      </div>
    </div>
  );
}
