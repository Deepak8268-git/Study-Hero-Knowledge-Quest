import requests
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get API key from environment variable
MISTRAL_API_KEY = os.getenv('MISTRAL_API_KEY')

if not MISTRAL_API_KEY:
    raise RuntimeError("MISTRAL_API_KEY environment variable is required")

API_URL = "https://api.mistral.ai/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {MISTRAL_API_KEY}",
    "Content-Type": "application/json"
}

def generate_questions_from_text(text):
    try:
        prompt = f"Generate 5 multiple choice quiz questions from the following content:\n\n{text}"
        
        payload = {
            "model": "mistral-medium",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a quiz generator. Create 5 multiple choice questions with 4 options each. Format each question as:\n\nQ1. Question text?\nA) Option 1\nB) Option 2\nC) Option 3\nD) Option 4\nCorrect Answer: Letter"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        
        print("Sending request to Mistral API...", file=sys.stderr)
        response = requests.post(API_URL, headers=headers, json=payload)
        print(f"Response status: {response.status_code}", file=sys.stderr)
        
        if response.status_code == 200:
            result = response.json()
            return result['choices'][0]['message']['content']
        else:
            print(f"API Error: {response.status_code}", file=sys.stderr)
            print(f"Response: {response.text}", file=sys.stderr)
            return f"Error: Failed to generate quiz. Status code: {response.status_code}"
    except Exception as e:
        print(f"Exception occurred: {str(e)}", file=sys.stderr)
        return f"Error: {str(e)}"

if __name__ == "__main__":
    try:
        # Read input from stdin
        print("Reading input...", file=sys.stderr)
        notes_content = sys.stdin.read().strip()
        if not notes_content:
            print("Error: No input provided", file=sys.stderr)
            sys.exit(1)
        
        # Generate and print quiz
        print("Generating quiz...", file=sys.stderr)
        quiz = generate_questions_from_text(notes_content)
        print(quiz)
    except Exception as e:
        print(f"Main error: {str(e)}", file=sys.stderr)
        sys.exit(1)
