"""
NVIDIA Generator Module

Handles response generation using NVIDIA ChatNVIDIA models.
Supports streaming and non-streaming generation.
"""

import logging
import json
from typing import List, Tuple, Optional, AsyncIterator

from langchain.schema import Document
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_core.prompts import ChatPromptTemplate

from .config import RAGConfig

logger = logging.getLogger(__name__)

# ── Prompt Templates ───────────────────────────────────────────────────────────

STUDY_ASSISTANT_PROMPT = """You are an expert study assistant. Use the following context from study documents to answer the question accurately and concisely.

If the context doesn't contain enough information, say so honestly rather than making up information.

**Context from documents:**
{context}

**Question:** {question}

**Instructions:**
- Be precise and educational
- Cite document sources when possible
- Use clear formatting (bullet points, headers) for complex answers
- If the answer requires multiple steps, break them down clearly"""

SUMMARIZATION_PROMPT = """You are an expert summarizer. Create a comprehensive but concise summary of the following text.

**Text to summarize:**
{context}

**Instructions:**
- Capture all key points and concepts
- Organize by theme/topic
- Keep technical accuracy
- Use bullet points for clarity"""


class NVIDIAGenerator:
    """
    NVIDIA LLM wrapper for RAG response generation.

    Features:
    - Streaming and non-streaming generation
    - Customizable prompt templates
    - Context window management
    - Source attribution
    """

    def __init__(self, config: RAGConfig):
        self.config = config
        self._llm: Optional[ChatNVIDIA] = None
        self._llm_streaming: Optional[ChatNVIDIA] = None
        self._generation_count: int = 0

    @property
    def model_id(self) -> str:
        return self.config.get_llm_model().model_id

    def initialize(self) -> "NVIDIAGenerator":
        """Initialize the NVIDIA LLM clients."""
        model_cfg = self.config.get_llm_model()
        gen_cfg = self.config.generator

        logger.info(f"Initializing NVIDIA Generator: {model_cfg.model_id}")

        # Non-streaming LLM
        self._llm = ChatNVIDIA(
            model=model_cfg.model_id,
            nvidia_api_key=self.config.nvidia_api_key,
            temperature=gen_cfg.temperature,
            top_p=gen_cfg.top_p,
            max_completion_tokens=gen_cfg.max_completion_tokens,
        )

        # Streaming LLM
        self._llm_streaming = ChatNVIDIA(
            model=model_cfg.model_id,
            nvidia_api_key=self.config.nvidia_api_key,
            temperature=gen_cfg.temperature,
            top_p=gen_cfg.top_p,
            max_completion_tokens=gen_cfg.max_completion_tokens,
            streaming=True,
        )

        logger.info(f"✓ Generator initialized: {model_cfg.model_id}")
        return self

    def _build_context(
        self,
        documents: List[Tuple[Document, float]],
        max_chunks: int = 5,
    ) -> str:
        """Build context string from retrieved documents with source info."""
        context_parts = []

        for i, (doc, score) in enumerate(documents[:max_chunks]):
            source = doc.metadata.get("source_name", doc.metadata.get("source", "Unknown"))
            page = doc.metadata.get("page", "?")
            chunk_id = doc.metadata.get("chunk_id", i)

            header = f"[Document {i + 1} | Source: {source}, Page: {page}, Chunk: {chunk_id}]"
            context_parts.append(f"{header}\n{doc.page_content}")

        return "\n\n---\n\n".join(context_parts)

    def generate(
        self,
        query: str,
        documents: List[Tuple[Document, float]],
        prompt_template: str = STUDY_ASSISTANT_PROMPT,
    ) -> dict:
        """
        Generate a response using retrieved documents.

        Args:
            query: User question
            documents: Retrieved (document, score) tuples
            prompt_template: Prompt template with {context} and {question} placeholders

        Returns:
            Dict with 'answer', 'sources', 'chunks_retrieved'
        """
        if not self._llm:
            raise RuntimeError("Generator not initialized")

        # Build context
        context = self._build_context(documents)

        # Format prompt
        prompt = prompt_template.format(context=context, question=query)

        # Generate response
        response = self._llm.invoke(prompt)
        self._generation_count += 1

        # Format sources
        sources = self._format_sources(documents)

        return {
            "answer": response.content,
            "sources": sources,
            "chunks_retrieved": len(documents),
        }

    async def generate_stream(
        self,
        query: str,
        documents: List[Tuple[Document, float]],
        prompt_template: str = STUDY_ASSISTANT_PROMPT,
    ) -> AsyncIterator[str]:
        """
        Stream a response using retrieved documents.

        Yields SSE-formatted chunks.

        Args:
            query: User question
            documents: Retrieved (document, score) tuples
            prompt_template: Prompt template

        Yields:
            SSE data strings
        """
        if not self._llm_streaming:
            raise RuntimeError("Generator not initialized")

        context = self._build_context(documents)
        prompt = prompt_template.format(context=context, question=query)

        try:
            async for chunk in self._llm_streaming.astream(prompt):
                if hasattr(chunk, "content") and chunk.content:
                    yield f"data: {json.dumps({'content': chunk.content})}\n\n"

            # Send sources at the end
            sources = self._format_sources(documents)
            yield f"data: {json.dumps({'sources': sources, 'chunks_retrieved': len(documents)})}\n\n"
            yield "data: [DONE]\n\n"

            self._generation_count += 1

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    @staticmethod
    def _format_sources(documents: List[Tuple[Document, float]]) -> List[dict]:
        """Format source documents for API response."""
        sources = []
        for doc, score in documents:
            metadata = doc.metadata.copy()
            metadata["retrieval_score"] = float(score)
            sources.append({
                "content": doc.page_content[:500] + ("..." if len(doc.page_content) > 500 else ""),
                "metadata": metadata,
            })
        return sources

    def get_stats(self) -> dict:
        """Get generator statistics."""
        return {
            "model": self.model_id,
            "total_generations": self._generation_count,
            "streaming": self.config.generator.streaming,
        }
