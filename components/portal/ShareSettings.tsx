"use client";

/**
 * ShareSettings — Sharing panel for a lore note's detail page.
 * Covers steps 32, 35, 36 of Phase G:
 *   - #draft / #gmOnly toggle badges (publish/hide controls)
 *   - Computed share URL display
 *   - Custom alias slug field (#shareAlias)
 *   - Password protection (#shareCredentials)
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Shield,
  X,
  Lock,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ShareAttribute {
  attributeId: string;
  name: string;
  type: "label" | "relation";
  value: string;
}

interface ShareSettingsProps {
  noteId: string;
  attributes: ShareAttribute[];
  isInShareTree?: boolean;
}

type ToggleTarget = "draft" | "gmOnly";

export function ShareSettings({ noteId, attributes, isInShareTree }: ShareSettingsProps) {
  const qc = useQueryClient();

  // Which toggle is currently saving
  const [saving, setSaving] = useState<ToggleTarget | null>(null);

  // Alias controls
  const [aliasInput, setAliasInput] = useState("");
  const [aliasSaving, setAliasSaving] = useState(false);

  // Credential controls
  const [credUser, setCredUser] = useState("");
  const [credPass, setCredPass] = useState("");
  const [credSaving, setCredSaving] = useState(false);
  const [showCredForm, setShowCredForm] = useState(false);

  // Derive share state from attributes
  const isDraft = attributes.some((a) => a.name === "draft" && a.type === "label");
  const isGmOnly = attributes.some((a) => a.name === "gmOnly" && a.type === "label");
  const draftAttr = attributes.find((a) => a.name === "draft" && a.type === "label");
  const gmOnlyAttr = attributes.find((a) => a.name === "gmOnly" && a.type === "label");
  const shareAliasAttr = attributes.find((a) => a.name === "shareAlias" && a.type === "label");
  const shareCredsAttr = attributes.find((a) => a.name === "shareCredentials" && a.type === "label");
  const currentAlias = shareAliasAttr?.value ?? "";
  const isProtected = Boolean(shareCredsAttr);

  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const shareUrl = `${portalUrl}/public/lore/${currentAlias || noteId}`;

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function toggle(target: ToggleTarget, existing: ShareAttribute | undefined) {
    setSaving(target);
    try {
      if (existing) {
        await fetch(`/api/lore/${noteId}/attributes?attrId=${existing.attributeId}`, {
          method: "DELETE",
        });
      } else {
        await fetch(`/api/lore/${noteId}/attributes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "label", name: target, value: "" }),
        });
      }
      await qc.invalidateQueries({ queryKey: ["note", noteId] });
    } finally {
      setSaving(null);
    }
  }

  async function saveAlias() {
    if (!aliasInput.trim() && !currentAlias) return;
    setAliasSaving(true);
    try {
      if (shareAliasAttr) {
        await fetch(`/api/lore/${noteId}/attributes?attrId=${shareAliasAttr.attributeId}`, {
          method: "DELETE",
        });
      }
      if (aliasInput.trim()) {
        await fetch(`/api/lore/${noteId}/attributes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "label", name: "shareAlias", value: aliasInput.trim() }),
        });
      }
      await qc.invalidateQueries({ queryKey: ["note", noteId] });
      setAliasInput("");
    } finally {
      setAliasSaving(false);
    }
  }

  async function clearAlias() {
    if (!shareAliasAttr) return;
    setAliasSaving(true);
    try {
      await fetch(`/api/lore/${noteId}/attributes?attrId=${shareAliasAttr.attributeId}`, {
        method: "DELETE",
      });
      await qc.invalidateQueries({ queryKey: ["note", noteId] });
      setAliasInput("");
    } finally {
      setAliasSaving(false);
    }
  }

  async function saveCredentials() {
    if (!credUser.trim() || !credPass.trim()) return;
    setCredSaving(true);
    try {
      if (shareCredsAttr) {
        await fetch(`/api/lore/${noteId}/attributes?attrId=${shareCredsAttr.attributeId}`, {
          method: "DELETE",
        });
      }
      await fetch(`/api/lore/${noteId}/attributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "label",
          name: "shareCredentials",
          value: `${credUser.trim()}:${credPass.trim()}`,
        }),
      });
      await qc.invalidateQueries({ queryKey: ["note", noteId] });
      setCredUser("");
      setCredPass("");
      setShowCredForm(false);
    } finally {
      setCredSaving(false);
    }
  }

  async function removeCredentials() {
    if (!shareCredsAttr) return;
    setCredSaving(true);
    try {
      await fetch(`/api/lore/${noteId}/attributes?attrId=${shareCredsAttr.attributeId}`, {
        method: "DELETE",
      });
      await qc.invalidateQueries({ queryKey: ["note", noteId] });
    } finally {
      setCredSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Card className="border-primary/20 bg-card/60">
      <CardHeader className="pb-2 border-b border-border/30">
        <CardTitle
          className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Sharing
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-3 space-y-4">
        {/* Status toggles */}
        <div className="flex flex-wrap gap-2">
          {/* Draft / Published */}
          <Badge
            className={cn(
              "cursor-pointer gap-1 text-xs select-none transition-colors border",
              isDraft
                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30"
                : isInShareTree === false
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                : "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
            )}
            onClick={() => toggle("draft", draftAttr)}
          >
            {saving === "draft" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            {isDraft ? "Draft" : isInShareTree === false ? "Not Shared" : "Published"}
          </Badge>

          {/* Visible / GM Only */}
          <Badge
            className={cn(
              "cursor-pointer gap-1 text-xs select-none transition-colors border",
              isGmOnly
                ? "bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30"
                : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50"
            )}
            onClick={() => toggle("gmOnly", gmOnlyAttr)}
          >
            {saving === "gmOnly" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isGmOnly ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            {isGmOnly ? "GM Only" : "Visible"}
          </Badge>

          {/* Protected indicator */}
          {isProtected && (
            <Badge className="gap-1 text-xs bg-blue-500/20 text-blue-400 border-blue-500/30 border">
              <Lock className="h-3 w-3" />
              Protected
            </Badge>
          )}
        </div>

        {/* Share URL */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Share URL
          </p>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-primary/70 hover:text-primary break-all font-mono transition-colors"
          >
            {shareUrl}
          </a>
          {!isDraft && !isGmOnly && isInShareTree === false && (
            <p className="text-[10px] text-yellow-500/90 font-medium mt-1 leading-normal">
              ⚠️ This note is not in the share tree. Configure the Share Root in Settings and ensure this note is a descendant of it.
            </p>
          )}
        </div>

        {/* Custom alias slug */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Custom URL Slug
          </Label>
          <div className="flex gap-1.5">
            <Input
              placeholder={currentAlias || "e.g. blackstone-keep"}
              value={aliasInput}
              onChange={(e) =>
                setAliasInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              className="h-7 text-xs font-mono"
              disabled={aliasSaving}
            />
            <Button
              size="sm"
              className="h-7 px-2 shrink-0"
              onClick={saveAlias}
              disabled={aliasSaving || !aliasInput.trim()}
              title="Save alias"
            >
              {aliasSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
            {currentAlias && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 shrink-0 text-muted-foreground"
                onClick={clearAlias}
                disabled={aliasSaving}
                title="Clear alias"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          {currentAlias && (
            <p className="text-[10px] text-muted-foreground">
              Current:{" "}
              <span className="font-mono text-primary/70">{currentAlias}</span>
            </p>
          )}
        </div>

        {/* Password protection */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Password
            </Label>
            {isProtected ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300"
                onClick={removeCredentials}
                disabled={credSaving}
              >
                {credSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                onClick={() => setShowCredForm(!showCredForm)}
              >
                {showCredForm ? "Cancel" : "Enable"}
              </Button>
            )}
          </div>

          {showCredForm && !isProtected && (
            <div className="space-y-2 pt-1">
              <Input
                placeholder="Username"
                value={credUser}
                onChange={(e) => setCredUser(e.target.value)}
                className="h-7 text-xs"
                autoComplete="off"
                disabled={credSaving}
              />
              <Input
                type="password"
                placeholder="Password (use a unique one)"
                value={credPass}
                onChange={(e) => setCredPass(e.target.value)}
                className="h-7 text-xs"
                autoComplete="new-password"
                disabled={credSaving}
              />
              <p className="text-[10px] text-muted-foreground">
                Stored as a note label. Use a unique password.
              </p>
              <Button
                size="sm"
                className="w-full h-7 gap-1 text-xs"
                onClick={saveCredentials}
                disabled={credSaving || !credUser.trim() || !credPass.trim()}
              >
                {credSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Shield className="h-3 w-3" />
                )}
                Save Credentials
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
