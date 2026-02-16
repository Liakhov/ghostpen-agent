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

| Task       | Model          | Temperature | Max tokens |
|------------|----------------|-------------|------------|
| Generation | gpt-4.1-mini   | 0.8         | 2000       |
| Refine     | gpt-4.1-mini   | 0.4         | 2000       |
| Analysis   | gpt-4.1-nano   | 0.3         | 3000       |
| Profile creation | gpt-4.1-nano | 0.3     | 4000       |

**Temperature rationale:**
- Generation (0.8) — creative task, needs variety across runs. Lower = repetitive hooks and structures.
- Refine (0.4) — controlled edits, should not deviate far from the previous draft.
- Analysis/Profile (0.3) — factual extraction from source texts, precision over creativity.

## Past Posts Search

Pipeline finds relevant past posts to prevent angle repetition and provide context.

**Strategy:**
1. Load all posts from `data/output/` matching the target platform
2. Extract topic keywords from user input (simple word tokenization, stop-word removal)
3. Score each past post by keyword overlap with the requested topic
4. Return top 2-3 posts (sorted by relevance, then recency)
5. If no posts match — skip context, generate without past posts

**Why not embeddings:** For <100 posts, keyword overlap is sufficient and adds zero dependencies. Embeddings become worthwhile at 500+ posts (future consideration).

**Post truncation:** If a past post exceeds 500 words, include only the first 300 words + "..." — enough for angle detection without consuming context window.

## Token Budget

Total context window: ~128k tokens (gpt-4.1-mini). Practical limit for attention quality: ~8k tokens in prompt.

| Component | Budget | Notes |
|-----------|--------|-------|
| System: Role + Output rules | ~300 tokens | Fixed, rarely changes |
| System: Profile body | ~1500 tokens | Largest variable component |
| User: Task prompt | ~200 tokens | Template + topic |
| User: Past posts (2-3) | ~1500 tokens | Truncated if needed |
| **Total prompt** | **~3500 tokens** | Well within quality range |
| Response | ~1500 tokens | LinkedIn max ~1500 chars |

**Guardrails:**
- If profile body > 2000 tokens: warn during `ghostpen init`, suggest trimming examples
- If past posts total > 2000 tokens: truncate oldest posts first
- Never exceed 6000 tokens total prompt — beyond this, attention to profile details degrades

## v0 → v0.2

v0 used Claude agent with tool routing. Replaced with deterministic pipeline — LLM only generates text, code handles orchestration.

## Future

- Fine-tuning GPT-4.1 mini per user
- Web UI (pipeline as API + frontend)
- Multi-user (`data/{user_id}/`)