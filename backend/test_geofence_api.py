import json

with open("app/core/geofence_data/amrita_attendance_polygons.json", "r") as f:
    zones = json.load(f)

for z in zones:
    if not z["building_name"].startswith("Building_"):
        lat = sum(p["lat"] for p in z["polygon"]) / len(z["polygon"])
        lon = sum(p["lon"] for p in z["polygon"]) / len(z["polygon"])
        print(f"{z['building_name']} -> {lat:.6f}, {lon:.6f}")

test_points.append(("Ettimadai Highway (Breach)", 10.9350, 76.9500))

print("\n--- Testing API Endpoint ---")
for name, lat, lon in test_points:
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/geofence/verify",
        data=json.dumps({"latitude": lat, "longitude": lon}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode("utf-8"))
    print(f"[{name}] -> Status: {data['status']}, InsideBuilding: {data['inside_building']}, Msg: {data['message']}, Latency: {data['latency_ms']} ms")
