import React, { useEffect, useMemo, useState } from "react";
import {
  RefreshCcw,
  FileText,
  ShieldCheck,
  ServerCog,
  Activity,
  Settings2,
  Cpu,
  Database,
  Zap,
  Book,
  Brain,
  Sparkles
} from "lucide-react";
import { ContentContainer } from "../components/layout";
import {
  Badge,
  Button,
  Card,
  Input,
  LoadingSpinner,
  TextArea,
} from "../components/ui";
import type { AgentStatus } from "../agent/types";
import type { ConfigSummaryItem } from "../client/types";

interface ConfigFormState {
  MCP_SERVER_PATH: string;
  MCP_SERVER_COMMAND: string;
}

const getConfigValue = (summary: ConfigSummaryItem[], key: string): string => {
  const entry = summary.find((item) => item.key === key);
  if (!entry) return "";
  return entry.value ?? "";
};

export const AgentConsole: React.FC = () => {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [configSummary, setConfigSummary] = useState<ConfigSummaryItem[]>([]);
  const [documentsInput, setDocumentsInput] = useState("");
  const [configForm, setConfigForm] = useState<ConfigFormState>({
    MCP_SERVER_PATH: "",
    MCP_SERVER_COMMAND: "",
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [updatingDocs, setUpdatingDocs] = useState(false);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    refreshAll();
  }, []);

  const refreshAll = async () => {
    setLoadingStatus(true);
    try {
      const [agentStatus, summary] = await Promise.all([
        window.studyAgent.getStatus(),
        window.appConfig.getSummary(),
      ]);
      setStatus(agentStatus);
      setConfigSummary(summary);
      setDocumentsInput(agentStatus.documents.requested.join("\n"));
      setConfigForm({
        MCP_SERVER_PATH: getConfigValue(summary, "MCP_SERVER_PATH"),
        MCP_SERVER_COMMAND: getConfigValue(summary, "MCP_SERVER_COMMAND"),
      });
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load agent status and configuration"
      );
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleDocumentReload = async (event: React.FormEvent) => {
    event.preventDefault();
    setUpdatingDocs(true);
    setSuccessMessage(null);
    try {
      const docPaths = documentsInput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const updatedStatus = await window.studyAgent.reloadDocuments(docPaths);
      setStatus(updatedStatus);
      setSuccessMessage("Library updated successfully!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to reload study documents"
      );
    } finally {
      setUpdatingDocs(false);
    }
  };

  const handleConfigSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setUpdatingConfig(true);
    setSuccessMessage(null);
    try {
      const summary = await window.appConfig.update({
        MCP_SERVER_PATH: configForm.MCP_SERVER_PATH || undefined,
        MCP_SERVER_COMMAND: configForm.MCP_SERVER_COMMAND || undefined,
      });
      setConfigSummary(summary);
      setSuccessMessage("Settings saved!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update configuration"
      );
    } finally {
      setUpdatingConfig(false);
    }
  };

  const envBadges = useMemo(() => {
    if (!status) return [];
    return [
      {
        label: "NVIDIA AI",
        ready: status.environment.nvidiaApiKey,
      },
      {
        label: "Gemini",
        ready: status.environment.geminiApiKey,
      },
      {
        label: "Anthropic",
        ready: status.environment.anthropicApiKey,
      },
    ];
  }, [status]);

  const toolNames = status?.mcpTools?.toolNames ?? [];

  return (
    <ContentContainer className="space-y-8 max-w-5xl mx-auto p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            My Study Buddy
          </h2>
          <p className="text-muted-foreground mt-2 text-lg">
            Manage your AI's brain and skills.
          </p>
        </div>
        <Button
          icon={<RefreshCcw className="w-4 h-4" />}
          variant="ghost"
          onClick={refreshAll}
          className="rounded-full hover:bg-muted"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {loadingStatus ? (
        <div className="flex items-center justify-center h-64 rounded-3xl bg-muted/30">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <span className="text-sm font-medium text-muted-foreground">Waking up...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bubbly-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">My Library</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {status?.documents.loadedCount ?? 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Book className="w-6 h-6 text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {status?.documents.requested.length ?? 0} books & docs
              </p>
            </Card>

            <Card className="bubbly-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Brain Power</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {status?.vectorStoreReady ? "Active" : "Sleepy"}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <Badge
                variant={status?.graphReady ? "success" : "warning"}
                size="sm"
                className="rounded-full px-3"
              >
                {status?.graphReady ? "Ready to Learn" : "Indexing..."}
              </Badge>
            </Card>

            <Card className="bubbly-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Skills</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {status?.mcpTools.toolCount ?? 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <Badge
                variant={status?.mcpTools.enabled ? "success" : "error"}
                size="sm"
                className="rounded-full px-3"
              >
                {status?.mcpTools.enabled ? "Connected" : "Offline"}
              </Badge>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bubbly-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Book className="w-5 h-5 text-primary" />
                    Knowledge Base
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    What should I read?
                  </p>
                </div>
              </div>
              <form className="space-y-4" onSubmit={handleDocumentReload}>
                <TextArea
                  label="File Paths"
                  rows={6}
                  value={documentsInput}
                  onChange={(event) => setDocumentsInput(event.target.value)}
                  placeholder={"/path/to/book.pdf\n/path/to/notes.md"}
                  className="rounded-xl bg-muted/30 border-transparent focus:bg-background transition-colors"
                />
                <Button type="submit" loading={updatingDocs} className="w-full rounded-xl">
                  Update Library
                </Button>
              </form>
            </Card>

            <Card className="bubbly-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-primary" />
                    Settings
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tweak how I work
                  </p>
                </div>
              </div>
              <form className="space-y-4" onSubmit={handleConfigSave}>
                <Input
                  label="Server Command"
                  value={configForm.MCP_SERVER_COMMAND}
                  onChange={(event) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      MCP_SERVER_COMMAND: event.target.value,
                    }))
                  }
                  placeholder="node"
                  className="rounded-xl bg-muted/30 border-transparent focus:bg-background transition-colors"
                />
                <Input
                  label="Server Path"
                  value={configForm.MCP_SERVER_PATH}
                  onChange={(event) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      MCP_SERVER_PATH: event.target.value,
                    }))
                  }
                  placeholder="/path/to/server.js"
                  className="rounded-xl bg-muted/30 border-transparent focus:bg-background transition-colors"
                />
                <Button type="submit" loading={updatingConfig} className="w-full rounded-xl">
                  Save Changes
                </Button>
              </form>
            </Card>
          </div>

          <Card className="bubbly-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Health Check
              </h3>
              <div className="flex gap-2 flex-wrap">
                {envBadges.map((item) => (
                  <Badge
                    key={item.label}
                    variant={item.ready ? "success" : "default"}
                    size="sm"
                    className="rounded-full px-3"
                  >
                    {item.label}: {item.ready ? "Good" : "Missing"}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="divide-y divide-border/50 border-t border-border/50">
              {configSummary.map((entry) => (
                <div
                  key={entry.key}
                  className="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 hover:bg-muted/30 px-2 rounded-lg transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {entry.key}
                    </p>
                    {entry.description && (
                      <p className="text-xs text-muted-foreground">
                        {entry.description}
                      </p>
                    )}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                    {entry.isSecret
                      ? (entry.maskedValue ?? "Not Set")
                      : (entry.value ?? "Not Set")}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </ContentContainer>
  );
};
