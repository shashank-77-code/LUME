import os
import openai

openai.api_key = os.environ.get("OPENAI_API_KEY")

def generate_text_embeddings(text_list: list):
    """Generate vector embeddings for a list of document strings."""
    try:
        response = openai.Embedding.create(
            input=text_list,
            model="text-embedding-ada-002"
        )
        return [data["embedding"] for data in response["data"]]
    except openai.error.OpenAIError as err:
        print(f"Failed to generate embeddings: {err}")
        return []

def check_available_models():
    """Fetch list of available models using v0.x API."""
    models_response = openai.Model.list()
    return [model.id for model in models_response.data]

def dynamic_api_invoker(api_name: str, **kwargs):
    """Dynamic call site requiring manual review."""
    method = getattr(openai, api_name)
    return method.create(**kwargs)
