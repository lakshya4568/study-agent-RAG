import React, { useEffect, useState } from "react";
import {
  Settings2,
  Save,
  Key,
  Activity,
  Brain,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { ContentContainer } from "../components/layout";
import { Button, Input, LoadingSpinner } from "../components/ui";
import type { ConfigSummaryItem } from "../client/types";

interface ConfigFormState {
  NVIDIA_API_KEY: string;
  GROQ_API_KEY: string;
  GEMINI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  MCP_SERVER_PATH: string;
  MCP_SERVER_COMMAND: string;
}

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"keys" | "memory">("keys");
  const [configSummary, setConfigSummary] = useState<ConfigSummaryItem[]>([]);
  const [configForm, setConfigForm] = useState<ConfigFormState>({
    NVIDIA_API_KEY: "",
    GROQ_API_KEY: "",
    GEMINI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    OPENAI_API_KEY: "",
    MCP_SERVER_PATH: "",
    MCP_SERVER_COMMAND: "",
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Memory State
  const [memoryContent, setMemoryContent] = useState<string>("");
  const [, setLoadingMemory] = useState<boolean>(false);
  const [savingMemory, setSavingMemory] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
    loadMemory();
  }, []);

  const loadSettings = async () => {
    setLoadingStatus(true);
    try {
      const summary = await window.appConfig.getSummary();
      setConfigSummary(summary);

      const getVal = (key: string) => summary.find((i) => i.key === key)?.value ?? "";
      setConfigForm({
        NVIDIA_API_KEY: "",
        GROQ_API_KEY: "",
        GEMINI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        OPENAI_API_KEY: "",
        MCP_SERVER_PATH: getVal("MCP_SERVER_PATH"),
        MCP_SERVER_COMMAND: getVal("MCP_SERVER_COMMAND"),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configuration");
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadMemory = async () => {
    setLoadingMemory(true);
    try {
      if (window.studyAgent && (window.studyAgent as any).getMemory) {
        const mem = await (window.studyAgent as any).getMemory();
        setMemoryContent(mem || "");
      } else {
        setMemoryContent("# Long-Term User Study Profile\n\n- Preferred Explanations: Concrete examples & mental models\n- Active Topics: Computer Science, Mathematics, Neural Networks\n- Spaced Repetition Target: 10 cards daily\n");
      }
    } catch {
      setMemoryContent("# Long-Term User Study Profile\n\nNo persistent profile yet.");
    } finally {
      setLoadingMemory(false);
    }
  };

  const handleSaveMemory = async () => {
    setSavingMemory(true);
    try {
      if (window.studyAgent && (window.studyAgent as any).saveMemory) {
        await (window.studyAgent as any).saveMemory(memoryContent);
      }
      setSuccessMessage("Long-term memory profile saved!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save memory");
    } finally {
      setSavingMemory(false);
    }
  };

  const handleClearMemory = async () => {
    if (!confirm("Are you sure you want to reset your long-term study memory profile?")) return;
    setMemoryContent("# Long-Term User Study Profile\n\n");
    setSuccessMessage("Memory profile reset. Click Save to persist.");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleConfigSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setUpdatingConfig(true);
    setSuccessMessage(null);
    try {
      const updates: Record<string, string | undefined> = {};
      if (configForm.NVIDIA_API_KEY) updates.NVIDIA_API_KEY = configForm.NVIDIA_API_KEY;
      if (configForm.GROQ_API_KEY) updates.GROQ_API_KEY = configForm.GROQ_API_KEY;
      if (configForm.GEMINI_API_KEY) updates.GEMINI_API_KEY = configForm.GEMINI_API_KEY;
      if (configForm.ANTHROPIC_API_KEY) updates.ANTHROPIC_API_KEY = configForm.ANTHROPIC_API_KEY;
      if (configForm.OPENAI_API_KEY) updates.OPENAI_API_KEY = configForm.OPENAI_API_KEY;
      updates.MCP_SERVER_PATH = configForm.MCP_SERVER_PATH || undefined;
      updates.MCP_SERVER_COMMAND = configForm.MCP_SERVER_COMMAND || undefined;

      const summary = await window.appConfig.update(updates);
      setConfigSummary(summary);
      setConfigForm((prev) => ({
        ...prev,
        NVIDIA_API_KEY: "",
        GROQ_API_KEY: "",
        GEMINI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        OPENAI_API_KEY: "",
      }));

      setSuccessMessage("Credentials and settings updated successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update configuration");
    } finally {
      setUpdatingConfig(false);
    }
  };

  const isSet = (key: string) => {
    return configSummary.find((item) => item.key === key)?.isSet;
  };

  return (
    <ContentContainer className="space-y-6 max-w-4xl mx-auto p-6 md:p-8 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-border">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Settings2 className="w-6 h-6 text-primary" />
            Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            LLM inference credentials · Long-term cognitive profile
          </p>
        </div>
      </div>

      {/* Tactile Segmented Tab Bar */}
      <div className="neu-segmented-trough p-1 rounded-2xl flex items-center gap-1.5 w-fit">
        <button
          onClick={() => setActiveTab("keys")}
          className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
            activeTab === "keys"
              ? "neu-segmented-active text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Model Credentials
        </button>
        <button
          onClick={() => setActiveTab("memory")}
          className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
            activeTab === "memory"
              ? "neu-segmented-active text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Brain className="w-3.5 h-3.5 text-primary" /> Long-Term Memory
        </button>
      </div>

      {error && (
        <div className="p-3.5 neu-inset bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2">
          <Activity className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 neu-raised-sm bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-500 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMessage}
        </div>
      )}

      {loadingStatus ? (
        <div className="flex items-center justify-center h-64 rounded-2xl neu-inset">
          <LoadingSpinner size="lg" />
        </div>
      ) : activeTab === "keys" ? (
        <form onSubmit={handleConfigSave} className="space-y-5">
          <div className="neu-bezel">
            <div className="neu-bezel-inner p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground pb-2 border-b border-border">
                <Key className="w-4 h-4 text-primary" />
                <h3>AI Provider API Credentials</h3>
              </div>

              <Input
                label={
                  <span className="flex items-center gap-2">
                    Groq API Key
                    {isSet("GROQ_API_KEY") && (
                      <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold">(Configured - Ultra Fast)</span>
                    )}
                  </span>
                }
                type="password"
                value={configForm.GROQ_API_KEY}
                onChange={(e) =>
                  setConfigForm((prev) => ({ ...prev, GROQ_API_KEY: e.target.value }))
                }
                placeholder={isSet("GROQ_API_KEY") ? "••••••••••••••••" : "gsk_..."}
              />

              <Input
                label={
                  <span className="flex items-center gap-2">
                    NVIDIA API Key
                    {isSet("NVIDIA_API_KEY") && (
                      <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold">(Configured)</span>
                    )}
                  </span>
                }
                type="password"
                value={configForm.NVIDIA_API_KEY}
                onChange={(e) =>
                  setConfigForm((prev) => ({ ...prev, NVIDIA_API_KEY: e.target.value }))
                }
                placeholder={isSet("NVIDIA_API_KEY") ? "••••••••••••••••" : "nvapi-..."}
              />

              <Input
                label={
                  <span className="flex items-center gap-2">
                    Gemini API Key
                    {isSet("GEMINI_API_KEY") && (
                      <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold">(Configured)</span>
                    )}
                  </span>
                }
                type="password"
                value={configForm.GEMINI_API_KEY}
                onChange={(e) =>
                  setConfigForm((prev) => ({ ...prev, GEMINI_API_KEY: e.target.value }))
                }
                placeholder={isSet("GEMINI_API_KEY") ? "••••••••••••••••" : "AIzaSy..."}
              />

              <Input
                label={
                  <span className="flex items-center gap-2">
                    OpenAI API Key
                    {isSet("OPENAI_API_KEY") && (
                      <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold">(Configured)</span>
                    )}
                  </span>
                }
                type="password"
                value={configForm.OPENAI_API_KEY}
                onChange={(e) =>
                  setConfigForm((prev) => ({ ...prev, OPENAI_API_KEY: e.target.value }))
                }
                placeholder={isSet("OPENAI_API_KEY") ? "••••••••••••••••" : "sk-..."}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={updatingConfig}
              size="sm"
              className="px-6 font-semibold"
              icon={<Save className="w-4 h-4" />}
            >
              Save Credentials
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="neu-bezel">
            <div className="neu-bezel-inner p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Brain className="w-4 h-4 text-primary" />
                  <h3>Long-Term Cognitive Memory Core (`Memory.md`)</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearMemory}
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  className="text-xs text-muted-foreground hover:text-rose-400"
                >
                  Reset
                </Button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Your agent automatically updates this persistent markdown file with your study habits,
                strengths, preferred learning styles, and recurring topic difficulties.
              </p>

              <textarea
                value={memoryContent}
                onChange={(e) => setMemoryContent(e.target.value)}
                rows={10}
                className="w-full p-4 rounded-xl neu-inset font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/80 leading-relaxed resize-y custom-scrollbar"
                placeholder="Agent long-term memory markdown content..."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveMemory}
              loading={savingMemory}
              size="sm"
              className="px-6 font-semibold"
              icon={<Save className="w-4 h-4" />}
            >
              Save Memory Profile
            </Button>
          </div>
        </div>
      )}
    </ContentContainer>
  );
};

export default Settings;


