import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit2 } from "lucide-react";
import { StatblockEditForm } from "./StatblockEditForm";

interface StatblockNote {
  noteId: string;
  title: string;
  attributes: Array<{ name: string; value: string; type: string }>;
}

function attr(note: StatblockNote, name: string): string | undefined {
  return note.attributes.find((a) => a.name === name)?.value;
}

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function AbilityScore({ label, value }: { label: string; value: string | undefined }) {
  const num = parseInt(value ?? "10", 10);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className="text-sm font-bold">{isNaN(num) ? "—" : num}</span>
      <span className="text-[10px] text-muted-foreground">{isNaN(num) ? "" : mod(num)}</span>
    </div>
  );
}

/** Compact card variant — used in the statblock library grid */
export function StatblockCardCompact({ note }: { note: StatblockNote }) {
  const name = attr(note, "crName") ?? note.title;
  const cr = attr(note, "challengeRating") ?? attr(note, "crLevel");
  const creatureType = attr(note, "creatureType");
  const size = attr(note, "size");
  const ac = attr(note, "ac");
  const hp = attr(note, "hp");
  const alignment = attr(note, "alignment");

  return (
    <Link
      href={`/lore/${note.noteId}`}
      className="block rounded-lg border border-border/50 bg-card/60 hover:bg-card/80 hover:border-primary/40 transition-colors p-3 group"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors leading-tight">{name}</h3>
        {cr !== undefined && (
          <Badge variant="outline" className="text-[10px] px-1.5 shrink-0 font-mono">
            CR {cr}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground capitalize">
        {[size, creatureType, alignment].filter(Boolean).join(" · ")}
      </p>
      {(ac || hp) && (
        <div className="flex gap-3 mt-2 text-xs">
          {ac && <span><span className="text-muted-foreground">AC</span> {ac}</span>}
          {hp && <span><span className="text-muted-foreground">HP</span> {hp}</span>}
        </div>
      )}
    </Link>
  );
}

/** Full stat block — used in detail views and session quick-lookup */
export function StatblockCard({
  note,
  initialIsEditing = false,
  onEditToggle
}: {
  note: StatblockNote;
  initialIsEditing?: boolean;
  onEditToggle?: (isEditing: boolean) => void;
}) {
  const [isEditing, setIsEditing] = useState(initialIsEditing);

  const handleSetIsEditing = (val: boolean) => {
    setIsEditing(val);
    onEditToggle?.(val);
  };

  if (isEditing) {
    return (
      <StatblockEditForm
        note={note}
        onCancel={() => handleSetIsEditing(false)}
        onSaveSuccess={() => handleSetIsEditing(false)}
      />
    );
  }

  const name = attr(note, "crName") ?? note.title;
  const cr = attr(note, "challengeRating") ?? attr(note, "crLevel");
  const creatureType = attr(note, "creatureType");
  const size = attr(note, "size");
  const alignment = attr(note, "alignment");
  const ac = attr(note, "ac");
  const hp = attr(note, "hp");
  const speed = attr(note, "speed");
  const immunities = attr(note, "immunities");
  const resistances = attr(note, "resistances");
  const vulnerabilities = attr(note, "vulnerabilities");
  const abilities = attr(note, "abilities");
  const actions = attr(note, "actions");
  const legendaryActions = attr(note, "legendaryActions");

  return (
    <div className="rounded-lg border-2 border-amber-900/40 bg-amber-950/20 p-4 space-y-3">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-base text-amber-200">{name}</h2>
            <p className="text-xs text-amber-200/60 italic capitalize mt-0.5">
              {[size, creatureType, alignment].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {cr !== undefined && (
              <Badge className="bg-amber-900/60 text-amber-200 border-amber-700/50 text-xs">CR {cr}</Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSetIsEditing(true)}
              className="h-7 w-7 text-amber-200/60 hover:text-amber-200 hover:bg-amber-950/40"
              title="Edit Statblock"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <Separator className="border-amber-900/40" />

      {/* Core stats */}
      <div className="space-y-1 text-xs">
        {ac && (
          <div className="flex gap-2">
            <span className="font-bold text-amber-200/80 w-16">Armor Class</span>
            <span>{ac}</span>
          </div>
        )}
        {hp && (
          <div className="flex gap-2">
            <span className="font-bold text-amber-200/80 w-16">Hit Points</span>
            <span>{hp}</span>
          </div>
        )}
        {speed && (
          <div className="flex gap-2">
            <span className="font-bold text-amber-200/80 w-16">Speed</span>
            <span>{speed}</span>
          </div>
        )}
      </div>

      <Separator className="border-amber-900/40" />

      {/* Ability scores */}
      <div className="grid grid-cols-6 gap-1">
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((stat) => (
          <AbilityScore key={stat} label={stat} value={attr(note, stat)} />
        ))}
      </div>

      {/* Resistances / immunities */}
      {(immunities || resistances || vulnerabilities) && (
        <>
          <Separator className="border-amber-900/40" />
          <div className="space-y-1 text-xs">
            {immunities && (
              <div className="flex gap-2">
                <span className="font-bold text-amber-200/80 w-24">Immunities</span>
                <span className="text-muted-foreground">{immunities}</span>
              </div>
            )}
            {resistances && (
              <div className="flex gap-2">
                <span className="font-bold text-amber-200/80 w-24">Resistances</span>
                <span className="text-muted-foreground">{resistances}</span>
              </div>
            )}
            {vulnerabilities && (
              <div className="flex gap-2">
                <span className="font-bold text-amber-200/80 w-24">Vulnerabilities</span>
                <span className="text-muted-foreground">{vulnerabilities}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Abilities / Actions */}
      {(abilities || actions || legendaryActions) && (
        <>
          <Separator className="border-amber-900/40" />
          <div className="space-y-2 text-xs">
            {abilities && (
              <div>
                <p className="font-bold text-amber-200/80 mb-0.5">Special Abilities</p>
                <p className="text-muted-foreground leading-relaxed">{abilities}</p>
              </div>
            )}
            {actions && (
              <div>
                <p className="font-bold text-amber-200/80 mb-0.5">Actions</p>
                <p className="text-muted-foreground leading-relaxed">{actions}</p>
              </div>
            )}
            {legendaryActions && (
              <div>
                <p className="font-bold text-amber-200/80 mb-0.5">Legendary Actions</p>
                <p className="text-muted-foreground leading-relaxed">{legendaryActions}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail link */}
      <div className="pt-1">
        <Link
          href={`/lore/${note.noteId}`}
          className="text-[10px] text-primary/60 hover:text-primary transition-colors"
        >
          Full note →
        </Link>
      </div>
    </div>
  );
}
