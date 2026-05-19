"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";

export interface MapPin {
    noteId: string;
    title: string;
    loreType: string | null;
    x: number;
    y: number;
    description?: string;
}

export interface MapViewerProps {
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    pins: MapPin[];
    onPinClick?: (noteId: string) => void;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Initializes and renders a Leaflet image map with interactive pins inside a container div.
 *
 * Renders a div that becomes the Leaflet map container, overlays the provided image using simple CRS bounds,
 * places markers for each pin with popups showing title, optional lore type, and optional description,
 * and calls `onPinClick` with the pin's `noteId` when a marker is clicked.
 *
 * @param imageUrl - URL of the image to overlay on the map
 * @param imageWidth - Width of the image in pixels (used to compute map bounds)
 * @param imageHeight - Height of the image in pixels (used to compute map bounds)
 * @param pins - Array of pins to render; each pin specifies coordinates (`x`, `y`), `title`, `noteId`, optional `loreType`, and optional `description`
 * @param onPinClick - Optional callback invoked with the pin's `noteId` when a marker is clicked
 * @returns A div element that serves as the Leaflet map container
 */
function MapViewerInner({
    imageUrl,
    imageWidth,
    imageHeight,
    pins,
    onPinClick,
}: MapViewerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletRef = useRef<any>(null);

    // NOTE: Parent should memoize `pins` and `onPinClick` to avoid
    // unnecessary Leaflet map teardown/rebuild on every render.
    useEffect(() => {
        let map: any;

        (async () => {
            const L = await import("leaflet");

            const bounds: [[number, number], [number, number]] = [
                [0, 0],
                [imageHeight, imageWidth],
            ];

            if (!mapRef.current) return;

            map = L.map(mapRef.current, {
                crs: L.CRS.Simple,
                maxBounds: bounds,
                maxZoom: 4,
                minZoom: -2,
                zoomSnap: 0.25,
            }).fitBounds(bounds);

            L.imageOverlay(imageUrl, bounds).addTo(map);

            const pinIcon = L.divIcon({
                className: "map-pin-icon",
                html: `<svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="var(--primary)"/>
                    <circle cx="12" cy="12" r="5" fill="white"/>
                </svg>`,
                iconSize: [24, 36],
                iconAnchor: [12, 36],
                popupAnchor: [0, -36],
            });

            for (const pin of pins) {
                const marker = L.marker([pin.y, pin.x], { icon: pinIcon }).addTo(map);
                const popupHtml = `<div class="map-pin-popup">
                    <strong>${escapeHtml(pin.title)}</strong>
                    ${pin.loreType ? `<span class="text-xs text-muted-foreground ml-1">(${escapeHtml(pin.loreType)})</span>` : ""}
                    ${pin.description ? `<p class="text-sm mt-1">${escapeHtml(pin.description)}</p>` : ""}
                </div>`;
                marker.bindPopup(popupHtml);
                if (onPinClick) {
                    marker.on("click", () => onPinClick(pin.noteId));
                }
            }

            leafletRef.current = map;
        })();

        return () => {
            map?.remove();
        };
    }, [imageUrl, imageWidth, imageHeight, pins, onPinClick]);

    return (
        <div
            ref={mapRef}
            style={{ width: "100%", height: "100%", minHeight: "400px" }}
        />
    );
}

const MapViewer = dynamic(() => Promise.resolve(MapViewerInner), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-[400px] bg-muted rounded-lg">
            <span className="text-muted-foreground">Loading map...</span>
        </div>
    ),
});

export default MapViewer;
