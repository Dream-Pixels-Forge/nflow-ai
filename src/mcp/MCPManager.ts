/**
 * MCP Server Integration
 * 
 * Implements Model Context Protocol server discovery and tool management
 * Based on MCP specification from Obsidian vault.
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  outputSchema?: {
    type: string;
    properties: Record<string, any>;
  };
}

export interface MCPServer {
  name: string;
  version: string;
  url: string;
  description: string;
  tools: MCPTool[];
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
  };
  authentication?: {
    type: 'none' | 'api-key' | 'oauth2';
    tokenUrl?: string;
  };
  status: 'connected' | 'disconnected' | 'error';
  lastConnected?: string;
  error?: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export interface MCPConnection {
  id: string;
  server: MCPServer;
  connectedAt: string;
  lastActivity: string;
  requestCount: number;
  errorCount: number;
}

export interface MCPConfig {
  autoDiscover: boolean;
  discoveryTimeoutMs: number;
  requestTimeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

const DEFAULT_CONFIG: MCPConfig = {
  autoDiscover: true,
  discoveryTimeoutMs: 10000,
  requestTimeoutMs: 30000,
  maxRetries: 3,
  retryDelayMs: 1000
};

/**
 * MCP Manager - Handles server discovery and tool management
 */
export class MCPManager {
  private servers: Map<string, MCPServer> = new Map();
  private connections: Map<string, MCPConnection> = new Map();
  private config: MCPConfig;

  constructor(config: Partial<MCPConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register an MCP server
   */
  registerServer(server: Omit<MCPServer, 'status'>): MCPServer {
    const fullServer: MCPServer = {
      ...server,
      status: 'disconnected'
    };

    this.servers.set(server.name, fullServer);
    return fullServer;
  }

  /**
   * Connect to an MCP server
   */
  async connectToServer(serverName: string): Promise<MCPConnection | null> {
    const server = this.servers.get(serverName);
    if (!server) {
      console.error(`[MCP] Server ${serverName} not found`);
      return null;
    }

    try {
      // Attempt to connect to server
      const response = await fetch(`${server.url}/health`, {
        signal: AbortSignal.timeout(this.config.discoveryTimeoutMs)
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      // Update server status
      server.status = 'connected';
      server.lastConnected = new Date().toISOString();

      // Create connection
      const connection: MCPConnection = {
        id: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        server,
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        requestCount: 0,
        errorCount: 0
      };

      this.connections.set(connection.id, connection);

      return connection;
    } catch (error) {
      server.status = 'error';
      server.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[MCP] Failed to connect to ${serverName}:`, error);
      return null;
    }
  }

  /**
   * Disconnect from an MCP server
   */
  disconnectFromServer(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    // Update server status
    connection.server.status = 'disconnected';

    // Remove connection
    this.connections.delete(connectionId);

    return true;
  }

  /**
   * Discover tools from a server
   */
  async discoverTools(serverName: string): Promise<MCPTool[]> {
    const server = this.servers.get(serverName);
    if (!server) return [];

    try {
      const response = await fetch(`${server.url}/tools`, {
        signal: AbortSignal.timeout(this.config.discoveryTimeoutMs)
      });

      if (!response.ok) {
        throw new Error(`Tool discovery failed: ${response.status}`);
      }

      const tools: MCPTool[] = await response.json();
      server.tools = tools;

      return tools;
    } catch (error) {
      console.error(`[MCP] Failed to discover tools from ${serverName}:`, error);
      return [];
    }
  }

  /**
   * Call a tool on an MCP server
   */
  async callTool(
    connectionId: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      const response = await fetch(`${connection.server.url}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(this.config.requestTimeoutMs)
      });

      if (!response.ok) {
        throw new Error(`Tool call failed: ${response.status}`);
      }

      const result = await response.json();

      // Update connection stats
      connection.requestCount++;
      connection.lastActivity = new Date().toISOString();

      return result;
    } catch (error) {
      connection.errorCount++;
      throw error;
    }
  }

  /**
   * Get all registered servers
   */
  getServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server by name
   */
  getServer(name: string): MCPServer | undefined {
    return this.servers.get(name);
  }

  /**
   * Get all active connections
   */
  getConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): MCPConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Find servers by capability
   */
  findServersByCapability(capability: 'tools' | 'resources' | 'prompts'): MCPServer[] {
    return Array.from(this.servers.values()).filter(
      server => server.capabilities[capability]
    );
  }

  /**
   * Find servers with specific tool
   */
  findServersWithTool(toolName: string): MCPServer[] {
    return Array.from(this.servers.values()).filter(
      server => server.tools.some(tool => tool.name === toolName)
    );
  }

  /**
   * Get all available tools across servers
   */
  getAllTools(): Array<{ server: string; tool: MCPTool }> {
    const tools: Array<{ server: string; tool: MCPTool }> = [];

    this.servers.forEach((server) => {
      server.tools.forEach((tool) => {
        tools.push({ server: server.name, tool });
      });
    });

    return tools;
  }

  /**
   * Get MCP stats
   */
  getStats(): {
    totalServers: number;
    connectedServers: number;
    totalTools: number;
    totalConnections: number;
    totalRequests: number;
    totalErrors: number;
  } {
    const servers = Array.from(this.servers.values());
    const connections = Array.from(this.connections.values());

    return {
      totalServers: servers.length,
      connectedServers: servers.filter(s => s.status === 'connected').length,
      totalTools: servers.reduce((sum, s) => sum + s.tools.length, 0),
      totalConnections: connections.length,
      totalRequests: connections.reduce((sum, c) => sum + c.requestCount, 0),
      totalErrors: connections.reduce((sum, c) => sum + c.errorCount, 0)
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MCPConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): MCPConfig {
    return { ...this.config };
  }

  /**
   * Clear all servers and connections
   */
  clear(): void {
    this.servers.clear();
    this.connections.clear();
  }
}

// Singleton instance
export const mcpManager = new MCPManager();
