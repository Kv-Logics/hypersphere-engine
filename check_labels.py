import cv2
import numpy as np
import mediapipe as mp
import torch
import torch.nn.functional as F
import os
import sys

# Ensure SilentFace is imported
sys.path.append(os.path.join(os.path.dirname(__file__), 'SilentFace', 'src'))
from model_lib.MiniFASNet import MiniFASNetV2

MODEL_PATH = "2.7_80x80_MiniFASNetV2.pth"

def get_expanded_bbox(xmin, ymin, box_w, box_h, img_w, img_h, scale=2.7):
    center_x = xmin + box_w / 2
    center_y = ymin + box_h / 2
    new_w, new_h = box_w * scale, box_h * scale
    new_xmin = max(0, int(center_x - new_w / 2))
    new_ymin = max(0, int(center_y - new_h / 2))
    new_xmax = min(img_w, int(center_x + new_w / 2))
    new_ymax = min(img_h, int(center_y + new_h / 2))
    return new_xmin, new_ymin, new_xmax, new_ymax

def main():
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    model = MiniFASNetV2(conv6_kernel=(5, 5)).to(device)
    state_dict = torch.load(MODEL_PATH, map_location=device)
    new_state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
    model.load_state_dict(new_state_dict)
    model.eval()

    mp_face_detection = mp.solutions.face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5)

    for filename in ['real_face.png', 'phone_attack.png', 'monitor_attack.png', 'fake_attack.png']:
        image_path = os.path.join("results", filename)
        if not os.path.exists(image_path): continue
            
        image = cv2.imread(image_path)
        h, w, _ = image.shape
        
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = mp_face_detection.process(image_rgb)
        if not results.detections:
            continue
            
        detection = results.detections[0]
        bbox = detection.location_data.relative_bounding_box
        xmin, ymin = int(bbox.xmin * w), int(bbox.ymin * h)
        box_w, box_h = int(bbox.width * w), int(bbox.height * h)
        
        exp_xmin, exp_ymin, exp_xmax, exp_ymax = get_expanded_bbox(xmin, ymin, box_w, box_h, w, h, scale=2.7)
        spoof_crop = image[exp_ymin:exp_ymax, exp_xmin:exp_xmax]
        
        face_image = cv2.resize(spoof_crop, (80, 80))
        img_tensor = face_image.astype(np.float32)
        img_tensor = np.transpose(img_tensor, (2, 0, 1))
        img_tensor = np.expand_dims(img_tensor, axis=0)
        
        input_tensor = torch.FloatTensor(img_tensor).to(device)
        with torch.no_grad():
            output = model(input_tensor)
            probs = F.softmax(output, dim=1).cpu().numpy()[0]
            
        print(f"[{filename}] Probs:")
        print(f"Class 0: {probs[0]:.4f} | Class 1: {probs[1]:.4f} | Class 2: {probs[2]:.4f}")

if __name__ == '__main__':
    main()
