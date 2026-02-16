# Ghostpen

## Problem

Every AI writing tool produces the same thing — generic, soulless text that sounds like everyone and no one. "Select tone: professional / casual / friendly" doesn't capture how a real person writes. People try ChatGPT, get something that doesn't sound like them, rewrite from scratch, and never come back.

**The core issue:** existing tools don't know your voice. Your style is more than one word — it's sentence rhythm, favorite hooks, phrases you'd never use, the way you open and close a post.

## Solution

**Ghostpen** learns how you write, then writes like you.

You give it 10-20 of your best posts. It extracts your style DNA into a profile — tone, structure, patterns, taboos. Then when you say "write a post about burnout for LinkedIn", it generates a draft that sounds like you wrote it.

Not 10 variants to pick from. One draft that needs 10-20% editing, not a full rewrite.

## How It Works

```
$ ghostpen "post about burnout for LinkedIn"

📖 Loading style profile...
📝 Found 2 similar past posts...
✍️  Generating draft...

---
[draft in your voice]
---

What to change? (or "ok" to save)
> hook is weak, make it provocative

🔄 Regenerating...

---
[updated draft]
---

> ok
💾 Saved to data/output/2026-02-08-burnout-linkedin.md
```

Three capabilities:
1. **Style extraction** — analyzes your posts → creates a Style Profile (tone, rhythm, hooks, taboos)
2. **One-shot generation** — loads profile, finds relevant past posts, generates a draft in one API call
3. **Learning from feedback** — "too formal" → regenerates + updates profile for next time

## Audience

**Primary:** Solo entrepreneurs and experts building a personal brand. LinkedIn creators, coaches, founders. 3-5 posts/week. Already tried AI tools — disappointed.

**Secondary:** Content managers running multiple client accounts — switching between voices.

## Principles

1. **Your voice, not AI voice.** Style Profile built from real posts, not a dropdown menu.
2. **Simple.** `npm install -g ghostpen` and you're writing.
3. **Cheap.** One API call per draft. No agent overhead.
4. **Quality over quantity.** One great post beats five mediocre ones.