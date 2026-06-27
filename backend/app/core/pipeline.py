import os
import cv2
import numpy as np
import logging
import hashlib
import sys

logger = logging.getLogger(__name__)

# Standard reference points for a 112x112 aligned face.
DST_PTS = np.array([
    [38.2946, 51.6963], # Person's Right Eye
    [73.5318, 51.5014], # Person's Left Eye
    [56.0252, 71.7366]  # Nose Tip
], dtype=np.float32)

class FacePipeline:
    def __init__(self, recognition_model_path="w600k_r50.onnx", antispoof_model_path="2.7_80x80_MiniFASNetV2.pth"):
        self.recog_path = recognition_model_path
        self.as_path = antispoof_model_path
        
        self.recog_session = None
        self.antispoof_model = None
        self.device = None
        self.mp_face_detection = None
        self.face_cascade = None
        self.detector_type = "mediapipe"
        
        # Flags (mock mode is completely disabled)
        self.use_mock_recog = False
        self.use_mock_liveness = False
        self.use_mock_detection = False
        
        self.load_detection()
        self.load_recognition()
        self.load_liveness()

    def load_detection(self):
        try:
            import mediapipe as mp
            self.mp_face_detection = mp.solutions.face_detection
            self.use_mock_detection = False
            self.detector_type = "mediapipe"
            logger.info("MediaPipe Face Detection loaded successfully.")
        except Exception as e:
            raise RuntimeError(f"CRITICAL: Failed to load MediaPipe Face Detection: {e}")

    def load_recognition(self):
        path = self.recog_path
        if not os.path.exists(path):
            project_root_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", self.recog_path)
            if os.path.exists(project_root_path):
                path = project_root_path
            else:
                raise FileNotFoundError(f"CRITICAL: ONNX Recognition model weight file not found at '{self.recog_path}'")

        try:
            import onnxruntime as ort
            self.recog_session = ort.InferenceSession(path)
            logger.info(f"ONNX Recognition Model loaded successfully from {path}.")
        except Exception as e:
            raise RuntimeError(f"CRITICAL: Failed to load ONNX Recognition Model: {e}")

    def load_liveness(self):
        path = self.as_path
        if not os.path.exists(path):
            project_root_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", self.as_path)
            if os.path.exists(project_root_path):
                path = project_root_path
            else:
                raise FileNotFoundError(f"CRITICAL: PyTorch Anti-spoof Model weight file not found at '{self.as_path}'")

        try:
            import torch
            
            src_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "SilentFace", "src")
            if src_dir not in sys.path:
                sys.path.append(src_dir)
                
            from model_lib.MiniFASNet import MiniFASNetV2
            
            self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
            model = MiniFASNetV2(conv6_kernel=(5, 5)).to(self.device)
            
            state_dict = torch.load(path, map_location=self.device)
            new_state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
            model.load_state_dict(new_state_dict)
            model.eval()
            
            self.antispoof_model = model
            logger.info(f"PyTorch Anti-spoof Model loaded successfully from {path} (Device: {self.device}).")
        except Exception as e:
            raise RuntimeError(f"CRITICAL: Failed to load PyTorch Anti-spoof Model: {e}")

    def get_expanded_bbox(self, xmin, ymin, box_w, box_h, img_w, img_h, scale=2.7):
        center_x = xmin + box_w / 2
        center_y = ymin + box_h / 2
        new_w, new_h = box_w * scale, box_h * scale
        new_xmin = max(0, int(center_x - new_w / 2))
        new_ymin = max(0, int(center_y - new_h / 2))
        new_xmax = min(img_w, int(center_x + new_w / 2))
        new_ymax = min(img_h, int(center_y + new_h / 2))
        return new_xmin, new_ymin, new_xmax, new_ymax

    def process_image(self, image_bytes: bytes):
        """Processes raw bytes of query image. Returns aligned face crop, embedding, liveness score, quality score, and a list of feedback messages."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Failed to decode image bytes.")
            
        h, w, _ = image.shape
        aligned_face = None
        spoof_crop = None
        feedback = []
        
        if self.mp_face_detection is None:
            raise RuntimeError("MediaPipe face detector is not loaded.")
        
        with self.mp_face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5) as face_detection:
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = face_detection.process(image_rgb)
            
            if not results.detections:
                raise ValueError("No face detected in the image.")
                
            detection = results.detections[0]
            bbox = detection.location_data.relative_bounding_box
            xmin, ymin = int(bbox.xmin * w), int(bbox.ymin * h)
            box_w, box_h = int(bbox.width * w), int(bbox.height * h)
            
            if box_w < w * 0.15:
                feedback.append("Please step closer to the camera.")
            elif box_w > w * 0.8:
                feedback.append("Please step back slightly.")
            
            exp_xmin, exp_ymin, exp_xmax, exp_ymax = self.get_expanded_bbox(xmin, ymin, box_w, box_h, w, h, scale=2.7)
            spoof_crop = image[exp_ymin:exp_ymax, exp_xmin:exp_xmax]
            
            keypoints = detection.location_data.relative_keypoints
            src_pts = np.array([
                (keypoints[0].x * w, keypoints[0].y * h),
                (keypoints[1].x * w, keypoints[1].y * h),
                (keypoints[2].x * w, keypoints[2].y * h)
            ], dtype=np.float32)
            
            right_eye_x = keypoints[0].x * w
            left_eye_x = keypoints[1].x * w
            nose_x = keypoints[2].x * w
            
            d_right = abs(nose_x - right_eye_x)
            d_left = abs(nose_x - left_eye_x)
            if d_left > 0 and d_right > 0:
                asymmetry = abs(d_right - d_left) / (d_right + d_left)
                if asymmetry > 0.30:
                    feedback.append("Turn to face camera directly.")
            
            tform, _ = cv2.estimateAffinePartial2D(src_pts, DST_PTS)
            if tform is None:
                raise ValueError("Face alignment failed.")
            aligned_face = cv2.warpAffine(image, tform, (112, 112))
                
        gray = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        quality_score = min(1.0, blur_score / 200.0)
        
        if quality_score < 0.35:
            feedback.append("Image too blurry.")
            
        mean_brightness = np.mean(gray)
        if mean_brightness < 50:
            feedback.append("Lighting too dark. Step into a well-lit area.")
        elif mean_brightness > 220:
            feedback.append("Lighting too bright. Avoid strong backlighting.")

        if self.recog_session is None:
            raise RuntimeError("CRITICAL: ONNX Recognition session is not loaded.")
            
        face_image = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2RGB)
        face_image = (face_image / 255.0 - 0.5) / 0.5
        face_image = np.transpose(face_image, (2, 0, 1))
        face_image = np.expand_dims(face_image, axis=0).astype(np.float32)
        
        input_name = self.recog_session.get_inputs()[0].name
        embedding = self.recog_session.run(None, {input_name: face_image})[0].flatten()
        embedding = embedding / np.linalg.norm(embedding)

        if self.antispoof_model is None:
            raise RuntimeError("CRITICAL: PyTorch Anti-spoof model is not loaded.")
        if spoof_crop is None or spoof_crop.size == 0:
            raise ValueError("Invalid spoof crop for liveness estimation.")
            
        import torch
        import torch.nn.functional as F
        
        face_image = cv2.resize(spoof_crop, (80, 80))
        image_data = face_image.astype(np.float32)
        image_data = np.transpose(image_data, (2, 0, 1))
        image_data = np.expand_dims(image_data, axis=0)
        
        input_tensor = torch.FloatTensor(image_data).to(self.device)
        with torch.no_grad():
            output = self.antispoof_model(input_tensor)
            probs = F.softmax(output, dim=1).cpu().numpy()[0]
        liveness_score = float(probs[1])

        return aligned_face, embedding, liveness_score, quality_score, feedback

# Singleton instance of FacePipeline
from app.config import settings
face_pipeline = FacePipeline(
    recognition_model_path=settings.RECOGNITION_MODEL_PATH,
    antispoof_model_path=settings.ANTISPOOF_MODEL_PATH
)
