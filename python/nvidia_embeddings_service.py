#!/usr/bin/env python3
# Run using project venv: .venv/bin/python nvidia_embeddings_service.py
"""
NVIDIA Embeddings Service using official langchain-nvidia-ai-endpoints
Uses the latest model: nvidia/llama-3.2-nemoretriever-300m-embed-v2

This service runs as a standalone process and communicates with Node.js via JSON-RPC over stdin/stdout
"""

import sys
import json
import os
from typing import List, Dict, Any, Iterable
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings

# Initialize NVIDIA Embeddings with the latest model
MODEL_NAME = "nvidia/llama-3.2-nemoretriever-300m-embed-v2"
DEFAULT_BATCH_SIZE = int(os.getenv("NVIDIA_EMBED_BATCH_SIZE", "16"))


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


def chunk_list(items: List[str], size: int) -> Iterable[List[str]]:
    """Yield successive chunks from a list"""
    if size <= 0:
        size = 1
    for i in range(0, len(items), size):
        yield items[i : i + size]


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

            batch_size = params.get("batchSize") or DEFAULT_BATCH_SIZE

            print(
                f"DEBUG: Embedding {len(documents)} documents in batches of {batch_size}",
                file=sys.stderr,
                flush=True,
            )

            sanitized_docs: List[str] = []
            for doc in documents:
                if isinstance(doc, list):
                    doc = " ".join(str(x) for x in doc)
                sanitized_docs.append(sanitize_text(str(doc)))

            embeddings: List[List[float]] = []
            fallback_mode = False
            batches = list(chunk_list(sanitized_docs, batch_size))

            for index, batch in enumerate(batches, start=1):
                try:
                    batch_embeddings = client.embed_documents(batch)
                except Exception as batch_error:
                    if not fallback_mode:
                        print(
                            f"WARN: Batch embed failed ({batch_error}), falling back to single query embeddings",
                            file=sys.stderr,
                            flush=True,
                        )
                        fallback_mode = True
                    batch_embeddings = [client.embed_query(doc) for doc in batch]

                embeddings.extend(batch_embeddings)
                print(
                    f"DEBUG: Embedded batch {index}/{len(batches)}",
                    file=sys.stderr,
                    flush=True,
                )

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
