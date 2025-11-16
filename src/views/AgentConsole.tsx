import React, { useEffect, useMemo, useState } from "react";
import {
  RefreshCcw,
  FileText,
  ShieldCheck,
  ServerCog,
  Activity,
  Settings2,
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
import type { AgentStatus } from "../agent/StudyAgentService";
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
      setSuccessMessage("Agent reloaded with updated document set.");
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
      setSuccessMessage("Configuration saved to .env");
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
        label: "NVIDIA API",
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
    <ContentContainer className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ServerCog className="w-8 h-8 text-purple-500" />
            Agent Console
          </h2>
          <p className="text-gray-600">
            Monitor Study Agent health, reload documents, and manage
            configuration
          </p>
        </div>
        <Button
          icon={<RefreshCcw className="w-5 h-5" />}
          variant="ghost"
          onClick={refreshAll}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      {loadingStatus ? (
        <Card className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">Documents Loaded</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {status?.documents.loadedCount ?? 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {status?.documents.requested.length ?? 0} configured sources
              </p>
              {status?.documents.fallbackUsed && (
                <Badge variant="warning" size="sm" className="mt-2">
                  Fallback context in use
                </Badge>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">Vector Store</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {status?.vectorStoreReady ? "Ready" : "Init"}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <Badge
                variant={status?.graphReady ? "success" : "warning"}
                size="sm"
              >
                {status?.graphReady ? "Graph compiled" : "Graph pending"}
              </Badge>
              {status?.lastInvocationLatencyMs && (
                <p className="text-xs text-gray-500 mt-2">
                  Last response: {Math.round(status.lastInvocationLatencyMs)}ms
                </p>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">MCP Tools</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {status?.mcpTools.toolCount ?? 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <Badge
                variant={status?.mcpTools.enabled ? "success" : "error"}
                size="sm"
              >
                {status?.mcpTools.enabled ? "Connected" : "Not Connected"}
              </Badge>
              {toolNames.length ? (
                <p className="text-xs text-gray-500 mt-2">
                  {toolNames.slice(0, 3).join(", ")}
                  {toolNames.length > 3 && " …"}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  Add an MCP server to unlock extra tools
                </p>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Document Sources
                  </h3>
                  <p className="text-sm text-gray-600">
                    Provide absolute or relative paths (one per line)
                  </p>
                </div>
                <Badge variant="info" size="sm">
                  {status?.documents.requested.length ?? 0} tracked
                </Badge>
              </div>
              <form className="space-y-4" onSubmit={handleDocumentReload}>
                <TextArea
                  label="Study Documents"
                  rows={6}
                  value={documentsInput}
                  onChange={(event) => setDocumentsInput(event.target.value)}
                  placeholder={"README.md"}
                />
                <Button type="submit" loading={updatingDocs}>
                  Reload Documents
                </Button>
              </form>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    MCP Defaults
                  </h3>
                  <p className="text-sm text-gray-600">
                    Update defaults stored in .env (used by quick-add forms)
                  </p>
                </div>
                <Settings2 className="w-6 h-6 text-purple-500" />
              </div>
              <form className="space-y-4" onSubmit={handleConfigSave}>
                <Input
                  label="MCP Server Command"
                  value={configForm.MCP_SERVER_COMMAND}
                  onChange={(event) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      MCP_SERVER_COMMAND: event.target.value,
                    }))
                  }
                  placeholder="node"
                />
                <Input
                  label="MCP Server Path"
                  value={configForm.MCP_SERVER_PATH}
                  onChange={(event) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      MCP_SERVER_PATH: event.target.value,
                    }))
                  }
                  placeholder="/absolute/path/to/server.js"
                />
                <Button type="submit" loading={updatingConfig}>
                  Save Configuration
                </Button>
              </form>
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Environment Overview
              </h3>
              <div className="flex gap-2 flex-wrap">
                {envBadges.map((item) => (
                  <Badge
                    key={item.label}
                    variant={item.ready ? "success" : "error"}
                    size="sm"
                  >
                    {item.label}: {item.ready ? "Ready" : "Missing"}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {configSummary.map((entry) => (
                <div
                  key={entry.key}
                  className="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {entry.key}
                    </p>
                    {entry.description && (
                      <p className="text-xs text-gray-500">
                        {entry.description}
                      </p>
                    )}
                  </div>
                  <div className="text-sm font-mono text-gray-700 break-all">
                    {entry.isSecret
                      ? (entry.maskedValue ?? "Not set")
                      : (entry.value ?? "Not set")}
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
