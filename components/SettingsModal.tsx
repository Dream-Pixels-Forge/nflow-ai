import React, { useState, useEffect } from 'react';
import { Settings, X, Volume2, VolumeX, MousePointer2, Zap, Gauge, Server, Cloud, Database, RefreshCw, AlertTriangle, CheckCircle2, Wifi, Cpu, Globe, Github } from 'lucide-react';
import { AppSettings, SuggestionLevel, AIProvider, PROVIDER_NAMES, PROVIDER_DESCRIPTIONS } from '../types';
import { getOllamaModels } from '../services/ollamaService';

interface SettingsModalProps {
  settings: AppSettings;
  onUpdate: (newSettings: AppSettings) => void;
  onClose: () => void;
}

const FALLBACK_MODELS = [
  'llama3', 
  'mistral', 
  'codellama', 
  'qwen2.5-coder', 
  'gemma', 
  'deepseek-coder',
  'phi3'
];

const PROVIDER_ICONS: Record<AIProvider, React.ElementType> = {
  gemini: Cloud,
  ollama: Database,
  openrouter: Globe,
  nvidia: Cpu
};

const PROVIDER_COLORS: Record<AIProvider, string> = {
  gemini: 'nexus-accent',
  ollama: 'orange-500',
  openrouter: 'blue-400',
  nvidia: 'green-500'
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onUpdate, onClose }) => {
  
  const [activeTab, setActiveTab] = useState<'general' | 'backend'>('general');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  // Fetch models when tab opens or URL changes
  useEffect(() => {
    if (activeTab === 'backend' && settings.aiProvider === 'ollama') {
        // Don't auto-fetch immediately to avoid spamming if user is typing URL
        // User should click Test Connection for definitive check
    }
  }, [activeTab, settings.aiProvider]);

  const fetchModels = async () => {
    setIsFetchingModels(true);
    setFetchError(null);
    setConnectionStatus('unknown');
    
    try {
      const models = await getOllamaModels(settings.ollamaUrl);
      if (models.length === 0) throw new Error("No models returned");
      setAvailableModels(models);
      setConnectionStatus('connected');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Connection failed or blocked.';
      console.warn("Auto-fetch failed, using fallbacks", e);
      setFetchError(message);
      setConnectionStatus('error');
      setAvailableModels(FALLBACK_MODELS); // Fallback so user can still select
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleToggle = (key: keyof AppSettings) => {
    if (key === 'suggestionLevel' || key === 'aiProvider' || key === 'ollamaUrl' || key === 'ollamaGeneralModel' || key === 'ollamaCodingModel') return; 
    onUpdate({
      ...settings,
      [key]: !settings[key]
    });
  };

  const handleLevelChange = (level: SuggestionLevel) => {
    onUpdate({
      ...settings,
      suggestionLevel: level
    });
  };

  const handleProviderChange = (provider: AIProvider) => {
    onUpdate({
        ...settings,
        aiProvider: provider
    });
  };

  const renderProviderSettings = () => {
    switch (settings.aiProvider) {
      case 'ollama':
        return renderOllamaSettings();
      case 'openrouter':
        return renderOpenRouterSettings();
      case 'nvidia':
        return renderNVIDIASettings();
      case 'gemini':
      default:
        return renderGeminiSettings();
    }
  };

  const renderGeminiSettings = () => (
    <div className="p-4 rounded bg-nexus-800/30 border border-nexus-accent/30 space-y-4 animate-fade-in">
      <div className="text-[10px] text-nexus-accent uppercase font-bold">Google Gemini Configuration</div>
      <div className="space-y-1">
        <label className="text-[10px] text-nexus-dim uppercase font-bold">API Key</label>
        <input 
          type="password"
          value={settings.geminiApiKey || ''}
          onChange={(e) => onUpdate({ ...settings, geminiApiKey: e.target.value })}
          className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-nexus-accent focus:outline-none font-mono"
          placeholder="Enter your Gemini API key"
        />
      </div>
      <div className="text-[9px] text-nexus-dim">
        Get your API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-nexus-accent hover:underline">Google AI Studio</a>
      </div>
    </div>
  );

  const renderOllamaSettings = () => (
    <div className="p-4 rounded bg-nexus-800/30 border border-orange-500/30 space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
          <label className="text-[10px] text-orange-400 uppercase font-bold">Connection URL</label>
      </div>
      <div className="flex gap-2">
           <input 
              type="text" 
              value={settings.ollamaUrl}
              onChange={(e) => onUpdate({ ...settings, ollamaUrl: e.target.value })}
              className="flex-1 bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-orange-500 focus:outline-none font-mono"
              placeholder="http://localhost:11434"
          />
          <button 
              onClick={fetchModels} 
              disabled={isFetchingModels}
              className={`px-3 rounded border border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[10px] font-bold tracking-wider flex items-center gap-2 transition-all ${isFetchingModels ? 'opacity-50' : ''}`}
          >
              {isFetchingModels ? (
                  <RefreshCw size={12} className="animate-spin" />
              ) : (
                  <Wifi size={12} />
              )}
              TEST CONNECTION
          </button>
      </div>

      {/* Connection Status Indicator */}
      {connectionStatus === 'connected' && (
          <div className="text-[10px] text-green-400 flex items-center gap-2 bg-green-900/10 p-2 rounded border border-green-900/30">
              <CheckCircle2 size={12} />
              <span>ONLINE: Successfully connected to Ollama.</span>
          </div>
      )}
      
      {/* Error Notice */}
      {fetchError && connectionStatus === 'error' && (
           <div className="text-[9px] bg-red-500/10 border border-red-500/30 p-2 rounded text-red-300 flex gap-2 items-start">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <div>
                  <div className="font-bold mb-1">CONNECTION FAILED</div>
                  <p className="mb-2">Your browser blocked the request. You must allow CORS.</p>
                  Run this command in your terminal and restart Ollama:
                  <code className="block bg-black/30 p-1 mt-1 rounded text-orange-300 select-all font-mono">
                     launchctl setenv OLLAMA_ORIGINS "*"
                  </code>
                  <span className="opacity-50 mt-1 block">(Windows: Set environment variable OLLAMA_ORIGINS to *)</span>
              </div>
           </div>
      )}

      {/* Model Selection - General */}
      <div className="space-y-1">
          <label className="text-[10px] text-orange-400 uppercase font-bold">General/Orchestrator Model</label>
          <div className="text-[9px] text-nexus-dim mb-1">Used by: CHAT, PLAN, MONITOR</div>
          <select 
              value={settings.ollamaGeneralModel}
              onChange={(e) => onUpdate({ ...settings, ollamaGeneralModel: e.target.value })}
              className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-orange-500 focus:outline-none font-mono"
          >
              <option value="">-- Select Model --</option>
              {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
      </div>

       {/* Model Selection - Coding */}
       <div className="space-y-1 border-t border-nexus-border/50 pt-2">
          <label className="text-[10px] text-orange-400 uppercase font-bold">Specialist/Coding Model</label>
          <div className="text-[9px] text-nexus-dim mb-1">Used by: CODER, ARCHITECT, TEST, SECURE, DEPLOY</div>
          <select 
              value={settings.ollamaCodingModel}
              onChange={(e) => onUpdate({ ...settings, ollamaCodingModel: e.target.value })}
              className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-orange-500 focus:outline-none font-mono"
          >
              <option value="">-- Same as General --</option>
              {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
      </div>
    </div>
  );

  const renderOpenRouterSettings = () => (
    <div className="p-4 rounded bg-nexus-800/30 border border-blue-400/30 space-y-4 animate-fade-in">
      <div className="text-[10px] text-blue-400 uppercase font-bold">OpenRouter Configuration</div>
      <div className="space-y-1">
        <label className="text-[10px] text-nexus-dim uppercase font-bold">API Key</label>
        <input 
          type="password"
          value={settings.openrouterApiKey || ''}
          onChange={(e) => onUpdate({ ...settings, openrouterApiKey: e.target.value })}
          className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-blue-400 focus:outline-none font-mono"
          placeholder="sk-or-..."
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-nexus-dim uppercase font-bold">Model</label>
        <select 
          value={settings.openrouterModel || 'anthropic/claude-3.5-sonnet'}
          onChange={(e) => onUpdate({ ...settings, openrouterModel: e.target.value })}
          className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-blue-400 focus:outline-none font-mono"
        >
          <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
          <option value="anthropic/claude-3-opus">Claude 3 Opus</option>
          <option value="openai/gpt-4o">GPT-4o</option>
          <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
          <option value="google/gemini-pro-1.5">Gemini Pro 1.5</option>
          <option value="meta-llama/llama-3.1-405b-instruct">Llama 3.1 405B</option>
          <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
          <option value="mistralai/mixtral-8x22b-instruct">Mixtral 8x22B</option>
          <option value="deepseek/deepseek-chat">DeepSeek Chat</option>
        </select>
      </div>
      <div className="text-[9px] text-nexus-dim">
        Access 100+ models via <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">OpenRouter</a>
      </div>
    </div>
  );

  const renderNVIDIASettings = () => (
    <div className="p-4 rounded bg-nexus-800/30 border border-green-500/30 space-y-4 animate-fade-in">
      <div className="text-[10px] text-green-500 uppercase font-bold">NVIDIA NIM Configuration</div>
      <div className="space-y-1">
        <label className="text-[10px] text-nexus-dim uppercase font-bold">API Key</label>
        <input 
          type="password"
          value={settings.nvidiaApiKey || ''}
          onChange={(e) => onUpdate({ ...settings, nvidiaApiKey: e.target.value })}
          className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-green-500 focus:outline-none font-mono"
          placeholder="nvapi-..."
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-nexus-dim uppercase font-bold">Model</label>
        <select 
          value={settings.nvidiaModel || 'meta/llama-3.1-405b-instruct'}
          onChange={(e) => onUpdate({ ...settings, nvidiaModel: e.target.value })}
          className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-green-500 focus:outline-none font-mono"
        >
          <option value="meta/llama-3.1-405b-instruct">Llama 3.1 405B</option>
          <option value="meta/llama-3.1-70b-instruct">Llama 3.1 70B</option>
          <option value="meta/llama-3.1-8b-instruct">Llama 3.1 8B</option>
          <option value="mistralai/mixtral-8x22b-instruct-v0.1">Mixtral 8x22B</option>
          <option value="google/gemma-2-27b-it">Gemma 2 27B</option>
          <option value="nvidia/nemotron-4-340b-instruct">Nemotron 4 340B</option>
          <option value="snowflake/arctic">Arctic</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-nexus-dim uppercase font-bold">Base URL</label>
        <input 
          type="text"
          value={settings.nvidiaBaseUrl || 'https://integrate.api.nvidia.com/v1'}
          onChange={(e) => onUpdate({ ...settings, nvidiaBaseUrl: e.target.value })}
          className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-green-500 focus:outline-none font-mono"
          placeholder="https://integrate.api.nvidia.com/v1"
        />
      </div>
      <div className="text-[9px] text-nexus-dim">
        Get your API key from <a href="https://build.nvidia.com/" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">NVIDIA Build</a>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8 animate-fade-in">
      <div className="w-full max-w-md bg-nexus-900 border border-nexus-border shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col rounded relative overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-nexus-border bg-nexus-800/50 flex items-center justify-between">
           <div className="flex items-center gap-2 text-nexus-dim">
              <Settings size={16} />
              <span className="text-sm font-mono font-bold tracking-widest text-gray-200">SYSTEM CONFIGURATION</span>
           </div>
           <button onClick={onClose} className="text-nexus-dim hover:text-white transition-colors">
              <X size={18} />
           </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-nexus-border">
            <button 
                onClick={() => setActiveTab('general')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase transition-colors ${activeTab === 'general' ? 'bg-nexus-800 text-nexus-accent' : 'text-nexus-dim hover:bg-nexus-800/50'}`}
            >
                Interface & Agents
            </button>
            <button 
                onClick={() => setActiveTab('backend')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase transition-colors ${activeTab === 'backend' ? 'bg-nexus-800 text-nexus-accent' : 'text-nexus-dim hover:bg-nexus-800/50'}`}
            >
                Backend Services
            </button>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          
          {activeTab === 'general' && (
              <>
                {/* Suggestion Level */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-nexus-accent">
                        <Gauge size={16} />
                        <label className="text-xs font-bold font-mono uppercase">Orchestrator Suggestion Level</label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {(['low', 'medium', 'high'] as SuggestionLevel[]).map((level) => (
                        <button
                            key={level}
                            onClick={() => handleLevelChange(level)}
                            className={`
                            py-2 px-3 rounded border text-xs font-mono uppercase transition-all
                            ${settings.suggestionLevel === level 
                                ? 'bg-nexus-accent/10 border-nexus-accent text-nexus-accent shadow-[0_0_10px_rgba(0,255,157,0.1)]' 
                                : 'bg-nexus-800 border-nexus-border text-gray-500 hover:border-gray-600'
                            }
                            `}
                        >
                            {level}
                        </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-nexus-dim leading-relaxed">
                        {settings.suggestionLevel === 'low' && "Conservative. Only suggests switches for critical context mismatches."}
                        {settings.suggestionLevel === 'medium' && "Balanced. Standard flow for most development tasks."}
                        {settings.suggestionLevel === 'high' && "Aggressive. Proactively suggests specialists for every sub-task."}
                    </p>
                </div>

                <div className="h-px w-full bg-nexus-border/50" />

                {/* Toggles */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 hover:bg-nexus-800/30 rounded cursor-pointer" onClick={() => handleToggle('soundEnabled')}>
                        <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded ${settings.soundEnabled ? 'text-nexus-accent bg-nexus-accent/10' : 'text-gray-600 bg-nexus-900'}`}>
                            {settings.soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-300">Interface Sounds</span>
                            <span className="text-[9px] text-nexus-dim">Enable haptic audio feedback</span>
                        </div>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.soundEnabled ? 'bg-nexus-accent' : 'bg-gray-700'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.soundEnabled ? 'left-5' : 'left-0.5'}`} />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-2 hover:bg-nexus-800/30 rounded cursor-pointer" onClick={() => handleToggle('autoScroll')}>
                        <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded ${settings.autoScroll ? 'text-blue-400 bg-blue-400/10' : 'text-gray-600 bg-nexus-900'}`}>
                            <MousePointer2 size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-300">Auto-Scroll</span>
                            <span className="text-[9px] text-nexus-dim">Follow new messages automatically</span>
                        </div>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.autoScroll ? 'bg-nexus-accent' : 'bg-gray-700'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.autoScroll ? 'left-5' : 'left-0.5'}`} />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-2 hover:bg-nexus-800/30 rounded cursor-pointer" onClick={() => handleToggle('animations')}>
                        <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded ${settings.animations ? 'text-purple-400 bg-purple-400/10' : 'text-gray-600 bg-nexus-900'}`}>
                            <Zap size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-300">Reduced Motion</span>
                            <span className="text-[9px] text-nexus-dim">Disable CRT scanlines and heavy animations</span>
                        </div>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${!settings.animations ? 'bg-nexus-accent' : 'bg-gray-700'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${!settings.animations ? 'left-5' : 'left-0.5'}`} />
                        </div>
                    </div>
                </div>
            </>
          )}

          {activeTab === 'backend' && (
             <div className="space-y-6">
                 {/* Provider Selector */}
                 <div className="space-y-3">
                    <div className="flex items-center gap-2 text-nexus-accent">
                        <Server size={16} />
                        <label className="text-xs font-bold font-mono uppercase">AI Inference Backend</label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(PROVIDER_NAMES) as AIProvider[]).map((provider) => {
                           const Icon = PROVIDER_ICONS[provider];
                           const color = PROVIDER_COLORS[provider];
                           return (
                             <button
                                key={provider}
                                onClick={() => handleProviderChange(provider)}
                                className={`p-3 rounded border flex flex-col items-center gap-2 transition-all ${settings.aiProvider === provider ? `bg-${color}/10 border-${color} text-${color}` : 'bg-nexus-800 border-nexus-border text-gray-500'}`}
                             >
                                <Icon size={20} />
                                <span className="text-xs font-bold">{PROVIDER_NAMES[provider].toUpperCase()}</span>
                                <span className="text-[9px] opacity-60">{PROVIDER_DESCRIPTIONS[provider].split(' ').slice(0, 3).join(' ')}</span>
                             </button>
                           );
                        })}
                    </div>
                 </div>

                 {/* Provider Settings */}
                 {renderProviderSettings()}

                 {/* GitHub Integration */}
                 <div className="h-px w-full bg-nexus-border/50" />
                 <div className="space-y-3">
                     <div className="flex items-center gap-2 text-gray-400">
                         <Github size={16} />
                         <label className="text-xs font-bold font-mono uppercase">GitHub Integration</label>
                     </div>
                     <div className="space-y-2">
                         <div>
                             <label className="text-[10px] text-nexus-dim uppercase font-bold">Personal Access Token</label>
                             <input
                                 type="password"
                                 value={settings.githubToken || ''}
                                 onChange={(e) => onUpdate({ ...settings, githubToken: e.target.value })}
                                 className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-gray-400 focus:outline-none font-mono"
                                 placeholder="ghp_..."
                             />
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                             <div>
                                 <label className="text-[10px] text-nexus-dim uppercase font-bold">Owner</label>
                                 <input
                                     type="text"
                                     value={settings.githubOwner || ''}
                                     onChange={(e) => onUpdate({ ...settings, githubOwner: e.target.value })}
                                     className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-gray-400 focus:outline-none font-mono"
                                     placeholder="owner"
                                 />
                             </div>
                             <div>
                                 <label className="text-[10px] text-nexus-dim uppercase font-bold">Repository</label>
                                 <input
                                     type="text"
                                     value={settings.githubRepo || ''}
                                     onChange={(e) => onUpdate({ ...settings, githubRepo: e.target.value })}
                                     className="w-full bg-nexus-900 border border-nexus-border text-xs p-2 text-gray-300 rounded focus:border-gray-400 focus:outline-none font-mono"
                                     placeholder="repo"
                                 />
                             </div>
                         </div>
                     </div>
                     <div className="text-[9px] text-nexus-dim">
                         Create a <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:underline">Personal Access Token</a> with repo permissions.
                     </div>
                 </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};
