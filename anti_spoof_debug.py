import cv2
import numpy as np
import mediapipe as mp
import torch
import torch.nn.functional as F
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'SilentFace', 'src'))
from model_lib.MiniFASNet import MiniFASNetV2

MODEL_PATH = "2.7_80x80_MiniFASNetV2.pth"
BBOX_EXPANSION = 2.7

def get_expanded_bbox(xmin, ymin, box_w, box_h, img_w, img_h, scale=2.7):
    center_x = xmin + box_w / 2
    center_y = ymin + box_h / 2
    new_w, new_h = box_w * scale, box_h * scale
    new_xmin = max(0, int(center_x - new_w / 2))
    new_ymin = max(0, int(center_y - new_h / 2))
    new_xmax = min(img_w, int(center_x + new_w / 2))
    new_ymax = min(img_h, int(center_y + new_h / 2))
    return new_xmin, new_ymin, new_xmax, new_ymax

def debug_inference(model, device, image, tag=""):
    print(f"\n--- Running Debug Inference on {tag} ---")
    h, w, _ = image.shape
    
    mp_face_detection = mp.solutions.face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = mp_face_detection.process(image_rgb)
    
    if not results.detections:
        print("No face detected.")
        return None
        
    detection = results.detections[0]
    bbox = detection.location_data.relative_bounding_box
    xmin, ymin = int(bbox.xmin * w), int(bbox.ymin * h)
    box_w, box_h = int(bbox.width * w), int(bbox.height * h)
    
    exp_xmin, exp_ymin, exp_xmax, exp_ymax = get_expanded_bbox(xmin, ymin, box_w, box_h, w, h, scale=BBOX_EXPANSION)
    spoof_crop = image[exp_ymin:exp_ymax, exp_xmin:exp_xmax]
    
    if spoof_crop.size == 0:
        return None

    cv2.imwrite(f"debug_crop_{tag}.jpg", spoof_crop)
    print(f"[Checklist 5] Saved debug_crop_{tag}.jpg. Size before resize: {spoof_crop.shape}")

    # Resize
    face_image = cv2.resize(spoof_crop, (80, 80))
    print(f"[Checklist 2] Model Input Size: {face_image.shape}")
    
    # Preprocessing
    img_tensor = face_image.astype(np.float32)
    img_tensor = np.transpose(img_tensor, (2, 0, 1))
    img_tensor = np.expand_dims(img_tensor, axis=0)
    
    print(f"[Checklist 4] Tensor Value Range: Min={img_tensor.min()}, Max={img_tensor.max()}")
    print(f"[Checklist 3] Color Format is BGR (direct from cv2/camera)")
    
    input_tensor = torch.FloatTensor(img_tensor).to(device)
    with torch.no_grad():
        output = model(input_tensor)
        probs = F.softmax(output, dim=1).cpu().numpy()[0]
        
    print(f"[Checklist 1/6] Raw Output Logits: {output.cpu().numpy()[0]}")
    print(f"[Checklist 1/6] Probabilities: Class 0: {probs[0]:.4f} | Class 1: {probs[1]:.4f} | Class 2: {probs[2]:.4f}")
    
    pred_idx = np.argmax(probs)
    print(f"[Checklist 1] Highest Class: {pred_idx}")
    
    confidence = probs[1]
    prediction = "REAL" if confidence >= 0.85 else "FAKE"
    print(f"[{tag}] Prediction: {prediction} (Real Confidence: {confidence:.4f})")
    return prediction, confidence

def main():
    print("Loading PyTorch model...")
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    model = MiniFASNetV2(conv6_kernel=(5, 5)).to(device)
    state_dict = torch.load(MODEL_PATH, map_location=device)
    new_state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
    model.load_state_dict(new_state_dict)
    model.eval()

    # Create Debug Report automatically for the images we already have!
    print("=========================================")
    print("      ANTI-SPOOF DEBUG REPORT RUN        ")
    print("=========================================")
    print("Model: MiniFASNetV2 (2.7_80x80)")
    
    for attack_type in ["real_face", "phone_attack", "monitor_attack"]:
        img_path = os.path.join("results", f"{attack_type}.png")
        if os.path.exists(img_path):
            img = cv2.imread(img_path)
            debug_inference(model, device, img, tag=attack_type)

    print("\n--- LIVE WEBCAM TEST ---")
    print("Press 'c' to capture a test frame. Press 'q' to quit.")
    cap = cv2.VideoCapture(0)
    
    while True:
        ret, frame = cap.read()
        if not ret: break
        
        display = frame.copy()
        cv2.putText(display, "Press 'C' to Test Frame", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 2)
        cv2.imshow("Debug Webcam", display)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('c'):
            debug_inference(model, device, frame, tag="live_capture")
        elif key == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
