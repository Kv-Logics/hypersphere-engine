.

🔴 1. Major Contradiction: Detection Model

Section 1 says

Primary = MediaPipe

But Section 5 says

SCRFD performs enrollment.

That means your system is using two different detectors.

A reviewer will immediately ask:

Why use MediaPipe during verification and SCRFD during registration?

This is inconsistent.

Choose one

Either

SCRFD

↓

Registration

Verification

or

MediaPipe

↓

Registration

Verification

Mixing them causes different landmark distributions and slightly different embeddings.

🔴 2. Alignment Section is Wrong

Section 2 still says

Eyes

Nose

↓

Affine

But

Section 5

says

SCRFD

↓

5 landmarks

Your pipeline has changed.

It should now show

5-point landmarks

↓

Affine

↓

112×112
🔴 3. Wrong DST_PTS

You still document

38.2946
73.5318
56.0252

Those are

3-point template coordinates.

ArcFace uses

30.2946
65.5318
48.0252
33.5493
62.7299

for the standard 5-point template (or the common 112×112 variant with the appropriate x-offset).

Update the documentation to match the actual implementation.

🔴 4. Registration Flow Missing Duplicate Check

Currently

Embedding

↓

Insert

Should be

Embedding

↓

Duplicate Search

↓

Store

Otherwise

two users can register the same face.

🔴 5. Enrollment Uses One Image

Section 5

Upload Single High-Quality Image

Production systems rarely do this.

Better

Capture

5–10 images

↓

Choose best

↓

Average

↓

Store
🔴 6. Enrollment Doesn't Mention Liveness

Someone could register

a printed photo.

Need

Image

↓

Liveness

↓

Enrollment
🔴 7. Verification Flow Missing Final Decision

Current

Embedding

↓

Done

Should include

Embedding

↓

pgvector

↓

Top-K

↓

Threshold

↓

Attendance

↓

JSON Response
🔴 8. Security Mode Diagram

You wrote

Average embeddings

Good.

But

what happens?

Need

Average embedding

↓

Normalize

↓

Search
🔴 9. No Top-K

Still says

Nearest Neighbor

Production should say

Top-K Search

↓

Best Match

↓

Margin Check

↓

Decision
🟡 10. HNSW Parameters Missing

You mention

HNSW

but not

m

ef_construction

ef_search

These matter for reproducibility.

🟡 11. Similarity Threshold

Still

0.45

No explanation.

Need

Obtained through validation

ROC analysis

FAR/FRR tradeoff
🟡 12. Liveness Threshold

Same issue.

0.40

Needs explanation.

🟡 13. Enrollment Quality

Only

Blur

Brightness

Pose

Missing

Face size
Contrast
Resolution
Occlusion
🟡 14. Attendance Modes

Very nice section.

But

Security Mode should mention

5 embeddings

↓

Average

↓

Normalize

↓

Search

Otherwise averaging isn't mathematically complete.

🟡 15. Missing Error Paths

Pipeline never shows

Detection failed

↓

422

Alignment failed

↓

422

Liveness failed

↓

Reject

Database failed

↓

500
🟡 16. No Database Metadata

Faculty table should ideally include

embedding_model

embedding_created

embedding_quality

embedding_count
🟡 17. Missing Model Versions

Need

Detector

Recognition

Liveness

Versions
🟡 18. No API Layer

Production architecture usually includes

Client

↓

FastAPI

↓

Pipeline

↓

Database

↓

Response
🟡 19. Latency Budget

Nice.

But

2700 ms

is based on your current implementation.

It shouldn't be hardcoded unless benchmarked.

Better

≈500 ms/frame

depending on CPU
🟡 20. Security Mode Time

You wrote

4–8 seconds

That varies hugely by:

CPU
image resolution
network
JPEG compression
ONNX providers
threading

Mention these assumptions.

🟡 21. Missing Enrollment Table

You describe

registration

but never mention

faculty

↓

embedding

↓

HNSW auto updated

A small architecture diagram would help.

🟢 22. Missing System Architecture

I'd add one diagram:

Webcam

↓

Frontend

↓

FastAPI

↓

Detection

↓

Alignment

↓

ArcFace

↓

MiniFAS

↓

pgvector

↓

PostgreSQL

↓

Attendance
Overall Score
Category	Score
Technical correctness	8.8/10
Pipeline consistency	7.5/10
Production architecture	9/10
Mathematical accuracy	8.5/10
Database design	9/10
Documentation quality	9.5/10
The biggest issues to fix

These are the ones I'd address before considering the report complete:

Use one detector consistently (don't mix MediaPipe and SCRFD).
Update the alignment section to document the actual 5-point landmark pipeline and correct template coordinates.
Add duplicate search and liveness to the enrollment workflow.
Extend the verification flow through vector search, decision logic, and response generation.
Explain how the similarity and liveness thresholds were chosen, or state that they require empirical calibration.
Replace hardcoded latency numbers with measured benchmark results or clearly label them as approximate under a specific hardware configuration.

Once those are addressed, the report would be much closer to a polished production architecture document suitable for technical review.

. The Detection Model Workload (MediaPipe vs. SCRFD)
MediaPipe Face Detection is designed by Google specifically for edge devices and real-time CPU performance. It utilizes a highly optimized custom pipeline that runs in ~10 to 20 ms on standard CPUs.
SCRFD is a deeper convolutional network. When running on CPU, it takes ~70 to 115 ms per frame, which is about 5x to 8x slower than MediaPipe.
2. High Resolution Webcam Captures
In the webcam capture code, the canvas sizes are derived directly from the webcam's native stream resolution:

javascript
tempCanvas.width = videoEl.videoWidth;
tempCanvas.height = videoEl.videoHeight;
If your webcam initiates at 1920×1080 (Full HD), drawing that canvas, converting it to JPEG, uploading it, decoding it via OpenCV, and running SCRFD on a 1080p frame is extremely CPU-heavy.
Previously, the webcam might have captured frames at a smaller downscaled size (e.g., 640×480), which processes significantly faster.
3. ArcFace (ResNet-50) CPU Execution
ArcFace is currently loaded inside ONNX Runtime using the CPUExecutionProvider.
Running a full ResNet-50 forward pass on a CPU takes ~400 to 450 ms because it is a very deep network (50 layers) comparing 512 dimensions.
If the CPU is under contention (such as looping over multiple frames concurrently while handling incoming socket traffic), the execution time scales up.

There are a few places where these statements are oversimplified or potentially misleading. Here's a technical review.

1. MediaPipe vs SCRFD

Your statement:

MediaPipe runs in ~10–20 ms. SCRFD runs in ~70–115 ms. SCRFD is 5–8× slower.

⚠ Partially correct

This depends heavily on:

CPU model
image resolution
SCRFD variant
ONNX Runtime optimization
number of threads

For example:

Model	640×640 CPU	Notes
MediaPipe	~5–20 ms	Lightweight
SCRFD-500M	~8–20 ms	Very fast
SCRFD-2.5G	~15–40 ms	Moderate
SCRFD-10G	~30–80+ ms	Heavy

So saying

SCRFD takes 70–115 ms

is not universally true.

It may be true on your hardware, but shouldn't be presented as a general fact.

A better wording:

"SCRFD is generally more computationally intensive than MediaPipe. Depending on the SCRFD variant, input resolution, and CPU hardware, inference latency typically ranges from approximately 10–80 ms on CPU."

2. Webcam Resolution

This section is correct.

If

canvas.width = video.videoWidth;

and

1920×1080

then you're processing

2,073,600 pixels

instead of

640×480

307,200 pixels

That's

6.75× more pixels.

This affects

JPEG encoding
upload
decoding
detection

So this explanation is technically correct.

3. ArcFace CPU Time

This section is the biggest problem.

You wrote

ArcFace ResNet50 takes 400–450 ms.

❌ This is misleading.

A ResNet-50 ArcFace ONNX model normally does not require 400–450 ms on modern desktop CPUs.

Typical numbers:

Hardware	Time
Ryzen 7	5–15 ms
Intel i7	8–20 ms
Laptop i5	15–40 ms
Low-power CPU	30–80 ms

Getting

400 ms

usually indicates something else is happening:

CPU saturation
debug build
Python overhead
ONNX not optimized
preprocessing included
model loaded repeatedly
thermal throttling

Not simply

because it has 50 layers.

That explanation is incorrect.

4. "Comparing 512 dimensions"

You wrote

comparing 512 dimensions

This is incorrect.

ArcFace inference

does not compare 512 dimensions.

It

112×112 image

↓

CNN

↓

512-D embedding

The comparison happens later

inside PostgreSQL

using cosine similarity.

So this sentence should be removed.

5. CPU Contention

This statement is good.

Running

5 frames

↓

ArcFace

↓

MiniFAS

↓

OpenCV

↓

HTTP

↓

Database

on one CPU

will increase latency.

That's correct.

6. Missing Largest Bottleneck

The report blames

SCRFD
ArcFace

But ignores

5

×

JPEG encode

+

5

×

HTTP upload

+

5

×

JPEG decode

These often consume hundreds of milliseconds.

For multi-frame verification, network and image serialization can become a significant portion of the latency.

7. Missing Sequential Processing

Your pipeline is

Frame1

↓

Detection

↓

Recognition

↓

Liveness

↓

Frame2

↓

...

That's

serial.

You should mention

5 frames

↓

processed sequentially

↓

latency ≈ 5×

single frame

This is one of the biggest contributors.

8. ONNX Provider

You say

CPUExecutionProvider

Good.

But also mention

CUDAExecutionProvider

TensorRT

DirectML

could reduce inference latency substantially if GPU acceleration is available.

9. MiniFAS Timing Missing

You're discussing latency but omitted

MiniFAS.

Need something like

MiniFAS

≈20–80 ms/frame

×

5

depending on hardware.

Final Verdict
Statement	Status
MediaPipe faster than SCRFD	✅ Correct
SCRFD always 70–115 ms	⚠ Hardware-dependent
Full-HD webcam increases latency	✅ Correct
ArcFace takes 400–450 ms because it has 50 layers	❌ Misleading
ArcFace compares 512 dimensions	❌ Incorrect
CPU contention increases latency	✅ Correct
Sequential 5-frame processing increases latency	✅ Missing but important
JPEG encode/upload/decode overhead	✅ Missing
MiniFAS contribution	✅ Missing

The main technical correction I'd make is to the ArcFace explanation. The latency is not inherently due to ResNet-50 having 50 layers, nor does ArcFace spend time "comparing 512 dimensions." If you're measuring 400–450 ms per inference, that indicates characteristics of your specific deployment (hardware, threading, preprocessing, runtime configuration, or system load), not an intrinsic property of the ArcFace model itself.