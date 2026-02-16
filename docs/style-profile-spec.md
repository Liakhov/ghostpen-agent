# Style Profile Specification — Ghostpen v0.2

## Overview

Style Profile is the single source of truth about a user's writing style. Markdown file with YAML frontmatter. Body is injected into the system prompt as-is — LLM reads it as text, code does not parse individual sections.

The profile describes **how this specific person writes** — with all quirks and even flaws that make the text feel alive.

Location: `data/profiles/<profile-name>.md`

---

## Multi-Profile System

### Profile Types

| Type | Description | Evolves with feedback | Usage |
|---|---|---|---|
| `personal` | Your style. One per user. Created via `ghostpen init`. | Yes | Default for all generations |
| `reference` | Another author's style. Created via `ghostpen profile create`. | No (manual only) | Generate in someone else's voice, analysis |

### File Structure

```
data/profiles/
├── default.md              ← personal profile
├── competitor-alex.md      ← reference profile
├── competitor-maria.md     ← reference profile
└── mentor-style.md         ← reference profile
```

### CLI Commands

```bash
# Personal profile
ghostpen init                                    # Create default.md

# Reference profiles
ghostpen profile create competitor-alex          # Create new reference profile
ghostpen profile list                            # List all profiles
ghostpen profile show competitor-alex            # Show profile summary
ghostpen profile delete competitor-alex          # Delete profile

# Generation with different profiles
ghostpen "тема" --profile competitor-alex        # Write in Alex's style
```

---

## Format

Markdown with YAML frontmatter. Frontmatter contains metadata for code. Body describes the style for LLM.

### Frontmatter (YAML)

```yaml
---
version: 1
type: personal          # "personal" | "reference"
language: uk            # "uk" | "en" | "uk+en"
source: "12 LinkedIn posts, 5 Instagram posts"
created: 2026-02-08T14:00:00Z
updated: 2026-02-08T16:30:00Z
---
```

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | number | yes | Incremented on each update |
| `type` | string | yes | `"personal"` or `"reference"` |
| `language` | string | yes | `"uk"`, `"en"`, `"uk+en"` |
| `source` | string | yes | Where the source texts came from |
| `created` | ISO 8601 | yes | Creation date |
| `updated` | ISO 8601 | yes | Last update date |

### Body (Markdown)

Body is injected into the system prompt in full. LLM interprets it as an instruction. Code does not parse individual sections — it only reads frontmatter for metadata and passes the body to the prompt.

Required sections:

```markdown
## Voice
## LinkedIn
## Instagram
## X
## Examples
## Anti-examples
```

---

## Body Sections

### Voice — style core

Describes how the person writes regardless of platform.

```markdown
## Voice

- Tone: дружній, трохи іронічний, з повагою до читача
- Formality: casual але експертний — як розмова з розумним колегою за кавою
- Personality: Практик з досвідом. Любить розбирати загальноприйняті істини. Часто ділиться власними помилками.
- Sentence style: Короткі, рубані. Рідко більше 12 слів. Часто фрагменти: "От і все." Іноді довше речення для контрасту.
- Paragraph style: Одна думка = один абзац. 1-3 речення. Багато повітря.

### Hooks
- провокативне твердження ("Контент-плани не працюють.")
- особиста історія ("Три роки тому я втратив всіх клієнтів за тиждень.")
- питання ("Коли востаннє ви чесно сказали клієнту «ні»?")
- неочікувана статистика

### Closings
- відкрите питання до аудиторії
- один рядок підсумку — різкий і запам'ятовуваний
- м'який CTA ("Якщо зайшло — збережіть")

### Signature phrases
- ось у чому штука
- давайте чесно
- спойлер:
- і це нормально

### Vocabulary
- Preferred words: "пости" (not "контент"), "тексти" (not "матеріали"), "працює" (not "є ефективним")
- Technical terms: стрічка, охоплення, залученість
- Register: conversational with expertise — uses professional terms but explains them simply
- Transitions: "Але.", "І ось тут цікаво.", empty line, "↓"

### Avoid
- канцеляризми ("в рамках", "з метою", "дана стаття")
- слово "контент" — каже "пости" або "тексти"
- мотиваційні кліше ("вийди із зони комфорту", "прокачай")
- пасивний стан ("було прийнято рішення")
- більше 3 emoji на пост
- хештеги всередині тексту
- звертання "друзі" до аудиторії

### Emoji
Рідко, 1-2 на пост, тільки ↓ → 🔥 для візуального акценту, ніколи як заміна слів.
```

#### Voice Guidelines

| Field | Rule |
|---|---|
| Tone | 2-4 specific words. Not "professional" or "engaging" — those are generic |
| Formality | Scale with explanation, not just "formal/informal" |
| Personality | 2-3 sentences. The author's character, not a description of an ideal author |
| Hooks / Closings | Ordered from most frequent to least frequent |
| Vocabulary | Concrete word pairs (preferred → avoid). Transitions with examples |
| Avoid | Concrete examples, not abstract categories |

### Platforms — platform-specific rules

Each platform describes structure, constraints, and deviations from the base voice.

```markdown
## LinkedIn

- Max length: 1500
- Structure: hook (1-2 рубаних речення) → контекст/історія → розвиток думки з прикладом → інсайт → питання
- Tone: без змін від базового
- Formatting: кожне речення з нового рядка, без списків, текст "дихає"
- Hashtags: 3-5 в кінці через порожній рядок
- Example hooks:
  - "Контент-плани не працюють."
  - "Я звільнив свого найкращого менеджера. І ось чому це було правильно."
  - "Коли востаннє ви чесно сказали клієнту «ні»?"
- Notes: аудиторія цінує досвід і конкретику. "Я спробував X і ось що вийшло" > "Топ-5 порад".

## Instagram

- Max length: 800
- Structure: hook → 2-3 блоки цінності → CTA
- Tone: теплішій, ближчий, більше емоцій
- Formatting: абзаци по 2-3 речення, ↓ або → як роздільники
- Hashtags: 12-15 у першому коментарі
- Example hooks:
  - "Три роки тому я втратив всіх клієнтів за один тиждень."
  - "Ця порада коштувала мені 50 000 грн. Тепер даю безкоштовно."
- Notes: більше сторітелінгу, менше експертності. Перше речення вирішує все.

## X

- Max length: 280
- Structure: одна загострена думка
- Tone: різкіший, без пом'якшень
- Formatting: без форматування
- Hashtags: 0-1
- Example hooks:
  - "Нетворкінг — це не про візитки. Це про те, кому ти перший напишеш коли горить."
- Notes: твіт = одна думка доведена до краю. Якщо можна скоротити — скороти.
```

### Examples — reference posts

3-5 best posts. LLM uses them as a benchmark for tone and structure.

```markdown
## Examples

### Example 1 (LinkedIn)

Контент-плани не працюють.

Я це зрозумів після того, як три місяці чітко слідував плану.
І отримав нуль реакцій.

А потім одного ранку написав пост за 10 хвилин.
Про те, що мене бісить в нашій індустрії.

200+ коментарів.

**Why good:** Provocative hook. Personal story with a concrete result. Signature phrase "ось у чому штука". Ends with a question.

### Example 2 (Instagram)

Три роки тому я втратив всіх клієнтів за один тиждень.

↓

Я підняв ціни вдвічі. Без попередження.
Результат: 6 з 6 клієнтів пішли.

**Why good:** Intriguing hook. Plot twist. Honest admission of mistake. Arrows as section dividers.
```

### Anti-examples — what the LLM must NOT generate

1-2 example posts that violate the author's style. LLM uses them as a "red line" — the boundary between acceptable and unacceptable output. Anti-examples are more effective than Avoid rules because they show the full context of the failure.

```markdown
## Anti-examples

### Anti-example 1 (LinkedIn)

У сучасному світі, який постійно змінюється, кожен професіонал стикається з проблемою вигорання. Дослідження показують, що 76% працівників відчувають ознаки burnout. Ось 5 стратегій, які допоможуть вам ефективно подолати цю проблему:

1. Встановіть чіткі границі
2. Практикуйте mindfulness
3. Делегуйте задачі
4. Робіть перерви
5. Знайдіть ментора

Пам'ятайте: ваше здоров'я — найважливіше! Друзі, діліться своїм досвідом у коментарях 👇💪🔥

**Why bad:** Generic opening ("у сучасному світі"). Listicle structure — author never uses numbered lists. Motivational cliché ("ваше здоров'я — найважливіше"). Uses "друзі" (in Avoid list). 3 emoji (max limit). No personal story. No signature phrases. Sounds like any LinkedIn coach, not this specific author.
```

#### Anti-example Guidelines

| Rule | Details |
|---|---|
| Count | 1-2 anti-examples per profile |
| Source | Constructed from Avoid list violations, NOT real author's posts |
| Length | Same as a typical post — full context matters |
| **Why bad** | Must reference specific profile rules that are violated |
| Tone | Should be recognizably "AI-generic" — the exact output we're fighting |

---

## How the Pipeline Uses This

### Generation

1. Pipeline determines profile (`--profile` or `default`)
2. Reads `.md` file, parses frontmatter
3. Determines platform from the request
4. Injects profile body into system prompt in full
5. Adds topic + past posts as user message
6. Single API call → draft

### Feedback update

1. Pipeline receives feedback from user
2. Checks `type` in frontmatter:
    - `personal` → can update after confirmation
    - `reference` → never updated via feedback
3. If a style correction repeats 3+ times → proposes a change
4. After confirmation: updates the relevant section, increments `version`, updates `updated`

### Validation

Pipeline checks on read:
- Frontmatter is present and contains `version`, `type`, `language`
- `type` is `"personal"` or `"reference"`
- `language` is one of `["uk", "en", "uk+en"]`
- Body is not empty

If validation fails → clear error message explaining what's wrong.

---

## Full Example

```markdown
---
version: 3
type: personal
language: uk
source: "12 LinkedIn posts, 5 Instagram posts"
created: 2026-02-08T14:00:00Z
updated: 2026-02-09T10:00:00Z
---

## Voice

- Tone: дружній, трохи іронічний, з повагою до читача
- Formality: casual але експертний — як розмова з розумним колегою за кавою
- Personality: Практик з досвідом. Любить розбирати загальноприйняті істини і показувати що все складніше. Не претендує на істину в останній інстанції. Часто ділиться власними помилками.
- Sentence style: Короткі, рубані. Рідко більше 12 слів. Часто фрагменти: "От і все." або "Ніяк." Іноді довше речення для контрасту.
- Paragraph style: Одна думка = один абзац. 1-3 речення. Багато повітря. Текст "дихає".

### Hooks
- провокативне твердження ("Контент-плани не працюють.")
- особиста історія ("Три роки тому я втратив всіх клієнтів за тиждень.")
- питання ("Коли востаннє ви чесно сказали клієнту «ні»?")
- неочікувана статистика

### Closings
- відкрите питання до аудиторії
- один рядок підсумку — різкий і запам'ятовуваний
- м'який CTA ("Якщо зайшло — збережіть")

### Signature phrases
- ось у чому штука
- давайте чесно
- спойлер:
- і це нормально
- коротко:

### Vocabulary
- Preferred words: "пости" (not "контент"), "тексти" (not "матеріали"), "працює" (not "є ефективним")
- Technical terms: стрічка, охоплення, залученість, аудиторія
- Register: conversational with expertise — uses professional terms but explains them simply
- Transitions: "Але.", "І ось тут цікаво.", empty line, "↓"

### Avoid
- канцеляризми ("в рамках", "з метою", "дана стаття")
- слово "контент" — каже "пости" або "тексти"
- мотиваційні кліше ("вийди із зони комфорту", "прокачай")
- пасивний стан ("було прийнято рішення")
- більше 3 emoji на пост
- хештеги всередині тексту
- звертання "друзі" до аудиторії

### Emoji
Рідко, 1-2 на пост, тільки ↓ → 🔥 для візуального акценту, ніколи як заміна слів.

## LinkedIn

- Max length: 1500
- Structure: hook (1-2 рубаних речення) → контекст/історія → розвиток думки з прикладом → інсайт або висновок → питання до аудиторії
- Tone: без змін
- Formatting: кожне речення або коротка думка з нового рядка. Без маркованих списків. Текст має виглядати як "стіна з повітрям", а не як стаття.
- Hashtags: 3-5 в кінці через порожній рядок
- Example hooks:
  - "Контент-плани не працюють."
  - "Я звільнив свого найкращого менеджера. І ось чому це було правильно."
  - "Коли востаннє ви чесно сказали клієнту «ні»?"
- Notes: LinkedIn аудиторія — професіонали. Цінують досвід і конкретику. "Я спробував X і ось що вийшло" завжди працює краще ніж "Топ-5 порад".

## Instagram

- Max length: 800
- Structure: hook → 2-3 блоки цінності → CTA
- Tone: теплішій, ближчий, більше емоцій
- Formatting: абзаци по 2-3 речення. ↓ або → як роздільники секцій.
- Hashtags: 12-15 у першому коментарі
- Example hooks:
  - "Три роки тому я втратив всіх клієнтів за один тиждень."
  - "Ця порада коштувала мені 50 000 грн. Тепер даю безкоштовно."
- Notes: Більше сторітелінгу, менше експертності. Люди скролять — перше речення вирішує все.

## X

- Max length: 280
- Structure: одна загострена думка
- Tone: різкіший, без пом'якшень
- Formatting: без форматування, без хештегів в тілі
- Hashtags: 0-1
- Example hooks:
  - "Нетворкінг — це не про візитки. Це про те, кому ти перший напишеш коли горить."
- Notes: Твіт = одна думка доведена до краю. Якщо можна скоротити — скороти.

## Examples

### Example 1 (LinkedIn)

Контент-плани не працюють.

Я це зрозумів після того, як три місяці чітко слідував плану.
І отримав нуль реакцій.

А потім одного ранку написав пост за 10 хвилин.
Про те, що мене бісить в нашій індустрії.
Без плану. Без структури.

200+ коментарів.

Ось у чому штука: люди реагують не на "якісний контент".
Вони реагують на чесність.

План дає тобі теми.
Але не дає тобі голос.

А голос — це єдине, що відрізняє тебе від ще одного "експерта" у стрічці.

Як у вас: плануєте чи пишете по натхненню?

**Why good:** Provocative one-sentence hook. Personal story with a concrete result. Contrast (plan vs spontaneity). Signature phrase "ось у чому штука". Ends with a question. Each line is a separate thought.

### Example 2 (Instagram)

Три роки тому я втратив всіх клієнтів за один тиждень.

Не через кризу. Не через конкурентів.
Через одне рішення, яке здавалось правильним.

↓

Я підняв ціни вдвічі.
Без попередження. Без пояснення.
Просто виставив нові рахунки.

Результат: 6 з 6 клієнтів пішли.

↓

Але через 2 місяці у мене було 4 нових.
Які платили нову ціну без питань.

Давайте чесно: я тоді не був розумний.
Мені просто пощастило.

Але урок залишився:
правильна ціна відлякує неправильних клієнтів.
І це нормально.

**Why good:** Intriguing hook. Emotional story with a twist. Honest admission of mistake. Two signature phrases ("давайте чесно", "і це нормально"). Arrows as dividers. Compact paragraphs.

## Anti-examples

### Anti-example 1 (LinkedIn)

У сучасному світі, який постійно змінюється, кожен професіонал стикається з проблемою вигорання. Дослідження показують, що 76% працівників відчувають ознаки burnout. Ось 5 стратегій, які допоможуть вам ефективно подолати цю проблему:

1. Встановіть чіткі границі
2. Практикуйте mindfulness
3. Делегуйте задачі
4. Робіть перерви
5. Знайдіть ментора

Пам'ятайте: ваше здоров'я — найважливіше! Друзі, діліться своїм досвідом у коментарях 👇💪🔥

**Why bad:** Generic opening ("у сучасному світі"). Listicle structure — author never uses numbered lists. Motivational cliché ("ваше здоров'я — найважливіше"). Uses "друзі" (Avoid list). 3 emoji at limit. No personal story. No signature phrases. Sounds like any LinkedIn coach, not this author.
```

---

## v0.1 → v0.2 Changes

| What | v0.1 | v0.2 |
|---|---|---|
| Format | JSON | Markdown + YAML frontmatter |
| Extension | `.json` | `.md` |
| Body parsing | Code parses each field | Body injected into prompt as-is |
| Changelog | JSON array in profile | Removed (git history) |
| Mix mode | `--mix base techniques` | Removed from scope |
| Agent | Claude tool-routing | Deterministic pipeline |
| Validation | Per-field JSON validation | Frontmatter fields + body not empty |
