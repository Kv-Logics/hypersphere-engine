# 🎬 Master Google Gemini Video Generation Prompt
## Hypersphere Engine: IoT Edge Biometric System on Raspberry Pi
### Review 2 — System Design, Embedded ML Analysis & Working Demo

> **How to Use this Prompt:**
> Copy the entire prompt block below and paste it directly into **Google Gemini** ([gemini.google.com](https://gemini.google.com), Google AI Studio, or Google Vids). It will generate a complete, production-ready video production package including timestamps, voiceover narration script, on-screen motion graphics descriptions, and AI video generator prompts for tools like Runway Gen-3, InVideo, Sora, or Google Vids.

***

```markdown
You are a Principal Embedded Systems Engineer, Computer Vision Specialist, and Academic Presentation Coach specializing in Electronics and Communication Engineering (ECE).

I need you to produce a complete, cinematic, and technically rigorous 5-minute System Demonstration Video Package for our university major project milestone: Review 2 of Course 23ECE381 / 23CCE381 Open Laboratory - I.

The evaluation rubric for Review 2 assigns:
- Design: 15 Marks (System topology, edge hardware, data pipelines, zero-cloud architecture)
- Analysis: 5 Marks (ARM64 latency budgets, memory footprints, power/thermal profiling, anti-spoofing benchmarks)
- Working Demo & Presentation: 10 Marks (Live mobile-to-edge workflow, facial registration, presentation attack defense rejection, geofence verification, hardware telemetry)

=========================================
PROJECT SPECIFICATIONS & CONSTRAINTS:
=========================================
1. Project Name: Hypersphere Engine: Decentralized IoT Edge Biometric Attendance & Campus Geofencing System
2. Hardware Platform: Raspberry Pi 4 / 5 (ARM64 Edge Gateway). Zero cloud hosting (no AWS, GCP, Azure).
3. Client Interaction: BYOD (Bring Your Own Device) — Faculty and students open a Progressive Web App (Next.js 15) on their personal smartphones over local campus Wi-Fi.
4. Embedded ML Pipeline (< 25 MB total memory footprint):
   - Face Detection: SCRFD-2.5G ONNX (0.67M params, 3.2MB) with ARM NEON SIMD acceleration.
   - Pre-flight Quality & Alignment: Laplacian blur variance (Var >= 50.0), 3D head pose (solvePnP), and 5-Point Partial Affine transformation to canonical ArcFace coordinates (112x112).
   - Presentation Attack Defense (Liveness): MiniFASNetV2 (0.43M params, 1.8MB) evaluating an expanded 2.7x crop for digital screen moire and paper reflection artifacts. Achieves 99.12% accuracy (ACER: 0.88%) on CASIA-SURF.
   - Feature Extraction: ArcFace MobileFaceNet (1.2M params, 13.6MB) generating a 512-dimensional normalized hyperspherical embedding vector.
5. Edge Database & Matching:
   - Zero-dependency local SQLite storage + in-memory dot-product cosine similarity (< 2ms search) or PostgreSQL with pgvector HNSW.
   - Adaptive drift candidate queue for gradual facial changes.
6. Campus Geofencing:
   - Ray-Casting Point-in-Polygon (Jordan Curve Theorem) evaluating GPS coordinates against 103 OpenStreetMap building polygons for Amrita campus in < 1.2ms. Rejects IP-based location spoofing.
7. Performance Benchmarks on Raspberry Pi:
   - Latency Budget: SCRFD (42ms) + Affine (5ms) + MiniFASNetV2 (38ms) + MobileFaceNet (32ms) + Vector Match (2ms) = 139ms on Raspberry Pi 5 (215ms on Raspberry Pi 4).
   - Electrical & Thermal: 5V @ 1.5A (~7.5W power draw), operates stably at 48°C - 54°C on passive heatsink cooling.

=========================================
DELIVERABLES REQUIRED IN YOUR RESPONSE:
=========================================

Please output a comprehensive, structured video production guide containing:

### PART 1: 5-Minute Scene-by-Scene Demonstration Video Script
Divide the video into 6 distinct cinematic scenes:
- Scene 1 (0:00 - 0:45): The Cloud Biometric Problem vs The Decentralized Edge IoT Vision.
- Scene 2 (0:45 - 1:45): System Design & 3-Tier Architecture (Mobile BYOD -> Campus Wi-Fi -> Raspberry Pi Gateway -> Embedded Pipeline -> Vector DB).
- Scene 3 (1:45 - 2:45): Embedded ML Pipeline & Mathematical Alignment Deep-Dive (Explain 5-pt Affine, SCRFD, MiniFASNetV2 anti-spoofing, and ArcFace MobileFaceNet).
- Scene 4 (2:45 - 3:30): Performance Analysis, Latency Budget (139ms), and Hardware Thermals/Power.
- Scene 5 (3:30 - 4:30): Live Working Demonstration (Mobile scan -> Blink detection -> Instant verification in Academic Block 1 -> Live screen-replay spoof attack rejection).
- Scene 6 (4:30 - 5:00): Review 2 Milestones Accomplished & Review 3 Hardware Kiosk Roadmap.

For EACH scene, provide:
1. Timestamp & Scene Title.
2. Visual Description: Exactly what is shown on screen (UI recordings, 3D animated architecture, camera footage of the Raspberry Pi).
3. On-Screen Display (OSD) / Motion Graphic Text: Key metrics, formulas, and diagrams displayed on screen.
4. Voiceover Narration Script: Verbatim, natural, confident narration spoken by the presenter. Use professional engineering terminology (e.g., "affine transformation", "ARM NEON SIMD", "eigenvalue focus variance", "CASIA-SURF ACER", "Jordan Curve Theorem").

### PART 2: Text-to-Video AI Generator Prompts (Runway Gen-3 / Sora / InVideo / Google Vids)
Generate 5 highly descriptive, cinematic text-to-video prompts that I can directly paste into AI video generation tools to create background video b-roll:
- Prompt 1: Futuristic Raspberry Pi 4/5 edge device on a server rack with blinking activity LEDs, connected via ethernet and Wi-Fi antennas, sleek tech aesthetic, 4k macro shot.
- Prompt 2: 3D holographic data stream moving from a student's smartphone through wireless waves into a compact microprocessor chip.
- Prompt 3: Close-up biometric face mesh alignment animation showing 5 neon anchor points locking onto eye centers, nose tip, and mouth corners, then warping into an aligned frame.
- Prompt 4: Split-screen presentation attack defense showing a real human face passing a green laser scan, while a phone screen replaying a video is targeted by red security grid lines displaying "SPOOF ATTACK DETECTED - REJECTED".
- Prompt 5: Top-down 3D satellite view of a lush university campus with 103 neon polygon boundaries glowing around academic buildings, with a GPS coordinate pulse locking onto "Academic Block 1".

### PART 3: Professor Viva Defense & Technical Questions Anticipated in the Video
List the top 4 critical technical questions professors will ask after watching this video demonstration, along with precise, high-scoring answers highlighting our engineering decisions.
```
***

## 💡 Recommended AI Video Creation Workflow

Once Gemini produces your script and prompts, follow this simple workflow to produce the final video:
1. **Voiceover:** Paste the Voiceover Script into **ElevenLabs** ([elevenlabs.io](https://elevenlabs.io)) using the *"Adam"* or *"Antoni"* natural voice to generate studio-grade MP3 audio.
2. **Visuals:** 
   - Use **InVideo AI** ([invideo.io](https://invideo.io)) or **Google Vids**: Paste the Gemini script and it will automatically assemble stock footage, animations, and voiceover into a complete video in minutes.
   - Alternatively, record your screen while interacting with the Next.js visualizer route at `http://localhost:3000/demo`.
3. **Editing:** Drop the recorded screen demo and AI voiceover into **CapCut** or **DaVinci Resolve** for a rapid, broadcast-ready 5-minute video presentation.
