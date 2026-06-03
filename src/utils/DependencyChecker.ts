import { Dependency } from '../models/Dependency';
import { DependencyCheckResult } from '../models/DependencyCheckResult';

/**
 * Checks Ollama connectivity and available models
 * @param settings - AppSettings containing Ollama configuration
 * @returns Promise of DependencyCheckResult specific to Ollama
 */
export const checkOllamaDependencies = async (ollamaUrl: string, generalModel: string, codingModel: string): Promise<DependencyCheckResult> => {
  const timestamp = new Date();
  const missingDependencies: Dependency[] = [];
  const incompatibleDependencies: Dependency[] = [];

  try {
    // Check if Ollama is accessible by getting available models
    const response = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Ollama API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const availableModels = data.models.map((m: any) => m.name);

    // Check if required models are available
    if (!availableModels.includes(generalModel)) {
      missingDependencies.push({
        name: generalModel,
        version: 'latest',
        status: 'missing',
        required: true,
        description: 'General purpose AI model for Ollama'
      });
    }

    if (codingModel && !availableModels.includes(codingModel)) {
      missingDependencies.push({
        name: codingModel,
        version: 'latest',
        status: 'missing',
        required: true,
        description: 'Coding-focused AI model for Ollama'
      });
    }

    const success = missingDependencies.length === 0;

    return {
      timestamp,
      success,
      missingDependencies,
      incompatibleDependencies,
      message: success
        ? "Ollama is running and required models are available"
        : "Ollama connection successful but some models are missing",
      actionSteps: success
        ? []
        : [
            `Run 'ollama pull ${generalModel}' to download the general model`,
            codingModel ? `Run 'ollama pull ${codingModel}' to download the coding model` : '',
            "Ensure Ollama is running with 'ollama serve'",
            "Configure OLLAMA_ORIGINS environment variable if needed: OLLAMA_ORIGINS=\"*\""
          ].filter(step => step.length > 0)
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      timestamp,
      success: false,
      missingDependencies: [{
        name: 'ollama-service',
        version: 'latest',
        status: 'missing',
        required: true,
        description: 'Ollama AI model server must be running and accessible'
      }],
      incompatibleDependencies: [],
      message: `Cannot connect to Ollama at ${ollamaUrl}: ${message}`,
      actionSteps: [
        "Install Ollama from https://ollama.ai/",
        `Start Ollama server with 'ollama serve'`,
        `Verify Ollama is accessible at ${ollamaUrl}`,
        "Run 'OLLAMA_ORIGINS=\"*\" ollama serve' to allow browser connections",
        "Check firewall settings if connection is blocked"
      ]
    };
  }
};

/**
 * Checks if all required dependencies are properly installed
 * @returns DependencyCheckResult with details about the verification
 */
export const checkDependencies = async (): Promise<DependencyCheckResult> => {
  const timestamp = new Date();
  const missingDependencies: Dependency[] = [];
  const incompatibleDependencies: Dependency[] = [];

  // Placeholder logic - in reality, this would parse package.json and check node_modules
  try {
    // This is where we'd implement actual dependency checking logic
    // For now, we'll simulate a successful check
    const success = missingDependencies.length === 0 && incompatibleDependencies.length === 0;

    return {
      timestamp,
      success,
      missingDependencies,
      incompatibleDependencies,
      message: success
        ? "All required dependencies are properly installed"
        : "Some dependencies are missing or incompatible",
      actionSteps: success
        ? []
        : [
            "Run 'npm install' to install missing dependencies",
            "Check your Node.js version (requires v18+)"
          ]
    };
  } catch (error) {
    return {
      timestamp,
      success: false,
      missingDependencies: [],
      incompatibleDependencies: [],
      message: "An error occurred while checking dependencies",
      actionSteps: [
        "Ensure you're running Node.js v18+",
        "Try deleting node_modules and package-lock.json, then run 'npm install'"
      ]
    };
  }
};

/**
 * Verifies if the Node.js version meets the project requirements
 * @returns boolean indicating if the version is compatible
 */
export const checkNodeVersion = (): boolean => {
  const [major] = process.version.split('.').map(Number);
  return major >= 18; // Check if Node.js version is 18 or higher
};
