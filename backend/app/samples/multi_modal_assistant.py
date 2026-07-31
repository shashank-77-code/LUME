import os
import openai

openai.api_key = os.getenv("OPENAI_API_KEY")
openai.organization = "org-12345678"

def transcribe_audio_file(audio_filepath: str):
    with open(audio_filepath, "rb") as audio_file:
        transcript = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file
        )
    return transcript["text"]

def generate_dalle_image(prompt_text: str):
    response = openai.Image.create(
        prompt=prompt_text,
        n=1,
        size="1024x1024"
    )
    return response['data'][0]['url']

def legacy_text_completion(prompt_text: str):
    result = openai.Completion.create(
        model="gpt-3.5-turbo-instruct",
        prompt=prompt_text,
        max_tokens=100
    )
    return result.choices[0].text
