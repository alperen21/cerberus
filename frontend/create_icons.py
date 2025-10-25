#!/usr/bin/env python3
"""Create simple placeholder icons for Cerberus extension"""

from PIL import Image, ImageDraw, ImageFont
import os

# Create public directory if it doesn't exist
os.makedirs("public", exist_ok=True)

# Icon sizes needed
sizes = [16, 32, 48, 128]

# Cerberus theme colors (blue/purple for security)
bg_color = (59, 130, 246)  # Blue
text_color = (255, 255, 255)  # White

for size in sizes:
    # Create new image with blue background
    img = Image.new('RGB', (size, size), bg_color)
    draw = ImageDraw.Draw(img)

    # Draw a simple "C" for Cerberus
    # For small icons, just use a filled circle with "C"
    if size >= 48:
        # Draw text "C"
        font_size = int(size * 0.6)
        text = "C"

        # Calculate text position to center it
        # Using default font since we may not have custom fonts
        bbox = draw.textbbox((0, 0), text)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        position = ((size - text_width) // 2, (size - text_height) // 2 - size // 10)
        draw.text(position, text, fill=text_color)
    else:
        # For small icons, just draw a circle
        margin = size // 4
        draw.ellipse([margin, margin, size - margin, size - margin],
                     fill=(100, 181, 246), outline=text_color, width=max(1, size // 16))

    # Save the icon
    filename = f"public/icon-{size}.png"
    img.save(filename, "PNG")
    print(f"Created {filename}")

print("\n✅ All icons created successfully!")
