/**
 * StdioTransport - Handles communication with MCP servers via STDIO
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface TransportMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * StdioTransport manages communication with an MCP server via stdin/stdout
 */
export class StdioTransport extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = '';
  private pendingRequests = new Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();

  /**
   * Start the MCP server process and establish communication
   */
  async start(command: string, args: string[], env?: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...env },
        });

        if (!this.process.stdout || !this.process.stdin) {
          throw new Error('Failed to create stdio streams');
        }

        // Handle stdout data (responses from server)
        this.process.stdout.on('data', (data: Buffer) => {
          this.handleData(data);
        });

        // Handle stderr (logging from server)
        this.process.stderr?.on('data', (data: Buffer) => {
          console.error('[MCP Server stderr]:', data.toString());
        });

        // Handle process errors
        this.process.on('error', (error) => {
          console.error('[MCP Server error]:', error);
          this.emit('error', error);
          reject(error);
        });

        // Handle process exit
        this.process.on('exit', (code, signal) => {
          console.log(`[MCP Server exited] code: ${code}, signal: ${signal}`);
          this.emit('close');
        });

        // Give the process a moment to start
        setTimeout(() => resolve(), 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming data from the server
   */
  private handleData(data: Buffer): void {
    this.buffer += data.toString();
    
    // Process complete JSON-RPC messages (one per line)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const message: TransportMessage = JSON.parse(line);
        this.handleMessage(message);
      } catch (error) {
        console.error('[MCP Transport] Failed to parse message:', line, error);
      }
    }
  }

  /**
   * Handle a parsed JSON-RPC message
   */
  private handleMessage(message: TransportMessage): void {
    // Handle response messages
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }
    
    // Handle notification messages (no id)
    if (message.method && message.id === undefined) {
      this.emit('notification', message);
    }
  }

  /**
   * Send a JSON-RPC request to the server
   */
  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Transport not started');
    }

    const id = randomUUID();
    const message: TransportMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      const messageStr = JSON.stringify(message) + '\n';
      const processStdin = this.process?.stdin;
      if (processStdin) {
        processStdin.write(messageStr, (error) => {
          if (error) {
            this.pendingRequests.delete(id);
            reject(error);
          }
        });
      }

      // Add timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Send a notification (no response expected)
   */
  sendNotification(method: string, params?: unknown): void {
    if (!this.process || !this.process.stdin) {
      throw new Error('Transport not started');
    }

    const message: TransportMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const messageStr = JSON.stringify(message) + '\n';
    this.process.stdin.write(messageStr);
  }

  /**
   * Close the transport and terminate the server process
   */
  async close(): Promise<void> {
    if (this.process) {
      const process = this.process;
      return new Promise((resolve) => {
        process.on('exit', () => {
          this.process = null;
          resolve();
        });
        
        process.kill();
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
            this.process = null;
            resolve();
          }
        }, 5000);
      });
    }
  }

  /**
   * Check if the transport is connected
   */
  isConnected(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
