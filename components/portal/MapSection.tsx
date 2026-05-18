"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MapViewer, { type MapPin } from "@/components/portal/MapViewer";

interface MapData {
    imageUrl: string | null;
    width: number;
    height: number;
    pins: MapPin[];
}

export function MapSection({ noteId }: { noteId: string }) {
    const router = useRouter();
    const [data, setData] = useState<MapData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/lore/${noteId}/map`)
            .then((r) => {
                if (!r.ok) throw new Error("Failed to load map");
                return r.json();
            })
            .then(setData)
            .catch((e) => setError(e.message));
    }, [noteId]);

    // Memoize to avoid unnecessary Leaflet map teardown/rebuild
    const handlePinClick = useCallback(
        (id: string) => router.push(`/lore/${id}`),
        [router],
    );

    if (error) return <p className="text-destructive text-sm">{error}</p>;
    if (!data) return <div className="h-[400px] bg-muted rounded-lg animate-pulse" />;
    if (!data.imageUrl) {
        return (
            <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
                <p className="text-muted-foreground">
                    No map image found. Add an image child note or a mapImage relation to this GeoMap.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-lg overflow-hidden border">
            <MapViewer
                imageUrl={data.imageUrl}
                imageWidth={data.width}
                imageHeight={data.height}
                pins={data.pins}
                onPinClick={handlePinClick}
            />
        </div>
    );
}
