"""
NVIDIA Embeddings Service using official langchain-nvidia-ai-endpoints
Uses the latest model: nvidia/llama-3.2-nemoretriever-300m-embed-v2

This service runs as a standalone process and communicates with Node.js via JSON-RPC over stdin/stdout
"""

import sys
import json
import os
from typing import List, Dict, Any
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings

# Initialize NVIDIA Embeddings with the latest model
MODEL_NAME = "nvidia/llama-3.2-nemoretriever-300m-embed-v2"


def get_api_key() -> str:
    """Get NVIDIA API key from environment"""
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise ValueError("NVIDIA_API_KEY environment variable is not set")
    return api_key


def initialize_embeddings():
    """Initialize the NVIDIA embeddings client"""
    try:
        client = NVIDIAEmbeddings(
            model=MODEL_NAME, api_key=get_api_key(), truncate="NONE"
        )
        return client
    except Exception as e:
        print(
            json.dumps(
                {
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32000,
                        "message": f"Failed to initialize NVIDIA embeddings: {str(e)}",
                    },
                    "id": None,
                }
            ),
            flush=True,
        )
        sys.exit(1)


def sanitize_text(text: str) -> str:
    """Remove or replace problematic characters for NVIDIA API"""
    # Remove emojis and other non-ASCII characters that might cause issues
    # NVIDIA API seems strict about character encoding
    try:
        # Try to encode as ASCII, replace problematic chars
        return text.encode("ascii", errors="ignore").decode("ascii")
    except:
        # Fallback: just remove problematic chars manually
        import re

        # Remove emojis and special unicode
        return re.sub(r"[^\x00-\x7F]+", " ", text)


def handle_request(client: NVIDIAEmbeddings, request: Dict[str, Any]) -> Dict[str, Any]:
    """Handle JSON-RPC request"""
    method = request.get("method")
    params = request.get("params", {})
    request_id = request.get("id")

    try:
        if method == "embed_query":
            # Embed a single query
            query = params.get("query")
            if not query:
                raise ValueError("Query parameter is required")

            # Sanitize input to remove emojis and problematic characters
            query = sanitize_text(query)

            embedding = client.embed_query(query)
            return {
                "jsonrpc": "2.0",
                "result": {
                    "embedding": embedding,
                    "dimensions": len(embedding),
                    "model": MODEL_NAME,
                },
                "id": request_id,
            }

        elif method == "embed_documents":
            # Embed multiple documents
            documents = params.get("documents")
            if not documents or not isinstance(documents, list):
                raise ValueError("Documents parameter must be a non-empty list")

            # Debug: log what we're receiving
            print(
                f"DEBUG: Received {len(documents)} documents",
                file=sys.stderr,
                flush=True,
            )
            print(
                f"DEBUG: First document type: {type(documents[0])}",
                file=sys.stderr,
                flush=True,
            )
            if isinstance(documents[0], list):
                print(
                    f"DEBUG: First document is a list of {len(documents[0])} items",
                    file=sys.stderr,
                    flush=True,
                )

            # NVIDIA API requires embedding one document at a time
            # We'll embed each document individually using embed_query
            embeddings = []
            for i, doc in enumerate(documents):
                print(
                    f"DEBUG: Embedding document {i+1}/{len(documents)}, type: {type(doc)}",
                    file=sys.stderr,
                    flush=True,
                )
                # Ensure doc is a string
                if isinstance(doc, list):
                    # If it's a list, flatten it to a single string
                    doc = " ".join(str(x) for x in doc)

                # Sanitize to remove emojis and problematic characters
                doc = sanitize_text(str(doc))

                embedding = client.embed_query(doc)
                embeddings.append(embedding)

            return {
                "jsonrpc": "2.0",
                "result": {
                    "embeddings": embeddings,
                    "count": len(embeddings),
                    "dimensions": len(embeddings[0]) if embeddings else 0,
                    "model": MODEL_NAME,
                },
                "id": request_id,
            }

        elif method == "get_model_info":
            # Return model information
            return {
                "jsonrpc": "2.0",
                "result": {
                    "model": MODEL_NAME,
                    "provider": "NVIDIA",
                    "type": "retrieval-embeddings",
                },
                "id": request_id,
            }

        else:
            raise ValueError(f"Unknown method: {method}")

    except Exception as e:
        return {
            "jsonrpc": "2.0",
            "error": {"code": -32603, "message": str(e)},
            "id": request_id,
        }


def main():
    """Main service loop"""
    # Initialize embeddings client
    client = initialize_embeddings()

    # Send ready signal
    print(
        json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "ready",
                "params": {"model": MODEL_NAME, "status": "initialized"},
            }
        ),
        flush=True,
    )

    # Process requests from stdin
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
            response = handle_request(client, request)
            print(json.dumps(response), flush=True)
        except json.JSONDecodeError as e:
            print(
                json.dumps(
                    {
                        "jsonrpc": "2.0",
                        "error": {"code": -32700, "message": f"Parse error: {str(e)}"},
                        "id": None,
                    }
                ),
                flush=True,
            )
        except Exception as e:
            print(
                json.dumps(
                    {
                        "jsonrpc": "2.0",
                        "error": {
                            "code": -32603,
                            "message": f"Internal error: {str(e)}",
                        },
                        "id": None,
                    }
                ),
                flush=True,
            )


if __name__ == "__main__":
    main()
