import cv2
import numpy as np
import mediapipe as mp
import os
import sys

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
MODEL_PATH = "2.7_80x80_MiniFASNetV2.pth"
INPUT_SIZE = (80, 80)
BBOX_EXPANSION = 2.7

def get_expanded_bbox(xmin, ymin, box_w, box_h, img_w, img_h, scale=2.7):
    """
    Anti-Spoofing networks evaluate the background context (e.g., edges of phones, paper) 
    in addition to the face. A tightly cropped face will always fail.
    """
    center_x = xmin + box_w / 2
    center_y = ymin + box_h / 2
    
    new_w = box_w * scale
    new_h = box_h * scale
    
    new_xmin = max(0, int(center_x - new_w / 2))
    new_ymin = max(0, int(center_y - new_h / 2))
    new_xmax = min(img_w, int(center_x + new_w / 2))
    new_ymax = min(img_h, int(center_y + new_h / 2))
    
    return new_xmin, new_ymin, new_xmax, new_ymax

def load_model():
    # MiniFASNetV2 for 80x80 input utilizes a 5x5 convolution kernel at the end
    model = MiniFASNetV2(conv6_kernel=(5, 5))
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    model.to(device)
    
    # Load PyTorch state dict
    state_dict = torch.load(MODEL_PATH, map_location=device)
    
    # Strip the 'module.' prefix if the model was saved using DataParallel
    new_state_dict = {}
    for k, v in state_dict.items():
        name = k.replace("module.", "")
        new_state_dict[name] = v
        
    model.load_state_dict(new_state_dict)
    model.eval()
    return model, device

def get_antispoof_score(model, device, face_image):
    face_image = cv2.resize(face_image, INPUT_SIZE)
    # Convert image to float32 and transpose from HWC to CHW as PyTorch expects
    image = face_image.astype(np.float32)
    image = np.transpose(image, (2, 0, 1))
    image = np.expand_dims(image, axis=0)
    
    input_tensor = torch.FloatTensor(image).to(device)
    
    with torch.no_grad():
        output = model(input_tensor)
        probs = F.softmax(output, dim=1).cpu().numpy()[0]
        
    # Official MiniFASNet architecture outputs 3 classes: 
    # Class 0: Spoof (Printed Paper/2D)
    # Class 1: Real Face (Bonafide)
    # Class 2: Spoof (Screen/Replay/3D)
    # Therefore, the real score is at index 1.
    real_score = probs[1]
    return float(real_score)

def main():
    if not os.path.exists("results"):
        os.makedirs("results")
        
    print(f"Loading Anti-Spoof PyTorch model from {MODEL_PATH}...")
    try:
        model, device = load_model()
    except Exception as e:
        print(f"Failed to load PyTorch model: {e}")
        return

    mp_face_detection = mp.solutions.face_detection

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return
        
    print("\n=============================================")
    print("      WORKFLOW 6: ANTI-SPOOF TESTING         ")
    print("=============================================")
    print("- Press '1' to capture Test A (Real Face)")
    print("- Press '2' to capture Test B (Fake Attack)")
    print("- Press 'q' to save report and exit")
    print("=============================================\n")

    results_data = {
        "Real Face": {"Prediction": "N/A", "Confidence": "N/A"},
        "Fake Attack": {"Prediction": "N/A", "Confidence": "N/A"}
    }

    with mp_face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5) as face_detection:
        while cap.isOpened():
            success, image = cap.read()
            if not success:
                continue

            display_image = cv2.flip(image, 1)
            
            image.flags.writeable = False
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            mp_results = face_detection.process(image_rgb)
            image.flags.writeable = True
            
            h, w, _ = image.shape
            
            current_real_score = None
            
            if mp_results.detections:
                detection = mp_results.detections[0]
                
                bbox = detection.location_data.relative_bounding_box
                xmin = int(bbox.xmin * w)
                ymin = int(bbox.ymin * h)
                box_w = int(bbox.width * w)
                box_h = int(bbox.height * h)
                
                # Expand box by 2.7x for MiniFASNet background context
                exp_xmin, exp_ymin, exp_xmax, exp_ymax = get_expanded_bbox(xmin, ymin, box_w, box_h, w, h, scale=BBOX_EXPANSION)
                face_crop = image[exp_ymin:exp_ymax, exp_xmin:exp_xmax]
                
                if face_crop.size > 0:
                    real_score = get_antispoof_score(model, device, face_crop)
                    is_real = real_score >= 0.85
                    
                    current_real_score = real_score
                    current_label = f"REAL ({real_score:.2f})" if is_real else f"FAKE ({(1.0 - real_score):.2f})"
                    current_color = (0, 255, 0) if is_real else (0, 0, 255)
                    
                    # Flip coordinates for mirrored display image
                    flip_xmin = max(0, w - exp_xmax)
                    flip_xmax = min(w, w - exp_xmin)
                    
                    cv2.rectangle(display_image, (flip_xmin, exp_ymin), (flip_xmax, exp_ymax), current_color, 3)
                    
                    text_size = cv2.getTextSize(current_label, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)[0]
                    cv2.rectangle(display_image, (flip_xmin, exp_ymin - text_size[1] - 10), 
                                  (flip_xmin + text_size[0], exp_ymin), current_color, -1)
                    cv2.putText(display_image, current_label, (flip_xmin, exp_ymin - 5), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

            # Draw Instructions HUD
            cv2.putText(display_image, "1: Real | 2: Fake | q: Quit", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

            cv2.imshow('MiniFASNet Anti-Spoof Test', display_image)
            
            key = cv2.waitKey(5) & 0xFF
            
            if key == ord('q'):
                break
            elif key in [ord('1'), ord('2')] and current_real_score is not None:
                is_real = current_real_score >= 0.85
                pred_text = "REAL" if is_real else "FAKE"
                
                if key == ord('1'):
                    name = "Real Face"
                    filename = "real_face.png"
                elif key == ord('2'):
                    name = "Fake Attack"
                    filename = "fake_attack.png"
                    
                cv2.imwrite(os.path.join("results", filename), display_image)
                results_data[name]["Prediction"] = pred_text
                results_data[name]["Confidence"] = f"{current_real_score:.4f}"
                print(f"Captured {name}: {pred_text} ({current_real_score:.2f}) -> Saved to results/{filename}")

    cap.release()
    cv2.destroyAllWindows()

    # Generate the requested text report
    report_path = os.path.join("results", "test_results.txt")
    with open(report_path, "w") as f:
        f.write("Anti-Spoof Test Report\n")
        f.write("========================\n\n")
        
        for test_name, data in results_data.items():
            f.write(f"{test_name}:\n")
            f.write(f"Prediction: {data['Prediction']}\n")
            f.write(f"Confidence: {data['Confidence']}\n\n")
            
    print(f"\nTest Report successfully generated at: {report_path}")

if __name__ == "__main__":
    main()
