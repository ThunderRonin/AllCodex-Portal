"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, X, AlertCircle } from "lucide-react";

interface StatblockNote {
  noteId: string;
  title: string;
  attributes: Array<{ name: string; value: string; type: string; attributeId?: string }>;
}

interface StatblockEditFormProps {
  note: StatblockNote;
  onCancel: () => void;
  onSaveSuccess?: () => void;
}

function attr(note: StatblockNote, name: string): string | undefined {
  return note.attributes.find((a) => a.name === name)?.value;
}

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

const CR_ORDER: Record<string, number> = {
  "0": 0, "1/8": 0.125, "1/4": 0.25, "1/2": 0.5,
};

function getCrLevel(cr: string): number {
  if (!cr) return 0;
  if (cr in CR_ORDER) return CR_ORDER[cr];
  const num = parseFloat(cr);
  return isNaN(num) ? 0 : num;
}

export function StatblockEditForm({ note, onCancel, onSaveSuccess }: StatblockEditFormProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState(note.title);
  const [crName, setCrName] = useState(attr(note, "crName") ?? "");
  const [challengeRating, setChallengeRating] = useState(attr(note, "challengeRating") ?? "");
  const [creatureType, setCreatureType] = useState(attr(note, "creatureType") ?? "");
  const [size, setSize] = useState(attr(note, "size") ?? "");
  const [alignment, setAlignment] = useState(attr(note, "alignment") ?? "");
  const [ac, setAc] = useState(attr(note, "ac") ?? "");
  const [hp, setHp] = useState(attr(note, "hp") ?? "");
  const [speed, setSpeed] = useState(attr(note, "speed") ?? "");
  
  // Ability scores
  const [str, setStr] = useState(attr(note, "str") ?? "10");
  const [dex, setDex] = useState(attr(note, "dex") ?? "10");
  const [con, setCon] = useState(attr(note, "con") ?? "10");
  const [int, setInt] = useState(attr(note, "int") ?? "10");
  const [wis, setWis] = useState(attr(note, "wis") ?? "10");
  const [cha, setCha] = useState(attr(note, "cha") ?? "10");

  // Multi-line values
  const [immunities, setImmunities] = useState(attr(note, "immunities") ?? "");
  const [resistances, setResistances] = useState(attr(note, "resistances") ?? "");
  const [vulnerabilities, setVulnerabilities] = useState(attr(note, "vulnerabilities") ?? "");
  const [abilities, setAbilities] = useState(attr(note, "abilities") ?? "");
  const [actions, setActions] = useState(attr(note, "actions") ?? "");
  const [legendaryActions, setLegendaryActions] = useState(attr(note, "legendaryActions") ?? "");

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      // 1. PATCH the title if it has changed
      if (title.trim() !== note.title) {
        const res = await fetch(`/api/lore/${note.noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() }),
        });
        if (!res.ok) throw new Error("Failed to save note title");
      }

      // 2. Diff and save attributes
      const currentFields: Record<string, string> = {
        crName: crName.trim() || title.trim(), // fallback to title if crName is empty
        challengeRating: challengeRating.trim(),
        crLevel: String(getCrLevel(challengeRating.trim())),
        creatureType: creatureType.trim(),
        size: size.trim(),
        alignment: alignment.trim(),
        ac: ac.trim(),
        hp: hp.trim(),
        speed: speed.trim(),
        str: str.trim(),
        dex: dex.trim(),
        con: con.trim(),
        int: int.trim(),
        wis: wis.trim(),
        cha: cha.trim(),
        immunities: immunities.trim(),
        resistances: resistances.trim(),
        vulnerabilities: vulnerabilities.trim(),
        abilities: abilities.trim(),
        actions: actions.trim(),
        legendaryActions: legendaryActions.trim(),
      };

      const deletes: { key: string; attrId: string }[] = [];
      const creates: { key: string; value: string }[] = [];

      for (const [key, newValue] of Object.entries(currentFields)) {
        const existingAttr = note.attributes.find((a) => a.name === key);

        if (existingAttr && existingAttr.attributeId) {
          if (newValue === "") {
            deletes.push({ key, attrId: existingAttr.attributeId });
          } else if (existingAttr.value !== newValue) {
            deletes.push({ key, attrId: existingAttr.attributeId });
            creates.push({ key, value: newValue });
          }
        } else if (newValue !== "") {
          creates.push({ key, value: newValue });
        }
      }

      const delResults = await Promise.allSettled(
        deletes.map(({ key, attrId }) =>
          fetch(`/api/lore/${note.noteId}/attributes?attrId=${attrId}`, { method: "DELETE" })
            .then((r) => { if (!r.ok) throw new Error(`delete ${key}`); })
        )
      );
      const delFailures = delResults.filter((r) => r.status === "rejected");
      if (delFailures.length > 0) {
        throw new Error(`Failed to delete ${delFailures.length} attribute(s)`);
      }

      const createResults = await Promise.allSettled(
        creates.map(({ key, value }) =>
          fetch(`/api/lore/${note.noteId}/attributes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "label", name: key, value }),
          }).then((r) => { if (!r.ok) throw new Error(`create ${key}`); })
        )
      );
      const createFailures = createResults.filter((r) => r.status === "rejected");
      if (createFailures.length > 0) {
        throw new Error(`Failed to create ${createFailures.length} attribute(s)`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statblocks"] });
      queryClient.invalidateQueries({ queryKey: ["note", note.noteId] });
      queryClient.invalidateQueries({ queryKey: ["lore-tree"] });
      onSaveSuccess?.();
    },
    onError: (err: any) => {
      setError(err.message || "An error occurred while saving the statblock.");
    },
  });

  const getAbilityMod = (val: string) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? "" : mod(num);
  };

  return (
    <div className="rounded-lg border-2 border-amber-900/40 bg-amber-950/20 p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-amber-200 uppercase tracking-widest" style={{ fontFamily: "var(--font-cinzel)" }}>
          Edit Statblock
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-amber-200/60 hover:text-amber-200 h-6 px-2 hover:bg-amber-950/40">
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 rounded border border-red-500/30 bg-red-500/10 text-red-300 text-[11px]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="title" className="font-semibold text-amber-200/80">Creature Title (Note Title)</label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Acolyte"
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="crName" className="font-semibold text-amber-200/80">Display Name (crName)</label>
          <Input
            id="crName"
            value={crName}
            onChange={(e) => setCrName(e.target.value)}
            placeholder="e.g. Acolyte"
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label htmlFor="challengeRating" className="font-semibold text-amber-200/80">Challenge Rating (CR)</label>
          <Input
            id="challengeRating"
            value={challengeRating}
            onChange={(e) => setChallengeRating(e.target.value)}
            placeholder="e.g. 1/4, 1, 12"
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="creatureType" className="font-semibold text-amber-200/80">Creature Type</label>
          <Input
            id="creatureType"
            value={creatureType}
            onChange={(e) => setCreatureType(e.target.value)}
            placeholder="e.g. humanoid (any race)"
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="size" className="font-semibold text-amber-200/80">Size</label>
          <Input
            id="size"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="e.g. Medium, Large"
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="alignment" className="font-semibold text-amber-200/80">Alignment</label>
          <Input
            id="alignment"
            value={alignment}
            onChange={(e) => setAlignment(e.target.value)}
            placeholder="e.g. any alignment"
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
      </div>

      <Separator className="border-amber-900/40" />

      {/* Core stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label htmlFor="ac" className="font-semibold text-amber-200/80">Armor Class (AC)</label>
          <Input
            id="ac"
            value={ac}
            onChange={(e) => setAc(e.target.value)}
            placeholder="e.g. 10 (leather armor)"
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="hp" className="font-semibold text-amber-200/80">Hit Points (HP)</label>
          <Input
            id="hp"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            placeholder="e.g. 9 (2d8)"
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="speed" className="font-semibold text-amber-200/80">Speed</label>
          <Input
            id="speed"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            placeholder="e.g. 30 ft."
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
      </div>

      <Separator className="border-amber-900/40" />

      {/* Ability Scores */}
      <div className="space-y-1.5">
        <label className="font-semibold text-amber-200/80 uppercase tracking-widest text-[10px]">Ability Scores</label>
        <div className="grid grid-cols-6 gap-2">
          {[
            { label: "STR", val: str, set: setStr },
            { label: "DEX", val: dex, set: setDex },
            { label: "CON", val: con, set: setCon },
            { label: "INT", val: int, set: setInt },
            { label: "WIS", val: wis, set: setWis },
            { label: "CHA", val: cha, set: setCha },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1 p-1 bg-amber-950/30 rounded border border-amber-900/20">
              <label htmlFor={`ability-${item.label.toLowerCase()}`} className="text-[10px] font-bold text-amber-200/60">{item.label}</label>
              <Input
                id={`ability-${item.label.toLowerCase()}`}
                type="number"
                value={item.val}
                onChange={(e) => item.set(e.target.value)}
                className="h-7 w-12 text-center bg-amber-950/50 border-amber-900/30 text-amber-100 p-0 text-xs focus-visible:ring-amber-500/40"
              />
              <span className="text-[10px] text-amber-200/40 font-mono min-h-[14px]">
                {getAbilityMod(item.val)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Separator className="border-amber-900/40" />

      {/* Resistances / immunities */}
      <div className="space-y-2">
        <div className="space-y-1">
          <label htmlFor="immunities" className="font-semibold text-amber-200/80">Damage Immunities</label>
          <Input
            id="immunities"
            value={immunities}
            onChange={(e) => setImmunities(e.target.value)}
            placeholder="e.g. poison"
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="resistances" className="font-semibold text-amber-200/80">Damage Resistances</label>
          <Input
            id="resistances"
            value={resistances}
            onChange={(e) => setResistances(e.target.value)}
            placeholder="e.g. bludgeoning, piercing"
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="vulnerabilities" className="font-semibold text-amber-200/80">Damage Vulnerabilities</label>
          <Input
            id="vulnerabilities"
            value={vulnerabilities}
            onChange={(e) => setVulnerabilities(e.target.value)}
            placeholder="e.g. fire"
            className="h-8 bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 focus-visible:border-amber-700/50"
          />
        </div>
      </div>

      <Separator className="border-amber-900/40" />

      {/* Mechanics blocks */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="abilities" className="font-semibold text-amber-200/80">Special Abilities</label>
          <Textarea
            id="abilities"
            value={abilities}
            onChange={(e) => setAbilities(e.target.value)}
            placeholder="e.g. Spellcasting. The acolyte is a 1st-level spellcaster..."
            className="bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 text-xs min-h-[60px]"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="actions" className="font-semibold text-amber-200/80">Actions</label>
          <Textarea
            id="actions"
            value={actions}
            onChange={(e) => setActions(e.target.value)}
            placeholder="e.g. Club. Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage."
            className="bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 text-xs min-h-[60px]"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="legendaryActions" className="font-semibold text-amber-200/80">Legendary Actions</label>
          <Textarea
            id="legendaryActions"
            value={legendaryActions}
            onChange={(e) => setLegendaryActions(e.target.value)}
            placeholder="e.g. The dragon can take 3 legendary actions..."
            className="bg-amber-950/40 border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus-visible:ring-amber-500/50 text-xs min-h-[60px]"
          />
        </div>
      </div>

      <Separator className="border-amber-900/40" />

      {/* Form actions */}
      <div className="flex gap-2 justify-end pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
          className="border-amber-900/40 text-amber-200 hover:bg-amber-950/30 hover:text-amber-100 h-8"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => save()}
          disabled={isPending || !title.trim()}
          className="bg-amber-800 hover:bg-amber-700 text-amber-100 hover:text-white border-amber-600/30 h-8 gap-1.5"
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
