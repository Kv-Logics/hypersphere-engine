import cv2
import numpy as np
import mediapipe as mp

# Initialize MediaPipe Face Detection
mp_face_detection = mp.solutions.face_detection
mp_drawing = mp.solutions.drawing_utils

# Standard reference points for a 112x112 aligned face.
# These points ensure the eyes are horizontal and the nose is centered.
# Coordinates are: [x, y]
dst_pts = np.array([
    [38.2946, 51.6963], # Person's Right Eye (Left side of the image)
    [73.5318, 51.5014], # Person's Left Eye (Right side of the image)
    [56.0252, 71.7366]  # Nose Tip (Centered horizontally)
], dtype=np.float32)

cap = cv2.VideoCapture(0)

# Initialize the face detection model
with mp_face_detection.FaceDetection(
    model_selection=0, min_detection_confidence=0.5) as face_detection:
    
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        exit()
        
    print("Webcam opened. Press 'q' to exit.")
    
    while cap.isOpened():
        success, image = cap.read()
        if not success:
            continue

        # Convert the BGR image to RGB
        image.flags.writeable = False
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Process the image and find faces
        results = face_detection.process(image_rgb)
        image.flags.writeable = True

        aligned_face = None
        
        if results.detections:
            # For simplicity, we just take the first detected face
            detection = results.detections[0]
            
            # Extract image dimensions
            h, w, _ = image.shape
            keypoints = detection.location_data.relative_keypoints
            
            # Get the exact pixel coordinates of the eyes and nose
            # Keypoint indices in MediaPipe FaceDetection:
            # 0: Right Eye, 1: Left Eye, 2: Nose Tip, 3: Mouth Center, 4: Right Ear, 5: Left Ear
            right_eye = (keypoints[0].x * w, keypoints[0].y * h)
            left_eye = (keypoints[1].x * w, keypoints[1].y * h)
            nose_tip = (keypoints[2].x * w, keypoints[2].y * h)
            
            # Create an array of our source points
            src_pts = np.array([right_eye, left_eye, nose_tip], dtype=np.float32)
            
            # Compute the affine transformation matrix (Rotation + Translation + Scaling)
            # estimateAffinePartial2D computes a transform with 4 degrees of freedom
            tform, _ = cv2.estimateAffinePartial2D(src_pts, dst_pts)
            
            if tform is not None:
                # Apply the transformation to warp the original image into the 112x112 aligned format
                aligned_face = cv2.warpAffine(image, tform, (112, 112))
            
            # Draw face detection annotations on the original image for visualization
            mp_drawing.draw_detection(image, detection)

        # Show the original frame (flipped horizontally for a mirror effect)
        cv2.imshow('Original Video Feed', cv2.flip(image, 1))
        
        # Show the cropped and aligned face
        if aligned_face is not None:
            # We also flip the aligned face so it moves like a mirror along with the original feed
            cv2.imshow('Aligned Face (112x112)', cv2.flip(aligned_face, 1))
            
        # Exit if 'q' is pressed
        if cv2.waitKey(5) & 0xFF == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()
