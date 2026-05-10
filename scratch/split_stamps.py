from PIL import Image
import os

def split_image(image_path, output_dir, rows, cols):
    img = Image.open(image_path)
    width, height = img.size
    
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    tile_width = width // cols
    tile_height = height // rows
    
    count = 1
    for r in range(rows):
        for c in range(cols):
            left = c * tile_width
            top = r * tile_height
            right = left + tile_width
            bottom = top + tile_height
            
            tile = img.crop((left, top, right, bottom))
            tile.save(os.path.join(output_dir, f"stamp{count}.png"))
            print(f"Saved stamp{count}.png")
            count += 1

if __name__ == "__main__":
    split_image("icon/スタンプ用.png", "public/stamps", 3, 3)
