import os
import cv2
import numpy as np
import logging
import threading
from app.config import settings
from app.core.scrfd import SCRFDetector

logger = logging.getLogger(__name__)

# Standard 5-point reference points for a 112x112 aligned face (ArcFace standard).
DST_PTS = np.array([
    [30.2946, 51.6963], # Person's Right Eye center
    [65.5318, 51.5014], # Person's Left Eye center
    [48.0252, 71.7366], # Nose Tip
    [33.5493, 92.3655], # Person's Right Mouth Corner
    [62.7299, 92.2041]  # Person's Left Mouth Corner
], dtype=np.float32)

# 3D canonical reference model for frontal face pose estimation (generic proportions)
FACE_3D_MODEL = np.array([
    [-30.0,  32.0, -10.0],  # Right eye
    [ 30.0,  32.0, -10.0],  # Left eye
    [  0.0,   0.0,   0.0],  # Nose
    [-25.0, -28.0,  -5.0],  # Right mouth
    [ 25.0, -28.0,  -5.0]   # Left mouth
], dtype=np.float64)

class FacePipeline:
    def __init__(self, 
                 detection_model_path=None,
                 recognition_model_path=None, 
                 antispoof_model_path=None):
                 
        self.det_path = detection_model_path or settings.DETECTION_MODEL_PATH
        self.recog_path = recognition_model_path or settings.RECOGNITION_MODEL_PATH
        self.as_path = antispoof_model_path or settings.ANTISPOOF_MODEL_PATH
        
        self.det_model = None
        self.recog_session = None
        self.antispoof_model = None
        self.device = None
        
        # PyTorch requires an explicit lock for concurrent execution, ONNX does not
        self._liveness_lock = threading.Lock()
        
        self.load_detection()
        self.load_recognition()
        self.load_liveness()

    def load_detection(self):
        path = self.det_path
        if not os.path.exists(path):
            project_root_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", self.det_path)
            if os.path.exists(project_root_path):
                path = project_root_path
            else:
                raise FileNotFoundError(f"CRITICAL: SCRFD Face Detection model weight file not found at '{self.det_path}'")
        try:
            self.det_model = SCRFDetector(model_file=path, det_thresh=settings.DETECTION_THRESHOLD)
            logger.info(f"SCRFD Face Detector loaded successfully from {path}.")
        except Exception as e:
            raise RuntimeError(f"CRITICAL: Failed to load SCRFD Face Detector: {e}")

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
            self.recog_session = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
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
            from app.core.liveness.MiniFASNet import MiniFASNetV2
            
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

    def process_image(self, image_bytes: bytes, is_enrollment: bool = False):
        """
        Processes raw bytes of query image.
        Returns aligned face crop, embedding, liveness score, quality score, and a list of feedback messages.
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Failed to decode image bytes.")
            
        h, w, _ = image.shape
        feedback = []
        
        # 1. Run SCRFD Detection
        bboxes, kpss = self.det_model.detect(image)
        if bboxes.shape[0] == 0:
            raise ValueError("No face detected in the image.")
            
        # Filter detections by detection threshold
        valid_indices = [i for i in range(bboxes.shape[0]) if bboxes[i, 4] >= settings.DETECTION_THRESHOLD]
        if not valid_indices:
            raise ValueError("No face detected with high confidence.")
            
        # Select largest face
        best_idx = max(valid_indices, key=lambda i: (bboxes[i, 2] - bboxes[i, 0]) * (bboxes[i, 3] - bboxes[i, 1]))
        bbox = bboxes[best_idx]
        landmarks_2d = kpss[best_idx]
        
        x1, y1, x2, y2, det_score = bbox
        box_w = x2 - x1
        box_h = y2 - y1
        
        # 2. Frame boundary positioning checks
        if box_w < w * 0.08:
            feedback.append("Please step closer to the camera.")
        elif box_w > w * 0.8:
            feedback.append("Please step back slightly.")
            
        if box_w < 80 or box_h < 80:
            feedback.append("Please move closer to the camera (face size too small).")
            
        # 3. Expansion crop for liveness model
        exp_xmin, exp_ymin, exp_xmax, exp_ymax = self.get_expanded_bbox(x1, y1, box_w, box_h, w, h, scale=settings.BBOX_EXPANSION)
        spoof_crop = image[exp_ymin:exp_ymax, exp_xmin:exp_xmax]
        
        # 4. Face alignment
        tform, _ = cv2.estimateAffinePartial2D(landmarks_2d.astype(np.float32), DST_PTS)
        if tform is None:
            raise ValueError("Face alignment failed.")
        aligned_face = cv2.warpAffine(image, tform, (112, 112))
        
        # 5. Pose Estimation via SolvePnP
        landmarks_2d_double = landmarks_2d.astype(np.float64)
        focal_length = w
        camera_matrix = np.array([
            [focal_length, 0, w / 2],
            [0, focal_length, h / 2],
            [0, 0, 1]
        ], dtype=np.float64)
        
        _, rvec, tvec = cv2.solvePnP(FACE_3D_MODEL, landmarks_2d_double, camera_matrix, None, flags=cv2.SOLVEPNP_ITERATIVE)
        rmat, _ = cv2.Rodrigues(rvec)
        
        # Extract Euler angles (yaw, pitch, roll)
        sy = np.sqrt(rmat[0, 0] * rmat[0, 0] + rmat[1, 0] * rmat[1, 0])
        singular = sy < 1e-6
        if not singular:
            x_rot = np.arctan2(rmat[2, 1], rmat[2, 2])
            y_rot = np.arctan2(-rmat[2, 0], sy)
            z_rot = np.arctan2(rmat[1, 0], rmat[0, 0])
        else:
            x_rot = np.arctan2(-rmat[1, 2], rmat[1, 1])
            y_rot = np.arctan2(-rmat[2, 0], sy)
            z_rot = 0
            
        pitch = np.degrees(x_rot)
        yaw = np.degrees(y_rot)
        roll = np.degrees(z_rot)
        
        # 6. Apply dynamic quality gates & threshold configurations
        max_yaw = 20.0 if is_enrollment else 35.0
        max_pitch = 15.0 if is_enrollment else 30.0
        max_roll = 15.0 if is_enrollment else 25.0
        min_quality = 0.50 if is_enrollment else 0.35
        
        # Check poses
        if abs(yaw) > max_yaw:
            feedback.append(f"Turn to face camera directly (yaw: {abs(yaw):.1f}° exceeds {max_yaw}°).")
        if abs(pitch) > max_pitch:
            feedback.append(f"Look directly at the camera (pitch: {abs(pitch):.1f}° exceeds {max_pitch}°).")
        if abs(roll) > max_roll:
            feedback.append(f"Please keep your head level (roll: {abs(roll):.1f}° exceeds {max_roll}°).")
            
        # Quality score calculations
        gray = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2GRAY)
        
        # Blur check (Laplacian variance normalized to 112x112 baseline)
        blur_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        quality_score = min(1.0, blur_var / 100.0)  # Normalized base threshold
        
        if quality_score < min_quality:
            feedback.append(f"Image too blurry (quality: {quality_score:.2f} below {min_quality:.2f}).")
            
        # Contrast check (Michelson contrast)
        gray_min = float(np.min(gray))
        gray_max = float(np.max(gray))
        contrast = (gray_max - gray_min) / (gray_max + gray_min + 1e-5)
        if contrast < 0.15:
            feedback.append(f"Image contrast is too low ({contrast:.2f} below 0.15).")
            
        # Illumination brightness check (Histogram spread std)
        mean_brightness = np.mean(gray)
        std_brightness = np.std(gray)
        if mean_brightness < 50 or std_brightness < 25:
            feedback.append("Lighting too dark. Step into a well-lit area.")
        elif mean_brightness > 220:
            feedback.append("Lighting too bright. Avoid strong backlighting.")
            
        # Resolution check
        res_ratio = box_w / 112.0
        if res_ratio < 0.75:
            feedback.append("Image resolution is too low for reliable matching.")
            
        # 7. Run Face Recognition model
        if self.recog_session is None:
            raise RuntimeError("CRITICAL: ONNX Recognition session is not loaded.")
            
        face_img_rgb = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2RGB)
        face_img_norm = (face_img_rgb / 255.0 - 0.5) / 0.5
        face_img_trans = np.transpose(face_img_norm, (2, 0, 1))
        face_img_batch = np.expand_dims(face_img_trans, axis=0).astype(np.float32)
        
        recog_input_name = self.recog_session.get_inputs()[0].name
        # ONNX inference does not use a lock as it is thread-safe
        embedding = self.recog_session.run(None, {recog_input_name: face_img_batch})[0].flatten()
        
        # 8. Embedding Quality Norm Gate (Calibrated)
        raw_norm = float(np.linalg.norm(embedding))
        if raw_norm < settings.EMBEDDING_QUALITY_THRESHOLD:
            feedback.append(f"Face embedding quality too low for reliable matching (norm: {raw_norm:.2f} below {settings.EMBEDDING_QUALITY_THRESHOLD:.2f}).")
            
        # Normalize the final embedding vector
        embedding = embedding / (raw_norm + 1e-5)

        # 9. Run Liveness/Anti-Spoof model
        if self.antispoof_model is None:
            raise RuntimeError("CRITICAL: PyTorch Anti-spoof model is not loaded.")
        if spoof_crop is None or spoof_crop.size == 0:
            raise ValueError("Invalid spoof crop for liveness estimation.")
            
        import torch
        import torch.nn.functional as F
        
        liveness_input = cv2.resize(spoof_crop, (80, 80))
        liveness_data = liveness_input.astype(np.float32)
        liveness_trans = np.transpose(liveness_data, (2, 0, 1))
        liveness_batch = np.expand_dims(liveness_trans, axis=0)
        
        liveness_tensor = torch.FloatTensor(liveness_batch).to(self.device)
        
        # PyTorch requires an explicit lock around forward calls to prevent thread overlap
        with self._liveness_lock:
            with torch.no_grad():
                output = self.antispoof_model(liveness_tensor)
                probs = F.softmax(output, dim=1).cpu().numpy()[0]
        liveness_score = float(probs[1])

        return aligned_face, embedding, liveness_score, quality_score, feedback

# Instantiate a single FacePipeline instance
face_pipeline = FacePipeline(
    detection_model_path=settings.DETECTION_MODEL_PATH,
    recognition_model_path=settings.RECOGNITION_MODEL_PATH,
    antispoof_model_path=settings.ANTISPOOF_MODEL_PATH
)
