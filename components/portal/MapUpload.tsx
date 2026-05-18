"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface MapUploadProps {
    noteId: string;
    onUploaded: () => void;
}

export default function MapUpload({ noteId, onUploaded }: MapUploadProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleUpload(file: File) {
        setUploading(true);
        setError(null);

        const dimensions = await getImageDimensions(file);

        const form = new FormData();
        form.append("image", file);
        form.append("width", String(dimensions.width));
        form.append("height", String(dimensions.height));

        try {
            const res = await fetch(`/api/lore/${noteId}/map/upload`, {
                method: "POST",
                body: form,
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message ?? "Upload failed");
            }
            onUploaded();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="flex flex-col items-center justify-center h-[400px] bg-muted rounded-lg border-2 border-dashed border-border gap-3">
            <p className="text-muted-foreground">Upload a background map image</p>
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                }}
            />
            <Button
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
            >
                {uploading ? "Uploading..." : "Choose Image"}
            </Button>
            {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
    );
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve({ width: 1000, height: 1000 });
        img.src = URL.createObjectURL(file);
    });
}
