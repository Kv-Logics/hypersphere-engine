import cv2
import numpy as np
import mediapipe as mp
import onnxruntime as ort
import os
import sys
import json

# Append the cloned repo to sys.path so we can import its PyTorch models
sys.path.append(os.path.join(os.path.dirname(__file__), 'SilentFace', 'src'))
try:
    import torch
    import torch.nn.functional as F
    from model_lib.MiniFASNet import MiniFASNetV2
except ImportError:
    print("Error: PyTorch or SilentFace repo not found.")
    print("Make sure 'pip install torch torchvision' has finished and the SilentFace repo is cloned!")
    sys.exit(1)

# --- Configuration ---
ANTISPOOF_MODEL_PATH = "2.7_80x80_MiniFASNetV2.pth"
RECOGNITION_MODEL_PATH = "w600k_r50.onnx"
REGISTERED_FACE_PATH = "registered_face.json"

ANTISPOOF_THRESHOLD = 0.85
MATCH_THRESHOLD = 0.45

# Standard reference points for a 112x112 aligned face.
dst_pts = np.array([
    [38.2946, 51.6963], # Person's Right Eye 
    [73.5318, 51.5014], # Person's Left Eye 
    [56.0252, 71.7366]  # Nose Tip
], dtype=np.float32)

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def get_expanded_bbox(xmin, ymin, box_w, box_h, img_w, img_h, scale=2.7):
    """Expands bounding box for Anti-Spoofing background context."""
    center_x = xmin + box_w / 2
    center_y = ymin + box_h / 2
    new_w, new_h = box_w * scale, box_h * scale
    new_xmin = max(0, int(center_x - new_w / 2))
    new_ymin = max(0, int(center_y - new_h / 2))
    new_xmax = min(img_w, int(center_x + new_w / 2))
    new_ymax = min(img_h, int(center_y + new_h / 2))
    return new_xmin, new_ymin, new_xmax, new_ymax

def get_antispoof_score(model, device, face_image):
    """Runs PyTorch MiniFASNet for liveness detection."""
    face_image = cv2.resize(face_image, (80, 80))
    image = face_image.astype(np.float32)
    image = np.transpose(image, (2, 0, 1))
    image = np.expand_dims(image, axis=0)
    input_tensor = torch.FloatTensor(image).to(device)
    with torch.no_grad():
        output = model(input_tensor)
        probs = F.softmax(output, dim=1).cpu().numpy()[0]
    return float(probs[1]) # Class 1 is REAL in MiniFASNet

def get_face_embedding(session, face_image):
    """Runs ONNX Face Recognition model to extract a 512-D vector."""
    face_image = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
    face_image = (face_image / 255.0 - 0.5) / 0.5
    face_image = np.transpose(face_image, (2, 0, 1))
    face_image = np.expand_dims(face_image, axis=0).astype(np.float32)
    input_name = session.get_inputs()[0].name
    embedding = session.run(None, {input_name: face_image})[0].flatten()
    return embedding / np.linalg.norm(embedding)

def calculate_cosine_similarity(emb1, emb2):
    norm1, norm2 = np.linalg.norm(emb1), np.linalg.norm(emb2)
    if norm1 == 0 or norm2 == 0: return 0.0
    return np.dot(emb1, emb2) / (norm1 * norm2)

# ==========================================
# MAIN PIPELINE
# ==========================================

def main():
    print("\n[1/4] Loading Registration Template...")
    try:
        with open(REGISTERED_FACE_PATH, 'r') as f:
            base_embedding = np.array(json.load(f), dtype=np.float32)
    except Exception as e:
        print(f"Error loading {REGISTERED_FACE_PATH}: {e}")
        return

    print("[2/4] Loading ONNX Recognition Model...")
    try:
        recog_session = ort.InferenceSession(RECOGNITION_MODEL_PATH)
    except Exception as e:
        print(f"Error loading {RECOGNITION_MODEL_PATH}: {e}")
        return

    print("[3/4] Loading PyTorch Anti-Spoof Model...")
    try:
        device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        antispoof_model = MiniFASNetV2(conv6_kernel=(5, 5)).to(device)
        state_dict = torch.load(ANTISPOOF_MODEL_PATH, map_location=device)
        new_state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
        antispoof_model.load_state_dict(new_state_dict)
        antispoof_model.eval()
    except Exception as e:
        print(f"Error loading {ANTISPOOF_MODEL_PATH}: {e}")
        return

    print("[4/4] Starting Video Stream...")
    cap = cv2.VideoCapture(0)
    
    print("\n=============================================")
    print("      WORKFLOW 7: FINAL SYSTEM ONLINE        ")
    print("=============================================")
    print("Pipeline Active: Detection -> Anti-Spoof -> Alignment -> Recognition")
    print("Press 'q' to exit.")
    
    with mp.solutions.face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5) as face_detection:
        while cap.isOpened():
            success, image = cap.read()
            if not success: continue

            display_image = cv2.flip(image, 1)
            h, w, _ = image.shape
            
            image.flags.writeable = False
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = face_detection.process(image_rgb)
            image.flags.writeable = True
            
            if results.detections:
                for detection in results.detections:
                    # --- 1. MEDIA PIPE DETECTION ---
                    bbox = detection.location_data.relative_bounding_box
                    xmin, ymin = int(bbox.xmin * w), int(bbox.ymin * h)
                    box_w, box_h = int(bbox.width * w), int(bbox.height * h)
                    
                    # --- 2. LAYER 1: ANTI-SPOOF CHECK ---
                    exp_xmin, exp_ymin, exp_xmax, exp_ymax = get_expanded_bbox(xmin, ymin, box_w, box_h, w, h, scale=BBOX_EXPANSION)
                    spoof_crop = image[exp_ymin:exp_ymax, exp_xmin:exp_xmax]
                    
                    if spoof_crop.size == 0: continue
                    real_score = get_antispoof_score(antispoof_model, device, spoof_crop)
                    
                    flip_xmin = max(0, w - exp_xmax)
                    flip_xmax = min(w, w - exp_xmin)
                    
                    if real_score < ANTISPOOF_THRESHOLD:
                        # REJECT: It is a spoof. We skip recognition entirely to save compute!
                        color = (0, 0, 255) # Red
                        label = f"SPOOF DETECTED ({real_score:.2f})"
                        cv2.rectangle(display_image, (flip_xmin, exp_ymin), (flip_xmax, exp_ymax), color, 3)
                    else:
                        # --- 3. LAYER 2: FACE RECOGNITION ---
                        # Only reached if the face is REAL
                        keypoints = detection.location_data.relative_keypoints
                        src_pts = np.array([
                            (keypoints[0].x * w, keypoints[0].y * h), # Right Eye
                            (keypoints[1].x * w, keypoints[1].y * h), # Left Eye
                            (keypoints[2].x * w, keypoints[2].y * h)  # Nose Tip
                        ], dtype=np.float32)
                        
                        tform, _ = cv2.estimateAffinePartial2D(src_pts, dst_pts)
                        if tform is not None:
                            aligned_face = cv2.warpAffine(image, tform, (112, 112))
                            live_embedding = get_face_embedding(recog_session, aligned_face)
                            similarity = calculate_cosine_similarity(base_embedding, live_embedding)
                            
                            if similarity >= MATCH_THRESHOLD:
                                color = (0, 255, 0) # Green
                                label = f"ACCESS GRANTED ({similarity:.2f})"
                            else:
                                color = (0, 165, 255) # Orange
                                label = f"UNKNOWN PERSON ({similarity:.2f})"
                                
                            cv2.rectangle(display_image, (flip_xmin, exp_ymin), (flip_xmax, exp_ymax), color, 3)
                        else:
                            label = "ALIGNMENT FAILED"
                            color = (0, 0, 255)

                    # --- DRAW UI ---
                    text_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
                    cv2.rectangle(display_image, (flip_xmin, exp_ymin - text_size[1] - 10), 
                                  (flip_xmin + text_size[0], exp_ymin), color, -1)
                    cv2.putText(display_image, label, (flip_xmin, exp_ymin - 5), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

            cv2.imshow('Final System: Anti-Spoof + Recognition', display_image)
            if cv2.waitKey(5) & 0xFF == ord('q'): break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
