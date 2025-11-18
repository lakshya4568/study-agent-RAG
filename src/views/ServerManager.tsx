/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Server as ServerIcon, Trash2, AlertCircle } from "lucide-react";
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
    if (!confirm("Are you sure you want to remove this server?")) return;

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
    <ContentContainer>
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ServerIcon className="w-8 h-8 text-purple-500" />
            MCP Servers
          </h2>
          <p className="text-gray-600 mt-1">
            {servers.length} servers connected
          </p>
        </div>
        <Button
          icon={showAddForm ? undefined : <Plus className="w-5 h-5" />}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "Add Server"}
        </Button>
      </div>

      {/* Add Server Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <Card>
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Add New Server
              </h3>
              <form onSubmit={handleAddServer} className="space-y-4">
                <Input
                  label="Server Name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="My MCP Server"
                  required
                />

                <Input
                  label="Server ID (optional)"
                  value={formData.id}
                  onChange={(e) =>
                    setFormData({ ...formData, id: e.target.value })
                  }
                  placeholder="Auto-generated if empty"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Command
                  </label>
                  <select
                    value={formData.command}
                    onChange={(e) =>
                      setFormData({ ...formData, command: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="node">Node.js (node)</option>
                    <option value="npx">NPX Package (npx)</option>
                    <option value="python">Python (python)</option>
                    <option value="python3">Python 3 (python3)</option>
                  </select>
                </div>

                {formData.command === "npx" ? (
                  <>
                    <Input
                      label="NPX Package Name"
                      value={formData.npxPackage}
                      onChange={(e) =>
                        setFormData({ ...formData, npxPackage: e.target.value })
                      }
                      placeholder="@upstash/context7-mcp"
                      required
                    />
                    <Input
                      label="Additional Arguments (optional)"
                      value={formData.additionalArgs}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          additionalArgs: e.target.value,
                        })
                      }
                      placeholder="-y"
                    />
                  </>
                ) : (
                  <Input
                    label="Server Script Path"
                    value={formData.serverPath}
                    onChange={(e) =>
                      setFormData({ ...formData, serverPath: e.target.value })
                    }
                    placeholder="/absolute/path/to/server.js"
                    required
                  />
                )}

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={loading}
                    loading={loading}
                    className="flex-1"
                  >
                    Add Server
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Servers Grid */}
      {servers.length === 0 ? (
        <Card className="text-center py-16">
          <div className="text-6xl mb-4">🔌</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No servers connected
          </h3>
          <p className="text-gray-600 mb-6">
            Add your first MCP server to get started
          </p>
          <Button
            onClick={() => setShowAddForm(true)}
            icon={<Plus className="w-5 h-5" />}
          >
            Add Server
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {servers.map((server, index) => (
              <motion.div
                key={server.config.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card hoverable>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {server.config.name}
                      </h3>
                      <Badge
                        variant={getStatusVariant(server.status)}
                        size="sm"
                      >
                        {server.status}
                      </Badge>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                      <ServerIcon className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span>ID:</span>
                      <span className="font-mono text-xs truncate max-w-[60%]">
                        {server.config.id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Command:</span>
                      <span className="font-mono text-xs">
                        {server.config.command}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tools:</span>
                      <Badge variant="info" size="sm">
                        {server.tools.length}
                      </Badge>
                    </div>
                  </div>

                  {server.error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{server.error}</span>
                    </div>
                  )}

                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4" />}
                    onClick={() => handleRemoveServer(server.config.id)}
                    className="w-full"
                  >
                    Remove
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
