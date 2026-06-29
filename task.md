B. Haar Cascade Fallback

This is probably the weakest part of the pipeline.

Haar Cascades were introduced around 2001.

Problems:

poor recall
sensitive to lighting
many false positives
fails with glasses
fails with beard
fails with masks
poor profile face support

Most modern production systems do not use Haar Cascades anymore.

Better fallbacks:

SCRFD
RetinaFace
YuNet
BlazeFace2. Landmark Quality

MediaPipe Face Detection provides only

eyes
nose
mouth
ears

This is enough for rough alignment.

But ArcFace performs best with

5-point or 106-point landmarks

Example:

RetinaFace gives

eye corners
nose
mouth corners

SCRFD + 5-point landmarks

or

Face Alignment Network

produce much more accurate alignment.

3. Affine Alignment Problems

Current pipeline

eyes
nose

↓

estimateAffinePartial2D

↓

112×112

Works well only when

head rotation is small
roll angle is small

Fails for

large yaw
tilted heads
profile faces

Because

3 landmarks are insufficient.

Production systems often use

similarity transform
5 landmarks
68 landmarks
106 landmarks
4. Quality Assessment is Too Simple

Current

Blur

+

Brightness

Real systems check much more.

Example

Pose

Reject

yaw > 35°

pitch > 30°

roll > 25°
Occlusion

Detect

mask
sunglasses
hand
hair
Face Size

Reject tiny faces.

Example

face width < 80 px
Resolution

Reject

112×112 generated from
30×30 face

because interpolation cannot recover details.

Motion Blur

Variance of Laplacian

cannot distinguish

camera shake
motion blur
out-of-focus blur

Production systems often use CNN-based quality assessment.

1. MediaPipe Face Detection

Still the weakest component.

MediaPipe Face Detection is not designed for

CCTV
Attendance cameras
Large pose
Long distance

SCRFD would outperform it significantly.




2. Haar Cascade Should Not Exist

This is still problematic.

haarcascade_frontalface_default.xml

should simply be removed.

Replace with

SCRFD
RetinaFace
YuNet


3. Fake Mouth Landmark Estimation

This is probably the biggest mathematical issue.

You compute

rmc_x = mc_x - 0.414 * eye_dx

and

lmc_x = mc_x + 0.414 * eye_dx

But MediaPipe Face Detection never predicts mouth corners.

You are estimating them.

This works only when

face frontal
expression neutral

Fails for

smile
talking
beard
rotated head

A real landmark detector is much better.


4. Pose Estimation Isn't Real Pose Estimation

Current yaw

asymmetry =

Pitch

eye nose ratio

Roll

eye slope

These are heuristic approximations.

Production systems solve

Perspective-n-Point (PnP)

using

3D face model

which gives

yaw
pitch
roll

accurately.

5. Blur Threshold

Current

quality_score = blur/200

This number

200

is arbitrary.

Different cameras

Different resolutions

Different lenses

need different thresholds.

6. Brightness Check

Current

mean(gray)

This cannot distinguish

Dark room

from

Strong shadow.

Histogram analysis

or

CNN quality model

works better.

7. Only One Image

Recognition

Liveness

Quality

Everything

comes from

ONE frame.

Production systems usually

capture

5–20 frames

choose

highest quality

then recognize.

Accuracy increases dramatically.

8. No Detection Confidence Filter

MediaPipe returns

min_detection_confidence

but after detection

you don't verify

actual confidence.

Low confidence detections may continue.

9. Single Face Problem

MediaPipe

results.detections[0]

If

two professors

stand together

first face is taken.

Better

select

largest

or

highest confidence.

10. No Occlusion Detection

Nothing checks

mask
sunglasses
hand
scarf
hair

These heavily affect ArcFace.

11. Liveness

Still

single-image MiniFASNet.

Weak against

phone replay
tablet replay
video injection
high-quality print attacks
12. No Embedding Quality

Even if

embedding quality

is poor

it is still stored.

Production systems reject

low-quality embeddings.

13. No Multi-Embedding Enrollment

Still

Faculty

↓

One embedding

Production

Faculty

↓

10 embeddings

↓

Centroid

or

Top similarity
14. No Duplicate Search

Register

Professor A

again

System accepts.

Should perform

1:N search

before saving.

15. No Score Margin

Suppose

A = 0.51

B = 0.50

Current

accepts A.

Production

flags

Ambiguous Match.

16. No Adaptive Threshold

Still

fixed threshold

like

0.45

Production thresholds

depend on

camera

environment

dataset

population.

17. No Enrollment Verification

Should ensure

frontal
neutral
no smile
no sunglasses
no blur

before saving.

18. No Model Version Tracking

If later

ArcFace model changes

old embeddings become incompatible.

Need

embedding

model_version

created_at
19. No Drift Update

Faculty

2024

↓

2027

Beard

↓

Recognition drops.

Need

automatic embedding refresh.

20. Error Recovery

If

ONNX

fails

PyTorch

fails

GPU unavailable

System throws exception.

Production

needs

graceful recovery.

21. Memory Efficiency

Every request creates

with FaceDetection(...)

A new detector instance is created for every image. While functional, this adds unnecessary initialization overhead under high request rates. Reusing detector instances or worker-local pools can improve throughput.

22. Thread Safety

FacePipeline is implemented as a singleton shared across requests.

In a multi-worker or highly concurrent deployment, you should verify that:

ONNX Runtime sessions are safely shared or isolated as appropriate.
PyTorch inference is thread-safe for your usage pattern.
MediaPipe objects are not shared unsafely between requests.

Without careful concurrency testing, sporadic production issues can occur.