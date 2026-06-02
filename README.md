# NEXUSFLOW | Production-Grade Agentic Operating System

NexusFlow is a production-grade agentic operating system that orchestrates a team of specialized AI agents to build software. It features comprehensive security, observability, and orchestration capabilities based on the PRIDES framework and A2A/AP2 protocols.

![NexusFlow Screenshot](https://via.placeholder.com/800x600/0a0a0a/00ff9d?text=NexusFlow+Terminal)

## 🚀 Features

### Core Capabilities

- **Multi-Agent Orchestration**: 8 specialized AI personas (Chat, Plan, Architect, Coder, Test, Secure, Deploy, Monitor)
- **5 AI Providers**: Google Gemini, Ollama (Local), OpenRouter, NVIDIA NIM, OpenCode
- **Terminal-Themed UI**: Cyberpunk/Sci-Fi interface with CRT scanlines and retro fonts
- **Configuration Autosave**: Settings automatically saved and restored

### Agentic Systems

- **Agent Orchestrator**: Heartbeat monitoring, phase state machine (P→R→I→D→E→S)
- **Emergency Stop**: Multi-level emergency system with AP2 mandate revocation
- **Behavioral Drift Detection**: Intent monitoring and reasoning trace analysis
- **Phase Gates**: Quality validation between development phases
- **Context Manager**: Session isolation and context window optimization

### Protocol Support

- **A2A Protocol**: Agent-to-agent communication with task lifecycle
- **AP2 Protocol**: Secure agent payments with cryptographic mandates
- **MCP Integration**: Model Context Protocol for tool management
- **Persistent Memory**: Cross-session memory persistence

### Agent OS (7-Layer Architecture)

1. **Identity System**: User preferences and rule enforcement
2. **Context Portfolio**: Team, product, and project context
3. **Skills Library**: Reusable workflow instruction sets
4. **Memory**: Decision logs and learning persistence
5. **Connections**: MCP server integration
6. **Verification**: Quality checks and audit trails
7. **Automation**: Scheduled task execution

### Advanced Orchestration

- **Sequential Pipelines**: Execute agents in sequence
- **Loop Pipelines**: Execute agents with exit conditions
- **Dynamic Instructions**: Context-aware instruction generation
- **State Keys**: Type-safe state management

### Security Features

- **Model Armor**: Prompt injection detection, PII filtering, jailbreak prevention
- **Secret Manager**: Secure API key storage with rotation
- **Circuit Breaker**: Gradient-decay system to prevent infinite loops
- **OWASP Compliance**: LLM Top 10 vulnerability defense
- **Agent Authentication**: OAuth2 for agent-to-agent communication

### Production Features

- **Observability**: Distributed tracing and metrics collection
- **Persistent Services**: Session, artifact, and memory management
- **Deployment Manager**: Multi-platform deployment (Managed, Serverless, Kubernetes)

## ⚡ Quickstart

### Prerequisites

- **Node.js** (v18+)
- **pnpm** (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/Dream-Pixels-Forge/nflow-ai.git
cd nflow-ai

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open `http://localhost:3000`.

### Build for Production

```bash
pnpm build
pnpm preview
```

## 🤖 AI Provider Configuration

### Google Gemini (Default)

1. Get API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Create `.env` file:
   ```
   VITE_API_KEY=your_gemini_api_key
   ```
3. Select "Google Gemini" in Settings → Backend Services

### Ollama (Local)

1. Install Ollama: [ollama.ai](https://ollama.ai)
2. Pull a model: `ollama pull llama3`
3. Enable CORS:
   ```bash
   # Mac/Linux
   launchctl setenv OLLAMA_ORIGINS "*"
   
   # Windows: Set environment variable OLLAMA_ORIGINS=*
   ```
4. Restart Ollama
5. Select "Ollama Local" in Settings and click "Test Connection"

### OpenRouter

1. Get API key from [OpenRouter](https://openrouter.ai/keys)
2. Select "OpenRouter" in Settings
3. Enter API key and select a model (Claude, GPT-4o, Llama, etc.)

### NVIDIA NIM

1. Get API key from [NVIDIA Build](https://build.nvidia.com/)
2. Select "NVIDIA NIM" in Settings
3. Enter API key and select a model

### OpenCode

1. Get API key from [OpenCode](https://opencode.ai)
2. Select "OpenCode" in Settings
3. Enter API key

## 📝 Agent Commands

| Command | Agent | Role |
|---------|-------|------|
| `/chat` | **NEXUS-CHAT** | General Assistant & Coordinator |
| `/plan` | **NEXUS-PLAN** | Requirements & User Stories |
| `/arch` | **NEXUS-ARCH** | System Design & Structure |
| `/code` | **NEXUS-CODE** | Implementation Specialist |
| `/test` | **NEXUS-TEST** | QA & Validation |
| `/sec` | **NEXUS-SEC** | Security & Vulnerability Analysis |
| `/ops` | **NEXUS-OPS** | CI/CD & Deployment |
| `/mon` | **NEXUS-MON** | Performance & Health |

## 🏗️ Architecture

```
nflow-ai/
├── App.tsx                    # Main application
├── components/                # UI Components (12)
├── hooks/                     # React Hooks (11)
├── services/                  # AI Provider Services
├── src/
│   ├── a2a/                  # A2A Protocol
│   ├── agentic/              # Core Agentic Systems
│   ├── agent-os/             # 7-Layer Agent OS
│   ├── mcp/                  # MCP Integration
│   ├── memory/               # Persistent Memory
│   ├── pipelines/            # Orchestration Pipelines
│   ├── production/           # Production Features
│   └── security/             # Security Features
│       ├── auth/             # Agent Authentication
│       ├── circuit-breaker/  # Circuit Breaker
│       ├── model-armor/      # Input/Output Filtering
│       ├── owasp/            # OWASP Compliance
│       └── secret-manager/   # Secret Management
```

## 🔧 Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm test         # Run tests
pnpm test:ui      # Run tests with UI
```

### Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **AI SDKs**: @google/genai, OpenAI-compatible APIs

## 📚 Documentation

- [Project Review](PROJECT_REVIEW.md) - Comprehensive code review
- [Feature Roadmap](FEATURE_ROADMAP.md) - Implementation roadmap
- [Agentic Architecture](AGENTIC_ARCHITECTURE.md) - System architecture

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

ISC License

## 📧 Contact

- **Project Maintainer**: [dream.pixels.forge@gmail.com](mailto:dream.pixels.forge@gmail.com)
- **GitHub**: [Dream-Pixels-Forge/nflow-ai](https://github.com/Dream-Pixels-Forge/nflow-ai)

## ⭐ Support

If you find NexusFlow valuable, please consider giving it a star on GitHub!
