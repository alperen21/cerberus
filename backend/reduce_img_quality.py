from PIL import Image
Image.open("dbs.png").convert("RGB").save("dbs_low_quality.jpg", quality=35, optimize=True, progressive=True, subsampling=2)