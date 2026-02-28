import React, { useEffect, useState, useCallback } from "react";
import {
  Database,
  FileText,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Layers,
  Cpu,
  ArrowRight,
  Zap,
  Search,
  Filter,
  SplitSquareVertical,
  Brain,
  Box,
  CircleDot,
  X,
} from "lucide-react";
import { ContentContainer } from "../components/layout";
import { Button, Card, LoadingSpinner } from "../components/ui";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helper ──────────────────────────────────────────────────────────────────

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

// ─── Sub-components ──────────────────────────────────────────────────────────

/** A small stat card */
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}> = ({ icon, label, value, sub, color = "text-primary" }) => (
  <Card className="p-4 flex items-start gap-3 bg-card/50 backdrop-blur-sm border-border/30">
    <div className={`p-2 rounded-xl bg-muted/50 ${color}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
      {sub && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
      )}
    </div>
  </Card>
);

/** Single pipeline stage block */
const PipelineStage: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  detail?: string;
  color: string;
  isLast?: boolean;
}> = ({ icon, title, description, detail, color, isLast }) => (
  <div className="flex items-start gap-3">
    <div className="flex flex-col items-center">
      <div
        className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shadow-sm`}
      >
        {icon}
      </div>
      {!isLast && <div className="w-0.5 h-8 bg-border/50 my-1" />}
    </div>
    <div className="pt-1 min-w-0 flex-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
      {detail && (
        <p className="text-[11px] text-muted-foreground/70 mt-0.5 font-mono">
          {detail}
        </p>
      )}
    </div>
  </div>
);

/** Horizontal pipeline flow diagram */
const PipelineFlowDiagram: React.FC<{ health: RAGHealthData | null }> = ({
  health,
}) => {
  const ingestionSteps = [
    {
      icon: <FileText className="w-4 h-4" />,
      label: "PDF / Text",
      color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    },
    {
      icon: <SplitSquareVertical className="w-4 h-4" />,
      label: "Chunker",
      color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      detail: health
        ? `${health.chunk_size_tokens} tok / ${health.chunk_overlap_tokens} overlap`
        : "",
    },
    {
      icon: <Cpu className="w-4 h-4" />,
      label: "Embedder",
      color: "bg-green-500/10 text-green-500 border-green-500/20",
      detail: health?.embedding_model?.split("/").pop() || "",
    },
    {
      icon: <Database className="w-4 h-4" />,
      label: "ChromaDB",
      color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    },
  ];

  const querySteps = [
    {
      icon: <Search className="w-4 h-4" />,
      label: "Query",
      color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    },
    {
      icon: <Layers className="w-4 h-4" />,
      label: health?.hybrid_search ? "Hybrid Retriever" : "Semantic Retriever",
      color: "bg-teal-500/10 text-teal-500 border-teal-500/20",
      detail: health?.hybrid_search ? "TF-IDF + Vector" : "Vector only",
    },
    {
      icon: <Filter className="w-4 h-4" />,
      label: "Reranker",
      color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      detail: health?.reranking_model?.split("/").pop() || "",
    },
    {
      icon: <Brain className="w-4 h-4" />,
      label: "Generator",
      color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      detail: health?.llm_model?.split("/").pop() || "",
    },
  ];

  const FlowRow: React.FC<{
    title: string;
    steps: typeof ingestionSteps;
  }> = ({ title, steps }) => (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
        {title}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${step.color} text-xs font-medium min-w-0`}
            >
              {step.icon}
              <div className="min-w-0">
                <span className="block">{step.label}</span>
                {step.detail && (
                  <span className="block text-[10px] opacity-70 font-mono truncate">
                    {step.detail}
                  </span>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <FlowRow title="Ingestion Pipeline" steps={ingestionSteps} />
      <FlowRow title="Query Pipeline" steps={querySteps} />
    </div>
  );
};

/** Simple bar chart for chunk distribution */
const ChunkDistributionChart: React.FC<{
  documents: UploadedDocument[];
}> = ({ documents }) => {
  const readyDocs = documents.filter(
    (d) => d.status === "ready" && (d.chunkCount ?? 0) > 0,
  );

  if (readyDocs.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No chunked documents yet
      </div>
    );
  }

  const maxChunks = Math.max(...readyDocs.map((d) => d.chunkCount ?? 0));
  const totalChunks = readyDocs.reduce(
    (sum, d) => sum + (d.chunkCount ?? 0),
    0,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Document</span>
        <span>Chunks ({totalChunks} total)</span>
      </div>
      <div className="space-y-2">
        {readyDocs.map((doc) => {
          const chunks = doc.chunkCount ?? 0;
          const pct = maxChunks > 0 ? (chunks / maxChunks) * 100 : 0;
          const hue = (chunks / Math.max(totalChunks, 1)) * 120; // green = more

          return (
            <div key={doc.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground truncate max-w-[60%]">
                  {doc.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {chunks} chunks
                </span>
              </div>
              <div className="h-4 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(pct, 4)}%`,
                    background: `linear-gradient(90deg, hsl(${hue}, 70%, 50%), hsl(${hue + 20}, 70%, 60%))`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Proportional pie-like visualization */}
      <div className="mt-4 pt-3 border-t border-border/30">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          Chunk Distribution
        </p>
        <div className="flex items-center gap-1 h-6 rounded-full overflow-hidden">
          {readyDocs.map((doc, idx) => {
            const chunks = doc.chunkCount ?? 0;
            const pct = totalChunks > 0 ? (chunks / totalChunks) * 100 : 0;
            const colors = [
              "bg-blue-500",
              "bg-emerald-500",
              "bg-amber-500",
              "bg-rose-500",
              "bg-purple-500",
              "bg-cyan-500",
              "bg-orange-500",
              "bg-teal-500",
            ];

            return (
              <div
                key={doc.id}
                className={`h-full ${colors[idx % colors.length]} transition-all duration-500`}
                style={{ width: `${Math.max(pct, 2)}%` }}
                title={`${doc.name}: ${chunks} chunks (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {readyDocs.map((doc, idx) => {
            const colors = [
              "bg-blue-500",
              "bg-emerald-500",
              "bg-amber-500",
              "bg-rose-500",
              "bg-purple-500",
              "bg-cyan-500",
              "bg-orange-500",
              "bg-teal-500",
            ];
            return (
              <div key={doc.id} className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`}
                />
                <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                  {doc.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const RAGDashboard: React.FC = () => {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [health, setHealth] = useState<RAGHealthData | null>(null);
  const [collectionStats, setCollectionStats] =
    useState<CollectionStatsData | null>(null);
  const [pipelineStats, setPipelineStats] = useState<PipelineStatsData | null>(
    null,
  );
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
      // Fetch documents from SQLite DB
      const docs = await window.db.getAllDocuments();
      setDocuments(Array.isArray(docs) ? docs : []);

      // Fetch vector store state from SQLite
      const vs = await window.ragDashboard.getVectorStoreState();
      setVectorState(vs);

      // Fetch live RAG service data
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
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClearCollection = async () => {
    if (
      !confirm(
        "This will permanently delete ALL documents and chunks from the vector database. Continue?",
      )
    )
      return;

    setClearing(true);
    try {
      await window.ragDashboard.clearCollection();
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to clear collection",
      );
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
      setError(
        err instanceof Error ? err.message : "Failed to delete document",
      );
    } finally {
      setDeletingDoc(null);
    }
  };

  const totalChunks =
    vectorState?.totalChunks ?? collectionStats?.total_documents ?? 0;
  const totalDocs = documents.filter((d) => d.status === "ready").length;

  return (
    <ContentContainer className="space-y-6 max-w-5xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-5 border-b border-border/40">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Database className="w-8 h-8 text-primary" />
            RAG Dashboard
          </h2>
          <p className="text-muted-foreground mt-2 text-lg">
            NVIDIA RAG pipeline status, loaded documents &amp; vector database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
              ragConnected
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-red-500/10 text-red-500 border-red-500/20"
            }`}
          >
            <CircleDot className="w-3 h-3" />
            {ragConnected ? "Service Online" : "Disconnected"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={refresh}
            loading={loading}
            className="rounded-full"
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 rounded-3xl bg-muted/30">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <span className="text-sm font-medium text-muted-foreground">
              Loading RAG dashboard...
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* ── Stats Overview ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<FileText className="w-5 h-5" />}
              label="Documents"
              value={totalDocs}
              sub={`${documents.length} total tracked`}
            />
            <StatCard
              icon={<Layers className="w-5 h-5" />}
              label="Chunks"
              value={totalChunks}
              sub={health ? `${health.chunk_size_tokens} tok/chunk` : "—"}
              color="text-amber-500"
            />
            <StatCard
              icon={<Cpu className="w-5 h-5" />}
              label="Embedding"
              value={
                health?.embedding_model?.split("/").pop()?.substring(0, 18) ??
                "—"
              }
              sub={
                pipelineStats?.embedder
                  ? `${pipelineStats.embedder.dimensions}d`
                  : "—"
              }
              color="text-green-500"
            />
            <StatCard
              icon={<Brain className="w-5 h-5" />}
              label="LLM"
              value={
                health?.llm_model?.split("/").pop()?.substring(0, 18) ?? "—"
              }
              sub={health?.hybrid_search ? "Hybrid search" : "Semantic search"}
              color="text-rose-500"
            />
          </div>

          {/* ── Pipeline Architecture ──────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Pipeline Architecture
            </h3>
            <Card className="p-5 bg-card/50 backdrop-blur-sm border-border/30">
              <PipelineFlowDiagram health={health} />
            </Card>
          </section>

          {/* ── How it Works: Pipeline Stages ─────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Box className="w-5 h-5 text-primary" />
              How the NVIDIA RAG Pipeline Works
            </h3>
            <Card className="p-5 bg-card/50 backdrop-blur-sm border-border/30">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Ingestion side */}
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Document Ingestion
                  </p>
                  <PipelineStage
                    icon={<FileText className="w-4 h-4 text-blue-500" />}
                    title="1. PDF Loader"
                    description="Documents are loaded with PyPDFLoader, extracting text per page while preserving metadata (page number, source path)."
                    color="bg-blue-500/10"
                  />
                  <PipelineStage
                    icon={
                      <SplitSquareVertical className="w-4 h-4 text-amber-500" />
                    }
                    title="2. Semantic Chunker"
                    description={`Token-aware splitting using tiktoken (cl100k_base). Chunks at ${health?.chunk_size_tokens ?? 512} tokens with ${health?.chunk_overlap_tokens ?? 128} token overlap (25%). Uses semantic separators: paragraphs → sentences → words.`}
                    detail="RecursiveCharacterTextSplitter.from_tiktoken_encoder()"
                    color="bg-amber-500/10"
                  />
                  <PipelineStage
                    icon={<Cpu className="w-4 h-4 text-green-500" />}
                    title="3. NVIDIA Embedder"
                    description={`Each chunk is embedded using ${health?.embedding_model?.split("/").pop() ?? "NVIDIA"} into dense vectors (${pipelineStats?.embedder?.dimensions ?? "N/A"}d). Rate-limited to 40 req/min (free tier).`}
                    color="bg-green-500/10"
                  />
                  <PipelineStage
                    icon={<Database className="w-4 h-4 text-purple-500" />}
                    title="4. ChromaDB Storage"
                    description="Vectors are stored in a persistent ChromaDB collection with enriched metadata (chunk_id, page, token count, preview)."
                    detail={collectionStats?.persist_dir ?? "~/.chroma_db"}
                    color="bg-purple-500/10"
                    isLast
                  />
                </div>
                {/* Query side */}
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Query &amp; Retrieval
                  </p>
                  <PipelineStage
                    icon={<Search className="w-4 h-4 text-cyan-500" />}
                    title="1. Query Input"
                    description="User questions are processed and embedded with the same NVIDIA model used during ingestion for consistent vector space alignment."
                    color="bg-cyan-500/10"
                  />
                  <PipelineStage
                    icon={<Layers className="w-4 h-4 text-teal-500" />}
                    title={`2. ${health?.hybrid_search ? "Hybrid" : "Semantic"} Retrieval`}
                    description={
                      health?.hybrid_search
                        ? "Combines chromaDB vector similarity search (cosine) with TF-IDF keyword search. Results fused via Reciprocal Rank Fusion (RRF) for robust retrieval."
                        : "ChromaDB similarity search retrieves top-K chunks by cosine distance from the query embedding."
                    }
                    detail={
                      health?.hybrid_search
                        ? "score_fusion = Σ 1/(rank_i + 60)"
                        : "similarity_search_with_score()"
                    }
                    color="bg-teal-500/10"
                  />
                  <PipelineStage
                    icon={<Filter className="w-4 h-4 text-orange-500" />}
                    title="3. NVIDIA Reranker"
                    description={`Retrieved chunks are reranked using ${health?.reranking_model?.split("/").pop() ?? "NVIDIA reranker"} for fine-grained relevance scoring. Only top results pass through.`}
                    color="bg-orange-500/10"
                  />
                  <PipelineStage
                    icon={<Brain className="w-4 h-4 text-rose-500" />}
                    title="4. LLM Generator"
                    description={`Context from reranked chunks is injected into a study-assistant prompt and sent to ${health?.llm_model?.split("/").pop() ?? "the LLM"} for answer generation with streaming support.`}
                    detail="temperature=0.6 · top_p=0.9 · max_tokens=4096"
                    color="bg-rose-500/10"
                    isLast
                  />
                </div>
              </div>
            </Card>
          </section>

          {/* ── Chunk Distribution Graph ───────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              Chunk Distribution
            </h3>
            <Card className="p-5 bg-card/50 backdrop-blur-sm border-border/30">
              <ChunkDistributionChart documents={documents} />
            </Card>
          </section>

          {/* ── Loaded Documents ────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Loaded Documents
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearCollection}
                loading={clearing}
                className="text-destructive hover:bg-destructive/10 rounded-full"
                icon={<Trash2 className="w-4 h-4" />}
              >
                Clear All
              </Button>
            </div>

            {documents.length === 0 ? (
              <Card className="p-8 text-center bg-card/50 backdrop-blur-sm border-border/30">
                <Database className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  No documents loaded yet. Upload a PDF from the chat to get
                  started.
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <Card
                    key={doc.id}
                    className="p-4 flex items-center gap-4 bg-card/50 backdrop-blur-sm border-border/30 group"
                  >
                    {/* Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        doc.status === "ready"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : doc.status === "error"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {doc.status === "ready" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : doc.status === "error" ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <LoadingSpinner size="sm" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {doc.name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{formatBytes(doc.size)}</span>
                        <span>·</span>
                        <span>{formatDate(doc.uploadedAt)}</span>
                        {doc.chunkCount !== undefined && doc.chunkCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-primary font-medium">
                              {doc.chunkCount} chunks
                            </span>
                          </>
                        )}
                      </p>
                      {doc.error && (
                        <p className="text-xs text-destructive mt-1 truncate">
                          {doc.error}
                        </p>
                      )}
                    </div>

                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                      loading={deletingDoc === doc.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* ── Chunking Method Explanation ─────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <SplitSquareVertical className="w-5 h-5 text-primary" />
              Chunking Strategy
            </h3>
            <Card className="p-5 bg-card/50 backdrop-blur-sm border-border/30 space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Method
                  </p>
                  <p className="text-sm text-foreground font-medium">
                    Token-Aware Semantic Splitting
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Uses{" "}
                    <code className="text-[11px] bg-muted/50 px-1 rounded">
                      tiktoken (cl100k_base)
                    </code>{" "}
                    for accurate token counting. Splits along semantic
                    boundaries in priority order.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Parameters
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Chunk Size</span>
                      <span className="font-mono text-foreground">
                        {health?.chunk_size_tokens ?? 512} tokens
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Overlap</span>
                      <span className="font-mono text-foreground">
                        {health?.chunk_overlap_tokens ?? 128} tokens (25%)
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Encoding</span>
                      <span className="font-mono text-foreground">
                        cl100k_base
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Separator Priority
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {[
                      "\\n\\n\\n",
                      "\\n\\n",
                      "\\n",
                      ". ",
                      "? ",
                      "! ",
                      "; ",
                      ", ",
                      "space",
                      "char",
                    ].map((sep) => (
                      <span
                        key={sep}
                        className="text-[10px] font-mono bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded"
                      >
                        {sep}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Splits at the highest-priority boundary that keeps chunks
                    within the token budget.
                  </p>
                </div>
              </div>

              {/* Visual chunking diagram */}
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                  Visual: How a document is chunked
                </p>
                <div className="flex gap-0.5 items-center">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="flex-1 flex items-center">
                      <div
                        className={`h-8 w-full rounded-sm ${
                          i % 3 === 0
                            ? "bg-blue-500/30"
                            : i % 3 === 1
                              ? "bg-emerald-500/30"
                              : "bg-amber-500/30"
                        }`}
                        style={{
                          opacity: 0.5 + (i / 12) * 0.5,
                        }}
                      />
                      {/* Overlap indicator */}
                      {(i + 1) % 3 === 0 && i < 11 && (
                        <div className="w-3 h-8 bg-linear-to-r from-current/20 to-transparent -ml-1.5 rounded-sm relative z-10 border-l-2 border-dashed border-muted-foreground/20" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-blue-500/30" />
                    <span className="text-[10px] text-muted-foreground">
                      Chunk A
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500/30" />
                    <span className="text-[10px] text-muted-foreground">
                      Chunk B
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-amber-500/30" />
                    <span className="text-[10px] text-muted-foreground">
                      Chunk C
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2 border-l-2 border-dashed border-muted-foreground/30" />
                    <span className="text-[10px] text-muted-foreground">
                      Overlap ({health?.chunk_overlap_tokens ?? 128} tokens)
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </section>
        </>
      )}
    </ContentContainer>
  );
};
