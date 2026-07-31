import os
import openai

# Legacy OpenAI SDK 0.x Configuration
openai.api_key = os.getenv("OPENAI_API_KEY", "sk-demo-key-12345")

def handle_user_message(user_prompt: str):
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful customer support assistant."},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=150
        )
        return response.choices[0].message.content
    except openai.error.RateLimitError as e:
        print(f"Rate limit exceeded: {e}")
        return "System busy, please try again in a moment."
    except openai.error.InvalidRequestError as e:
        print(f"Invalid request parameters: {e}")
        return "Invalid input prompt."
    except openai.error.OpenAIError as e:
        print(f"General OpenAI API failure: {e}")
        return "An internal AI service error occurred."

if __name__ == "__main__":
    reply = handle_user_message("Hello, how do I reset my password?")
    print("Bot Reply:", reply)
