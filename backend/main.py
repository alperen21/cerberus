from agentic.agent import CerberusAgent
import base64
import os

def image_to_base64(image_path: str) -> str:
    """
    Convert an image file to base64 string.
    
    Args:
        image_path (str): Path to the image file
        
    Returns:
        str: Base64 encoded string of the image
        
    Raises:
        FileNotFoundError: If the image file doesn't exist
        Exception: If there's an error reading the file
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")
    
    try:
        with open(image_path, 'rb') as image_file:
            image_data = image_file.read()
            base64_string = base64.b64encode(image_data).decode('utf-8')
            return base64_string
    except Exception as e:
        raise Exception(f"Error converting image to base64: {e}")

def main():
    agent = CerberusAgent()
    url = "https://www.ddbs.com"
    image = image_to_base64("dbs_low_quality.jpg")

    response = agent.invoke(
        screenshot=image,
        url=url
    )

    print(response['reasons'], response['label'])
    agent.print_graph()

if __name__ == "__main__":
    main()