import { useEffect, useMemo, useRef } from "react";

import { hasMapTiler, mapTilerStyleUrl } from "@/lib/maptiler";

type Incident = {
  id: string;
  type: "SOS" | "DURESS" | "MEDICAL";
  status: string;
  name: string;
  address: string;
  receivedAt: string;
  location?: {
    lat: number;
    lng: number;
  } | null;
};

function markerColor(type: Incident["type"]) {
  if (type === "DURESS") return "#ff3ea5";
  if (type === "MEDICAL") return "#ffb347";
  return "#ff4d4f";
}

export function IncidentMap({
  incidents,
  selectedId,
  onSelect,
}: {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (incidentId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const maplibreRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const locatedIncidents = useMemo(
    () =>
      incidents.filter(
        (incident) =>
          typeof incident.location?.lat === "number" &&
          typeof incident.location?.lng === "number",
      ),
    [incidents],
  );

  useEffect(() => {
    if (!containerRef.current || !hasMapTiler || mapRef.current) {
      return;
    }

    let cancelled = false;

    const boot = async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) {
        return;
      }
      maplibreRef.current = maplibregl;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: mapTilerStyleUrl,
        center: [106.7009, 10.7766],
        zoom: 12.5,
        attributionControl: true,
      });

      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "top-right",
      );
      mapRef.current = map;
    };

    void boot();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (!locatedIncidents.length) {
      return;
    }

    const bounds = new maplibregl.LngLatBounds();

    for (const incident of locatedIncidents) {
      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "relative flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-[0_0_0_6px_rgba(255,255,255,0.12)]";
      el.style.backgroundColor = markerColor(incident.type);
      el.style.outline =
        selectedId === incident.id ? "3px solid rgba(125, 211, 252, 0.8)" : "none";
      el.style.cursor = "pointer";
      el.setAttribute("aria-label", incident.name);

      const pulse = document.createElement("span");
      pulse.className = "absolute inset-0 animate-ping rounded-full opacity-60";
      pulse.style.backgroundColor = markerColor(incident.type);
      el.appendChild(pulse);

      const dot = document.createElement("span");
      dot.className = "relative block h-2.5 w-2.5 rounded-full bg-white";
      el.appendChild(dot);

      el.addEventListener("click", () => onSelect(incident.id));

      const popup = new maplibregl.Popup({
        offset: 18,
      }).setHTML(
        `<div style="min-width:180px">
          <div style="font-weight:700;color:#111827">${incident.name}</div>
          <div style="font-size:12px;color:#4b5563;margin-top:4px">${incident.address}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:6px">${incident.type} · ${incident.status}</div>
        </div>`,
      );

      const marker = new maplibregl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([incident.location!.lng, incident.location!.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([incident.location!.lng, incident.location!.lat]);
    }

    if (locatedIncidents.length === 1) {
      map.easeTo({
        center: [locatedIncidents[0].location!.lng, locatedIncidents[0].location!.lat],
        zoom: 14.5,
        duration: 900,
      });
      return;
    }

    map.fitBounds(bounds, {
      padding: 48,
      maxZoom: 15,
      duration: 900,
    });
  }, [locatedIncidents, onSelect, selectedId]);

  if (!hasMapTiler) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl bg-card text-center text-sm text-muted-foreground">
        <div className="max-w-sm space-y-2 px-6">
          <p className="font-semibold text-foreground">
            Chưa cấu hình MapTiler
          </p>
          <p>
            Thêm `VITE_MAPTILER_API_KEY` vào `web-admin/.env.local` để bật bản
            đồ thật cho trung tâm điều phối.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="h-full min-h-[420px] w-full" />;
}
