import numpy as np
import json
import os

def calculate_cosine_similarity(embedding1, embedding2):
    """
    Calculates the cosine similarity between two embeddings.
    Since our embeddings are already L2 normalized in Workflow 3, 
    the cosine similarity is mathematically identical to the dot product.
    Formula: dot(A, B) / (norm(A) * norm(B))
    """
    dot_product = np.dot(embedding1, embedding2)
    norm1 = np.linalg.norm(embedding1)
    norm2 = np.linalg.norm(embedding2)
    
    # Avoid division by zero
    if norm1 == 0 or norm2 == 0:
        return 0.0
        
    similarity = dot_product / (norm1 * norm2)
    return similarity

def main():
    print("--- Workflow 4: Cosine Similarity Test ---\n")

    # Threshold for matching 
    # (Typically for ArcFace/MobileFaceNet, a threshold between 0.4 and 0.6 is used)
    MATCH_THRESHOLD = 0.45 
    print(f"Using Threshold: {MATCH_THRESHOLD}\n")

    try:
        # Load the saved embedding from Workflow 3 to act as "Face A"
        with open("keerthi_embedding.json", 'r') as f:
            embedding_a = np.array(json.load(f), dtype=np.float32)
        print("Successfully loaded Embedding A from 'keerthi_embedding.json'")
    except FileNotFoundError:
        print("Error: Could not find 'keerthi_embedding.json'. Run Workflow 3 first to generate it.")
        return

    # ---------------------------------------------------------
    # Scenario 1: Same Face (Should MATCH)
    # We use the exact same embedding to simulate capturing the same person again
    # ---------------------------------------------------------
    embedding_b_same = embedding_a.copy()
    
    similarity_same = calculate_cosine_similarity(embedding_a, embedding_b_same)
    
    print("\n--- Scenario 1: Same Face ---")
    print(f"Cosine Similarity Score : {similarity_same:.4f}")
    if similarity_same >= MATCH_THRESHOLD:
        print("Result                  : [MATCH]")
    else:
        print("Result                  : [NO MATCH]")

    # ---------------------------------------------------------
    # Scenario 2: Different Face (Should NO MATCH)
    # We generate a completely random embedding to simulate a stranger
    # ---------------------------------------------------------
    np.random.seed(42) # Seed for reproducibility
    embedding_b_diff = np.random.randn(*embedding_a.shape).astype(np.float32)
    embedding_b_diff = embedding_b_diff / np.linalg.norm(embedding_b_diff) # L2 normalize
    
    similarity_diff = calculate_cosine_similarity(embedding_a, embedding_b_diff)

    print("\n--- Scenario 2: Different Face ---")
    print(f"Cosine Similarity Score : {similarity_diff:.4f}")
    if similarity_diff >= MATCH_THRESHOLD:
        print("Result                  : [MATCH]")
    else:
        print("Result                  : [NO MATCH]")


if __name__ == "__main__":
    main()
