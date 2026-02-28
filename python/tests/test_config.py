"""
Unit Tests for RAG Configuration Module

Tests config loading, validation, model registry, and environment overrides.
"""

import os
import pytest
from unittest.mock import patch

# Add parent to path for imports
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rag.config import (
    RAGConfig,
    ModelConfig,
    ChunkingConfig,
    RetrieverConfig,
    GeneratorConfig,
    EMBEDDING_MODELS,
    RERANKING_MODELS,
    LLM_MODELS,
)


class TestModelConfig:
    """Tests for ModelConfig dataclass."""

    def test_default_model_config(self):
        cfg = ModelConfig(model_id="test/model")
        assert cfg.model_id == "test/model"
        assert cfg.description == ""
        assert cfg.max_tokens == 512
        assert cfg.dimensions is None

    def test_full_model_config(self):
        cfg = ModelConfig(
            model_id="nvidia/test-v1",
            description="Test model",
            max_tokens=8192,
            dimensions=4096,
        )
        assert cfg.model_id == "nvidia/test-v1"
        assert cfg.dimensions == 4096


class TestModelRegistries:
    """Tests for model registries."""

    def test_embedding_models_exist(self):
        assert len(EMBEDDING_MODELS) >= 4
        assert "nv-embedqa-1b-v2" in EMBEDDING_MODELS
        assert "nemoretriever-300m-v2" in EMBEDDING_MODELS
        assert "nv-embedcode-7b" in EMBEDDING_MODELS

    def test_embedding_models_have_ids(self):
        for name, cfg in EMBEDDING_MODELS.items():
            assert cfg.model_id, f"Model {name} has no model_id"
            assert cfg.description, f"Model {name} has no description"
            assert cfg.dimensions is not None, f"Model {name} has no dimensions"

    def test_reranking_models_exist(self):
        assert len(RERANKING_MODELS) >= 2
        assert "nv-rerankqa-1b-v2" in RERANKING_MODELS

    def test_llm_models_exist(self):
        assert len(LLM_MODELS) >= 1
        assert "kimi-k2-instruct" in LLM_MODELS


class TestChunkingConfig:
    """Tests for ChunkingConfig."""

    def test_defaults(self):
        cfg = ChunkingConfig()
        assert cfg.chunk_size == 512
        assert cfg.chunk_overlap == 128
        assert cfg.encoding_name == "cl100k_base"
        assert len(cfg.separators) > 5

    def test_overlap_less_than_size(self):
        cfg = ChunkingConfig()
        assert cfg.chunk_overlap < cfg.chunk_size


class TestRetrieverConfig:
    """Tests for RetrieverConfig."""

    def test_defaults(self):
        cfg = RetrieverConfig()
        assert cfg.top_k == 10
        assert cfg.top_n == 5
        assert cfg.use_hybrid is True
        assert cfg.keyword_weight + cfg.semantic_weight == pytest.approx(1.0)

    def test_weights_sum_to_one(self):
        cfg = RetrieverConfig(keyword_weight=0.4, semantic_weight=0.6)
        assert cfg.keyword_weight + cfg.semantic_weight == pytest.approx(1.0)


class TestRAGConfig:
    """Tests for RAGConfig."""

    def test_default_config(self):
        cfg = RAGConfig(nvidia_api_key="test-key")
        assert cfg.embedding_model == "nv-embedqa-1b-v2"
        assert cfg.reranking_model == "nv-rerankqa-1b-v2"
        assert cfg.llm_model == "kimi-k2-instruct"
        assert cfg.enable_reranking is True
        assert cfg.enable_hybrid_search is True

    def test_get_embedding_model(self):
        cfg = RAGConfig(nvidia_api_key="test-key")
        model = cfg.get_embedding_model()
        assert model.model_id == "nvidia/llama-3.2-nv-embedqa-1b-v2"
        assert model.dimensions == 2048

    def test_get_reranking_model(self):
        cfg = RAGConfig(nvidia_api_key="test-key")
        model = cfg.get_reranking_model()
        assert model.model_id == "nvidia/llama-3.2-nv-rerankqa-1b-v2"

    def test_get_llm_model(self):
        cfg = RAGConfig(nvidia_api_key="test-key")
        model = cfg.get_llm_model()
        assert model.model_id == "moonshotai/kimi-k2-instruct"

    def test_invalid_embedding_model(self):
        cfg = RAGConfig(nvidia_api_key="test-key", embedding_model="nonexistent")
        with pytest.raises(ValueError, match="Unknown embedding model"):
            cfg.get_embedding_model()

    def test_invalid_reranking_model(self):
        cfg = RAGConfig(nvidia_api_key="test-key", reranking_model="nonexistent")
        with pytest.raises(ValueError, match="Unknown reranking model"):
            cfg.get_reranking_model()

    def test_validate_missing_api_key(self):
        cfg = RAGConfig(nvidia_api_key="")
        with pytest.raises(ValueError, match="NVIDIA_API_KEY"):
            cfg.validate()

    def test_validate_success(self):
        cfg = RAGConfig(nvidia_api_key="nvapi-test")
        cfg.validate()  # Should not raise

    @patch.dict(os.environ, {
        "NVIDIA_API_KEY": "nvapi-env-key",
        "RAG_EMBEDDING_MODEL": "nemoretriever-300m-v2",
        "RAG_ENABLE_RERANKING": "false",
        "RAG_ENABLE_HYBRID": "false",
    })
    def test_from_env(self):
        cfg = RAGConfig.from_env()
        assert cfg.nvidia_api_key == "nvapi-env-key"
        assert cfg.embedding_model == "nemoretriever-300m-v2"
        assert cfg.enable_reranking is False
        assert cfg.enable_hybrid_search is False

    def test_model_switching(self):
        """Test that models can be switched via config."""
        for model_name in EMBEDDING_MODELS:
            cfg = RAGConfig(nvidia_api_key="test", embedding_model=model_name)
            model = cfg.get_embedding_model()
            assert model.model_id.startswith(("nvidia/", "baai/"))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
