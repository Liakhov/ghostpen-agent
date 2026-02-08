# Ghostpen

AI-powered CLI agent that learns your writing style and generates social media content in your voice.

Ghostpen analyzes your best posts, builds a Style Profile, and generates drafts that sound like you — not like generic AI. One good draft instead of ten mediocre ones.

## How it works

1. **Learns your style** — feed it 10-20 of your best posts, it creates a Style Profile: tone, sentence rhythm, hooks, signature phrases, what you never write
2. **Generates in your voice** — give it a topic and platform, it autonomously decides what to do: reads your profile, searches for fresh stats, checks past posts, generates a draft
3. **Evolves with feedback** — say "too formal" and it regenerates. After repeated feedback, it suggests updating your profile

## Quick start

### Prerequisites

- Node.js 18+
- [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
git clone https://github.com/Liakhov/ghostpen-agent.git
cd ghostpen-agent
npm install
```

Create a `.env` file:

```bash
cp .env.example .env
```

Add your Anthropic API key to `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Usage

```bash
# Generate a post
npm run dev "напиши пост про вигорання для LinkedIn"

# Use a specific style profile
npm run dev "post about AI trends" -- --profile competitor-alex

# Mix your voice with someone's techniques
npm run dev "пост про найм" -- --mix default competitor-alex

# Create your personal style profile
npm run dev init

# Create a reference profile (competitor/mentor)
npm run dev profile create competitor-alex

# List all profiles
npm run dev profile list

# Analyze your content
npm run dev analyze
```

### Feedback loop

After generating a draft, Ghostpen waits for your feedback:

```
Що змінити? (або "ok" щоб зберегти)
> hook слабкий, зроби провокативніше

[regenerated draft]

Що змінити?
> ok

Завершено.
```

## Style Profile

The Style Profile is a JSON file that captures how you write:

- **Tone** — "friendly, slightly ironic" not just "professional"
- **Sentence style** — short and punchy? long and narrative?
- **Hooks** — how you start posts (provocative statement, personal story, question)
- **Closings** — how you end (open question, sharp one-liner, soft CTA)
- **Signature phrases** — your recurring expressions
- **Avoid list** — things you never write (corporate jargon, motivational cliches)
- **Platform rules** — structure, length, formatting per platform (LinkedIn, Instagram, X)

Profiles live in `data/profiles/`. Your personal profile evolves with feedback. Reference profiles (competitors, mentors) stay static unless you manually update them.

## Notion integration

Optional. Add to `.env`:

```
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=...
```

Ghostpen can read Notion pages as source material and save drafts to your Notion content calendar.

## Project structure

```
src/
├── index.ts           # CLI entry point
├── agent.ts           # Agent conversation loop
├── prompts/           # System & task prompts
├── tools/             # Agent tools (style profile, web search, Notion, etc.)
├── types/             # TypeScript types
└── utils/             # Logger, config, helpers
data/
├── profiles/          # Style profiles (JSON)
├── examples/          # Sample posts for analysis
└── output/generated/  # Generated drafts (Markdown)
docs/                  # Architecture, PRD, specs
```

## Tech stack

- **Runtime:** Node.js + TypeScript
- **AI:** Anthropic SDK (Claude Sonnet 4)
- **Integrations:** Notion API (optional)
- **Storage:** Local filesystem (JSON + Markdown)

## License

ISC
