import dotenv
import os
import requests

dotenv.load_dotenv()
API_KEY = os.getenv('VITE_GEMINI_API_KEY')

models_to_try = [
    "gemini-1.0-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-3.0-flash",
    "gemini-3.1-flash"
]

for model in models_to_try:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": "Say hi"}]}]
    }
    response = requests.post(url, json=payload)
    print(f"Model {model}: Status {response.status_code}")
    if response.status_code == 200:
        print(" -> SUCCESS!")
    else:
        try:
            print(f" -> Error: {response.json()['error']['message']}")
        except:
            print(f" -> Error: {response.text}")
