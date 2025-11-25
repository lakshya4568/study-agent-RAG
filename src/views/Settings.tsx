import React, { useEffect, useState } from "react";
import {
    Settings2,
    Save,
    Key,
    ServerCog,
    Activity,
    Sparkles
} from "lucide-react";
import { ContentContainer } from "../components/layout";
import {
    Button,
    Card,
    Input,
    LoadingSpinner,
} from "../components/ui";
import type { ConfigSummaryItem } from "../client/types";

interface ConfigFormState {
    NVIDIA_API_KEY: string;
    GEMINI_API_KEY: string;
    ANTHROPIC_API_KEY: string;
    OPENAI_API_KEY: string;
    MCP_SERVER_PATH: string;
    MCP_SERVER_COMMAND: string;
}

const getConfigValue = (summary: ConfigSummaryItem[], key: string): string => {
    const entry = summary.find((item) => item.key === key);
    if (!entry) return "";
    // If it's a secret and masked, we might want to show empty or the masked value
    // For editing, usually we show empty placeholder if it's set, or let them overwrite
    return entry.value ?? "";
};

export const Settings: React.FC = () => {
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

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoadingStatus(true);
        try {
            const summary = await window.appConfig.getSummary();
            setConfigSummary(summary);

            // We don't want to pre-fill secrets with masked values as that would save stars to the file
            // Instead we keep them empty in the form, but show status in the UI
            setConfigForm({
                NVIDIA_API_KEY: "", // Don't load secrets
                GEMINI_API_KEY: "",
                ANTHROPIC_API_KEY: "",
                OPENAI_API_KEY: "",
                MCP_SERVER_PATH: getConfigValue(summary, "MCP_SERVER_PATH"),
                MCP_SERVER_COMMAND: getConfigValue(summary, "MCP_SERVER_COMMAND"),
            });
            setError(null);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load configuration"
            );
        } finally {
            setLoadingStatus(false);
        }
    };

    const handleConfigSave = async (event: React.FormEvent) => {
        event.preventDefault();
        setUpdatingConfig(true);
        setSuccessMessage(null);
        try {
            // Only send values that are not empty strings
            const updates: Record<string, string | undefined> = {};

            if (configForm.NVIDIA_API_KEY) updates.NVIDIA_API_KEY = configForm.NVIDIA_API_KEY;
            if (configForm.GEMINI_API_KEY) updates.GEMINI_API_KEY = configForm.GEMINI_API_KEY;
            if (configForm.ANTHROPIC_API_KEY) updates.ANTHROPIC_API_KEY = configForm.ANTHROPIC_API_KEY;
            if (configForm.OPENAI_API_KEY) updates.OPENAI_API_KEY = configForm.OPENAI_API_KEY;

            // Always send these as they are visible
            updates.MCP_SERVER_PATH = configForm.MCP_SERVER_PATH || undefined;
            updates.MCP_SERVER_COMMAND = configForm.MCP_SERVER_COMMAND || undefined;

            const summary = await window.appConfig.update(updates);
            setConfigSummary(summary);

            // Clear password fields after save
            setConfigForm(prev => ({
                ...prev,
                NVIDIA_API_KEY: "",
                GEMINI_API_KEY: "",
                ANTHROPIC_API_KEY: "",
                OPENAI_API_KEY: "",
            }));

            setSuccessMessage("Settings saved successfully!");

            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);

        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to update configuration"
            );
        } finally {
            setUpdatingConfig(false);
        }
    };

    const isSet = (key: string) => {
        return configSummary.find(item => item.key === key)?.isSet;
    };

    return (
        <ContentContainer className="space-y-8 max-w-4xl mx-auto p-6 md:p-8">
            <div className="flex items-center justify-between gap-4 pb-6 border-b border-border/40">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Settings2 className="w-8 h-8 text-primary" />
                        Settings
                    </h2>
                    <p className="text-muted-foreground mt-2 text-lg">
                        Configure your AI providers and environment variables.
                    </p>
                </div>
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
                        <span className="text-sm font-medium text-muted-foreground">Loading settings...</span>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleConfigSave} className="space-y-8">

                    {/* API Keys Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-xl font-semibold text-foreground">
                            <Key className="w-5 h-5 text-primary" />
                            <h3>API Keys</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <Card className="p-6 space-y-4">
                                <Input
                                    label={
                                        <span className="flex items-center gap-2">
                                            NVIDIA API Key
                                            {isSet("NVIDIA_API_KEY") && <span className="text-xs text-emerald-500 font-medium">(Configured)</span>}
                                        </span>
                                    }
                                    type="password"
                                    value={configForm.NVIDIA_API_KEY}
                                    onChange={(e) => setConfigForm(prev => ({ ...prev, NVIDIA_API_KEY: e.target.value }))}
                                    placeholder={isSet("NVIDIA_API_KEY") ? "••••••••••••••••" : "Enter NVIDIA API Key"}
                                    className="rounded-xl bg-muted/30 border-transparent focus:bg-background transition-colors"
                                />

                                <Input
                                    label={
                                        <span className="flex items-center gap-2">
                                            Gemini API Key
                                            {isSet("GEMINI_API_KEY") && <span className="text-xs text-emerald-500 font-medium">(Configured)</span>}
                                        </span>
                                    }
                                    type="password"
                                    value={configForm.GEMINI_API_KEY}
                                    onChange={(e) => setConfigForm(prev => ({ ...prev, GEMINI_API_KEY: e.target.value }))}
                                    placeholder={isSet("GEMINI_API_KEY") ? "••••••••••••••••" : "Enter Gemini API Key"}
                                    className="rounded-xl bg-muted/30 border-transparent focus:bg-background transition-colors"
                                />

                                <Input
                                    label={
                                        <span className="flex items-center gap-2">
                                            Anthropic API Key
                                            {isSet("ANTHROPIC_API_KEY") && <span className="text-xs text-emerald-500 font-medium">(Configured)</span>}
                                        </span>
                                    }
                                    type="password"
                                    value={configForm.ANTHROPIC_API_KEY}
                                    onChange={(e) => setConfigForm(prev => ({ ...prev, ANTHROPIC_API_KEY: e.target.value }))}
                                    placeholder={isSet("ANTHROPIC_API_KEY") ? "••••••••••••••••" : "Enter Anthropic API Key"}
                                    className="rounded-xl bg-muted/30 border-transparent focus:bg-background transition-colors"
                                />

                                <Input
                                    label={
                                        <span className="flex items-center gap-2">
                                            OpenAI API Key
                                            {isSet("OPENAI_API_KEY") && <span className="text-xs text-emerald-500 font-medium">(Configured)</span>}
                                        </span>
                                    }
                                    type="password"
                                    value={configForm.OPENAI_API_KEY}
                                    onChange={(e) => setConfigForm(prev => ({ ...prev, OPENAI_API_KEY: e.target.value }))}
                                    placeholder={isSet("OPENAI_API_KEY") ? "••••••••••••••••" : "Enter OpenAI API Key"}
                                    className="rounded-xl bg-muted/30 border-transparent focus:bg-background transition-colors"
                                />
                            </Card>
                        </div>
                    </section>

                    {/* Server Configuration Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-xl font-semibold text-foreground">
                            <ServerCog className="w-5 h-5 text-primary" />
                            <h3>MCP Server Configuration</h3>
                        </div>
                        <Card className="p-6 space-y-4">
                            <Input
                                label="Server Command"
                                value={configForm.MCP_SERVER_COMMAND}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, MCP_SERVER_COMMAND: e.target.value }))}
                                placeholder="node"
                                className="rounded-xl bg-muted/30 border-transparent focus:bg-background transition-colors"
                            />
                            <Input
                                label="Server Path"
                                value={configForm.MCP_SERVER_PATH}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, MCP_SERVER_PATH: e.target.value }))}
                                placeholder="/path/to/server.js"
                                className="rounded-xl bg-muted/30 border-transparent focus:bg-background transition-colors"
                            />
                        </Card>
                    </section>

                    <div className="flex justify-end pt-4">
                        <Button
                            type="submit"
                            loading={updatingConfig}
                            className="rounded-xl px-8"
                            icon={<Save className="w-4 h-4" />}
                        >
                            Save Changes
                        </Button>
                    </div>
                </form>
            )}
        </ContentContainer>
    );
};
