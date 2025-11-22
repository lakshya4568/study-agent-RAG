/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Blocks, Trash2, AlertCircle, Terminal, Package, Command, Plug } from "lucide-react";
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
    if (!confirm("Remove this tool?")) return;

    try {
      await window.mcpClient.removeServer(serverId);
      await loadServers();
    } catch (err) {
      console.error("Failed to remove server:", err);
    }
  };

  const getStatusVariant = (
    status: string
  ): "success" | "warning" | "error" | "default" => {
    switch (status) {
      case "connected":
        return "success";
      case "connecting":
        return "warning";
      case "error":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <ContentContainer className="max-w-5xl mx-auto p-6 md:p-8">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-8 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Blocks className="w-8 h-8 text-primary" />
            Tools & Integrations
          </h2>
          <p className="text-muted-foreground mt-2 text-lg">
            Connect external apps to supercharge your study buddy.
          </p>
        </div>
        <Button
          icon={showAddForm ? undefined : <Plus className="w-4 h-4" />}
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? "ghost" : "primary"}
          className="rounded-full"
        >
          {showAddForm ? "Cancel" : "Add New Tool"}
        </Button>
      </div>

      {/* Add Server Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <Card className="bubbly-card p-6 border-primary/20 bg-primary/5">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Plug className="w-6 h-6 text-primary" />
                Connect New Tool
              </h3>
              <form onSubmit={handleAddServer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Tool Name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g. Google Drive"
                    required
                    className="bg-background rounded-xl"
                  />

                  <Input
                    label="ID (Optional)"
                    value={formData.id}
                    onChange={(e) =>
                      setFormData({ ...formData, id: e.target.value })
                    }
                    placeholder="Auto-generated"
                    className="bg-background rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Type
                  </label>
                  <div className="relative">
                    <select
                      value={formData.command}
                      onChange={(e) =>
                        setFormData({ ...formData, command: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                      required
                    >
                      <option value="node">Node.js Script</option>
                      <option value="npx">NPX Package</option>
                      <option value="python">Python Script</option>
                    </select>
                    <Command className="absolute right-3 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {formData.command === "npx" ? (
                  <>
                    <Input
                      label="Package Name"
                      value={formData.npxPackage}
                      onChange={(e) =>
                        setFormData({ ...formData, npxPackage: e.target.value })
                      }
                      placeholder="@modelcontextprotocol/server-filesystem"
                      required
                      className="bg-background rounded-xl"
                    />
                    <Input
                      label="Arguments (Optional)"
                      value={formData.additionalArgs}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          additionalArgs: e.target.value,
                        })
                      }
                      placeholder="e.g. /path/to/allowed/dir"
                      className="bg-background rounded-xl"
                    />
                  </>
                ) : (
                  <Input
                    label="Script Path"
                    value={formData.serverPath}
                    onChange={(e) =>
                      setFormData({ ...formData, serverPath: e.target.value })
                    }
                    placeholder="/absolute/path/to/server.js"
                    required
                    className="bg-background rounded-xl"
                  />
                )}

                {error && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    loading={loading}
                    className="flex-1 rounded-xl"
                  >
                    Connect Tool
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Servers Grid */}
      {servers.length === 0 ? (
        <Card className="text-center py-16 border-dashed border-2 bg-muted/5 rounded-3xl">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Blocks className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            No Tools Connected
          </h3>
          <p className="text-muted-foreground mb-8 text-base max-w-md mx-auto">
            Add a tool to give your study buddy more capabilities, like reading files or searching the web.
          </p>
          <Button
            onClick={() => setShowAddForm(true)}
            icon={<Plus className="w-4 h-4" />}
            className="rounded-full"
          >
            Add First Tool
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {servers.map((server, index) => (
              <motion.div
                key={server.config.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card hoverable className="h-full flex flex-col border-border shadow-sm hover:shadow-lg transition-all group bubbly-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0 pr-3">
                      <h3 className="text-lg font-bold text-foreground truncate">
                        {server.config.name}
                      </h3>
                      <div className="mt-1">
                        <Badge
                          variant={getStatusVariant(server.status)}
                          size="sm"
                          className="rounded-full px-2"
                        >
                          {server.status === "connected" ? "Active" : server.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Package className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-muted-foreground mb-6 flex-1">
                    <div className="flex justify-between items-center py-1 border-b border-border/30">
                      <span className="text-xs font-medium">Type</span>
                      <span className="text-xs opacity-70">
                        {server.config.command === "node" ? "Node.js" : server.config.command === "npx" ? "NPX" : "Python"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-xs font-medium">Capabilities</span>
                      <Badge variant="outline" size="sm" className="rounded-full">
                        {server.tools.length} skills
                      </Badge>
                    </div>
                  </div>

                  {server.error && (
                    <div className="mb-4 p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-start gap-2">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="break-all">{server.error}</span>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4" />}
                    onClick={() => handleRemoveServer(server.config.id)}
                    className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                  >
                    Disconnect
                  </Button>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </ContentContainer>
  );
};
