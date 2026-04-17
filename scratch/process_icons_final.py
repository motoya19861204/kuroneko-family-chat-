import os
from PIL import Image

SRC_DIR = r"d:\04_ゲーム\kuroneko-family-chat\icon"
DEST_DIR = r"d:\04_ゲーム\kuroneko-family-chat\public\icons\neko"

if not os.path.exists(DEST_DIR):
    os.makedirs(DEST_DIR)

MAPPING = {
    "Neko-default.jpg": "default.png",
    "Neko-ikari.png": "angry.png",
    "Neko-Niyari.jpg": "grin.png",
    "Neko-Kanasii.jpg": "sad.png",
    "Neko-bikkuri.png": "surprised.png",
    "Neko-akire.jpg": "bored.png",
    "Neko-yorokobi.png": "happy.png",
    "Neko-up.jpg": "gentle.png",
}

def process_image_with_padding(src_path, dest_path):
    with Image.open(src_path) as img:
        # アルファチャンネル（透明）を考慮
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
            
        width, height = img.size
        # ターゲットサイズ（256px）
        target_size = 256
        
        # アスペクト比を維持して、長い方の辺を256にリサイズ
        ratio = target_size / max(width, height)
        new_width = int(width * ratio)
        new_height = int(height * ratio)
        
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # 真っ白な正方形の背景を作成（透過ではなく白を指定。チャット背景に合わせる）
        # もし透過にしたい場合は (0, 0, 0, 0)
        new_img = Image.new("RGBA", (target_size, target_size), (255, 255, 255, 255))
        
        # 中央に配置
        paste_x = (target_size - new_width) // 2
        paste_y = (target_size - new_height) // 2
        new_img.paste(img, (paste_x, paste_y), img)
        
        # 保存（PNG)
        new_img.save(dest_path, "PNG")
        print(f"Processed (Padded): {os.path.basename(src_path)} -> {os.path.basename(dest_path)}")

for src_name, dest_name in MAPPING.items():
    src_path = os.path.join(SRC_DIR, src_name)
    dest_path = os.path.join(DEST_DIR, dest_name)
    
    if os.path.exists(src_path):
        process_image_with_padding(src_path, dest_path)
    else:
        print(f"Skip: {src_name} (not found)")
