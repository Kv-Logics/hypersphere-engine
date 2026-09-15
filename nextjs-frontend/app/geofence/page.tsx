"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import Leaflet-based AmritaCampusMap with SSR disabled
const AmritaCampusMap = dynamic(
  () => import("@/components/geofence/AmritaCampusMap"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm font-semibold tracking-wider uppercase text-slate-300">
            Loading Amrita Vishwa Vidyapeetham Geofence Map...
          </p>
          <span className="text-xs text-slate-500">
            Rendering 103 OSM extracted buildings & campus perimeter
          </span>
        </div>
      </div>
    ),
  }
);

export default function GeofencePage() {
  return <AmritaCampusMap />;
}
