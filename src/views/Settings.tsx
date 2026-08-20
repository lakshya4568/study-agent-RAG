import React, { useEffect, useState } from "react";
import {
  Settings2,
  Save,
  Key,
  ServerCog,
  Activity,
  Sparkles,
  Brain,
  Trash2,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { ContentContainer } from "../components/layout";
import { Button, Card, Input, LoadingSpinner } from "../components/ui";
import type { ConfigSummaryItem } from "../client/types";
import { useChatStore } from "../client/store";

interface ConfigFormState {
  NVIDIA_API_KEY: string;
  GEMINI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  MCP_SERVER_PATH: string;
  MCP_SERVER_COMMAND: string;
}

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"keys" | "memory" | "appearance">("keys");
  const [configSummary, setConfigSummary] = useState<ConfigSummaryItem[]>([]);
  const [configForm, setConfigForm] = useState<ConfigFormState>({
    NVIDIA_API_KEY: "",
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

  // Memory Studio State
  const [memoryContent, setMemoryContent] = useState<string>("");
  const [loadingMemory, setLoadingMemory] = useState<boolean>(false);
  const [savingMemory, setSavingMemory] = useState<boolean>(false);

  const { theme, setTheme } = useChatStore();

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
    <ContentContainer className="space-y-6 max-w-4xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-border/40">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Settings2 className="w-7 h-7 text-primary" />
            Control Studio
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure LLM inference providers, long-term cognitive memory, and user experience.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-muted/30 border border-border/30 w-fit">
        <button
          onClick={() => setActiveTab("keys")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "keys"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Model Credentials
        </button>
        <button
          onClick={() => setActiveTab("memory")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === "memory"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Brain className="w-3.5 h-3.5" /> Long-Term Memory
        </button>
        <button
          onClick={() => setActiveTab("appearance")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "appearance"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Appearance
        </button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-xs font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {loadingStatus ? (
        <div className="flex items-center justify-center h-64 rounded-3xl bg-card/30 border border-border/40">
          <LoadingSpinner size="lg" />
        </div>
      ) : activeTab === "keys" ? (
        <form onSubmit={handleConfigSave} className="space-y-6">
          <div className="double-bezel">
            <div className="double-bezel-inner p-6 bg-card/70 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Key className="w-4 h-4 text-primary" />
                <h3>AI Provider API Keys</h3>
              </div>

              <Input
                label={
                  <span className="flex items-center gap-2">
                    NVIDIA API Key
                    {isSet("NVIDIA_API_KEY") && (
                      <span className="text-[10px] text-emerald-400 font-semibold">(Configured)</span>
                    )}
                  </span>
                }
                type="password"
                value={configForm.NVIDIA_API_KEY}
                onChange={(e) =>
                  setConfigForm((prev) => ({ ...prev, NVIDIA_API_KEY: e.target.value }))
                }
                placeholder={isSet("NVIDIA_API_KEY") ? "••••••••••••••••" : "nvapi-..."}
                className="rounded-xl"
              />

              <Input
                label={
                  <span className="flex items-center gap-2">
                    Gemini API Key
                    {isSet("GEMINI_API_KEY") && (
                      <span className="text-[10px] text-emerald-400 font-semibold">(Configured)</span>
                    )}
                  </span>
                }
                type="password"
                value={configForm.GEMINI_API_KEY}
                onChange={(e) =>
                  setConfigForm((prev) => ({ ...prev, GEMINI_API_KEY: e.target.value }))
                }
                placeholder={isSet("GEMINI_API_KEY") ? "••••••••••••••••" : "AIzaSy..."}
                className="rounded-xl"
              />

              <Input
                label={
                  <span className="flex items-center gap-2">
                    OpenAI API Key
                    {isSet("OPENAI_API_KEY") && (
                      <span className="text-[10px] text-emerald-400 font-semibold">(Configured)</span>
                    )}
                  </span>
                }
                type="password"
                value={configForm.OPENAI_API_KEY}
                onChange={(e) =>
                  setConfigForm((prev) => ({ ...prev, OPENAI_API_KEY: e.target.value }))
                }
                placeholder={isSet("OPENAI_API_KEY") ? "••••••••••••••••" : "sk-..."}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={updatingConfig}
              className="rounded-full px-8 font-semibold shadow-md"
              icon={<Save className="w-4 h-4" />}
            >
              Save Credentials
            </Button>
          </div>
        </form>
      ) : activeTab === "memory" ? (
        <div className="space-y-6">
          <div className="double-bezel">
            <div className="double-bezel-inner p-6 bg-card/70 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Brain className="w-4 h-4 text-primary" />
                  <h3>Long-Term Memory Core (`Memory.md`)</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearMemory}
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  className="text-xs text-muted-foreground hover:text-destructive rounded-full"
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
                className="w-full p-4 rounded-2xl bg-zinc-950/80 border border-border/40 font-mono text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-y custom-scrollbar"
                placeholder="Agent long-term memory markdown content..."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveMemory}
              loading={savingMemory}
              className="rounded-full px-8 font-semibold shadow-md"
              icon={<Save className="w-4 h-4" />}
            >
              Save Memory Profile
            </Button>
          </div>
        </div>
      ) : (
        <div className="double-bezel">
          <div className="double-bezel-inner p-6 bg-card/70 space-y-5">
            <h3 className="text-sm font-bold text-foreground">Theme & Interface Appearance</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setTheme("dark");
                  document.documentElement.classList.remove("theme-light");
                  document.documentElement.classList.add("dark");
                }}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  theme === "dark"
                    ? "bg-primary/10 border-primary shadow-sm"
                    : "bg-muted/30 border-border/40 hover:bg-muted/50"
                }`}
              >
                <p className="text-sm font-bold text-foreground">Obsidian Dark</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deep OLED blacks and emerald ambient lighting
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTheme("light");
                  document.documentElement.classList.remove("dark");
                  document.documentElement.classList.add("theme-light");
                }}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  theme === "light"
                    ? "bg-primary/10 border-primary shadow-sm"
                    : "bg-muted/30 border-border/40 hover:bg-muted/50"
                }`}
              >
                <p className="text-sm font-bold text-foreground">Clean Light</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Soft neutral tones with high-contrast text
                </p>
              </button>
            </div>
          </div>
        </div>
      )}
    </ContentContainer>
  );
};

export default Settings;
