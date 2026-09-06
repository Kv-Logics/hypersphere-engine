"""
Generate Review 2 Presentation (.pptx) for Hypersphere Engine
Produces a professional, dark-themed slide deck directly from project data.
Usage: python scripts/generate_pptx.py
Output: REVIEW_2_PRESENTATION.pptx
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

# ── Color Palette (Dark Professional Theme) ──────────────────────────
BG_DARK       = RGBColor(0x0F, 0x17, 0x2A)   # Deep navy
BG_CARD       = RGBColor(0x1A, 0x25, 0x3C)   # Card background
ACCENT_BLUE   = RGBColor(0x3B, 0x82, 0xF6)   # Primary accent
ACCENT_CYAN   = RGBColor(0x06, 0xB6, 0xD4)   # Secondary accent
ACCENT_GREEN  = RGBColor(0x10, 0xB9, 0x81)   # Success / positive
ACCENT_AMBER  = RGBColor(0xF5, 0x9E, 0x0B)   # Warning / highlight
ACCENT_RED    = RGBColor(0xEF, 0x44, 0x44)   # Alert / danger
TEXT_WHITE    = RGBColor(0xF1, 0xF5, 0xF9)   # Primary text
TEXT_MUTED    = RGBColor(0x94, 0xA3, 0xB8)   # Secondary text
TEXT_DIM      = RGBColor(0x64, 0x74, 0x8B)   # Tertiary text
BORDER_COLOR  = RGBColor(0x33, 0x44, 0x5C)   # Borders


def set_slide_bg(slide, color=BG_DARK):
    """Set solid background color for a slide."""
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_shape_rect(slide, left, top, width, height, fill_color, border_color=None):
    """Add a rounded rectangle shape."""
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    if border_color:
        shape.line.color.rgb = border_color
        shape.line.width = Pt(1)
    else:
        shape.line.fill.background()
    return shape


def add_text_box(slide, left, top, width, height, text, font_size=14,
                 color=TEXT_WHITE, bold=False, alignment=PP_ALIGN.LEFT, font_name="Calibri"):
    """Add a text box with specified formatting."""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = alignment
    return txBox


def add_bullet_list(slide, left, top, width, height, items, font_size=13,
                    color=TEXT_WHITE, bullet_color=ACCENT_CYAN):
    """Add a bulleted list of items."""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = item
        p.font.size = Pt(font_size)
        p.font.color.rgb = color
        p.font.name = "Calibri"
        p.space_after = Pt(6)
        p.level = 0
    return txBox


def add_accent_line(slide, left, top, width, color=ACCENT_BLUE):
    """Add a horizontal accent line."""
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, Pt(3))
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


def add_table_slide(slide, left, top, width, rows_data, col_widths, header_color=ACCENT_BLUE):
    """Add a formatted table to a slide."""
    rows = len(rows_data)
    cols = len(rows_data[0])
    table_shape = slide.shapes.add_table(rows, cols, left, top, width, Inches(0.4 * rows))
    table = table_shape.table

    for ci, cw in enumerate(col_widths):
        table.columns[ci].width = cw

    for ri, row in enumerate(rows_data):
        for ci, cell_text in enumerate(row):
            cell = table.cell(ri, ci)
            cell.text = cell_text
            for paragraph in cell.text_frame.paragraphs:
                paragraph.font.size = Pt(10)
                paragraph.font.name = "Calibri"
                if ri == 0:
                    paragraph.font.bold = True
                    paragraph.font.color.rgb = TEXT_WHITE
                    paragraph.alignment = PP_ALIGN.CENTER
                else:
                    paragraph.font.color.rgb = TEXT_WHITE
                    paragraph.alignment = PP_ALIGN.LEFT

            # Cell fill
            cell_fill = cell.fill
            cell_fill.solid()
            if ri == 0:
                cell_fill.fore_color.rgb = header_color
            elif ri % 2 == 0:
                cell_fill.fore_color.rgb = RGBColor(0x1E, 0x29, 0x3B)
            else:
                cell_fill.fore_color.rgb = BG_CARD

    return table_shape


def add_notes(slide, notes_text):
    """Add speaker notes to a slide."""
    notes_slide = slide.notes_slide
    notes_slide.notes_text_frame.text = notes_text


# ======================================================================
#  MAIN GENERATION
# ======================================================================

def generate_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)   # 16:9 widescreen
    prs.slide_height = Inches(7.5)

    SLIDE_W = Inches(13.333)
    SLIDE_H = Inches(7.5)
    MARGIN = Inches(0.6)
    CONTENT_W = SLIDE_W - 2 * MARGIN

    # -- SLIDE 1: Title ------------------------------------------------
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank
    set_slide_bg(slide)

    # Top accent bar
    add_shape_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.08), ACCENT_BLUE)

    # Course label
    add_text_box(slide, MARGIN, Inches(1.0), CONTENT_W, Inches(0.4),
                 "23CCE381 / 23ECE381  |  Open Laboratory - I  |  Review 2",
                 font_size=14, color=ACCENT_CYAN, bold=False)

    # Main title
    add_text_box(slide, MARGIN, Inches(1.8), CONTENT_W, Inches(1.2),
                 "HYPERSPHERE ENGINE",
                 font_size=44, color=TEXT_WHITE, bold=True, alignment=PP_ALIGN.LEFT)

    # Subtitle
    add_text_box(slide, MARGIN, Inches(2.9), CONTENT_W, Inches(0.8),
                 "Decentralized IoT Edge Biometric Attendance\n& Campus Geofencing System",
                 font_size=22, color=TEXT_MUTED, bold=False)

    add_accent_line(slide, MARGIN, Inches(3.9), Inches(4), ACCENT_BLUE)

    # Key info cards
    info_items = [
        ("TARGET HARDWARE", "Raspberry Pi 4 / 5 (ARM64)"),
        ("CLIENT DEVICES",  "Smartphones (BYOD)"),
        ("ML MODELS",       "4 Neural Networks < 25 MB"),
        ("LATENCY",         "< 200ms End-to-End"),
    ]
    card_w = Inches(2.8)
    card_h = Inches(1.3)
    start_x = MARGIN
    for i, (label, value) in enumerate(info_items):
        x = start_x + i * (card_w + Inches(0.2))
        add_shape_rect(slide, x, Inches(4.5), card_w, card_h, BG_CARD, BORDER_COLOR)
        add_text_box(slide, x + Inches(0.2), Inches(4.65), card_w - Inches(0.4), Inches(0.3),
                     label, font_size=10, color=ACCENT_CYAN, bold=True)
        add_text_box(slide, x + Inches(0.2), Inches(5.0), card_w - Inches(0.4), Inches(0.5),
                     value, font_size=16, color=TEXT_WHITE, bold=True)

    # Institutions
    add_text_box(slide, MARGIN, Inches(6.3), CONTENT_W, Inches(0.4),
                 "NIT Trichy (CDI)  &  Amrita Vishwa Vidyapeetham",
                 font_size=12, color=TEXT_DIM)

    add_notes(slide, "Title slide. Introduce the project name, course code, and Review 2 context. "
              "Emphasize that this is an IoT edge system running entirely on Raspberry Pi hardware "
              "with zero cloud dependency. Mention the sub-200ms latency target.")

    # -- SLIDE 2: Problem Statement ------------------------------------
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    add_shape_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.08), ACCENT_BLUE)

    add_text_box(slide, MARGIN, Inches(0.3), CONTENT_W, Inches(0.5),
                 "02  |  PROBLEM STATEMENT", font_size=12, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, MARGIN, Inches(0.8), CONTENT_W, Inches(0.6),
                 "Why Edge IoT Beats Cloud-Based Biometrics",
                 font_size=28, color=TEXT_WHITE, bold=True)

    # Cloud problems (left column)
    add_shape_rect(slide, MARGIN, Inches(1.8), Inches(5.8), Inches(4.8), BG_CARD, ACCENT_RED)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(1.95), Inches(5.2), Inches(0.4),
                 "CLOUD-BASED BOTTLENECKS", font_size=13, color=ACCENT_RED, bold=True)
    add_bullet_list(slide, MARGIN + Inches(0.3), Inches(2.5), Inches(5.2), Inches(3.8), [
        "High Network Latency: Uploading hi-res face images to cloud\ncreates >1.5s delays and consumes institutional bandwidth",
        "Privacy & Compliance Violations: Storing biometric templates\non 3rd-party cloud infrastructure risks data leakage",
        "Single Point of Network Failure: Internet disruption halts\nthe entire campus attendance system",
    ], font_size=13, color=TEXT_MUTED)

    # Edge solution (right column)
    add_shape_rect(slide, Inches(6.8), Inches(1.8), Inches(5.8), Inches(4.8), BG_CARD, ACCENT_GREEN)
    add_text_box(slide, Inches(7.1), Inches(1.95), Inches(5.2), Inches(0.4),
                 "HYPERSPHERE IoT EDGE SOLUTION", font_size=13, color=ACCENT_GREEN, bold=True)
    add_bullet_list(slide, Inches(7.1), Inches(2.5), Inches(5.2), Inches(3.8), [
        "Edge Computing Gateway: Complete ML inference and vector\nmatching execute locally on Raspberry Pi 4/5",
        "Zero-Cloud Architecture: Works offline over local campus\nWi-Fi or LAN - no internet dependency",
        "BYOD Interaction: Faculty/students use personal phones to\nmark attendance - no touchpoints or queue bottlenecks",
    ], font_size=13, color=TEXT_WHITE)

    add_notes(slide, "Present the three major problems with cloud-based biometric attendance, "
              "then contrast with the three IoT edge solutions. Emphasize zero cloud costs, "
              "data sovereignty, and offline resilience.")

    # -- SLIDE 3: System Architecture ----------------------------------
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    add_shape_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.08), ACCENT_BLUE)

    add_text_box(slide, MARGIN, Inches(0.3), CONTENT_W, Inches(0.5),
                 "03  |  SYSTEM ARCHITECTURE", font_size=12, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, MARGIN, Inches(0.8), CONTENT_W, Inches(0.6),
                 "End-to-End IoT Edge System Design",
                 font_size=28, color=TEXT_WHITE, bold=True)

    # Mobile Device Block
    add_shape_rect(slide, Inches(0.6), Inches(2.0), Inches(3.5), Inches(3.5), BG_CARD, ACCENT_CYAN)
    add_text_box(slide, Inches(0.8), Inches(2.1), Inches(3.1), Inches(0.4),
                 "MOBILE SMARTPHONES", font_size=13, color=ACCENT_CYAN, bold=True)
    add_bullet_list(slide, Inches(0.8), Inches(2.6), Inches(3.1), Inches(2.5), [
        "Mobile Web Browser (PWA)",
        "Client-side MediaPipe Vision",
        "Hardware GPS Fix for Geofence",
        "Camera Capture & Blink Detection",
    ], font_size=12, color=TEXT_MUTED)

    # Arrow
    add_text_box(slide, Inches(4.3), Inches(3.3), Inches(1.5), Inches(0.6),
                 "  Local Campus\n    Wi-Fi / REST",
                 font_size=11, color=ACCENT_BLUE, bold=True)
    arrow = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(4.4), Inches(3.8), Inches(1.3), Inches(0.3))
    arrow.fill.solid()
    arrow.fill.fore_color.rgb = ACCENT_BLUE
    arrow.line.fill.background()

    # Raspberry Pi Block
    add_shape_rect(slide, Inches(5.9), Inches(1.6), Inches(3.8), Inches(2.0), BG_CARD, ACCENT_GREEN)
    add_text_box(slide, Inches(6.1), Inches(1.7), Inches(3.4), Inches(0.4),
                 "RASPBERRY PI 4/5 GATEWAY", font_size=13, color=ACCENT_GREEN, bold=True)
    add_bullet_list(slide, Inches(6.1), Inches(2.2), Inches(3.4), Inches(1.2), [
        "Next.js 15 (Edge UI Server)",
        "FastAPI (Async Python ASGI)",
        "Low-Power: 5V / ~7.5W",
    ], font_size=11, color=TEXT_MUTED)

    # ML Pipeline Block
    add_shape_rect(slide, Inches(5.9), Inches(3.9), Inches(3.8), Inches(2.2), BG_CARD, ACCENT_AMBER)
    add_text_box(slide, Inches(6.1), Inches(4.0), Inches(3.4), Inches(0.4),
                 "EMBEDDED ML PIPELINE (ARM64)", font_size=12, color=ACCENT_AMBER, bold=True)
    add_bullet_list(slide, Inches(6.1), Inches(4.5), Inches(3.4), Inches(1.5), [
        "1. SCRFD-2.5G ONNX (Detection)",
        "2. Quality Gating & Affine Align",
        "3. MiniFASNetV2 Anti-Spoofing",
        "4. ArcFace MobileFaceNet (Embed)",
    ], font_size=11, color=TEXT_MUTED)

    # Edge DB Block
    add_shape_rect(slide, Inches(10.2), Inches(2.0), Inches(2.6), Inches(3.5), BG_CARD, ACCENT_BLUE)
    add_text_box(slide, Inches(10.4), Inches(2.1), Inches(2.2), Inches(0.4),
                 "EDGE STORAGE", font_size=13, color=ACCENT_BLUE, bold=True)
    add_bullet_list(slide, Inches(10.4), Inches(2.6), Inches(2.2), Inches(2.5), [
        "SQLite + In-Memory",
        "pgvector HNSW Index",
        "Ray-Casting PiP",
        "103 Building Polygons",
        "Geofence Engine",
    ], font_size=11, color=TEXT_MUTED)

    # Arrow from Pi to DB
    arrow2 = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(9.85), Inches(3.3), Inches(0.3), Inches(0.25))
    arrow2.fill.solid()
    arrow2.fill.fore_color.rgb = ACCENT_BLUE
    arrow2.line.fill.background()

    add_notes(slide, "Walk through the 3-tier architecture: Mobile clients -> Raspberry Pi Edge Gateway -> "
              "Local embedded ML pipeline -> Edge vector DB and geofence engine. "
              "Emphasize zero cloud dependency and local campus Wi-Fi connectivity.")

    # -- SLIDE 4: ML Pipeline & Model Selection ------------------------
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    add_shape_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.08), ACCENT_BLUE)

    add_text_box(slide, MARGIN, Inches(0.3), CONTENT_W, Inches(0.5),
                 "04  |  EMBEDDED ML PIPELINE", font_size=12, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, MARGIN, Inches(0.8), CONTENT_W, Inches(0.6),
                 "Lightweight Model Selection for ARM64 Edge",
                 font_size=28, color=TEXT_WHITE, bold=True)

    # Model table
    table_data = [
        ["Pipeline Stage", "Model", "Parameters", "Memory", "ARM64 Acceleration"],
        ["1. Face Detection", "SCRFD-2.5G (ONNX)", "0.67M", "3.2 MB", "ONNX ARM NEON SIMD"],
        ["2. Alignment", "5-Point Partial Affine", "Analytical", "< 1 KB", "OpenCV ARM Optimized"],
        ["3. Anti-Spoofing", "MiniFASNetV2 (PyTorch)", "0.43M", "1.8 MB", "PyTorch CPU (Quantized)"],
        ["4. Feature Extractor", "ArcFace MobileFaceNet", "1.2M", "13.6 MB", "ONNX Runtime INT8/FP32"],
        ["5. High-Res Alt", "ArcFace ResNet-50", "43.6M", "174 MB", "FP32 (High precision)"],
    ]
    col_widths = [Inches(2.2), Inches(2.8), Inches(1.5), Inches(1.5), Inches(3.0)]
    add_table_slide(slide, MARGIN, Inches(1.8), Inches(11.0), table_data, col_widths, ACCENT_BLUE)

    # Key callout
    add_shape_rect(slide, MARGIN, Inches(5.2), Inches(8), Inches(1.2), BG_CARD, ACCENT_GREEN)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(5.35), Inches(7.4), Inches(0.3),
                 "KEY INSIGHT", font_size=11, color=ACCENT_GREEN, bold=True)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(5.7), Inches(7.4), Inches(0.5),
                 "Total memory footprint: < 25 MB for ALL neural network weights combined!\n"
                 "Fits easily into Raspberry Pi's 4GB/8GB RAM with >90% headroom.",
                 font_size=14, color=TEXT_WHITE, bold=False)

    add_notes(slide, "Walk through each pipeline stage and explain model selection rationale. "
              "Emphasize that ALL models combined use less than 25MB - perfect for RPi edge deployment. "
              "Contrast MobileFaceNet (13.6MB) vs ResNet-50 (174MB) and why MobileFaceNet is the primary choice.")

    # -- SLIDE 5: Mathematical Alignment & Quality ---------------------
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    add_shape_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.08), ACCENT_BLUE)

    add_text_box(slide, MARGIN, Inches(0.3), CONTENT_W, Inches(0.5),
                 "05  |  MATHEMATICAL ALIGNMENT", font_size=12, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, MARGIN, Inches(0.8), CONTENT_W, Inches(0.6),
                 "Quality Gating & 5-Point Affine Normalization",
                 font_size=28, color=TEXT_WHITE, bold=True)

    # Left: Alignment
    add_shape_rect(slide, MARGIN, Inches(1.8), Inches(5.8), Inches(4.8), BG_CARD, ACCENT_BLUE)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(1.95), Inches(5.2), Inches(0.4),
                 "5-POINT AFFINE NORMALIZATION", font_size=13, color=ACCENT_BLUE, bold=True)
    add_bullet_list(slide, MARGIN + Inches(0.3), Inches(2.5), Inches(5.2), Inches(3.5), [
        "Extracts 5 facial anchors: Left Eye, Right Eye,\nNose Tip, Left Mouth, Right Mouth",
        "Maps to ArcFace canonical coordinates DST_PTS:\n[30.29, 51.70], [65.53, 51.50], [48.03, 71.74],\n[33.55, 92.37], [62.73, 92.20]",
        "Eliminates roll angle & perspective distortion",
        "Yields aligned 112x112 crop for embedding extraction",
    ], font_size=12, color=TEXT_MUTED)

    # Right: Quality Guards
    add_shape_rect(slide, Inches(6.8), Inches(1.8), Inches(5.8), Inches(4.8), BG_CARD, ACCENT_AMBER)
    add_text_box(slide, Inches(7.1), Inches(1.95), Inches(5.2), Inches(0.4),
                 "EDGE QUALITY GUARDS", font_size=13, color=ACCENT_AMBER, bold=True)
    add_bullet_list(slide, Inches(7.1), Inches(2.5), Inches(5.2), Inches(3.5), [
        "Laplacian Focus Blur:\nVar(Laplacian) >= 50.0\nRejects blurred captures from moving phones",
        "Luminance Bounds:\nmean_gray in [40.0, 220.0]\nPrevents underlit or overexposed frames",
        "3D Head Pose (solvePnP):\n|yaw| < 30 deg, |pitch| < 25 deg\nRejects extreme angles for accuracy",
    ], font_size=12, color=TEXT_MUTED)

    add_notes(slide, "Explain 5-point affine alignment as a critical preprocessing step. "
              "The DST_PTS canonical coordinates ensure consistent face geometry regardless of capture angle. "
              "Quality guards save CPU cycles by rejecting bad frames before running expensive neural networks.")

    # -- SLIDE 6: Anti-Spoofing ----------------------------------------
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    add_shape_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.08), ACCENT_BLUE)

    add_text_box(slide, MARGIN, Inches(0.3), CONTENT_W, Inches(0.5),
                 "06  |  PRESENTATION ATTACK DEFENSE", font_size=12, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, MARGIN, Inches(0.8), CONTENT_W, Inches(0.6),
                 "MiniFASNetV2 Anti-Spoofing on Edge Hardware",
                 font_size=28, color=TEXT_WHITE, bold=True)

    # Threat card
    add_shape_rect(slide, MARGIN, Inches(1.8), Inches(5.5), Inches(1.5), BG_CARD, ACCENT_RED)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(1.95), Inches(4.9), Inches(0.3),
                 "THE THREAT", font_size=12, color=ACCENT_RED, bold=True)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(2.3), Inches(4.9), Inches(0.8),
                 "Attackers holding up printed photos or replaying face\n"
                 "videos on smartphone screens to spoof biometric verification",
                 font_size=13, color=TEXT_MUTED)

    # Defense card
    add_shape_rect(slide, MARGIN, Inches(3.6), Inches(11.5), Inches(3.0), BG_CARD, ACCENT_GREEN)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(3.75), Inches(11.0), Inches(0.3),
                 "MINIFASNETV2 DEFENSE MECHANISM", font_size=13, color=ACCENT_GREEN, bold=True)
    add_bullet_list(slide, MARGIN + Inches(0.3), Inches(4.2), Inches(5.0), Inches(2.2), [
        "Evaluates 2.7x expanded crop (80x80 RGB) to capture\nperipheral depth gradients & moire patterns",
        "Generates softmax liveness probability:\nP(Live Face) >= 0.40 threshold",
        "Rejects screen replays & printed photos in < 40ms\non ARM Cortex-A72/A76",
    ], font_size=12, color=TEXT_MUTED)

    # Stats
    stats = [("99.12%", "Accuracy"), ("0.88%", "ACER"), ("< 40ms", "Inference"), ("0.43M", "Parameters")]
    for i, (val, label) in enumerate(stats):
        x = Inches(6.5) + i * Inches(1.6)
        add_text_box(slide, x, Inches(4.4), Inches(1.4), Inches(0.5),
                     val, font_size=22, color=ACCENT_GREEN, bold=True, alignment=PP_ALIGN.CENTER)
        add_text_box(slide, x, Inches(4.95), Inches(1.4), Inches(0.3),
                     label, font_size=10, color=TEXT_DIM, alignment=PP_ALIGN.CENTER)

    add_notes(slide, "Explain the presentation attack defense layer. MiniFASNetV2 uses an expanded 2.7x crop "
              "to capture texture artifacts from digital displays (moire patterns) and printed photos. "
              "Achieves 99.12% accuracy on CASIA-SURF benchmark with only 0.43M parameters.")

    # -- SLIDE 7: Latency & Power Profile ------------------------------
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    add_shape_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.08), ACCENT_BLUE)

    add_text_box(slide, MARGIN, Inches(0.3), CONTENT_W, Inches(0.5),
                 "07  |  PERFORMANCE BENCHMARKS", font_size=12, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, MARGIN, Inches(0.8), CONTENT_W, Inches(0.6),
                 "Raspberry Pi Latency Budget, Thermal & Power Profile",
                 font_size=28, color=TEXT_WHITE, bold=True)

    # Latency breakdown table
    latency_data = [
        ["Pipeline Stage", "Duration", "Cumulative"],
        ["Phone Image Capture & Tx", "20 ms", "20 ms"],
        ["SCRFD Face Detection", "42 ms", "62 ms"],
        ["Quality & Affine Alignment", "5 ms", "67 ms"],
        ["MiniFASNetV2 Liveness", "38 ms", "105 ms"],
        ["ArcFace MobileFaceNet Embed", "32 ms", "137 ms"],
        ["Vector Similarity Match", "2 ms", "139 ms"],
    ]
    col_widths_lat = [Inches(3.5), Inches(1.8), Inches(1.8)]
    add_table_slide(slide, MARGIN, Inches(1.7), Inches(7.1), latency_data, col_widths_lat, ACCENT_BLUE)

    # Total latency cards
    add_shape_rect(slide, Inches(8.5), Inches(1.7), Inches(2.2), Inches(1.8), BG_CARD, ACCENT_GREEN)
    add_text_box(slide, Inches(8.6), Inches(1.85), Inches(2.0), Inches(0.3),
                 "RPi 5 TOTAL", font_size=10, color=ACCENT_GREEN, bold=True, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(8.6), Inches(2.3), Inches(2.0), Inches(0.6),
                 "~139ms", font_size=36, color=ACCENT_GREEN, bold=True, alignment=PP_ALIGN.CENTER)

    add_shape_rect(slide, Inches(11.0), Inches(1.7), Inches(2.2), Inches(1.8), BG_CARD, ACCENT_AMBER)
    add_text_box(slide, Inches(11.1), Inches(1.85), Inches(2.0), Inches(0.3),
                 "RPi 4 TOTAL", font_size=10, color=ACCENT_AMBER, bold=True, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(11.1), Inches(2.3), Inches(2.0), Inches(0.6),
                 "~215ms", font_size=36, color=ACCENT_AMBER, bold=True, alignment=PP_ALIGN.CENTER)

    # Power & Thermal card
    add_shape_rect(slide, Inches(8.5), Inches(3.8), Inches(4.7), Inches(2.5), BG_CARD, ACCENT_CYAN)
    add_text_box(slide, Inches(8.7), Inches(3.95), Inches(4.3), Inches(0.3),
                 "HARDWARE POWER & THERMALS", font_size=12, color=ACCENT_CYAN, bold=True)
    add_bullet_list(slide, Inches(8.7), Inches(4.4), Inches(4.3), Inches(1.8), [
        "Power Draw: 5V, 1.5A = ~7.5W\nunder full inference workload",
        "Thermal Equilibrium: 48-54 C\nwith passive aluminum heatsink",
        "No active cooling required for\nsustained inference operation",
    ], font_size=12, color=TEXT_MUTED)

    add_notes(slide, "Break down the end-to-end latency budget for each pipeline stage. "
              "Total verification is ~139ms on Pi 5 and ~215ms on Pi 4. "
              "Highlight the low power draw (7.5W) and stable thermals (48-54C) with passive cooling only.")

    # -- SLIDE 8: Geofencing -------------------------------------------
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    add_shape_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.08), ACCENT_BLUE)

    add_text_box(slide, MARGIN, Inches(0.3), CONTENT_W, Inches(0.5),
                 "08  |  CAMPUS GEOFENCING", font_size=12, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, MARGIN, Inches(0.8), CONTENT_W, Inches(0.6),
                 "Hierarchical GPS Geofencing & Location Verification",
                 font_size=28, color=TEXT_WHITE, bold=True)

    # Tier cards
    tiers = [
        ("TIER 1: INSIDE BUILDING", "Ray-Casting Point-in-Polygon (PiP)\nchecks GPS against 103 OSM building\npolygons in < 1ms", ACCENT_GREEN, Inches(0.6)),
        ("TIER 2: CAMPUS GROUNDS", "Verifies user is within the outer\ncampus perimeter boundary polygon", ACCENT_AMBER, Inches(4.6)),
        ("TIER 3: OFF CAMPUS", "Rejects or flags attendance record\nfor manual administrator review", ACCENT_RED, Inches(8.6)),
    ]
    for label, desc, color, x in tiers:
        add_shape_rect(slide, x, Inches(1.8), Inches(3.6), Inches(2.5), BG_CARD, color)
        add_text_box(slide, x + Inches(0.2), Inches(1.95), Inches(3.2), Inches(0.4),
                     label, font_size=12, color=color, bold=True)
        add_text_box(slide, x + Inches(0.2), Inches(2.5), Inches(3.2), Inches(1.5),
                     desc, font_size=13, color=TEXT_MUTED)

    # GPS enforcement card
    add_shape_rect(slide, MARGIN, Inches(4.8), Inches(11.5), Inches(1.5), BG_CARD, ACCENT_BLUE)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(4.95), Inches(10.9), Inches(0.3),
                 "HARDWARE GPS ENFORCEMENT", font_size=13, color=ACCENT_BLUE, bold=True)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(5.4), Inches(10.9), Inches(0.7),
                 "Rejects IP-based location fixes (accuracy radius > 100m).\n"
                 "Requires true mobile device hardware GNSS/GPS fixes for secure geoverification.\n"
                 "Jordan Curve Theorem (Ray-Casting PiP) evaluates 103 polygons in < 1.2ms on ARM.",
                 font_size=13, color=TEXT_MUTED)

    add_notes(slide, "Explain the 3-tier hierarchical geofencing system. "
              "Tier 1 uses the Jordan Curve Theorem (ray-casting PiP) to check if GPS coordinates "
              "fall inside any of the 103 campus building polygons from OpenStreetMap. "
              "Hardware GPS enforcement ensures IP-based spoofing is blocked.")

    # -- SLIDE 9: Demo Workflow ----------------------------------------
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    add_shape_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.08), ACCENT_BLUE)

    add_text_box(slide, MARGIN, Inches(0.3), CONTENT_W, Inches(0.5),
                 "09  |  LIVE DEMO", font_size=12, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, MARGIN, Inches(0.8), CONTENT_W, Inches(0.6),
                 "Proof-of-Concept Demonstration Workflow",
                 font_size=28, color=TEXT_WHITE, bold=True)

    steps = [
        ("1", "MOBILE ACCESS", "Open http://<edge-ip>:3000\nfrom phone browser", ACCENT_CYAN),
        ("2", "ROLE-BASED AUTH", "Login as faculty (hodece)\nor admin (director, kv)", ACCENT_BLUE),
        ("3", "FACE CAPTURE", "User captures face\nBlink detected as liveness", ACCENT_GREEN),
        ("4", "EDGE PROCESSING", "Pi processes: Detection,\nAnti-Spoof, Embedding", ACCENT_AMBER),
        ("5", "RESULT", "Attendance confirmed with\nbuilding name in < 200ms", ACCENT_GREEN),
    ]
    for i, (num, title, desc, color) in enumerate(steps):
        x = MARGIN + i * Inches(2.4)
        add_shape_rect(slide, x, Inches(1.8), Inches(2.2), Inches(2.8), BG_CARD, color)
        # Step number circle
        circle = slide.shapes.add_shape(MSO_SHAPE.OVAL, x + Inches(0.8), Inches(2.0), Inches(0.5), Inches(0.5))
        circle.fill.solid()
        circle.fill.fore_color.rgb = color
        circle.line.fill.background()
        # Number in circle
        tf = circle.text_frame
        tf.paragraphs[0].text = num
        tf.paragraphs[0].font.size = Pt(18)
        tf.paragraphs[0].font.color.rgb = TEXT_WHITE
        tf.paragraphs[0].font.bold = True
        tf.paragraphs[0].alignment = PP_ALIGN.CENTER
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE

        add_text_box(slide, x + Inches(0.15), Inches(2.7), Inches(1.9), Inches(0.3),
                     title, font_size=11, color=color, bold=True, alignment=PP_ALIGN.CENTER)
        add_text_box(slide, x + Inches(0.15), Inches(3.1), Inches(1.9), Inches(1.0),
                     desc, font_size=11, color=TEXT_MUTED, alignment=PP_ALIGN.CENTER)

    # Anti-spoof demo card
    add_shape_rect(slide, MARGIN, Inches(5.0), Inches(5.5), Inches(1.5), BG_CARD, ACCENT_RED)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(5.15), Inches(4.9), Inches(0.3),
                 "LIVE ANTI-SPOOFING DEFENSE", font_size=12, color=ACCENT_RED, bold=True)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(5.5), Inches(4.9), Inches(0.7),
                 "Displaying a face photo on another phone triggers instant\n"
                 "rejection: \"Spoof detected: Liveness score 0.12\"",
                 font_size=13, color=TEXT_MUTED)

    # Telemetry card
    add_shape_rect(slide, Inches(6.5), Inches(5.0), Inches(6.0), Inches(1.5), BG_CARD, ACCENT_CYAN)
    add_text_box(slide, Inches(6.8), Inches(5.15), Inches(5.4), Inches(0.3),
                 "ADMIN EDGE TELEMETRY", font_size=12, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, Inches(6.8), Inches(5.5), Inches(5.4), Inches(0.7),
                 "Shows CPU temperature, RAM usage (only 280MB used),\n"
                 "multi-embedding drift logs, and real-time inference metrics",
                 font_size=13, color=TEXT_MUTED)

    add_notes(slide, "Walk through the 5-step live demo workflow. "
              "Demonstrate the anti-spoofing defense by showing a photo on another phone. "
              "Show the admin telemetry dashboard with CPU temp and RAM metrics from the Pi.")

    # -- SLIDE 10: Conclusion & Roadmap --------------------------------
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    add_shape_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.08), ACCENT_BLUE)

    add_text_box(slide, MARGIN, Inches(0.3), CONTENT_W, Inches(0.5),
                 "10  |  CONCLUSION & ROADMAP", font_size=12, color=ACCENT_CYAN, bold=True)
    add_text_box(slide, MARGIN, Inches(0.8), CONTENT_W, Inches(0.6),
                 "Review 2 Milestones & Review 3 Target",
                 font_size=28, color=TEXT_WHITE, bold=True)

    # Review 2 achievements
    add_shape_rect(slide, MARGIN, Inches(1.8), Inches(5.8), Inches(4.0), BG_CARD, ACCENT_GREEN)
    add_text_box(slide, MARGIN + Inches(0.3), Inches(1.95), Inches(5.2), Inches(0.4),
                 "REVIEW 2 MILESTONES ACCOMPLISHED", font_size=13, color=ACCENT_GREEN, bold=True)
    add_bullet_list(slide, MARGIN + Inches(0.3), Inches(2.5), Inches(5.2), Inches(3.0), [
        "Complete IoT edge architecture designed\nand validated on Raspberry Pi hardware",
        "Multi-stage embedded ML pipeline optimized\nfor ARM64 with sub-200ms turnaround",
        "Working proof-of-concept running with\nmobile phone interaction over local Wi-Fi",
        "4 neural networks totaling < 25MB memory\nfootprint with 99.12% anti-spoof accuracy",
        "103 campus building geofence polygons\nwith < 1.2ms PiP evaluation",
    ], font_size=12, color=TEXT_MUTED)

    # Review 3 targets
    add_shape_rect(slide, Inches(6.8), Inches(1.8), Inches(5.8), Inches(4.0), BG_CARD, ACCENT_AMBER)
    add_text_box(slide, Inches(7.1), Inches(1.95), Inches(5.2), Inches(0.4),
                 "REVIEW 3 TARGET (OCTOBER 22, 2026)", font_size=13, color=ACCENT_AMBER, bold=True)
    add_bullet_list(slide, Inches(7.1), Inches(2.5), Inches(5.2), Inches(3.0), [
        "Custom 3D-printed Raspberry Pi kiosk\nenclosure with OLED status display & buzzer",
        "Offline sync buffer with MQTT telemetry\nfor multi-device mesh communication",
        "Academic poster presentation layout\nand final viva defense preparation",
        "Extended evaluation with 50+ concurrent\nusers on campus for stress testing",
        "INT8 quantized model optimization\nfor further latency reduction on Pi 4",
    ], font_size=12, color=TEXT_MUTED)

    # Thank you bar
    add_shape_rect(slide, MARGIN, Inches(6.2), CONTENT_W, Inches(0.8), BG_CARD, ACCENT_BLUE)
    add_text_box(slide, MARGIN, Inches(6.3), CONTENT_W, Inches(0.5),
                 "Thank You  |  Questions & Discussion",
                 font_size=18, color=TEXT_WHITE, bold=True, alignment=PP_ALIGN.CENTER)

    add_notes(slide, "Summarize the Review 2 achievements and present the Review 3 roadmap. "
              "Invite questions from the evaluation panel. Key talking points: "
              "IoT edge architecture, sub-200ms latency, zero cloud dependency, "
              "and the upcoming 3D-printed kiosk hardware integration.")

    # -- Save ----------------------------------------------------------
    output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               "REVIEW_2_PRESENTATION.pptx")
    prs.save(output_path)
    print(f"[OK] Presentation saved to: {output_path}")
    print(f"     Slides: {len(prs.slides)} slides")
    print(f"     Format: 16:9 Widescreen (13.333\" x 7.5\")")
    return output_path


if __name__ == "__main__":
    generate_presentation()
