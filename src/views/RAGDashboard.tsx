import React, { useEffect, useState, useCallback } from "react";
import {
  Database,
  FileText,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Cpu,
  Brain,
  CircleDot,
  Sparkles,
} from "lucide-react";
import { ContentContainer } from "../components/layout";
import { Button, LoadingSpinner } from "../components/ui";
import ragGraphic from "../assets/rag_pipeline_graphic.jpg";

interface UploadedDocument {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  uploadedAt: number;
  status?: "processing" | "ready" | "error";
  chunkCount?: number;
  error?: string;
}

interface RAGHealthData {
  status: string;
  nvidia_key_set: boolean;
  embedding_model: string;
  reranking_model?: string;
  llm_model: string;
  hybrid_search?: boolean;
  reranking_enabled?: boolean;
  chunk_size_tokens: number;
  chunk_overlap_tokens: number;
}

interface CollectionStatsData {
  collection_name: string;
  total_documents: number;
  document_count: number;
  hybrid_search: boolean;
  persist_dir: string;
}

interface PipelineStatsData {
  embedder: {
    model: string;
    total_requests: number;
    total_tokens_embedded: number;
    dimensions: number;
  };
  retriever: {
    collection_name: string;
    total_documents: number;
    document_count: number;
    hybrid_search: boolean;
    persist_dir: string;
  };
  reranker: {
    model: string;
    total_reranked: number;
    avg_input_docs?: number;
  };
  generator: {
    model: string;
    total_generations: number;
  };
  metrics: Record<string, unknown>;
}

interface VectorStoreState {
  totalDocuments: number;
  totalChunks: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const RAGDashboard: React.FC = () => {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [health, setHealth] = useState<RAGHealthData | null>(null);
  const [collectionStats, setCollectionStats] = useState<CollectionStatsData | null>(null);
  const [pipelineStats, setPipelineStats] = useState<PipelineStatsData | null>(null);
  const [vectorState, setVectorState] = useState<VectorStoreState | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ragConnected, setRagConnected] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await window.db.getAllDocuments();
      setDocuments(Array.isArray(docs) ? docs : []);

      const vs = await window.ragDashboard.getVectorStoreState();
      setVectorState(vs);

      try {
        const h = await window.ragDashboard.getHealth();
        setHealth(h);
        setRagConnected(true);

        const cs = await window.ragDashboard.getCollectionStats();
        setCollectionStats(cs);

        const ps = await window.ragDashboard.getPipelineStats();
        setPipelineStats(ps);
      } catch {
        setRagConnected(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vector data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClearCollection = async () => {
    if (!confirm("This will permanently purge all chunk embeddings from ChromaDB. Continue?")) {
      return;
    }

    setClearing(true);
    try {
      await window.ragDashboard.clearCollection();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to purge collection");
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    setDeletingDoc(docId);
    try {
      await window.db.deleteDocument(docId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingDoc(null);
    }
  };

  const totalChunks = vectorState?.totalChunks ?? collectionStats?.total_documents ?? 0;
  const totalDocs = documents.filter((d) => d.status === "ready").length;

  return (
    <ContentContainer className="space-y-6 max-w-5xl mx-auto p-6 md:p-8 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-5 border-b border-border/40">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Database className="w-6 h-6 text-primary" />
            Neural Vector Engine
          </h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            NVIDIA NIM RAG pipeline · Chroma vector collection · Semantic chunking
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full neu-raised-sm border ${
              ragConnected
                ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/25"
                : "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/25"
            }`}
          >
            <CircleDot className="w-3 h-3 animate-pulse" />
            {ragConnected ? "NVIDIA RAG Online" : "Service Offline"}
          </span>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={refresh}
            loading={loading}
            className="text-xs font-semibold"
          >
            Sync
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 neu-inset bg-rose-500/10 border border-rose-500/25 rounded-2xl text-rose-500 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 rounded-3xl neu-inset">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <span className="text-xs font-semibold text-muted-foreground">
              Inspecting vector embeddings...
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Banner with 3D Visual Asset (Machined Double-Bezel) */}
          <div className="neu-bezel overflow-hidden">
            <div className="neu-bezel-inner p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2.5 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25 neu-raised-sm">
                  <Sparkles className="w-3 h-3" /> Dense Semantic Retrieval
                </div>
                <h3 className="text-xl font-bold text-foreground tracking-tight">
                  Hybrid Embedding & Reranking Architecture
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Documents are tokenized with <code className="text-primary font-mono font-semibold">tiktoken</code> (512 tokens / 128 overlap), embedded
                  into dense 1024d vectors using NVIDIA's neural embedding model, stored in local ChromaDB,
                  and reranked via reciprocal rank fusion before generation.
                </p>
              </div>
              <div className="w-36 h-36 rounded-2xl overflow-hidden neu-raised shrink-0 border border-border/40">
                <img src={ragGraphic} alt="RAG Pipeline" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {/* Telemetry Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="neu-bezel">
              <div className="neu-bezel-inner p-4">
                <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-1">
                  <FileText className="w-4 h-4" /> Documents
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{totalDocs}</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{documents.length} tracked files</p>
              </div>
            </div>

            <div className="neu-bezel">
              <div className="neu-bezel-inner p-4">
                <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Layers className="w-4 h-4" /> Chunks
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{totalChunks}</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {health ? `${health.chunk_size_tokens} tok / 25% overlap` : "Indexed chunks"}
                </p>
              </div>
            </div>

            <div className="neu-bezel">
              <div className="neu-bezel-inner p-4">
                <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Cpu className="w-4 h-4" /> Embedder
                </div>
                <p className="text-sm font-bold text-foreground truncate">
                  {health?.embedding_model?.split("/").pop() ?? "NVIDIA Embed"}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {pipelineStats?.embedder ? `${pipelineStats.embedder.dimensions}d Dense Space` : "1024d Vector Space"}
                </p>
              </div>
            </div>

            <div className="neu-bezel">
              <div className="neu-bezel-inner p-4">
                <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Brain className="w-4 h-4" /> Generator
                </div>
                <p className="text-sm font-bold text-foreground truncate">
                  {health?.llm_model?.split("/").pop() ?? "Kimi-k2 Chat"}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Hybrid RRF Rerank</p>
              </div>
            </div>
          </div>

          {/* Document Repository */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Loaded Study Documents
              </h3>
              {documents.length > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleClearCollection}
                  loading={clearing}
                  className="text-xs"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Purge All Chunks
                </Button>
              )}
            </div>

            {documents.length === 0 ? (
              <div className="neu-bezel text-center p-6">
                <div className="neu-bezel-inner p-8 flex flex-col items-center">
                  <Database className="w-10 h-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No Documents in Vector Database</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Attach course notes or PDFs in the Study Chat view to populate this repository.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {documents.map((doc) => (
                  <div key={doc.id} className="neu-bezel group">
                    <div className="neu-bezel-inner p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl neu-inset-sm flex items-center justify-center shrink-0 ${
                            doc.status === "ready"
                              ? "text-emerald-500 dark:text-emerald-400 border border-emerald-500/25"
                              : "text-amber-500 dark:text-amber-400 border border-amber-500/25"
                          }`}
                        >
                          {doc.status === "ready" ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <LoadingSpinner size="sm" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground/70 flex items-center gap-2 mt-0.5 font-mono">
                            <span>{formatBytes(doc.size)}</span>
                            <span>·</span>
                            <span>{formatDate(doc.uploadedAt)}</span>
                            {doc.chunkCount !== undefined && (
                              <>
                                <span>·</span>
                                <span className="text-emerald-500 dark:text-emerald-400 font-bold">{doc.chunkCount} Chunks</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={deletingDoc === doc.id}
                        className="w-8 h-8 rounded-xl neu-raised-sm flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-rose-400 hover:bg-rose-500/10 transition-all active:scale-95 cursor-pointer"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </ContentContainer>
  );
};

export default RAGDashboard;

