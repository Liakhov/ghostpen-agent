# Ghostpen Agent

CLI tool that learns your writing style and generates social media posts in your voice. Deterministic pipeline — LLM only generates text, code handles orchestration.

## Behavioral Rules

- Do what has been asked; nothing more, nothing less
- ALWAYS read a file before editing it
- NEVER create files unless absolutely necessary — prefer editing existing ones
- NEVER save files to root folder
- NEVER commit secrets, credentials, or .env files
- Keep files under 500 lines

## Project Context

**Stack**: TypeScript, Node.js, Commander, OpenAI API (GPT-4.1 mini/nano), Chalk
**Architecture**: Deterministic pipeline (parse → load → build → call → display)
**State**: File-based (Markdown + YAML frontmatter), no database
**Platforms**: LinkedIn, Instagram, X
**Languages**: Ukrainian, English

## File Structure

```
src/
├── index.ts              # CLI entry point (commander)
├── pipeline/
│   ├── runner.ts         # Pipeline orchestrator
│   ├── init-profile.ts   # Profile creation pipeline
│   ├── generate.ts       # Post generation pipeline
│   └── refine.ts         # Feedback refinement pipeline
├── commands/             # CLI command handlers (init, profile CRUD)
├── services/
│   ├── openai.ts         # OpenAI API client
│   └── post-search.ts    # Past posts keyword search
├── prompts/
│   ├── system.ts         # System prompt = role + profile body + output rules
│   └── tasks/            # Task-specific user prompts (generate, refine, analyze, create-profile)
├── utils/                # Frontmatter, pricing, logger, CLI helpers
├── types/                # TypeScript types
└── constants/            # Paths, app constants

data/
├── profiles/             # Style profiles (*.md with YAML frontmatter)
│   ├── default.md        # Personal profile (evolves with feedback)
│   └── {name}.md         # Reference profiles (static)
└── output/               # Generated posts (*.md with YAML frontmatter)
```

## Commands

```bash
# Development
npm run dev               # tsx src/index.ts

# Build
npm run build             # tsc

# Run
npm start                 # node dist/index.js
```

No test or lint scripts exist yet. Add them before running.

## Key Conventions

### Pipeline Pattern

Every user action is a pipeline: single entry, deterministic steps, one LLM call per step. No agent loop, no tool routing.

```
CLI input → load profile → build prompt → API call → display → feedback loop
```

### Profile System

- **Personal** (`type: personal`) — one per user, created via `ghostpen init`, evolves with feedback
- **Reference** (`type: reference`) — created via `ghostpen profile create`, never auto-updated
- Profile body is injected into system prompt verbatim — LLM reads it as instructions
- Frontmatter has metadata (`version`, `type`, `language`, `source`, `created`, `updated`)

### Feedback Loop

- User gives corrections after generation; pipeline sends refined prompt with full iteration history
- Style feedback (tone, length, formality) tracked in profile frontmatter `feedback_tracker`
- After 3+ repeated style corrections → propose profile update
- Content feedback applied to current draft only, not tracked

### Prompts

- System prompt = Role + Profile body (verbatim) + Output rules. Assembled in `src/prompts/system.ts`
- Task prompts built per-request in `src/prompts/tasks/`. Each returns a string for the user message
- BAD/GOOD examples in prompts are the highest-impact technique — one contrast prevents generic output

## v0 → v0.2 Migration (In Progress)

Migrating from Anthropic agent (tool-routing) to deterministic pipeline with OpenAI API.

**What's changing:**
- `@anthropic-ai/sdk` → `openai` (not yet swapped in package.json)
- `src/agent/`, `src/tools/` → removed, replaced by `src/pipeline/`
- JSON style profiles → Markdown + YAML frontmatter
- Tool-based orchestration → code-based pipeline

**Legacy code to remove:** `src/agent/`, `src/tools/`, `src/prompts/templates/mix-mode.ts`

## Detailed Documentation

For comprehensive specs, see `docs/`:
- `docs/prd.md` — Product requirements, features, implementation tasks
- `docs/architecture.md` — System diagram, pipelines, models, token budget
- `docs/style-profile-spec.md` — Profile format, sections, validation, examples
- `docs/prompts-guide.md` — Prompt design, templates, iteration playbook