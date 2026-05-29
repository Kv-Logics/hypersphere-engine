import cv2
import numpy as np
import json
import mediapipe as mp
import onnxruntime as ort
import time

# --- Configuration ---
ONNX_MODEL_PATH = "w600k_r50.onnx"
OUTPUT_FILE = "registered_face.json"
MAX_FRAMES = 35
FRAMES_PER_STAGE = 5
TRANSITION_DELAY_SEC = 2.0

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

def get_prompt(progress):
    """Returns dynamic instructions based on current frame progress."""
    stage = progress // FRAMES_PER_STAGE
    if stage == 0:
        return "Straight"
    elif stage == 1:
        return "Left 15 deg"
    elif stage == 2:
        return "Right 15 deg"
    elif stage == 3:
        return "Up"
    elif stage == 4:
        return "Down"
    elif stage == 5:
        return "Smile"
    else:
        return "Neutral"

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
        
    print("\n=======================================================")
    print(" ADVANCED REGISTRATION: TEMPLATE GENERATION ACTIVATED  ")
    print("=======================================================")
    print(f"We will capture {MAX_FRAMES} frames to build a robust template.")
    print("You will have 2 seconds between each stage to adjust your pose.")
    print("Press 's' when you are ready to begin the capture sequence.")
    print("=======================================================\n")

    embeddings = []
    is_capturing = False
    
    current_stage = 0
    transition_start_time = 0.0
    
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
            
            # --- Status UI ---
            in_transition = False
            
            if not is_capturing:
                cv2.putText(display_image, "Press 's' to START capture", (20, 40), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
            else:
                progress = len(embeddings)
                target_stage = progress // FRAMES_PER_STAGE
                
                # If we entered a new stage, trigger the 2-second transition pause
                if target_stage > current_stage:
                    current_stage = target_stage
                    transition_start_time = time.time()
                
                prompt = get_prompt(progress)
                
                # Check if we are currently in the 2-second waiting period
                time_since_transition = time.time() - transition_start_time
                if time_since_transition < TRANSITION_DELAY_SEC and progress < MAX_FRAMES:
                    in_transition = True
                    remaining = TRANSITION_DELAY_SEC - time_since_transition
                    cv2.putText(display_image, f"Get Ready... {remaining:.1f}s", (20, 160), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                
                # Show current instruction
                cv2.putText(display_image, f"Instruction: {prompt}", (20, 40), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
                # Show progress bar text
                cv2.putText(display_image, f"Progress: {progress}/{MAX_FRAMES}", (20, 80), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                            
                # Draw progress bar
                bar_width = int((progress / MAX_FRAMES) * 300)
                cv2.rectangle(display_image, (20, 100), (320, 120), (100, 100, 100), 2)
                cv2.rectangle(display_image, (20, 100), (20 + bar_width, 120), (0, 255, 0), -1)

            if results.detections:
                best_detection = results.detections[0]
                
                # Extract and draw bounding box
                bbox = best_detection.location_data.relative_bounding_box
                xmin = int(bbox.xmin * w)
                ymin = int(bbox.ymin * h)
                box_w = int(bbox.width * w)
                box_h = int(bbox.height * h)
                xmax = xmin + box_w
                ymax = ymin + box_h
                
                flip_xmin = max(0, w - xmax)
                flip_xmax = min(w, w - xmin)
                ymin = max(0, ymin)
                ymax = min(h, ymax)
                
                # Box is green if actively capturing frames, orange if waiting/transitioning
                color = (0, 255, 0) if (is_capturing and not in_transition) else (255, 165, 0)
                cv2.rectangle(display_image, (flip_xmin, ymin), (flip_xmax, ymax), color, 2)
                
                # Only capture if active, face is present, and NOT in transition
                if is_capturing and not in_transition and len(embeddings) < MAX_FRAMES:
                    keypoints = best_detection.location_data.relative_keypoints
                    right_eye = (keypoints[0].x * w, keypoints[0].y * h)
                    left_eye = (keypoints[1].x * w, keypoints[1].y * h)
                    nose_tip = (keypoints[2].x * w, keypoints[2].y * h)
                    
                    src_pts = np.array([right_eye, left_eye, nose_tip], dtype=np.float32)
                    tform, _ = cv2.estimateAffinePartial2D(src_pts, dst_pts)
                    
                    if tform is not None:
                        aligned_face = cv2.warpAffine(image, tform, (112, 112))
                        embedding = get_face_embedding(session, aligned_face)
                        embeddings.append(embedding)
                        
                        # Add a small delay between captures to ensure varying micro-expressions
                        time.sleep(0.15) 

            cv2.imshow('Advanced Template Registration', display_image)
            
            key = cv2.waitKey(5) & 0xFF
            if key == ord('q'):
                print("Registration cancelled.")
                break
            elif key == ord('s') and not is_capturing:
                is_capturing = True
                current_stage = 0
                transition_start_time = time.time() # Start the 2-second countdown for the first prompt
                print("Capture sequence started...")

            # End sequence when target is reached
            if len(embeddings) >= MAX_FRAMES:
                cv2.putText(display_image, "PROCESSING TEMPLATE...", (20, 200), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                cv2.imshow('Advanced Template Registration', display_image)
                cv2.waitKey(100) # Render the processing text
                break

    cap.release()
    cv2.destroyAllWindows()

    if len(embeddings) == MAX_FRAMES:
        print("\nProcessing embeddings...")
        embeddings_array = np.array(embeddings)
        
        # 1. Average the embeddings
        avg_embedding = np.mean(embeddings_array, axis=0)
        
        # 2. L2 Normalize the averaged vector
        final_embedding = avg_embedding / np.linalg.norm(avg_embedding)
        
        # 3. Save final template
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(final_embedding.tolist(), f)
            
        print(f"SUCCESS: Robust template generated from {MAX_FRAMES} frames.")
        print(f"Saved to '{OUTPUT_FILE}'.")
        print("Your similarity scores should now be much more stable (0.80+) across different lighting and poses!")

if __name__ == "__main__":
    main()
