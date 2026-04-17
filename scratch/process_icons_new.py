import os
from PIL import Image

# フォルダの設定
SRC_DIR = r"d:\04_ゲーム\kuroneko-family-chat\icon"
DEST_DIR = r"d:\04_ゲーム\kuroneko-family-chat\public\icons\neko"

if not os.path.exists(DEST_DIR):
    os.makedirs(DEST_DIR)

# ファイル名のマッピングを更新
MAPPING = {
    "Neko-yorokobi.png": "happy.png",   # 新しい喜び画像をハッピーに
    "Neko-up.jpg": "gentle.png",      # 以前のアップを「優しい」に
}

def process_image(src_path, dest_path):
    with Image.open(src_path) as img:
        # 正方形にクロップする（中央を基準に）
        width, height = img.size
        new_size = min(width, height)
        left = (width - new_size)/2
        top = (height - new_size)/2
        right = (width + new_size)/2
        bottom = (height + new_size)/2
        
        img = img.crop((left, top, right, bottom))
        # リサイズ（アイコンとして扱いやすい256pxに）
        img = img.resize((256, 256), Image.Resampling.LANCZOS)
        
        # 保存
        img.save(dest_path, "PNG")
        print(f"Processed: {os.path.basename(src_path)} -> {os.path.basename(dest_path)}")

for src_name, dest_name in MAPPING.items():
    src_path = os.path.join(SRC_DIR, src_name)
    dest_path = os.path.join(DEST_DIR, dest_name)
    
    if os.path.exists(src_path):
        process_image(src_path, dest_path)
    else:
        print(f"Skip: {src_name} (not found)")
