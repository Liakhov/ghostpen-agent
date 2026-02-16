# PRD — Ghostpen v0.2

## Scope

CLI tool that learns your writing style and generates social media posts in your voice. v0.2 migrates from Anthropic agent (tool-routing) to deterministic pipeline with OpenAI API. Same features, new architecture — LLM only generates text, code handles orchestration. Single user, local filesystem, no UI.

## Features

### Init (`ghostpen init`)
Collect 10-20 user posts (paste or file), send to API for style analysis, save markdown profile to `data/profiles/default.md`. Show human-readable summary. Interactive corrections update the profile.

### Generate (`ghostpen "topic for platform"`)
Load style profile → find past posts on similar topic → build prompt → single API call → display draft. Feedback loop: user gives corrections, agent regenerates. `ok` saves to `data/output/`. Supports `--profile name` to use a different profile.

### Feedback loop
After generation, user can request changes inline. Style-related corrections (repeated 3+ times) trigger a proposal to update the personal profile. Feedback tracker persists in `data/profiles/default.md` frontmatter. Reference profiles never update from feedback.

#### Feedback classification

Pipeline classifies each feedback as **style** or **content** using simple heuristics (no LLM call):

| Type | Detection | Examples | Action |
|------|-----------|----------|--------|
| Style | Matches keyword patterns: tone, formal, casual, short, long, voice, sound, hook | "too formal", "make it shorter", "sounds like AI" | Track in frontmatter, propose profile update at 3+ |
| Content | Everything else | "change the example to X", "add a CTA about Y" | Apply to current draft only, no tracking |

#### Feedback tracker schema

Stored in profile frontmatter under `feedback_tracker`:

```yaml
---
version: 3
type: personal
language: uk
feedback_tracker:
  - pattern: "too formal"
    category: tone
    count: 4
    first_seen: 2026-02-08T14:30:00Z
    last_seen: 2026-02-10T09:00:00Z
    resolved: false
  - pattern: "shorter sentences"
    category: sentence_style
    count: 2
    first_seen: 2026-02-09T11:00:00Z
    last_seen: 2026-02-09T16:00:00Z
    resolved: false
---
```

**Grouping:** Feedback is normalized to lowercase and matched against existing patterns using keyword overlap. "too formal" and "sounds too official" both match the "too formal" pattern if they share 50%+ keywords. If no match — create new pattern.

**Resolution:** When a profile update is accepted, the corresponding pattern is marked `resolved: true` and stops counting.

### Profile CRUD (`ghostpen profile <action>`)
- `create <name>` — create reference profile from pasted posts
- `list` — show all profiles with types
- `show <name>` — display profile content
- `delete <name>` — remove profile

Two types: `personal` (one, evolves with feedback) and `reference` (many, static).

## Implementation tasks

| # | Task | Files |
|---|------|-------|
| 1 | Replace Anthropic SDK with OpenAI SDK | `package.json`, `src/services/openai.ts` (new) |
| 2 | Create pipeline runner (parse → load → build → call → display) | `src/pipeline/runner.ts` (new) |
| 3 | Implement init-profile pipeline | `src/pipeline/init-profile.ts` (new), `src/prompts/tasks/create-profile.ts` |
| 4 | Implement generate pipeline | `src/pipeline/generate.ts` (new), `src/prompts/system.ts` |
| 5 | Implement refine pipeline (feedback iteration) | `src/pipeline/refine.ts` (new) |
| 6 | Port profile CRUD commands | `src/commands/profile.ts`, `src/commands/profile-flow.ts` |
| 7 | Port past-posts search to pipeline util | `src/services/post-search.ts` (new) |
| 8 | Update CLI entry point for pipeline routing | `src/index.ts` |
| 9 | Remove agent layer (`src/agent/`, `src/tools/`) | `src/agent/*`, `src/tools/*` |
| 10 | Update prompts for OpenAI message format | `src/prompts/**` |

## File structure

```
src/
├── index.ts              # CLI entry point (commander)
├── pipeline/
│   ├── runner.ts         # Pipeline orchestrator
│   ├── init-profile.ts   # Profile creation pipeline
│   ├── generate.ts       # Post generation pipeline
│   └── refine.ts         # Feedback refinement pipeline
├── commands/
│   ├── init.ts           # Init command handler
│   ├── profile.ts        # Profile CRUD commands
│   └── profile-flow.ts   # Interactive profile creation flow
├── services/
│   ├── openai.ts         # OpenAI API client
│   └── post-search.ts    # Past posts search
├── prompts/
│   ├── system.ts         # System prompt builder
│   └── tasks/            # Task-specific prompts
├── utils/
│   ├── frontmatter.ts    # YAML frontmatter parse/serialize
│   ├── pricing.ts        # Token cost tracking
│   ├── logger.ts         # Console output formatting
│   └── cli.ts            # CLI helpers (readline, input)
├── types/
│   └── index.ts          # TypeScript types
└── constants/
    ├── paths.ts          # File paths
    └── app.ts            # App constants
data/
├── profiles/             # Style profiles (Markdown + YAML frontmatter)
│   ├── default.md        # Personal profile
│   └── {name}.md         # Reference profiles
└── output/               # Generated posts (Markdown + YAML frontmatter)
```

## Stack & dependencies

| Dependency | Purpose |
|-----------|---------|
| `openai` | OpenAI API client (GPT-4.1 mini for generation, GPT-4.1 nano for analysis) |
| `commander` | CLI argument parsing |
| `chalk` | Terminal styling |
| `dotenv` | Environment variables |
| `tsx` | TypeScript execution (dev) |
| `typescript` | Type checking (dev) |

## Quality Metrics

Track these to measure generation quality over time. Stored per-session in generated post frontmatter.

| Metric | How to measure | Target |
|--------|---------------|--------|
| First-draft acceptance rate | Posts saved with 0 refine iterations / total posts | > 30% |
| Average refine iterations | Mean iterations before "ok" | < 3 |
| Hook compliance | Hook used from profile Hooks list (yes/no, logged in frontmatter) | > 80% |
| Avoid list violations | Items from Avoid list found in final output (post-save check) | 0 |
| Profile update frequency | How often feedback triggers profile changes | 1-2x per week (healthy learning) |

**Generated post frontmatter extension:**

```yaml
---
platform: linkedin
topic: burnout
profile: default
created: 2026-02-08T14:30:00Z
iterations: 2
hook_from_profile: true
---
```

These metrics are logged locally — no external analytics. Run `ghostpen stats` (future) to see trends.

## Constraints

- Single user, no auth
- Text only — no images, carousels, video
- Platforms: LinkedIn, Instagram, X
- No auto-publishing
- Local filesystem only (Markdown + YAML frontmatter)
- Ukrainian and English (detected from profile)
- No web search in v0.2 (removed with agent layer, revisit later)
