<!--
Sync Impact Report:
- Version change: N/A → 1.0.0
- Modified principles: N/A (first version)
- Added sections: All principles and sections added for first time
- Removed sections: N/A
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated
  - .specify/templates/spec-template.md ✅ updated
  - .specify/templates/tasks-template.md ✅ updated
- Follow-up TODOs: None
-->

# NexusFlow Constitution

## Core Principles

### Multi-Agent Orchestration
Every feature must support the multi-agent architecture with specialized AI personas (Architect, Coder, QA, Security, etc.); Each agent must have clear roles and responsibilities with well-defined interfaces; Complex software development tasks must be decomposable into agent-specific responsibilities.

### Local-First Design
All core functionality must work offline with local AI providers (Ollama) as the default; Cloud services (Google Gemini) are optional enhancements; Privacy and data sovereignty are prioritized over convenience.

### Terminal-Style Interface
The UI must mimic a professional development environment with command-line interface patterns; User interactions follow terminal-style commands and responses; Interface must be efficient for developers familiar with CLI tools.

### Cyberpunk/Sci-Fi Aesthetics
Visual design must incorporate CRT scanlines, retro fonts, and immersive animations; UI components should reflect futuristic technology themes; Visual appearance must reinforce the AI agent orchestration concept.

### Dual Backend Compatibility
Application must seamlessly switch between Google Gemini and Ollama backends; Backend selection must be configurable through UI settings; Automatic validation of backend connectivity and required models must occur at startup.

## Technology Stack Requirements

Must use React 18+ with TypeScript for frontend; Vite for build system and development server; Tailwind CSS for styling; Google GenAI library for cloud AI integration; Node.js (v18+) as runtime environment.

## Quality Gates & Testing

All features must include unit tests with >80% coverage; Integration tests required for multi-agent workflows; Performance testing for AI response times; Dependency validation to ensure security and compatibility.

## Governance

All PRs must verify compliance with core principles; Architectural changes require explicit approval; New features must include documentation and quickstart guides; Breaking changes must include migration plans; Code reviews must verify all principles are upheld.

**Version**: 1.0.0 | **Ratified**: 2025-11-24 | **Last Amended**: 2025-11-24
