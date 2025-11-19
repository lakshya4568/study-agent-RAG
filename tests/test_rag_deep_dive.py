import os
import sys
import asyncio
import json
from pathlib import Path
from dotenv import load_dotenv
import time

# Add python directory to sys.path to allow imports
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root / "python"))

# Import from the service
try:
    from nvidia_rag_service import (
        initialize_nvidia_clients,
        create_optimized_chunks,
        token_length_function,
        embeddings,
        llm,
        NVIDIA_API_KEY,
    )
    import nvidia_rag_service
except ImportError as e:
    print(f"Error importing nvidia_rag_service: {e}")
    sys.exit(1)

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain.schema import Document

# Load environment variables
load_dotenv(project_root / ".env")

TEST_PDF_PATH = "/Users/proximus/Downloads/3D ASSISNGMENT-2.pdf"
TEST_COLLECTION_NAME = "test_debug_collection"
PERSIST_DIR = str(project_root / "chroma_db_test")


def print_header(title):
    print("\n" + "=" * 80)
    print(f" {title}")
    print("=" * 80)


def print_section(title):
    print(f"\n--- {title} ---")


async def run_deep_dive_test():
    print_header("STARTING RAG DEEP DIVE TEST")
    print(f"Target PDF: {TEST_PDF_PATH}")

    # 1. Initialize Clients
    print_section("Initializing NVIDIA Clients")
    try:
        # We need to set the API key env var for the module if it wasn't set before import
        if not os.getenv("NVIDIA_API_KEY"):
            print("⚠️ NVIDIA_API_KEY not found in env, checking module...")

        await initialize_nvidia_clients()
        # Access the globals from the module
        active_embeddings = nvidia_rag_service.embeddings
        active_llm = nvidia_rag_service.llm

        if not active_embeddings or not active_llm:
            print("❌ Failed to initialize clients.")
            return
        print("✅ NVIDIA Clients Initialized")
        print(f"   Embedding Model: {active_embeddings.model}")
        print(f"   LLM Model: {active_llm.model}")
    except Exception as e:
        print(f"❌ Error initializing clients: {e}")
        return

    # 2. Load Document
    print_section("Loading Document")
    if not os.path.exists(TEST_PDF_PATH):
        print(f"❌ File not found: {TEST_PDF_PATH}")
        return

    try:
        loader = PyPDFLoader(TEST_PDF_PATH)
        documents = loader.load()
        print(f"✅ Loaded {len(documents)} pages.")

        print("\n[FULL EXTRACTED TEXT]:")
        for i, doc in enumerate(documents):
            print(f"\n--- Page {i+1} ---")
            print(doc.page_content)
            print("----------------")
    except Exception as e:
        print(f"❌ Error loading PDF: {e}")
        return

    # 3. Chunking
    print_section("Chunking Document")
    try:
        chunks = create_optimized_chunks(documents)
        print(f"✅ Created {len(chunks)} chunks.")

        print("\n[FULL CHUNK ANALYSIS]:")
        for i, chunk in enumerate(chunks):
            print(f"\n🔸 Chunk {i+1} (ID: {chunk.metadata.get('chunk_id')})")
            print(f"   Source Page: {chunk.metadata.get('page')}")
            print(f"   Size: {chunk.metadata.get('chunk_size_tokens')} tokens")
            print(f"   Content:\n{chunk.page_content}")
            print("-" * 40)
    except Exception as e:
        print(f"❌ Error chunking: {e}")
        return

    # 4. Embeddings
    print_section("Generating Embeddings (Sample)")
    try:
        sample_text = chunks[0].page_content
        print(f"Embedding chunk 1 ({len(sample_text)} chars)...")
        start_time = time.time()
        vector = active_embeddings.embed_query(sample_text)
        duration = time.time() - start_time

        print(f"✅ Embedding generated in {duration:.2f}s")
        print(f"   Vector Dimensions: {len(vector)}")
        print(f"   Vector Preview (first 5 dims): {vector[:5]}")
    except Exception as e:
        print(f"❌ Error generating embedding: {e}")
        return

    # 5. Vector Store (Chroma)
    print_section(f"Populating Vector Store ({TEST_COLLECTION_NAME})")
    try:
        # Clean up previous test run if exists
        if os.path.exists(PERSIST_DIR):
            import shutil

            # shutil.rmtree(PERSIST_DIR) # Optional: keep it to test persistence or clean start
            pass

        vector_store = Chroma(
            collection_name=TEST_COLLECTION_NAME,
            embedding_function=active_embeddings,
            persist_directory=PERSIST_DIR,
        )

        # Reset collection for clean test
        try:
            vector_store.delete_collection()
            vector_store = Chroma(
                collection_name=TEST_COLLECTION_NAME,
                embedding_function=active_embeddings,
                persist_directory=PERSIST_DIR,
            )
        except:
            pass

        print(f"Adding {len(chunks)} chunks to ChromaDB...")
        vector_store.add_documents(chunks)
        vector_store.persist()
        print("✅ Documents added and persisted.")
    except Exception as e:
        print(f"❌ Error with Vector Store: {e}")
        return

    # 6. Retrieval & Generation
    print_section("Testing Retrieval & Generation")

    question = "write all the questions asked in this document"
    print(f"❓ Question: {question}")

    try:
        # Retrieval
        print("\n🔍 Retrieving relevant chunks...")
        # retriever = vector_store.as_retriever(search_kwargs={"k": 3})
        # retrieved_docs = retriever.invoke(question)

        # Use similarity_search_with_score to get scores
        results_with_scores = vector_store.similarity_search_with_score(question, k=3)
        retrieved_docs = [doc for doc, _ in results_with_scores]

        print(f"✅ Retrieved {len(results_with_scores)} chunks.")
        for i, (doc, score) in enumerate(results_with_scores):
            print(f"\n📄 Retrieved Chunk {i+1} (Score: {score:.4f}):")
            print(f"   Metadata: {doc.metadata}")
            print(f"   Content:\n{doc.page_content}")
            print("-" * 40)  # Generation
        print("\n🤖 Generating Answer with LLM...")

        context_text = "\n\n".join([d.page_content for d in retrieved_docs])

        prompt = f"""You are a helpful study assistant. Use the following context from study materials to answer the question accurately and concisely.

Context from documents:
{context_text}

Question: {question}

Answer:"""

        print("\n[Prompt sent to LLM]:")
        print("-" * 20)
        print(prompt)
        print("-" * 20)

        start_time = time.time()
        response = active_llm.invoke(prompt)
        duration = time.time() - start_time

        print_header("FINAL LLM RESPONSE")
        print(response.content)
        print(f"\n(Generated in {duration:.2f}s)")

    except Exception as e:
        print(f"❌ Error in RAG pipeline: {e}")
        return


if __name__ == "__main__":
    asyncio.run(run_deep_dive_test())
