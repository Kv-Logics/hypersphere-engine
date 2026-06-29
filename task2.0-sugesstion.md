What I Would Change
1. Don't use threading.Lock around ONNX

You propose:

with self._recog_lock:
    embedding = self.recog_session.run(...)

This serializes all recognition requests.

Throughput drops dramatically.

ONNX Runtime inference sessions are designed to support concurrent inference in most common deployment configurations.

Instead:

create one session per worker process, or
rely on ONNX Runtime's concurrency model and benchmark under your workload.

I would avoid a global lock unless you have measured a thread-safety issue.

2. PyTorch Lock

Same concern.

MiniFASNet inference is typically safe in inference mode (eval() with torch.no_grad()), but thread behavior depends on your serving architecture and hardware.

Benchmark first before adding locks that could become bottlenecks.

3. Embedding Quality Gate

You propose

raw_norm < 5

This is problematic.

Embedding norm depends on

backbone
training dataset
export
preprocessing

A fixed norm threshold is not portable.

Better:

Collect

1000

good images

↓

distribution

↓

mean

↓

std

↓

threshold

Never hardcode it without calibration.

4. Duplicate Threshold

You use

0.70

Again,

no universal value.

Needs validation.

I'd make it configurable.

5. Ambiguity Margin

You use

0.03

Good idea.

I'd improve it.

Instead of

Top1 - Top2

Use

Top1 similarity

Top2 similarity

Top1 quality

Top2 quality

Detection confidence

Liveness

This reduces false manual reviews.

6. Multi-frame

Current proposal

Choose best frame

I'd do

Top 5

↓

remove worst

↓

average embeddings

↓

normalize

↓

search

This is more stable.

Averaging multiple high-quality embeddings usually reduces random variation.

7. Drift Update

I would not update

0.70

to

0.90

automatically.

Imagine

Professor

↓

son looks similar

↓

accepted accidentally

↓

embedding drifts

↓

database corruption.

Better

Update only after

Repeated successful matches

OR

manual approval
8. Adaptive Thresholds

Instead of

camera thresholds

I'd use

camera

+

quality score

+

pose

↓

dynamic threshold

Example

Poor quality

↓

require

0.60

Good quality

↓

allow

0.45
9. Multi-Embedding

Centroid is okay.

But

Centroid

can lose useful variation.

Better

Embeddings table

Faculty

↓

15 embeddings

↓

Top similarity

Storage cost is tiny.

For 700 users:

700

×

15

×

512

floats

≈ 20–25 MB

This is negligible.

10. SCRFD Model

You recommend

SCRFD-500M

I'd actually suggest

SCRFD-2.5G

if your deployment is on desktop-class CPUs.

It offers a better balance of robustness and still runs comfortably on modern hardware.

Missing Production Features

These aren't covered in your plan but are worth adding.

Health Monitoring

Monitor

detector latency
ArcFace latency
liveness latency
database latency
GPU usage
CPU usage
Metrics

Track

FAR
FRR
FMR
FNMR
average similarity
average liveness

These help detect performance regressions over time.

Audit Logging

Every recognition should record

detector confidence
quality score
liveness score
similarity
matched identity
device
model version

This is invaluable for debugging.

Database Encryption

Embeddings are biometric templates.

Protect them with

encryption at rest
encrypted backups
least-privilege database access
audit trails
Rate Limiting

Prevent attackers from repeatedly attempting verification.

Watchlist Detection

If a verification returns

Top1 = 0.62

Top2 = 0.61

flag it instead of making an automatic decision.