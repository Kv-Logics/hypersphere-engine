import os
import json
import math
import time
from typing import Dict, List, Optional, Any, Tuple

def get_amrita_geofence():
    return amrita_geofence

class AmritaGeofenceEngine:
    """
    Sub-millisecond Point-in-Polygon (PiP) Geofencing Engine for
    Amrita Vishwa Vidyapeetham, Ettimadai Campus (Coimbatore, Tamil Nadu).
    Evaluates coordinates against campus boundary and 103 building zones.
    """

    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            base = os.path.dirname(os.path.abspath(__file__))
            data_dir = os.path.join(base, "geofence_data")
        self.data_dir = data_dir

        self.campus_boundary: Optional[Dict[str, Any]] = None
        self.boundary_coords: List[Tuple[float, float]] = []
        self.buildings: List[Dict[str, Any]] = []
        self.attendance_zones: List[Dict[str, Any]] = []

        self._load_data()

    def _load_data(self):
        # 1. Campus Boundary
        boundary_path = os.path.join(self.data_dir, "amrita_campus_boundary.geojson")
        if os.path.exists(boundary_path):
            with open(boundary_path, "r", encoding="utf-8") as f:
                self.campus_boundary = json.load(f)
                features = self.campus_boundary.get("features", [])
                if features:
                    geom = features[0].get("geometry", {})
                    if geom.get("type") == "Polygon":
                        # coordinates: [[lon, lat], ...]
                        self.boundary_coords = [(pt[0], pt[1]) for pt in geom.get("coordinates", [[]])[0]]

        # 2. Buildings GeoJSON
        buildings_path = os.path.join(self.data_dir, "amrita_buildings.geojson")
        if os.path.exists(buildings_path):
            with open(buildings_path, "r", encoding="utf-8") as f:
                b_data = json.load(f)
                self.buildings = b_data.get("features", [])

        # 3. Attendance Polygons
        att_path = os.path.join(self.data_dir, "amrita_attendance_polygons.json")
        if os.path.exists(att_path):
            with open(att_path, "r", encoding="utf-8") as f:
                self.attendance_zones = json.load(f)

    @staticmethod
    def is_point_in_polygon(lon: float, lat: float, polygon: List[Tuple[float, float]]) -> bool:
        """
        Ray-Casting Algorithm for Point-in-Polygon (Jordan Curve Theorem).
        lon = x, lat = y
        """
        inside = False
        n = len(polygon)
        if n < 3:
            return False
        p1x, p1y = polygon[0]
        for i in range(1, n + 1):
            p2x, p2y = polygon[i % n]
            if lat > min(p1y, p2y):
                if lat <= max(p1y, p2y):
                    if lon <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or lon <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculates distance between two lat/lon points in meters."""
        R = 6371000.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = (math.sin(delta_phi / 2.0) ** 2 +
             math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
        return R * c

    def verify_location(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Evaluates GPS coordinates against Amrita boundary and 103 building zones.
        Returns evaluation latency in milliseconds, zone classification, and nearest building.
        """
        t_start = time.perf_counter()

        # 1. Check if inside campus boundary
        inside_campus = False
        if self.boundary_coords:
            inside_campus = self.is_point_in_polygon(lon, lat, self.boundary_coords)
        else:
            # Fallback bounding box around Amrita Ettimadai
            inside_campus = (10.885 <= lat <= 10.925 and 76.882 <= lon <= 76.922)

        # 2. Check if inside any specific building
        matched_building = None
        nearest_building = None
        min_distance = float("inf")

        # Iterate through attendance zones
        for zone in self.attendance_zones:
            pts = zone.get("polygon", [])
            if not pts:
                continue
            poly_coords = [(p["lon"], p["lat"]) for p in pts]
            
            # Compute centroid for distance
            c_lat = sum(p["lat"] for p in pts) / len(pts)
            c_lon = sum(p["lon"] for p in pts) / len(pts)
            dist = self.haversine_distance(lat, lon, c_lat, c_lon)

            if dist < min_distance:
                min_distance = dist
                nearest_building = {
                    "id": zone.get("building_id"),
                    "name": zone.get("building_name"),
                    "distance_meters": round(dist, 1)
                }

            if self.is_point_in_polygon(lon, lat, poly_coords):
                matched_building = {
                    "id": zone.get("building_id"),
                    "name": zone.get("building_name"),
                    "distance_meters": 0.0
                }
                break

        t_elapsed = (time.perf_counter() - t_start) * 1000.0

        if matched_building:
            status = "INSIDE_BUILDING"
            message = f"Verified inside {matched_building['name']}"
        elif inside_campus:
            status = "CAMPUS_GROUNDS"
            nearest_info = f" (Nearest: {nearest_building['name']}, {nearest_building['distance_meters']}m)" if nearest_building else ""
            message = f"Verified on Amrita Campus Grounds{nearest_info}"
        else:
            status = "OFF_CAMPUS"
            message = f"Rejected: Coordinates lie outside Amrita Vishwa Vidyapeetham boundary ({round(min_distance, 1)}m away)"

        return {
            "latitude": lat,
            "longitude": lon,
            "inside_campus": inside_campus,
            "inside_building": matched_building is not None,
            "status": status,
            "message": message,
            "matched_building": matched_building,
            "nearest_building": nearest_building,
            "total_buildings_checked": len(self.attendance_zones),
            "latency_ms": round(t_elapsed, 2)
        }

# Global singleton
amrita_geofence = AmritaGeofenceEngine()
