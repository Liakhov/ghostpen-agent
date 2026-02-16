# Prompts Guide — Ghostpen v0.2

## Overview

In v0.2, LLM only generates text. Code handles orchestration (loading profiles, saving files, searching past posts). No tools, no agent loop — one API call per step.

Prompts are split into two layers:

- **System prompt** — assembled once per session: role + style profile body + output rules. Stays constant across feedback iterations.
- **User prompt** — built per request by pipeline code: task instruction + topic + context (past posts, platform).

```
System: role + profile.md body + output rules
User:   task prompt + topic + context
```

### File structure

```
src/prompts/
├── system.ts             # Assembles system prompt from role + profile body
└── tasks/
    ├── generate.ts       # User prompt for post generation
    ├── refine.ts         # User prompt for feedback iteration
    ├── analyze-style.ts  # User prompt for style analysis (init step 1)
    └── create-profile.ts # User prompt for profile creation (init step 2)
```

---

## System Prompt

### Assembly

```typescript
// src/prompts/system.ts
export function buildSystemPrompt(profileBody: string): string {
  return `${ROLE}

---

${profileBody}

---

${OUTPUT_RULES}`;
}
```

The profile `.md` body is injected verbatim between role and output rules. LLM reads Voice, Platform sections, Examples — all as natural language instructions.

### Role

```
You are Ghostpen, a personal ghostwriter.

Your job: write content that sounds like the author, not like AI.

The author's Style Profile is loaded below. It is your primary constraint.
Everything you write must conform to the profile — tone, structure, hooks, avoid list.

You succeed when a reader familiar with the author says: "This sounds exactly like them."
You fail when the output sounds like "AI-generated content" — polished, balanced, and devoid of personality.
When in doubt between "correct" and "authentic" — choose authentic.

You write in the same language as the Style Profile.
If the profile is in Ukrainian — write in Ukrainian.
If in English — write in English.
```

Why this works:
- "primary constraint" frames the profile as non-negotiable, not advisory.
- Success/failure criteria give the model a self-evaluation frame — it checks its own output against these before responding.
- "correct vs authentic" resolves the most common conflict: LLM defaults to grammatically polished prose, but real authors break rules intentionally.
- Language rule prevents LLM from defaulting to English.

### Output rules

```
RESPONSE FORMAT:

1. One line: what you did.
   Example: "Generated LinkedIn post using provocative-statement hook."

2. The draft — clean text, exactly as it would be published.

3. Ask: "What to change? (or 'ok' to save)"

RULES:
- No headers before the draft ("## Here's your post:")
- No commentary on your choices ("I chose this hook because...")
- No unsolicited alternatives
- No AI disclaimers
- No "---" dividers unless the profile uses them
- Never exceed the platform max_length
- Prefer shorter over longer
```

Why this works:
- Numbered format is unambiguous — LLM follows sequence.
- "Exactly as it would be published" eliminates formatting artifacts.
- DON'T list catches the 5 most common LLM failure modes.

---

## Task Prompts

### Generate (`src/prompts/tasks/generate.ts`)

Built by pipeline. Injected as user message.

```typescript
export function buildGeneratePrompt(params: {
  topic: string;
  platform: string;
  pastPosts?: string[];
}): string {

  let prompt = `Write a ${params.platform} post about: ${params.topic}

Follow the Style Profile in system prompt exactly.
Use the ${params.platform} section for structure, length, and formatting.
Pick a hook from the Hooks list. First item = default choice.
Use 1-2 signature phrases where they fit naturally — not forced.
Check every item in Avoid before responding.

BAD OUTPUT (generic AI — never do this):
"In today's fast-paced world, burnout has become an increasingly common challenge among professionals. Here are five strategies to help you manage it effectively..."

GOOD OUTPUT (real person with a voice):
"Вигорання — це не про роботу. Це про відсутність контролю. Я це зрозумів, коли звільнився з роботи мрії і нарешті зміг спати."

The good output has: a hook from the profile, short punchy sentences, personal experience, no generic framing.`;

  if (params.pastPosts?.length) {
    prompt += `

PREVIOUS POSTS ON SIMILAR TOPICS (avoid repeating the same angle):
${params.pastPosts.map((p, i) => `--- Post ${i + 1} ---\n${p}`).join('\n\n')}`;
  }

  return prompt;
}
```

Why this works:
- Opens with the concrete task: platform + topic.
- Each instruction maps to a specific profile section — testable.
- "First item = default choice" resolves ambiguity in hook selection.
- "Not forced" for signature phrases prevents unnatural insertion.
- Past posts framed as "avoid repeating" — clear intent.
- BAD/GOOD example is the single highest-impact addition — one concrete contrast eliminates entire categories of generic output. LLM pattern-matches against the bad example and avoids it.

### Refine (`src/prompts/tasks/refine.ts`)

Handles feedback iterations. Same system prompt, new user message. Receives **full iteration history** to prevent regression — without it, iteration 3 can reintroduce problems fixed in iteration 1.

```typescript
export function buildRefinePrompt(params: {
  history: Array<{ draft: string; feedback: string }>;
  currentDraft: string;
  feedback: string;
  platform: string;
}): string {

  let prompt = '';

  // Include previous iterations for context (prevents regression)
  if (params.history.length > 0) {
    prompt += `ITERATION HISTORY (for context — do not repeat fixed issues):\n`;
    params.history.forEach((iter, i) => {
      prompt += `\n--- Iteration ${i + 1} ---\nFeedback: ${iter.feedback}\nDraft: ${iter.draft}\n`;
    });
    prompt += `\n---\n\n`;
  }

  prompt += `CURRENT DRAFT:
${params.currentDraft}

NEW FEEDBACK: ${params.feedback}

INSTRUCTIONS:
If the feedback targets a specific part (hook, closing, one sentence) — rewrite ONLY that part. Keep the rest unchanged.
If the feedback is about overall style (tone, formality, length) — rewrite the full draft.
Do NOT reintroduce issues that were already fixed in previous iterations.
Follow all Style Profile rules from system prompt.
Check ${params.platform} max_length.

Return the updated draft in the same format: one status line, then clean text.`;

  return prompt;
}
```

Why this works:
- Full iteration history prevents regression — LLM sees what was already fixed.
- "Do NOT reintroduce issues" is an explicit instruction that maps to the history context.
- Explicit branching: partial fix vs full rewrite. Prevents unnecessary changes.
- "Keep the rest unchanged" is critical — without it, LLM rewrites everything.
- History is labeled "for context" — LLM knows it's reference, not the current task.

### Analyze style (`src/prompts/tasks/analyze-style.ts`)

Step 1 of profile creation. Model: GPT-4.1 nano (analysis, not generation).

```typescript
export function buildAnalyzePrompt(posts: string[]): string {
  return `Analyze the writing style of these posts.

POSTS:
${posts.map((p, i) => `--- Post ${i + 1} ---\n${p}`).join('\n\n')}

For each category, be specific. Use evidence from the posts. No generic labels.

1. TONE (3-5 words)
   Wrong: "professional and engaging"
   Right: "confident, slightly ironic, respects the reader"

2. FORMALITY
   Place on a scale: "texting a friend" → "Harvard Business Review"
   Explain with a comparison.

3. PERSONALITY (2-3 sentences)
   What character comes through? Not "good writer" — what kind of person?

4. SENTENCE STYLE
   Average length? Fragments or full sentences? Rhythm pattern?

5. PARAGRAPH STYLE
   Dense or airy? How many sentences per paragraph?

6. HOOKS (3-4 patterns, most frequent first)
   How does the author open posts? Quote examples.

7. CLOSINGS (2-3 patterns)
   How do posts end?

8. SIGNATURE PHRASES
   Recurring expressions. Only real ones from the texts — do not invent.

9. AVOID LIST
   What does the author NEVER do? What's absent from all posts?

10. EMOJI USAGE
    Frequency, types, placement. Or "never".

11. TRANSITIONS
    How does the author move between ideas? (empty line, arrow ↓/→, single-word fragment like "Але.", conjunction, abrupt cut)
    Quote examples of transitions from the posts.

12. POST STRUCTURE PATTERN
    Average post length (approximate word count). Ratio of story vs insight vs CTA.
    Does the author use a consistent structure or vary it?

13. VOCABULARY
    Preferred words and phrases (not signature phrases — everyday word choices).
    Words the author uses instead of common alternatives (e.g., "пости" instead of "контент").
    Register: conversational, academic, slang-heavy, mixed?

Respond in the same language as the posts.`;
}
```

Why this works:
- Wrong/Right example for tone is the single most impactful instruction — prevents the #1 failure mode (generic adjectives).
- "Quote examples" forces grounding in actual text.
- "Only real ones — do not invent" prevents hallucinated signature phrases.
- "What's absent" is a better framing than "what they avoid" — LLM looks for patterns of absence.

### Create profile (`src/prompts/tasks/create-profile.ts`)

Step 2 of profile creation. Takes analysis output, produces markdown profile.

```typescript
export function buildCreateProfilePrompt(params: {
  analysisResult: string;
  profileType: 'personal' | 'reference';
  profileName: string;
  language: string;
  postCount: number;
  platforms: string[];
}): string {

  return `Create a Style Profile in Markdown format based on this analysis.

ANALYSIS:
${params.analysisResult}

OUTPUT FORMAT:
Return a markdown document with YAML frontmatter. No code fences. No explanation.
Just the raw markdown content, starting with "---".

FRONTMATTER:
---
version: 1
type: ${params.profileType}
language: ${params.language}
source: "${params.postCount} posts, manually provided"
created: ${new Date().toISOString()}
updated: ${new Date().toISOString()}
---

REQUIRED SECTIONS (use ## headings):

## Voice
List: Tone, Formality, Personality, Sentence style, Paragraph style.
Then subsections: ### Hooks, ### Closings, ### Signature phrases, ### Vocabulary, ### Avoid, ### Emoji.

${params.platforms.map(p => `## ${p.charAt(0).toUpperCase() + p.slice(1)}\nList: Max length, Structure, Tone (override or "no change"), Formatting, Hashtags, Notes.`).join('\n\n')}

## Examples
Pick 3-5 best posts from the analysis. For each:
### Example N (Platform)
[full post text]
**Why good:** [specific reasons — hooks used, structure, what makes it effective]

## Anti-examples
Pick 1-2 weakest posts (or construct realistic bad examples based on the Avoid list). For each:
### Anti-example N (Platform)
[post text]
**Why bad:** [specific reasons — what rules it violates, what makes it sound generic]

RULES:
- Write in ${params.language}
- Every field must be specific to this author, not generic
- Hooks and Closings ordered by frequency (most common first)
- Avoid list must include concrete examples in parentheses
- If no posts exist for a platform, write reasonable defaults based on the author's general style`;
}
```

Why this works:
- Exact output structure eliminates ambiguity — LLM knows every section heading.
- "No code fences. No explanation. Just raw markdown" prevents wrapping.
- Platform sections generated dynamically from actual data.
- "Specific to this author, not generic" repeated as a constraint — the most important quality signal.
- Anti-examples section gives the generation model a "do not cross" boundary — more effective than positive examples alone.
- Vocabulary section captures everyday word choices that signature phrases miss — the subtle lexical fingerprint.

---

## Prompt Design Principles

1. **Concrete over abstract.** "Pick a hook from the Hooks list" not "write an engaging opening."
2. **Wrong/Right examples.** One example of what NOT to do is worth 10 positive instructions.
3. **One instruction per behavior.** If two rules could conflict, state which wins.
4. **Minimal tokens.** Every word the model reads dilutes attention. Cut ruthlessly.
5. **Testable claims.** Every instruction should be verifiable: "did the model follow this yes/no?"
6. **Data as context, instructions as rules.** Profile body = data. Prompt instructions = rules. Don't mix.

---

## Iteration Playbook

### Process

1. Generate with current prompts
2. Identify the failure: what specifically went wrong?
3. Locate the layer: system prompt (role/output rules) or task prompt?
4. Add one rule or one Wrong/Right example
5. Test on 3-5 different topics — ensure the fix doesn't break other cases
6. If a fix works for 5+ generations, keep it. If it causes new failures, revert.

### Common Failures and Fixes

| Failure | Where to fix | Fix pattern |
|---|---|---|
| Ignores profile tone | `system.ts` — role section | Strengthen "primary constraint" framing |
| Uses items from avoid list | `generate.ts` | Add "Check every item in Avoid before responding" |
| Invents new hook types | `generate.ts` | Add "Pick from list. Do not invent new types." |
| Rewrites entire draft on minor feedback | `refine.ts` | Add "rewrite ONLY that part. Keep the rest unchanged." |
| Generic style analysis | `analyze-style.ts` | Add Wrong/Right example for the failing field |
| Too long output | `system.ts` — output rules | Add "Never exceed max_length. Prefer shorter." |
| Comments on own choices | `system.ts` — output rules | Add to DON'T list |
| Profile has generic descriptions | `create-profile.ts` | Add "specific to this author, not generic" |
| Wraps output in code fences | `create-profile.ts` | Add "No code fences. No explanation." |
| Regression on iteration 3+ | `refine.ts` | Pass full iteration history, add "do not reintroduce fixed issues" |
| Output sounds polished but soulless | `system.ts` — role section | Add success/failure criteria ("you succeed when…") |
| Wrong word choices (generic synonyms) | `create-profile.ts` | Add Vocabulary section to profile |

### Anti-patterns

**"Be creative"** — unmeasurable. Instead: "Use metaphors from everyday life, as in the profile examples."

**Long instruction blocks** — if a section exceeds 15 lines, split it. Attention degrades with length.

**Contradictory rules** — "be concise" + "include detailed examples". State the priority or the context for each.

**Rules without examples** — "write in the author's style" tells the model nothing. "If the author uses 5-8 word sentences, do the same — don't expand to 20 words" is actionable.

**Implicit expectations** — if you expect a behavior, write it explicitly. LLMs don't infer intent from omission.

---

## v0.1 → v0.2 Changes

| What | v0.1 | v0.2 |
|---|---|---|
| System prompt | Role + tool guidelines + style rules + feedback rules | Role + profile body (verbatim) + output rules |
| Task prompts | Injected as part of agent tool calls | Built by pipeline, sent as user message |
| Profile injection | JSON fields serialized into prompt | Markdown body injected as-is |
| Tool instructions | 6 tool usage rules in system prompt | None — no tools |
| Mix mode prompt | Separate template with base/techniques split | Removed |
| Feedback handling | In system prompt (agent decides) | In refine.ts (pipeline routes) |
| Language | Ukrainian | English |
| Prompt modules | 6 separate files in modules/ | Inlined into system.ts |