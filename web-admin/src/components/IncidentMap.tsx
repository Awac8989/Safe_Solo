import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  Building2,
  Radio,
  Layers,
  MapPin,
  HeartPulse,
  Navigation,
  Crosshair,
} from "lucide-react";
import { hasMapTiler, mapTilerStyleUrl } from "@/lib/maptiler";
import { fetchHeroRadar, fetchSafeHavens, type HeroRadarItem, type SafeHavenItem } from "@/lib/api";

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
  vitals?: {
    spo2?: number;
    heartRate?: number;
    device?: string;
    battery?: number;
    status?: string;
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
  const [showHeroes, setShowHeroes] = useState(true);
  const [showSafeHavens, setShowSafeHavens] = useState(true);
  const [showDistanceLines, setShowDistanceLines] = useState(true);
  const [hoveredEntity, setHoveredEntity] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const maplibreRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Fetch real-time heroes and safe havens
  const heroesQuery = useQuery({
    queryKey: ["hero-radar"],
    queryFn: fetchHeroRadar,
    refetchInterval: 12000,
  });

  const safeHavensQuery = useQuery({
    queryKey: ["safe-havens"],
    queryFn: fetchSafeHavens,
  });

  const heroes = heroesQuery.data?.data ?? [];
  const safeHavens = safeHavensQuery.data?.data ?? [];

  const locatedIncidents = useMemo(
    () =>
      incidents.filter(
        (incident) =>
          typeof incident.location?.lat === "number" &&
          typeof incident.location?.lng === "number",
      ),
    [incidents],
  );

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedId) || locatedIncidents[0] || null,
    [incidents, selectedId, locatedIncidents],
  );

  // MapLibre GL effect if MapTiler is configured
  useEffect(() => {
    if (!containerRef.current || !hasMapTiler || mapRef.current) {
      return;
    }

    let cancelled = false;

    const boot = async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      maplibreRef.current = maplibregl;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: mapTilerStyleUrl,
        center: [106.6822, 10.7626],
        zoom: 13,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
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

  // Update MapLibre markers
  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // 1. Add Incident Markers
    for (const incident of locatedIncidents) {
      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "relative flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-[0_0_0_6px_rgba(255,255,255,0.12)]";
      el.style.backgroundColor = markerColor(incident.type);
      el.style.outline = selectedId === incident.id ? "3px solid rgba(125, 211, 252, 0.8)" : "none";
      el.style.cursor = "pointer";

      const pulse = document.createElement("span");
      pulse.className = "absolute inset-0 animate-ping rounded-full opacity-60";
      pulse.style.backgroundColor = markerColor(incident.type);
      el.appendChild(pulse);

      const dot = document.createElement("span");
      dot.className = "relative block h-2.5 w-2.5 rounded-full bg-white";
      el.appendChild(dot);

      el.addEventListener("click", () => onSelect(incident.id));

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([incident.location!.lng, incident.location!.lat])
        .addTo(map);

      markersRef.current.push(marker);
    }

    // 2. Add Hero Radar Markers
    if (showHeroes) {
      for (const hero of heroes) {
        const el = document.createElement("div");
        el.className =
          "relative flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-600 shadow-md cursor-pointer";
        el.title = `${hero.name} (Hiệp sĩ - ⭐${hero.trustScore})`;

        const pulse = document.createElement("span");
        pulse.className = "absolute -inset-1 rounded-full border border-emerald-400 opacity-60 animate-ping";
        el.appendChild(pulse);

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([hero.location.lng, hero.location.lat])
          .addTo(map);

        markersRef.current.push(marker);
      }
    }

    // 3. Add Safe Haven Markers
    if (showSafeHavens) {
      for (const haven of safeHavens) {
        const el = document.createElement("div");
        el.className = `flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white text-[9px] font-bold text-white shadow ${
          haven.type === "HOSPITAL" ? "bg-rose-600" : haven.type === "POLICE" ? "bg-blue-600" : "bg-amber-600"
        }`;
        el.innerText = haven.type === "HOSPITAL" ? "+" : haven.type === "POLICE" ? "P" : "K";
        el.title = `${haven.name} (${haven.typeLabel})`;

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([haven.location.lng, haven.location.lat])
          .addTo(map);

        markersRef.current.push(marker);
      }
    }
  }, [locatedIncidents, heroes, safeHavens, showHeroes, showSafeHavens, selectedId, onSelect]);

  // Center coordinate reference: District 5 / District 1 in HCMC
  const centerLat = 10.7680;
  const centerLng = 106.6850;
  const scale = 3200; // coordinate projection multiplier

  const project = (lat: number, lng: number) => {
    // 50% is center of container
    const x = 50 + (lng - centerLng) * scale;
    const y = 50 - (lat - centerLat) * (scale * 1.05);
    return {
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y)),
    };
  };

  return (
    <div className="relative h-full min-h-[440px] w-full overflow-hidden rounded-xl bg-[#090e1a] border border-border/80 text-foreground">
      {/* 1. Tactical Layer Controls */}
      <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-1.5 rounded-lg border border-border/70 bg-card/90 p-1.5 text-xs shadow-lg backdrop-blur">
        <span className="flex items-center gap-1 font-bold text-sky-400 px-1 text-[11px]">
          <Layers className="h-3.5 w-3.5" /> RADAR
        </span>
        <button
          onClick={() => setShowHeroes((v) => !v)}
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition ${
            showHeroes ? "bg-emerald-600 text-white font-bold" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          <ShieldCheck className="h-3 w-3" /> Hiệp sĩ ({heroes.length})
        </button>
        <button
          onClick={() => setShowSafeHavens((v) => !v)}
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition ${
            showSafeHavens ? "bg-sky-600 text-white font-bold" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          <Building2 className="h-3 w-3" /> Trạm An Toàn ({safeHavens.length})
        </button>
        <button
          onClick={() => setShowDistanceLines((v) => !v)}
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition ${
            showDistanceLines ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          <Crosshair className="h-3 w-3" /> Cự ly tiếp cận
        </button>
      </div>

      {/* 2. Map Render */}
      {hasMapTiler ? (
        <div ref={containerRef} className="h-full min-h-[440px] w-full" />
      ) : (
        /* Standalone High-Tech Tactical Emergency Radar Grid */
        <div className="relative h-full min-h-[440px] w-full flex items-center justify-center select-none overflow-hidden">
          {/* Radar Circles & Grid lines */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none opacity-40">
            {/* Concentric rings */}
            <circle cx="50%" cy="50%" r="80" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="50%" cy="50%" r="160" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="50%" cy="50%" r="240" fill="none" stroke="#0284c7" strokeWidth="1" />
            <circle cx="50%" cy="50%" r="340" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="6 6" />

            {/* Crosshairs */}
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#0284c7" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#0284c7" strokeWidth="1" strokeDasharray="2 2" />

            {/* Distance Lines from Selected Incident to Heroes */}
            {showDistanceLines && selectedIncident && selectedIncident.location && showHeroes && (
              <>
                {heroes.slice(0, 4).map((hero, i) => {
                  const p1 = project(selectedIncident.location!.lat, selectedIncident.location!.lng);
                  const p2 = project(hero.location.lat, hero.location.lng);
                  return (
                    <line
                      key={i}
                      x1={`${p1.x}%`}
                      y1={`${p1.y}%`}
                      x2={`${p2.x}%`}
                      y2={`${p2.y}%`}
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      className="animate-pulse"
                    />
                  );
                })}
              </>
            )}
          </svg>

          {/* Rotating Radar Sweep Line */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="h-[680px] w-[680px] rounded-full border border-sky-500/10 relative">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "conic-gradient(from 0deg at 50% 50%, rgba(14, 165, 233, 0.15) 0deg, rgba(14, 165, 233, 0) 60deg, transparent 360deg)",
                  animation: "spin 6s linear infinite",
                }}
              />
            </div>
          </div>

          {/* Radar Overlay Coordinates Labels */}
          <div className="absolute bottom-3 left-3 text-[10px] font-mono text-sky-400/80 bg-background/80 px-2 py-1 rounded border border-border/50">
            <div>KHU VỰC: TP. HỒ CHÍ MINH (Q.1, Q.3, Q.5, PHÚ NHUẬN)</div>
            <div>TỌA ĐỘ TRUNG TÂM: 10.7680° N, 106.6850° E</div>
          </div>

          {/* 3. Render Incident Markers */}
          {locatedIncidents.map((incident) => {
            const { x, y } = project(incident.location!.lat, incident.location!.lng);
            const isSelected = incident.id === selectedId;
            return (
              <button
                key={incident.id}
                onClick={() => onSelect(incident.id)}
                onMouseEnter={() => setHoveredEntity({ ...incident, kind: "INCIDENT" })}
                onMouseLeave={() => setHoveredEntity(null)}
                style={{ left: `${x}%`, top: `${y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 flex items-center justify-center transition-transform hover:scale-125 ${
                  isSelected ? "scale-125" : ""
                }`}
              >
                <div
                  className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-xl"
                  style={{ backgroundColor: markerColor(incident.type) }}
                >
                  <span
                    className="absolute inset-0 rounded-full animate-ping opacity-75"
                    style={{ backgroundColor: markerColor(incident.type) }}
                  />
                  <span className="relative block h-2 w-2 rounded-full bg-white" />
                </div>
              </button>
            );
          })}

          {/* 4. Render Hero Markers */}
          {showHeroes &&
            heroes.map((hero) => {
              const { x, y } = project(hero.location.lat, hero.location.lng);
              const isAvailable = hero.status === "AVAILABLE";
              return (
                <div
                  key={hero.id}
                  onMouseEnter={() => setHoveredEntity({ ...hero, kind: "HERO" })}
                  onMouseLeave={() => setHoveredEntity(null)}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer transition-transform hover:scale-125"
                >
                  <div
                    className={`relative flex h-5 w-5 items-center justify-center rounded-full border border-white text-[10px] shadow-lg ${
                      isAvailable ? "bg-emerald-500 text-white" : "bg-amber-500 text-black"
                    }`}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {isAvailable && (
                      <span className="absolute -inset-1 rounded-full border border-emerald-400 opacity-60 animate-ping" />
                    )}
                  </div>
                </div>
              );
            })}

          {/* 5. Render Safe Haven Markers */}
          {showSafeHavens &&
            safeHavens.map((haven) => {
              const { x, y } = project(haven.location.lat, haven.location.lng);
              return (
                <div
                  key={haven.id}
                  onMouseEnter={() => setHoveredEntity({ ...haven, kind: "HAVEN" })}
                  onMouseLeave={() => setHoveredEntity(null)}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-15 cursor-pointer transition-transform hover:scale-125"
                >
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded-full border border-white font-bold text-[9px] text-white shadow ${
                      haven.type === "HOSPITAL"
                        ? "bg-rose-600"
                        : haven.type === "POLICE"
                        ? "bg-blue-600"
                        : "bg-amber-600"
                    }`}
                  >
                    {haven.type === "HOSPITAL" ? "+" : haven.type === "POLICE" ? "P" : "24"}
                  </div>
                </div>
              );
            })}

          {/* Hover Tooltip Card */}
          {hoveredEntity && (
            <div className="absolute top-14 left-4 z-40 max-w-xs rounded-xl border border-border/80 bg-card/95 p-3 text-xs shadow-2xl backdrop-blur">
              {hoveredEntity.kind === "INCIDENT" && (
                <div>
                  <div className="font-bold text-rose-400 flex items-center gap-1">
                    <Radio className="h-3.5 w-3.5" /> SỰ CỐ: {hoveredEntity.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{hoveredEntity.address}</div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[10px]">
                    <span>Loại: <strong>{hoveredEntity.type}</strong></span>
                    <span>SpO2: <strong className="text-sky-400">{hoveredEntity.vitals?.spo2 ?? 91}%</strong></span>
                    <span>BPM: <strong className="text-rose-400">{hoveredEntity.vitals?.heartRate ?? 124}</strong></span>
                  </div>
                </div>
              )}

              {hoveredEntity.kind === "HERO" && (
                <div>
                  <div className="font-bold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> {hoveredEntity.name}
                    <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] text-emerald-300">
                      {hoveredEntity.statusLabel}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">📞 SĐT: {hoveredEntity.phone}</div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[10px]">
                    <span className="text-amber-400 font-bold">⭐ {hoveredEntity.trustScore}</span>
                    <span className="text-emerald-400">🏆 {hoveredEntity.rescuesCount} cứu hộ</span>
                    <span>🔋 {hoveredEntity.battery}%</span>
                  </div>
                  <div className="mt-1 text-[10px] text-sky-300">
                    Trang bị: {hoveredEntity.equipment?.[0]}
                  </div>
                </div>
              )}

              {hoveredEntity.kind === "HAVEN" && (
                <div>
                  <div className="font-bold text-sky-400 flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> {hoveredEntity.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{hoveredEntity.address}</div>
                  <div className="mt-1 text-[10px] text-sky-300">
                    Chuyên trách: {hoveredEntity.specialty}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
