# Ghostpen

CLI tool that learns your writing style and generates social media posts in your voice.

Feed it your best posts — it builds a Style Profile capturing your tone, rhythm, hooks, and taboos. Then give it a topic, and it generates a draft that sounds like you wrote it.

## Quick Start

### Prerequisites

- Node.js 18+
- [OpenAI API key](https://platform.openai.com/api-keys)

### Installation

```bash
git clone https://github.com/Liakhov/ghostpen-agent.git
cd ghostpen-agent
npm install
cp .env.example .env
```

Add your API key to `.env`:

```
OPENAI_API_KEY=sk-...
```

### Create Your Style Profile

```bash
npm run dev init
```

Paste 10-20 of your best posts separated by `---`. Ghostpen analyzes them and creates a markdown profile with your tone, hooks, closings, signature phrases, and avoid list.

### Generate a Post

```bash
npm run dev "post about burnout for LinkedIn"
```

Review the draft, give feedback, or type `ok` to save:

```
What to change? (or "ok" to save)
> hook is weak, make it provocative

[regenerated draft]

> ok
💾 Saved to data/output/2026-02-09-burnout-linkedin.md
```

## Commands

```bash
npm run dev init                          # Create personal style profile
npm run dev "topic for platform"          # Generate post
npm run dev "topic" -- --profile name     # Use specific profile
npm run dev profile create name           # Create reference profile
npm run dev profile list                  # List all profiles
npm run dev profile show name             # Show profile details
npm run dev profile delete name           # Delete profile
```

## Style Profile

A markdown file that captures how you write:

- **Voice** — tone, formality, personality, sentence style
- **Hooks** — how you open posts (provocation, story, question, stat)
- **Closings** — how you end (open question, one-liner, CTA)
- **Signature phrases** — your recurring expressions
- **Avoid** — things you never write (corporate jargon, cliches)
- **Platform rules** — structure, length, formatting per platform
- **Examples** — your best posts with annotations

Profiles live in `data/profiles/`. Your personal profile (`default.md`) evolves with feedback.

## Project Structure

```
src/
├── index.ts           # CLI entry point
├── pipeline/          # Generate, refine, init-profile
├── prompts/           # System & task prompts
├── services/          # OpenAI API, post search
├── utils/             # Frontmatter, pricing, logger
└── types/             # TypeScript types
data/
├── profiles/          # Style profiles (Markdown)
└── output/            # Generated posts (Markdown)
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **AI:** OpenAI API (GPT-4.1 mini for generation, GPT-4.1 nano for analysis)
- **Storage:** Local filesystem (Markdown + YAML frontmatter)

## License

ISC