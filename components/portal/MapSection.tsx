"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MapViewer, { type MapPin } from "@/components/portal/MapViewer";
import MapUpload from "@/components/portal/MapUpload";

interface MapData {
    imageUrl: string | null;
    width: number;
    height: number;
    pins: MapPin[];
}

/**
 * Renders the map section for a given lore note, including loading, error handling, upload fallback, and pin navigation.
 *
 * If the map data is still loading a skeleton placeholder is shown. If loading fails an error message is displayed.
 * If no image URL is available the `MapUpload` component is rendered and `loadMap` is invoked after a successful upload.
 * When a map image exists the `MapViewer` is rendered with pins; clicking a pin navigates to the corresponding lore page.
 *
 * @param noteId - The ID of the lore note whose map should be displayed
 */
export function MapSection({ noteId }: { noteId: string }) {
    const router = useRouter();
    const [data, setData] = useState<MapData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadMap = useCallback(() => {
        fetch(`/api/lore/${noteId}/map`)
            .then((r) => {
                if (!r.ok) throw new Error("Failed to load map");
                return r.json();
            })
            .then(setData)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load map"));
    }, [noteId]);

    useEffect(() => {
        loadMap();
    }, [loadMap]);

    // Memoize to avoid unnecessary Leaflet map teardown/rebuild
    const handlePinClick = useCallback(
        (id: string) => router.push(`/lore/${id}`),
        [router],
    );

    if (error) return <p className="text-destructive text-sm">{error}</p>;
    if (!data) return <div className="h-[400px] bg-muted rounded-lg animate-pulse" />;
    if (!data.imageUrl) {
        return <MapUpload noteId={noteId} onUploaded={loadMap} />;
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
