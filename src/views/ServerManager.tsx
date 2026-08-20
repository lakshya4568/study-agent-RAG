import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Blocks,
  Trash2,
  AlertCircle,
  Package,
  Plug,
  Zap,
} from "lucide-react";
import { ContentContainer } from "../components/layout";
import { Button, Input } from "../components/ui";

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
    <ContentContainer className="max-w-5xl mx-auto p-6 md:p-8 space-y-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-5 border-b border-border/40">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Blocks className="w-6 h-6 text-primary" />
            MCP Tool Integrations
          </h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            Model Context Protocol servers · Local tool execution & filesystem tools
          </p>
        </div>
        <Button
          icon={showAddForm ? undefined : <Plus className="w-4 h-4" />}
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? "ghost" : "primary"}
          className="rounded-xl px-5 text-xs font-semibold"
        >
          {showAddForm ? "Cancel" : "Connect Tool Server"}
        </Button>
      </div>

      {/* Add Server Form in Machined Bezel */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="neu-bezel mb-6">
              <div className="neu-bezel-inner p-6 space-y-5">
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
                    />
                    <Input
                      label="Server Identifier (Optional)"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      placeholder="auto-generated"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Runtime Type
                    </label>
                    <select
                      value={formData.command}
                      onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl neu-inset text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/80 font-medium"
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
                      />
                      <Input
                        label="Allowed Directory / Arguments"
                        value={formData.additionalArgs}
                        onChange={(e) => setFormData({ ...formData, additionalArgs: e.target.value })}
                        placeholder="/Users/username/Desktop/Notes"
                      />
                    </div>
                  ) : (
                    <Input
                      label="Executable Script Path"
                      value={formData.serverPath}
                      onChange={(e) => setFormData({ ...formData, serverPath: e.target.value })}
                      placeholder="/absolute/path/to/server.js"
                      required
                    />
                  )}

                  {error && (
                    <div className="p-3 neu-inset bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-500 dark:text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2.5 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAddForm(false)}
                      size="sm"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" loading={loading} size="sm" className="px-6">
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
        <div className="neu-bezel text-center p-6">
          <div className="neu-bezel-inner p-10 flex flex-col items-center max-w-md mx-auto">
            <Blocks className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-bold text-foreground">No MCP Tool Servers Connected</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed mb-5 text-center">
              Equip your study agent with external tools like filesystem access or web search by
              connecting an MCP server.
            </p>
            <Button
              onClick={() => setShowAddForm(true)}
              icon={<Plus className="w-4 h-4" />}
              size="sm"
              className="px-5"
            >
              Connect First Tool Server
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {servers.map((server) => {
            const hasTools = server.tools && server.tools.length > 0;
            return (
              <div key={server.config.id} className="neu-bezel group">
                <div className="neu-bezel-inner p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-foreground truncate">
                          {server.config.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border neu-raised-sm ${
                              server.status === "connected"
                                ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/25"
                                : "bg-secondary text-muted-foreground border-border/40"
                            }`}
                          >
                            <Zap className="w-2.5 h-2.5" />
                            {server.status === "connected" ? "Connected" : server.status}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {server.config.command} {server.config.args?.slice(0, 1).join(" ")}
                          </span>
                        </div>
                      </div>

                      <div className="w-9 h-9 rounded-xl neu-inset-sm text-primary flex items-center justify-center shrink-0 border border-border/40">
                        <Package className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Connected Tools Breakdown */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium pb-1 border-b border-border/40">
                        <span className="font-semibold text-foreground/80">Exposed Tools ({server.tools?.length || 0})</span>
                        <span className="text-[10px] font-mono text-emerald-500 dark:text-emerald-400 font-bold">Active in Graph</span>
                      </div>

                      {hasTools ? (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                          {server.tools.map((t: any, idx: number) => (
                            <div
                              key={t.name || idx}
                              className="p-2.5 rounded-xl neu-inset-sm border border-border/40"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-primary">
                                  {t.name}
                                </span>
                                {t.inputSchema?.properties && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/40 font-semibold">
                                    {Object.keys(t.inputSchema.properties).length} params
                                  </span>
                                )}
                              </div>
                              {t.description && (
                                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                                  {t.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic py-2">
                          No individual tool definitions reported.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/40 flex justify-end">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemoveServer(server.config.id)}
                      className="text-xs"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ContentContainer>
  );
};

export default ServerManager;

