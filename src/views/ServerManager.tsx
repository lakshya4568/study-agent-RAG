import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Blocks,
  Trash2,
  AlertCircle,
  Package,
  Command,
  Plug,
  CheckCircle2,
  Sparkles,
  Zap,
} from "lucide-react";
import { ContentContainer } from "../components/layout";
import { Button, Card, Input, Badge } from "../components/ui";

interface ServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ServerInfo {
  config: ServerConfig;
  status: "disconnected" | "connecting" | "connected" | "error";
  tools: any[];
  error?: string;
}

export const ServerManager: React.FC = () => {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    command: "node",
    serverPath: "",
    npxPackage: "",
    additionalArgs: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const allServers = await window.mcpClient.getAllServers();
      setServers(allServers);
    } catch (err) {
      console.error("Failed to load servers:", err);
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let args: string[];

      if (formData.command === "npx") {
        args = [];
        if (formData.additionalArgs.trim()) {
          args.push(...formData.additionalArgs.trim().split(/\s+/));
        }
        args.push(formData.npxPackage);
      } else {
        args = [formData.serverPath];
      }

      const config: ServerConfig = {
        id: formData.id || `server-${Date.now()}`,
        name: formData.name,
        command: formData.command,
        args: args,
      };

      const result = await window.mcpClient.addServer(config);

      if (result.success) {
        setFormData({
          id: "",
          name: "",
          command: "node",
          serverPath: "",
          npxPackage: "",
          additionalArgs: "",
        });
        setShowAddForm(false);
        await loadServers();
      } else {
        setError(result.error || "Failed to add server");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveServer = async (serverId: string) => {
    if (!confirm("Disconnect and remove this tool server?")) return;

    try {
      await window.mcpClient.removeServer(serverId);
      await loadServers();
    } catch (err) {
      console.error("Failed to remove server:", err);
    }
  };

  return (
    <ContentContainer className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-5 border-b border-border/40">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Blocks className="w-7 h-7 text-primary" />
            MCP Tool Integrations
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect Model Context Protocol (MCP) servers to equip your AI agent with filesystem and
            API skills.
          </p>
        </div>
        <Button
          icon={showAddForm ? undefined : <Plus className="w-4 h-4" />}
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? "ghost" : "primary"}
          className="rounded-full px-5 text-xs font-semibold"
        >
          {showAddForm ? "Cancel" : "Connect Tool Server"}
        </Button>
      </div>

      {/* Add Server Modal Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="double-bezel mb-6">
              <div className="double-bezel-inner p-6 bg-card/80 space-y-5">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Plug className="w-5 h-5 text-primary" /> Connect New MCP Server
                </h3>

                <form onSubmit={handleAddServer} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Integration Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Local Filesystem"
                      required
                      className="rounded-xl"
                    />
                    <Input
                      label="Server Identifier (Optional)"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      placeholder="auto-generated"
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Runtime Type
                    </label>
                    <select
                      value={formData.command}
                      onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-border/60 bg-muted/30 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    >
                      <option value="node">Node.js Binary</option>
                      <option value="npx">NPX Package Execution</option>
                      <option value="python">Python Interpreter</option>
                    </select>
                  </div>

                  {formData.command === "npx" ? (
                    <div className="space-y-4">
                      <Input
                        label="NPX Package"
                        value={formData.npxPackage}
                        onChange={(e) => setFormData({ ...formData, npxPackage: e.target.value })}
                        placeholder="@modelcontextprotocol/server-filesystem"
                        required
                        className="rounded-xl"
                      />
                      <Input
                        label="Allowed Directory / Arguments"
                        value={formData.additionalArgs}
                        onChange={(e) => setFormData({ ...formData, additionalArgs: e.target.value })}
                        placeholder="/Users/username/Desktop/Notes"
                        className="rounded-xl"
                      />
                    </div>
                  ) : (
                    <Input
                      label="Executable Script Path"
                      value={formData.serverPath}
                      onChange={(e) => setFormData({ ...formData, serverPath: e.target.value })}
                      placeholder="/absolute/path/to/server.js"
                      required
                      className="rounded-xl"
                    />
                  )}

                  {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAddForm(false)}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" loading={loading} className="rounded-xl px-6">
                      Launch & Connect
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Servers Listing */}
      {servers.length === 0 ? (
        <div className="double-bezel text-center p-12">
          <div className="double-bezel-inner p-8 flex flex-col items-center">
            <Blocks className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-bold text-foreground">No MCP Tool Servers Connected</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed mb-4">
              Equip your study agent with external tools like filesystem access or web search by
              connecting an MCP server.
            </p>
            <Button
              onClick={() => setShowAddForm(true)}
              icon={<Plus className="w-4 h-4" />}
              className="rounded-full"
            >
              Add First Tool Server
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {servers.map((server) => (
            <div key={server.config.id} className="double-bezel">
              <div className="double-bezel-inner p-5 bg-card/60 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">
                      {server.config.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          server.status === "connected"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-muted text-muted-foreground border-border/40"
                        }`}
                      >
                        <Zap className="w-2.5 h-2.5" />
                        {server.status === "connected" ? "Connected" : server.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {server.config.command}
                      </span>
                    </div>
                  </div>

                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                </div>

                {/* Available tools count */}
                <div className="py-2 px-3 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Exposed Tool Skills</span>
                  <span className="font-semibold text-foreground">
                    {server.tools?.length || 0} Registered
                  </span>
                </div>

                <div className="pt-2 border-t border-border/30 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveServer(server.config.id)}
                    className="text-xs text-destructive hover:bg-destructive/10 rounded-xl"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ContentContainer>
  );
};

export default ServerManager;
