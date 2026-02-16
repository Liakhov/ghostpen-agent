# Architecture — Ghostpen v0.2

## Overview

Node.js CLI. Deterministic pipeline. OpenAI API (GPT-4.1 mini / nano). File-based state.

## System Diagram

Three components: CLI for user interaction, pipeline for orchestration, OpenAI API for text generation.

```
┌──────────┐     ┌──────────────────────────────┐     ┌────────────┐
│          │     │         PIPELINE              │     │            │
│   CLI    │────▶│                               │────▶│  OpenAI    │
│  (user)  │◀────│  parse → load → build → call  │◀────│  API       │
│          │     │                               │     │            │
└──────────┘     └───────────┬──────────────────┘     └────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
              data/profiles/    data/output/
              *.md              *.md
```

## Pipelines

### Generate Post

One API call per iteration. Profile as system prompt, topic + past posts as user prompt.

```
args → load profile.md → find past posts → build prompt → API call → display
                                                              ▲
                                                     feedback │
                                                              ▼
                                                    API call → display → save .md
```

### Create Profile

Single API call analyzes user's posts and outputs a style profile in markdown.

```
collect posts (paste/file) → API call (analyze + generate) → save profile.md
```

## Data

```
data/
├── profiles/
│   ├── default.md        # Personal style profile
│   └── {name}.md         # Reference profiles
└── output/
    └── *.md              # Generated posts with frontmatter
```

### Style Profile

Markdown with YAML frontmatter. Body injected into system prompt as-is.

```markdown
---
version: 1
type: personal
language: uk
---

## Voice
- Tone: іронічний, впевнений
...

## LinkedIn
- Max length: 1500
- Structure: hook → story → insight → CTA

## Examples
[annotated posts]
```

### Generated Post

```markdown
---
platform: linkedin
topic: burnout
profile: default
created: 2026-02-08T14:30:00Z
---

[post text]
```

## Models

| Task       | Model          |
|------------|----------------|
| Generation | gpt-4.1-mini   |
| Analysis   | gpt-4.1-nano   |

## v0 → v0.2

v0 used Claude agent with tool routing. Replaced with deterministic pipeline — LLM only generates text, code handles orchestration.

## Future

- Fine-tuning GPT-4.1 mini per user
- Web UI (pipeline as API + frontend)
- Multi-user (`data/{user_id}/`)