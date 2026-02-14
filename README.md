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

### Create your Style Profile

```bash
npm run dev init
```

Paste 10-20 of your best posts separated by `---`. Ghostpen will analyze them and build a profile capturing your tone, hooks, closings, signature phrases, and what you never write.

### Generate a post

```bash
npm run dev "напиши пост про вигорання для LinkedIn"
```

After generation, give feedback or type `ok` to save:

```
Що змінити? (або "ok" щоб зберегти)
> hook слабкий, зроби провокативніше

[regenerated draft]

> ok
💾 Збережено: data/output/generated/2026-02-09-vyhorannya-linkedin.md
```

## Commands

```bash
# Generate a post (default profile)
npm run dev "тема для платформи"

# Use a specific profile
npm run dev "post about AI trends" -- --profile competitor-alex

# Mix your voice with someone's techniques
npm run dev "пост про найм" -- --mix "default competitor-alex"

# Debug mode (shows agent decisions)
npm run dev "тема" -- --debug

# Create your personal Style Profile
npm run dev init

# Manage profiles
npm run dev profile create competitor-alex
npm run dev profile list
npm run dev profile show competitor-alex
npm run dev profile delete competitor-alex
```

## Multi-profile & Mix Mode

**Reference profiles** let you capture the style of other authors (competitors, mentors):

```bash
npm run dev profile create competitor-alex
# Paste their posts, get a reference profile
```

**Mix mode** combines your voice with their techniques:

```bash
npm run dev "пост про лідерство" -- --mix default competitor-alex
```

Rules: your tone + their hooks/closings/structure. The result sounds like you, but with their techniques.

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

## Project structure

```
src/
├── index.ts           # CLI entry point
├── agent.ts           # Agent conversation loop
├── commands/          # init, profile management
├── prompts/           # System & task prompts, templates
├── tools/             # Agent tools (save, search, feedback)
├── types/             # TypeScript types
└── utils/             # Helpers
data/
├── profiles/          # Style profiles (JSON)
├── examples/          # Sample posts for analysis
└── output/generated/  # Generated drafts (Markdown)
```

## Tech stack

- **Runtime:** Node.js + TypeScript
- **AI:** Anthropic SDK (Claude Sonnet 4)
- **Integrations:** Web search (Anthropic)
- **Storage:** Local filesystem (JSON + Markdown)

## License

ISC
