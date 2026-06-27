import cv2
import numpy as np
import json
import mediapipe as mp
import onnxruntime as ort

# --- Configuration ---
ONNX_MODEL_PATH = "w600k_r50.onnx"
OUTPUT_FILE = "keerthi_embedding.json"

# Standard reference points for a 112x112 aligned face.
dst_pts = np.array([
    [38.2946, 51.6963], # Person's Right Eye 
    [73.5318, 51.5014], # Person's Left Eye 
    [56.0252, 71.7366]  # Nose Tip
], dtype=np.float32)

def get_face_embedding(session, face_image):
    face_image = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
    face_image = (face_image / 255.0 - 0.5) / 0.5
    face_image = np.transpose(face_image, (2, 0, 1))
    face_image = np.expand_dims(face_image, axis=0).astype(np.float32)
    
    input_name = session.get_inputs()[0].name
    embedding = session.run(None, {input_name: face_image})[0]
    
    embedding = embedding.flatten()
    embedding = embedding / np.linalg.norm(embedding)
    return embedding

def main():
    print(f"Loading ONNX model from {ONNX_MODEL_PATH}...")
    try:
        session = ort.InferenceSession(ONNX_MODEL_PATH)
    except Exception as e:
        print(f"Error loading ONNX model: {e}")
        return

    mp_face_detection = mp.solutions.face_detection

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return
        
    print("\n=============================================")
    print("      FACE REGISTRATION MODE ACTIVATED       ")
    print("=============================================")
    print("- Look at the camera.")
    print("- Press 's' to SNAP and register your face.")
    print("- Press 'q' to cancel and quit.")
    print("=============================================\n")

    with mp_face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5) as face_detection:
        while cap.isOpened():
            success, image = cap.read()
            if not success:
                continue

            display_image = cv2.flip(image, 1)
            
            image.flags.writeable = False
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = face_detection.process(image_rgb)
            image.flags.writeable = True
            
            h, w, _ = image.shape
            best_detection = None
            
            if results.detections:
                # Target the first face detected
                best_detection = results.detections[0]
                
                # Draw bounding box for visualization
                bbox = best_detection.location_data.relative_bounding_box
                xmin = int(bbox.xmin * w)
                ymin = int(bbox.ymin * h)
                box_w = int(bbox.width * w)
                box_h = int(bbox.height * h)
                xmax = xmin + box_w
                ymax = ymin + box_h
                
                flip_xmin = w - xmax
                flip_xmax = w - xmin
                flip_xmin = max(0, flip_xmin)
                flip_xmax = min(w, flip_xmax)
                ymin = max(0, ymin)
                ymax = min(h, ymax)
                
                cv2.rectangle(display_image, (flip_xmin, ymin), (flip_xmax, ymax), (255, 165, 0), 2)
                cv2.putText(display_image, "Ready - Press 's' to Register", (flip_xmin, ymin - 10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 165, 0), 2)

            cv2.imshow('Face Registration', display_image)
            
            key = cv2.waitKey(5) & 0xFF
            if key == ord('q'):
                print("Registration cancelled.")
                break
            elif key == ord('s'):
                if best_detection is None:
                    print("No face detected! Please ensure your face is in the frame and try again.")
                else:
                    print("Processing face...")
                    keypoints = best_detection.location_data.relative_keypoints
                    right_eye = (keypoints[0].x * w, keypoints[0].y * h)
                    left_eye = (keypoints[1].x * w, keypoints[1].y * h)
                    nose_tip = (keypoints[2].x * w, keypoints[2].y * h)
                    
                    src_pts = np.array([right_eye, left_eye, nose_tip], dtype=np.float32)
                    tform, _ = cv2.estimateAffinePartial2D(src_pts, dst_pts)
                    
                    if tform is not None:
                        aligned_face = cv2.warpAffine(image, tform, (112, 112))
                        embedding = get_face_embedding(session, aligned_face)
                        
                        # Save to JSON
                        with open(OUTPUT_FILE, 'w') as f:
                            json.dump(embedding.tolist(), f)
                            
                        print(f"\nSUCCESS: Face registered and saved to {OUTPUT_FILE}!")
                        print("You can now run 'python live_recognition.py' to test it live.")
                        
                        # Show the registered 112x112 crop briefly
                        cv2.imshow('Registered Face Crop', cv2.flip(aligned_face, 1))
                        cv2.waitKey(2000) # Show for 2 seconds
                        break
                    else:
                        print("Failed to align face. Please try again.")

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
