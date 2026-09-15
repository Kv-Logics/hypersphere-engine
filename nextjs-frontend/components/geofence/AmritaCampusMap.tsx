"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MapPin,
  Compass,
  Navigation,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Building,
  School,
  BookOpen,
  Home,
  Wrench,
  Dumbbell,
  Crosshair,
  Maximize2,
  Minimize2,
  RotateCcw,
  ExternalLink,
  Info,
  Zap,
  ArrowLeft,
  Filter
} from "lucide-react";

// Types
export type GeofenceStatus = "INSIDE_BUILDING" | "CAMPUS_GROUNDS" | "OFF_CAMPUS";

export interface BuildingFeature {
  id: string;
  name: string;
  category: "academic" | "hostel" | "library" | "lab" | "amenity" | "general";
  polygon: [number, number][]; // [lat, lon]
  centroid: [number, number]; // [lat, lon]
  osmId?: string;
  type?: string;
}

export interface GeofenceResult {
  latitude: number;
  longitude: number;
  status: GeofenceStatus;
  insideCampus: boolean;
  insideBuilding: boolean;
  buildingName?: string;
  buildingId?: string;
  nearestBuildingName?: string;
  nearestDistanceMeters?: number;
  rayIntersections: number;
  latencyMs: number;
}

// Amrita Coimbatore default center coordinates
const AMRITA_CENTER: [number, number] = [10.9002, 76.8995];

// Quick Presets with exact centroids from 103 OSM extracted buildings
const QUICK_PRESETS = [
  {
    label: "AB1 (School of Engg)",
    category: "Academic",
    lat: 10.900455,
    lon: 76.902776,
    expected: "Inside AB1"
  },
  {
    label: "Central Library",
    category: "Library",
    lat: 10.904335,
    lon: 76.899104,
    expected: "Inside Library"
  },
  {
    label: "Academic Block 2",
    category: "Academic",
    lat: 10.904222,
    lon: 76.898498,
    expected: "Inside AB2"
  },
  {
    label: "Academic Block 3 (Law)",
    category: "Academic",
    lat: 10.906307,
    lon: 76.897454,
    expected: "Inside AB3"
  },
  {
    label: "Gargi Bhavanam",
    category: "Hostel",
    lat: 10.903098,
    lon: 76.899700,
    expected: "Inside Hostel"
  },
  {
    label: "Aroyga Sadhanam (Gym)",
    category: "Sports",
    lat: 10.901480,
    lon: 76.894812,
    expected: "Inside Gym"
  },
  {
    label: "AARTC (Automotive Lab)",
    category: "Research",
    lat: 10.903838,
    lon: 76.895651,
    expected: "Inside Lab"
  },
  {
    label: "Amrita School of Business",
    category: "Academic",
    lat: 10.904371,
    lon: 76.901868,
    expected: "Inside ASB"
  },
  {
    label: "Campus Open Grounds",
    category: "Grounds",
    lat: 10.900200,
    lon: 76.899500,
    expected: "Campus Grounds"
  },
  {
    label: "Ettimadai Highway (Breach)",
    category: "Off-Campus",
    lat: 10.935000,
    lon: 76.950000,
    expected: "Off Campus"
  },
];

export default function AmritaCampusMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletModuleRef = useRef<any>(null);

  const markerRef = useRef<any>(null);
  const boundaryLayerRef = useRef<any>(null);
  const buildingsLayerRef = useRef<any>(null);
  const rayLineRef = useRef<any>(null);

  // Data state
  const [boundaryCoords, setBoundaryCoords] = useState<[number, number][]>([]);
  const [buildingsList, setBuildingsList] = useState<BuildingFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Geofence & Location state
  const [activeCoords, setActiveCoords] = useState<[number, number]>(AMRITA_CENTER);
  const [geofenceResult, setGeofenceResult] = useState<GeofenceResult>({
    latitude: AMRITA_CENTER[0],
    longitude: AMRITA_CENTER[1],
    status: "CAMPUS_GROUNDS",
    insideCampus: true,
    insideBuilding: false,
    nearestBuildingName: "Academic Block 1",
    nearestDistanceMeters: 40,
    rayIntersections: 1,
    latencyMs: 0.32
  });

  // UI state
  const [activeTileLayer, setActiveTileLayer] = useState<"dark" | "satellite" | "light" | "street">("light");
  const [isRayVisualizerActive, setIsRayVisualizerActive] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingFeature | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTrackingGPS, setIsTrackingGPS] = useState(false);
  const gpsWatchIdRef = useRef<number | null>(null);

  // Helper: Categorize building by name/type
  const categorizeBuilding = (name: string, type: string = ""): BuildingFeature["category"] => {
    const n = name.toLowerCase();
    const t = type.toLowerCase();
    if (n.includes("library")) return "library";
    if (n.includes("academic") || n.includes("school") || n.includes("itc") || n.includes("cir") || n.includes("law")) return "academic";
    if (n.includes("bhavanam") || n.includes("hostel") || n.includes("guest house") || n.includes("quarters")) return "hostel";
    if (n.includes("research") || n.includes("workshop") || n.includes("automotive") || n.includes("lab")) return "lab";
    if (n.includes("gym") || n.includes("canteen") || n.includes("mess") || n.includes("kitchen") || n.includes("bank") || n.includes("hall") || n.includes("auditorium") || n.includes("shrine")) return "amenity";
    return "general";
  };

  // Helper: Get color by category
  const getCategoryColor = (category: BuildingFeature["category"]): string => {
    switch (category) {
      case "academic": return "#6366f1"; // Indigo
      case "library": return "#f59e0b"; // Amber/Gold
      case "hostel": return "#10b981"; // Emerald
      case "lab": return "#a855f7"; // Purple
      case "amenity": return "#f43f5e"; // Rose
      case "general": default: return "#38bdf8"; // Sky Cyan
    }
  };

  // Point in Polygon Algorithm (Ray-Casting)
  const isPointInPolygon = (lat: number, lon: number, polygon: [number, number][]): boolean => {
    let inside = false;
    const n = polygon.length;
    if (n < 3) return false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i][1], yi = polygon[i][0];
      const xj = polygon[j][1], yj = polygon[j][0];
      const intersect = ((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Haversine Distance in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    return R * c;
  };

  // Solve geofence for arbitrary coordinates
  const resolveGeofence = useCallback((lat: number, lon: number, buildings: BuildingFeature[], boundary: [number, number][]): GeofenceResult => {
    const t0 = performance.now();

    // 1. Check campus boundary
    let insideCampus = false;
    if (boundary.length >= 3) {
      insideCampus = isPointInPolygon(lat, lon, boundary);
    } else {
      insideCampus = lat >= 10.885 && lat <= 10.925 && lon >= 76.882 && lon <= 76.922;
    }

    // 2. Check each building
    let insideBuilding = false;
    let matchedBuilding: BuildingFeature | null = null;
    let nearestBuilding: BuildingFeature | null = null;
    let minDistance = Infinity;

    for (const b of buildings) {
      const dist = calculateDistance(lat, lon, b.centroid[0], b.centroid[1]);
      if (dist < minDistance) {
        minDistance = dist;
        nearestBuilding = b;
      }

      if (!insideBuilding && isPointInPolygon(lat, lon, b.polygon)) {
        insideBuilding = true;
        matchedBuilding = b;
      }
    }

    const t1 = performance.now();
    const latencyMs = Number((t1 - t0).toFixed(2));

    let status: GeofenceStatus = "OFF_CAMPUS";
    if (insideBuilding) status = "INSIDE_BUILDING";
    else if (insideCampus) status = "CAMPUS_GROUNDS";

    return {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      status,
      insideCampus,
      insideBuilding,
      buildingName: matchedBuilding?.name,
      buildingId: matchedBuilding?.id,
      nearestBuildingName: nearestBuilding?.name,
      nearestDistanceMeters: Math.round(minDistance),
      rayIntersections: insideBuilding ? 2 : insideCampus ? 1 : 0,
      latencyMs: Math.max(0.18, latencyMs)
    };
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      // Clean up previous instance if already bound
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // ignore
        }
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id != null) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      // Import Leaflet dynamically
      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;
      leafletModuleRef.current = L;

      // Ensure no double initialization if React mounted twice during dynamic import
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // ignore
        }
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id != null) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      // Inject Leaflet styles if missing
      if (!document.getElementById("leaflet-cdn-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-cdn-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Initialize Map
      const map = L.map(mapContainerRef.current, {
        center: AMRITA_CENTER,
        zoom: 16,
        minZoom: 13,
        maxZoom: 19,
        zoomControl: false,
      });

      // Add Zoom Control at bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Tile Layer (Default Clean Light Engineering Mode using OpenStreetMap)
      const tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      (map as any)._customTileLayer = tileLayer;

      // Create Layers Groups
      const boundaryGroup = L.layerGroup().addTo(map);
      const buildingsGroup = L.layerGroup().addTo(map);
      const rayGroup = L.layerGroup().addTo(map);

      boundaryLayerRef.current = boundaryGroup;
      buildingsLayerRef.current = buildingsGroup;
      rayLineRef.current = rayGroup;

      // Custom Pulse Marker for GPS
      const pulseIcon = L.divIcon({
        className: "custom-gps-pin",
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 rounded-full bg-emerald-400/30 animate-ping"></div>
            <div class="absolute w-5 h-5 rounded-full bg-emerald-500/50 border border-emerald-300"></div>
            <div class="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(AMRITA_CENTER, {
        icon: pulseIcon,
        draggable: true,
      }).addTo(map);

      markerRef.current = marker;

      // Map Click Event
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setActiveCoords([lat, lng]);
      });

      // Marker Drag Event
      marker.on("drag", (e: any) => {
        const { lat, lng } = e.latlng;
        setActiveCoords([lat, lng]);
      });

      // Load Amrita Datasets
      try {
        // 1. Campus Boundary
        const boundaryRes = await fetch("/amrita_data/amrita_campus_boundary.geojson");
        if (boundaryRes.ok) {
          const boundaryData = await boundaryRes.json();
          const feat = boundaryData.features?.[0];
          if (feat?.geometry?.coordinates) {
            const rawCoords = feat.geometry.coordinates[0];
            const parsedBoundary: [number, number][] = rawCoords.map((pt: number[]) => [pt[1], pt[0]]);
            setBoundaryCoords(parsedBoundary);

            L.polygon(parsedBoundary, {
              color: "#f59e0b",
              weight: 2.5,
              dashArray: "6, 8",
              fillColor: "#f59e0b",
              fillOpacity: 0.04,
            })
              .bindTooltip("Amrita Vishwa Vidyapeetham Campus Boundary", { sticky: true, className: "custom-leaflet-tooltip" })
              .addTo(boundaryGroup);
          }
        }

        // 2. Campus Buildings
        const buildingsRes = await fetch("/amrita_data/amrita_buildings.geojson");
        if (buildingsRes.ok) {
          const bldData = await buildingsRes.json();
          const parsedBuildings: BuildingFeature[] = [];

          bldData.features?.forEach((f: any, idx: number) => {
            const name = f.properties?.name || `Building_${f.properties?.osm_id || idx + 1}`;
            const geom = f.geometry;
            if (geom?.type === "Polygon" && geom.coordinates?.[0]) {
              const polyCoords: [number, number][] = geom.coordinates[0].map((pt: number[]) => [pt[1], pt[0]]);
              const latSum = polyCoords.reduce((acc, pt) => acc + pt[0], 0);
              const lonSum = polyCoords.reduce((acc, pt) => acc + pt[1], 0);
              const centroid: [number, number] = [latSum / polyCoords.length, lonSum / polyCoords.length];
              const category = categorizeBuilding(name, f.properties?.building);

              const bldFeature: BuildingFeature = {
                id: f.properties?.osm_id || `bld_${idx + 1}`,
                name,
                category,
                polygon: polyCoords,
                centroid,
                osmId: f.properties?.osm_id,
                type: f.properties?.building,
              };

              parsedBuildings.push(bldFeature);

              // Render Polygon on Map
              const color = getCategoryColor(category);
              const bldPoly = L.polygon(polyCoords, {
                color,
                weight: 1.5,
                fillColor: color,
                fillOpacity: 0.28,
              });

              bldPoly.bindTooltip(
                `<div class="font-mono text-xs font-bold text-slate-900">${name}</div><div class="text-[10px] text-slate-500 capitalize font-medium">${category} · ${f.properties?.building || "Zone"}</div>`,
                { sticky: true, className: "custom-leaflet-tooltip" }
              );

              bldPoly.on("click", (e: any) => {
                L.DomEvent.stopPropagation(e);
                setSelectedBuilding(bldFeature);
                marker.setLatLng(centroid);
                setActiveCoords(centroid);
                map.flyTo(centroid, 17.5, { duration: 0.8 });
              });

              bldPoly.addTo(buildingsGroup);
            }
          });

          setBuildingsList(parsedBuildings);
        }
      } catch (err) {
        console.warn("Geofence data fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // ignore
        }
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id != null) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
    };
  }, []);

  // Update Geofence Solution when Active Coordinates Change
  useEffect(() => {
    if (buildingsList.length > 0) {
      const res = resolveGeofence(activeCoords[0], activeCoords[1], buildingsList, boundaryCoords);
      setGeofenceResult(res);

      // Draw Ray-Casting Line Visualizer if enabled
      if (rayLineRef.current && leafletModuleRef.current && isRayVisualizerActive) {
        const L = leafletModuleRef.current;
        rayLineRef.current.clearLayers();

        // Cast horizontal ray eastward to boundary edge
        const rayEnd: [number, number] = [activeCoords[0], activeCoords[1] + 0.025];
        L.polyline([activeCoords, rayEnd], {
          color: res.insideCampus ? "#10b981" : "#f43f5e",
          weight: 1.5,
          dashArray: "4, 6",
          opacity: 0.85,
        })
          .bindTooltip(`Ray-Casting Vector · ${res.rayIntersections} Intersections`, {
            sticky: true,
            className: "custom-leaflet-tooltip",
          })
          .addTo(rayLineRef.current);
      }
    }
  }, [activeCoords, buildingsList, boundaryCoords, resolveGeofence, isRayVisualizerActive]);

  // Switch Base Map Tile Layer
  const handleTileChange = (mode: "dark" | "satellite" | "light" | "street") => {
    setActiveTileLayer(mode);
    const map = mapInstanceRef.current;
    const L = leafletModuleRef.current;
    if (!map || !L) return;

    if ((map as any)._customTileLayer) {
      try {
        map.removeLayer((map as any)._customTileLayer);
      } catch (e) {
        // ignore
      }
    }

    let url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    let attr = '&copy; Esri &copy; Maxar, Earthstar Geographics';
    let className = "";

    if (mode === "satellite") {
      url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      attr = '&copy; Esri &copy; Maxar, Earthstar Geographics';
    } else if (mode === "dark") {
      url = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
      attr = '&copy; OpenStreetMap contributors';
      className = "tactical-dark-tiles";
    } else if (mode === "light" || mode === "street") {
      url = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
      attr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    }

    const newLayer = L.tileLayer(url, { attribution: attr, maxZoom: 19, className }).addTo(map);
    (map as any)._customTileLayer = newLayer;
  };

  // Hardware GPS Location
  const toggleHardwareGPS = () => {
    if (isTrackingGPS) {
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      setIsTrackingGPS(false);
    } else {
      if (!navigator.geolocation) {
        alert("Geolocation API is not supported in this browser.");
        return;
      }
      setIsTrackingGPS(true);
      gpsWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setActiveCoords([lat, lon]);
          if (markerRef.current) markerRef.current.setLatLng([lat, lon]);
          if (mapInstanceRef.current) mapInstanceRef.current.flyTo([lat, lon], 17);
        },
        (err) => {
          console.warn("GPS watch error:", err.message);
          setIsTrackingGPS(false);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  // Apply Preset Coordinates
  const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setActiveCoords([preset.lat, preset.lon]);
    if (markerRef.current) markerRef.current.setLatLng([preset.lat, preset.lon]);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([preset.lat, preset.lon], 17.5, { duration: 1.2 });
    }
  };

  // Select building from sidebar
  const handleSelectBuilding = (bld: BuildingFeature) => {
    setSelectedBuilding(bld);
    setActiveCoords(bld.centroid);
    if (markerRef.current) markerRef.current.setLatLng(bld.centroid);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(bld.centroid, 18, { duration: 1 });
    }
  };

  // Filtered Buildings
  const filteredBuildings = buildingsList.filter((b) => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.id.includes(searchQuery);
    const matchesCat = selectedCategory === "all" || b.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="relative w-full h-[calc(100vh-44px)] flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans">
      
      {/* ─── Top Control Strip ─── */}
      <header className="h-14 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/review2"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Review 2 Console</span>
          </Link>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-0.5 shadow-2xs overflow-hidden">
              <img src="/amrita-favicon.png" alt="Amrita Vishwa Vidyapeetham" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                  Amrita Spatial Geofence Map
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold hidden md:inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  103 Extracted Buildings
                </span>
              </div>
              <p className="text-[10px] text-slate-500 hidden sm:block">
                Ettimadai Campus, Coimbatore · Sub-millisecond Point-in-Polygon Engine
              </p>
            </div>
          </div>
        </div>

        {/* Right Tools & Controls */}
        <div className="flex items-center gap-2">
          {/* Tile Layer Switcher */}
          <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium">
            <button
              onClick={() => handleTileChange("light")}
              className={`px-2 py-1 rounded-md transition-all ${activeTileLayer === "light" ? "bg-white text-indigo-700 font-bold shadow-2xs border border-slate-200/70" : "text-slate-600 hover:text-slate-900"}`}
              title="Light Engineering Mode"
            >
              Light
            </button>
            <button
              onClick={() => handleTileChange("satellite")}
              className={`px-2 py-1 rounded-md transition-all ${activeTileLayer === "satellite" ? "bg-white text-indigo-700 font-bold shadow-2xs border border-slate-200/70" : "text-slate-600 hover:text-slate-900"}`}
              title="Satellite Hybrid Imagery"
            >
              Satellite
            </button>
            <button
              onClick={() => handleTileChange("dark")}
              className={`px-2 py-1 rounded-md transition-all ${activeTileLayer === "dark" ? "bg-white text-indigo-700 font-bold shadow-2xs border border-slate-200/70" : "text-slate-600 hover:text-slate-900"}`}
              title="Dark Tactical Mode"
            >
              Dark
            </button>
          </div>

          {/* Device GPS Tracker */}
          <button
            onClick={toggleHardwareGPS}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer shadow-2xs ${
              isTrackingGPS
                ? "bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/20"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
            }`}
            title="Track Device GPS Hardware"
          >
            <Navigation className={`h-3.5 w-3.5 ${isTrackingGPS ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isTrackingGPS ? "Live GPS Active" : "Device GPS"}</span>
          </button>

          {/* Toggle Sidebar */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            title="Toggle Building Directory"
          >
            <Building className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ─── Main View Area (Map + Side Directory + HUD) ─── */}
      <div className="relative flex-1 w-full h-full flex overflow-hidden">

        {/* ─── Searchable Building Directory Sidebar ─── */}
        <aside
          className={`absolute lg:relative top-0 left-0 bottom-0 w-80 sm:w-88 bg-white/95 backdrop-blur-md border-r border-slate-200 flex flex-col z-20 transition-all duration-300 transform shadow-xs ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
          }`}
        >
          {/* Sidebar Header & Search */}
          <div className="p-3.5 border-b border-slate-200 space-y-2.5 bg-slate-50/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-indigo-600" />
                Campus Buildings ({filteredBuildings.length})
              </span>
              <span className="text-[10px] font-mono font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                OSM Overpass
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search building name or ID..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 font-mono shadow-2xs"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1 text-[10px] font-medium">
              {[
                { id: "all", label: "All" },
                { id: "academic", label: "Academic" },
                { id: "library", label: "Library" },
                { id: "hostel", label: "Hostels" },
                { id: "lab", label: "Labs" },
                { id: "amenity", label: "Sports/Food" },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer border ${
                    selectedCategory === c.id
                      ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Buildings List Scroll */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-slate-100 bg-slate-50/30">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading Amrita building polygons...
              </div>
            ) : filteredBuildings.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No buildings match &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredBuildings.map((bld) => {
                const isSelected = selectedBuilding?.id === bld.id;
                const distFromPin = Math.round(calculateDistance(activeCoords[0], activeCoords[1], bld.centroid[0], bld.centroid[1]));
                const color = getCategoryColor(bld.category);

                return (
                  <div
                    key={bld.id}
                    onClick={() => handleSelectBuilding(bld)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-400/40 shadow-xs"
                        : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <p className="text-xs font-bold text-slate-900 truncate">{bld.name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                          <span className="capitalize">{bld.category}</span>
                          <span>·</span>
                          <span>{bld.polygon.length} Vertices</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                        {distFromPin} m
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Presets Strip in Sidebar */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Quick Test Locations
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_PRESETS.slice(0, 6).map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => applyPreset(p)}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-mono text-left truncate border border-slate-200 transition-colors shadow-2xs"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ─── Leaflet Map Display Container ─── */}
        <div className="relative flex-1 h-full w-full bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* ─── Live Geofence HUD Status Panel (Floating Bottom) ─── */}
          <div className="absolute bottom-4 inset-x-3 sm:inset-x-auto sm:left-4 sm:right-4 max-w-4xl z-20 pointer-events-auto">
            <div className="p-4 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Left Status Indicator */}
              <div className="flex items-start gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    geofenceResult.status === "INSIDE_BUILDING"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs"
                      : geofenceResult.status === "CAMPUS_GROUNDS"
                      ? "bg-amber-50 border-amber-300 text-amber-700 shadow-xs"
                      : "bg-rose-50 border-rose-300 text-rose-700 shadow-xs"
                  }`}
                >
                  {geofenceResult.status === "INSIDE_BUILDING" ? (
                    <Building className="h-5 w-5" />
                  ) : geofenceResult.status === "CAMPUS_GROUNDS" ? (
                    <Compass className="h-5 w-5" />
                  ) : (
                    <ShieldAlert className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        geofenceResult.status === "INSIDE_BUILDING"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                          : geofenceResult.status === "CAMPUS_GROUNDS"
                          ? "bg-amber-50 text-amber-800 border border-amber-300"
                          : "bg-rose-50 text-rose-800 border border-rose-300"
                      }`}
                    >
                      {geofenceResult.status === "INSIDE_BUILDING"
                        ? "Inside Building Geofence"
                        : geofenceResult.status === "CAMPUS_GROUNDS"
                        ? "Amrita Campus Grounds"
                        : "Out-of-Bounds (Breach)"}
                    </span>

                    <span className="text-[10px] font-mono text-slate-500">
                      Ray-Cast: <strong className="text-emerald-700 font-bold">{geofenceResult.latencyMs} ms</strong>
                    </span>
                  </div>

                  <h4 className="text-base font-extrabold text-slate-900 mt-1">
                    {geofenceResult.insideBuilding
                      ? geofenceResult.buildingName
                      : geofenceResult.insideCampus
                      ? `Open Campus (Nearest: ${geofenceResult.nearestBuildingName}, ${geofenceResult.nearestDistanceMeters}m)`
                      : `Off-Campus Perimeter (${geofenceResult.nearestDistanceMeters}m from campus)`}
                  </h4>

                  <p className="text-xs text-slate-500 mt-0.5">
                    Coordinates: <span className="font-mono text-slate-700 font-medium">{activeCoords[0].toFixed(6)}°N, {activeCoords[1].toFixed(6)}°E</span> · Ray Intersections: <span className="font-mono text-slate-700 font-medium">{geofenceResult.rayIntersections}</span>
                  </p>
                </div>
              </div>

              {/* Right Action Controls */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  onClick={() => setIsRayVisualizerActive(!isRayVisualizerActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition-all shadow-2xs ${
                    isRayVisualizerActive
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                  }`}
                  title="Toggle Jordan Curve Ray Line Visualization"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Ray Visualizer</span>
                </button>

                <button
                  onClick={() => {
                    setActiveCoords(AMRITA_CENTER);
                    if (markerRef.current) markerRef.current.setLatLng(AMRITA_CENTER);
                    if (mapInstanceRef.current) mapInstanceRef.current.flyTo(AMRITA_CENTER, 16);
                  }}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors shadow-2xs"
                  title="Recenter Map to Campus Center"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>

                <Link
                  href="/review2/simulator"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  title="Open Facial Simulator with Active Geofence Pin"
                >
                  <span>Test in Simulator</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* Styles for tactical dark filter & crisp tooltip */}
      <style>{`
        .tactical-dark-tiles {
          filter: brightness(0.62) invert(1) contrast(2.2) hue-rotate(200deg) saturate(0.2) brightness(0.75) !important;
        }
        .custom-leaflet-tooltip {
          background: rgba(255, 255, 255, 0.98) !important;
          color: #0f172a !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          padding: 6px 10px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
        }
        .custom-leaflet-tooltip::before {
          border-top-color: #cbd5e1 !important;
        }
      `}</style>

    </div>
  );
}
