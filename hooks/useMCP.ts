/**
 * useMCP - Custom hook for MCP Server Integration
 * 
 * Provides unified interface for MCP server discovery and tool management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  mcpManager,
  MCPServer,
  MCPTool,
  MCPConnection
} from '../src/agentic';

export interface MCPState {
  // Servers
  servers: MCPServer[];
  connectedServers: MCPServer[];
  
  // Tools
  allTools: Array<{ server: string; tool: MCPTool }>;
  
  // Connections
  connections: MCPConnection[];
  
  // Stats
  stats: {
    totalServers: number;
    connectedServers: number;
    totalTools: number;
    totalConnections: number;
    totalRequests: number;
    totalErrors: number;
  };
}

export interface MCPActions {
  // Server Management
  registerServer: (server: Omit<MCPServer, 'status'>) => MCPServer;
  connectToServer: (serverName: string) => Promise<MCPConnection | null>;
  disconnectFromServer: (connectionId: string) => boolean;
  
  // Tool Discovery
  discoverTools: (serverName: string) => Promise<MCPTool[]>;
  callTool: (connectionId: string, toolName: string, args: Record<string, any>) => Promise<any>;
  
  // Queries
  findServersByCapability: (capability: 'tools' | 'resources' | 'prompts') => MCPServer[];
  findServersWithTool: (toolName: string) => MCPServer[];
}

export function useMCP(): [MCPState, MCPActions] {
  // State
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [connectedServers, setConnectedServers] = useState<MCPServer[]>([]);
  const [allTools, setAllTools] = useState<Array<{ server: string; tool: MCPTool }>>([]);
  const [connections, setConnections] = useState<MCPConnection[]>([]);

  // Update state periodically
  useEffect(() => {
    const updateState = () => {
      const allServers = mcpManager.getServers();
      setServers(allServers);
      setConnectedServers(allServers.filter(s => s.status === 'connected'));
      setAllTools(mcpManager.getAllTools());
      setConnections(mcpManager.getConnections());
    };

    updateState();
    const interval = setInterval(updateState, 5000);

    return () => clearInterval(interval);
  }, []);

  // Server actions
  const registerServer = useCallback((server: Omit<MCPServer, 'status'>) => {
    const registered = mcpManager.registerServer(server);
    setServers(mcpManager.getServers());
    return registered;
  }, []);

  const connectToServer = useCallback(async (serverName: string) => {
    const connection = await mcpManager.connectToServer(serverName);
    setServers(mcpManager.getServers());
    setConnections(mcpManager.getConnections());
    return connection;
  }, []);

  const disconnectFromServer = useCallback((connectionId: string) => {
    const result = mcpManager.disconnectFromServer(connectionId);
    setServers(mcpManager.getServers());
    setConnections(mcpManager.getConnections());
    return result;
  }, []);

  // Tool actions
  const discoverTools = useCallback(async (serverName: string) => {
    const tools = await mcpManager.discoverTools(serverName);
    setAllTools(mcpManager.getAllTools());
    return tools;
  }, []);

  const callTool = useCallback(async (connectionId: string, toolName: string, args: Record<string, any>) => {
    return mcpManager.callTool(connectionId, toolName, args);
  }, []);

  // Query actions
  const findServersByCapability = useCallback((capability: 'tools' | 'resources' | 'prompts') => {
    return mcpManager.findServersByCapability(capability);
  }, []);

  const findServersWithTool = useCallback((toolName: string) => {
    return mcpManager.findServersWithTool(toolName);
  }, []);

  const state: MCPState = {
    servers,
    connectedServers,
    allTools,
    connections,
    stats: mcpManager.getStats()
  };

  const actions: MCPActions = {
    registerServer,
    connectToServer,
    disconnectFromServer,
    discoverTools,
    callTool,
    findServersByCapability,
    findServersWithTool
  };

  return [state, actions];
}
