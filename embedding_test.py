import cv2
import numpy as np
import json
import hashlib
import os

# --- Configuration ---
# Change this to False when you have your actual `mobilefacenet.onnx` file downloaded
USE_MOCK_MODEL = False
ONNX_MODEL_PATH = "w600k_r50.onnx" # (Change this to whatever the file is named)
EMBEDDING_SIZE = 512

class MockMobileFaceNet:
    """A simulated model to validate the pipeline without the actual ONNX file."""
    def __init__(self, embedding_size=512):
        self.embedding_size = embedding_size
        
    def get_embedding(self, face_image):
        # Generate a deterministic embedding based on the image content (using a hash).
        # This ensures that passing the identical image twice returns the exact same vector.
        image_hash = int(hashlib.md5(face_image.tobytes()).hexdigest(), 16)
        np.random.seed(image_hash % (2**32))
        embedding = np.random.randn(self.embedding_size).astype(np.float32)
        # Normalize to simulate typical face embedding behavior (L2 norm = 1)
        embedding = embedding / np.linalg.norm(embedding)
        return embedding

def load_real_model(model_path):
    try:
        import onnxruntime as ort
        session = ort.InferenceSession(model_path)
        return session
    except ImportError:
        print("Error: onnxruntime is not installed. Run 'pip install onnxruntime'")
        exit()
    except Exception as e:
        print(f"Error loading ONNX model: {e}")
        print("Please ensure you have placed 'mobilefacenet.onnx' in this directory.")
        exit()

def get_real_embedding(session, face_image):
    # Standard preprocessing for ONNX MobileFaceNet
    # 1. Convert BGR to RGB
    face_image = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
    # 2. Normalize to [-1, 1]
    face_image = (face_image / 255.0 - 0.5) / 0.5
    # 3. Transpose from HWC (112, 112, 3) to CHW (3, 112, 112)
    face_image = np.transpose(face_image, (2, 0, 1))
    # 4. Add batch dimension: (1, 3, 112, 112)
    face_image = np.expand_dims(face_image, axis=0).astype(np.float32)
    
    # Run inference
    input_name = session.get_inputs()[0].name
    embedding = session.run(None, {input_name: face_image})[0]
    
    # Flatten from (1, 512) to (512,) and normalize
    embedding = embedding.flatten()
    embedding = embedding / np.linalg.norm(embedding)
    return embedding

def main():
    print("--- Workflow 3: MobileFaceNet Embedding Test ---\n")
    
    # Generate a test 112x112 face (simulating output from Workflow 2)
    print("Generating a test 112x112 face...")
    face_image_a = np.random.randint(0, 256, (112, 112, 3), dtype=np.uint8)
    # We create a perfect copy to test consistency
    face_image_b = face_image_a.copy()
    
    # 1. Generate Embeddings
    if USE_MOCK_MODEL:
        print("Using MOCK MobileFaceNet model (Set USE_MOCK_MODEL=False to use real ONNX).")
        model = MockMobileFaceNet(EMBEDDING_SIZE)
        embedding_a = model.get_embedding(face_image_a)
        embedding_b = model.get_embedding(face_image_b)
    else:
        print(f"Loading real ONNX model from {ONNX_MODEL_PATH}...")
        session = load_real_model(ONNX_MODEL_PATH)
        embedding_a = get_real_embedding(session, face_image_a)
        embedding_b = get_real_embedding(session, face_image_b)

    # 2. Print Output
    print("\n[Embedding Output]")
    print(f"Shape: {embedding_a.shape}")
    print(f"First 10 values:\n{np.round(embedding_a[:10], 3).tolist()}")

    # 3. Validation Check
    is_close = np.allclose(embedding_a, embedding_b, atol=1e-5)
    print("\n[Validation Check]")
    print(f"Comparing Embedding A and Embedding B for the same face:")
    print(f"np.allclose(A, B) -> {is_close}")

    # 4. Save Embedding to JSON
    save_path = "keerthi_embedding.json"
    print(f"\n[Save & Load Test]")
    # Convert numpy array to standard python list for json serialization
    with open(save_path, 'w') as f:
        json.dump(embedding_a.tolist(), f)
    print(f"Saved embedding to {save_path}")

    # 5. Load and Verify
    with open(save_path, 'r') as f:
        loaded_list = json.load(f)
    loaded_embedding = np.array(loaded_list, dtype=np.float32)
    
    print(f"Loaded embedding shape: {loaded_embedding.shape}")

    # Pass Criteria Summary
    print("\n--- Pass Criteria ---")
    print(f"Face Input                {'[PASS]' if face_image_a.shape == (112, 112, 3) else '[FAIL]'}")
    print(f"Embedding Generated       {'[PASS]' if embedding_a is not None else '[FAIL]'}")
    print(f"Shape Correct             {'[PASS]' if loaded_embedding.shape == (EMBEDDING_SIZE,) else '[FAIL]'}")
    print(f"Can Save/Load Vector      {'[PASS]' if np.allclose(embedding_a, loaded_embedding) else '[FAIL]'}")

if __name__ == "__main__":
    main()
