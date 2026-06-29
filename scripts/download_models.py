import os
import urllib.request
import sys

models = {
    "w600k_r50.onnx": "https://huggingface.co/maze/faceX/resolve/main/w600k_r50.onnx",
    "2.7_80x80_MiniFASNetV2.pth": "https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/master/resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth",
    "scrfd_2.5g_bnkps.onnx": "https://huggingface.co/laichaoyi/MixupModels/resolve/main/scrfd_2.5g_bnkps.onnx"
}

def download_progress(block_num, block_size, total_size):
    read_so_far = block_num * block_size
    if total_size > 0:
        percent = min(100.0, read_so_far * 100.0 / total_size)
        s = f"\rDownloading... {percent:5.1f}% [{read_so_far // (1024*1024)}MB / {total_size // (1024*1024)}MB]"
        sys.stdout.write(s)
        sys.stdout.flush()
    else:
        sys.stdout.write(f"\rRead {read_so_far // 1024} KB")
        sys.stdout.flush()

def main():
    # Make sure we run in root directory of project
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root_dir)
    print(f"Working directory: {os.getcwd()}")

    # Ensure models directory exists
    os.makedirs("models", exist_ok=True)

    for filename, url in models.items():
        dest_path = os.path.join("models", filename)
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1024 * 1024:
            print(f"✓ {dest_path} already exists and looks valid. Skipping download.")
            continue

        print(f"Downloading {dest_path}...")
        try:
            # Add user agent header to prevent HTTP 403 Forbidden from Hugging Face
            opener = urllib.request.build_opener()
            opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')]
            urllib.request.install_opener(opener)
            
            urllib.request.urlretrieve(url, dest_path, download_progress)
            print(f"\n✓ Successfully downloaded {dest_path}!")
        except Exception as e:
            print(f"\n✗ Failed to download {dest_path}: {e}")
            if os.path.exists(dest_path):
                os.remove(dest_path)

if __name__ == "__main__":
    main()
