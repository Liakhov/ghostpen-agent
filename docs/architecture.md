# Architecture — Ghostpen v0.1

## Overview

Ghostpen — автономний AI-агент, побудований на Claude API. Агент сам обирає послідовність дій для кожного запиту. Розробник задає tools і system prompt, Claude вирішує коли і як їх використовувати.

Архітектура навмисно проста: Node.js процес, який спілкується з Claude API і має доступ до файлової системи. Без черг, без мікросервісів, без бази даних. Стан зберігається у файлах.

---

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                      USER (CLI)                         │
│                                                         │
│  $ ghostpen "пост про вигорання для LinkedIn"           │
│  $ ghostpen init                                        │
│  $ ghostpen analyze                                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                    AGENT CORE                            │
│                   (src/agent.ts)                         │
│                                                          │
│  ┌────────────┐   ┌─────────────┐   ┌────────────────┐  │
│  │  System    │   │  Tool       │   │  Conversation  │  │
│  │  Prompt    │──▶│  Router     │──▶│  Loop          │  │
│  │            │   │  (Claude)   │   │                │  │
│  └────────────┘   └──────┬──────┘   └────────────────┘  │
│                          │                               │
│              ┌───────────┼───────────┐                   │
│              ▼           ▼           ▼                   │
│         ┌────────┐ ┌─────────┐ ┌──────────┐             │
│         │ Style  │ │ Content │ │ External │             │
│         │ Tools  │ │ Tools   │ │ Tools    │             │
│         └────────┘ └─────────┘ └──────────┘             │
└──────────────────────────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
    ┌──────────┐              ┌──────────┐
    │  Local   │              │   Web    │
    │  Files   │              │  Search  │
    └──────────┘              └──────────┘
```

---

## Agent Decision Model

Ghostpen не виконує захардкоджений pipeline. Claude отримує system prompt з описом ролі, доступних tools і принципів прийняття рішень. Далі сам обирає що робити.

### Decision Flow: Генерація поста

```
User: "напиши пост про вигорання для LinkedIn"
                    │
                    ▼
        ┌───────────────────────┐
        │ 1. ЗАВЖДИ: прочитай   │  ← єдине hardcoded правило
        │    style profile      │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ 2. Claude ВИРІШУЄ:    │
        │                       │
        │ Чи потрібен ресерч?   │──── Так → search_web("burnout statistics 2025")
        │                       │
        │ Чи є минулі пости    │──── Так → read_past_posts("вигорання")
        │ на цю тему?          │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ 3. Генерація чернетки │
        │    з урахуванням:     │
        │    - style profile    │
        │    - platform rules   │
        │    - зібраний контекст│
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ 4. Показати результат │
        │    Чекати фідбек      │
        └───────────┬───────────┘
                    │
            ┌───────┴───────┐
            ▼               ▼
     "hook слабкий"       "ok"
            │               │
            ▼               ▼
     Перегенерація    save_to_file()
     частини
```

### Decision Flow: Створення Style Profile

```
User: ghostpen init
            │
            ▼
  ┌─────────────────────┐
  │ Запитати джерело:   │
  │ paste / file        │
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │ Прочитати пости     │
  │ (10-20 текстів)     │
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │ Claude аналізує:    │
  │ - тон               │
  │ - довжина речень    │
  │ - структура         │
  │ - hooks             │
  │ - табу              │
  │ - signature phrases │
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │ Показати summary    │
  │ людською мовою      │
  │ + зберегти JSON     │
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────┐
  │ Чекати корективи    │
  │ або підтвердження   │
  └─────────────────────┘
```

### Decision Flow: Feedback Loop

```
User: "занадто формально"
            │
            ▼
  ┌──────────────────────────┐
  │ Claude класифікує фідбек │
  └─────────┬────────────────┘
            │
    ┌───────┴────────┐
    ▼                ▼
 Конкретний       Стильовий
 "hook коротший"  "занадто формально"
    │                │
    ▼                ▼
 Перегенерувати   Перегенерувати
 частину          + інкрементувати
                  feedback_counter
                       │
                       ▼
               counter >= 3?
              ┌────┴────┐
              ▼         ▼
             Ні        Так
              │         │
              ▼         ▼
           Продовжити  Запропонувати
                       оновити profile
                           │
                      User confirms?
                      ┌────┴────┐
                      ▼         ▼
                     Так       Ні
                      │         │
                      ▼         ▼
               update_style   Продовжити
               _profile()
```

---

## Component Architecture

### 1. Entry Point (`src/index.ts`)

Відповідає за:
- Парсинг CLI аргументів (команда + тема + прапорці)
- Завантаження конфігурації з `.env`
- Передачу контролю в `agent.ts`

Команди:
```
ghostpen init                                  # Створити персональний style profile
ghostpen "тема для платформи"                  # Згенерувати пост (default profile)
ghostpen "тема" --profile competitor-alex      # Згенерувати у стилі Alex
ghostpen "тема" --mix default competitor-alex  # Мікс: мій голос + прийоми Alex
ghostpen analyze                               # Аналіз існуючих постів
ghostpen profile list                          # Список всіх профілів
ghostpen profile create competitor-alex        # Створити reference профіль
ghostpen profile show competitor-alex          # Показати summary профілю
ghostpen profile delete competitor-alex        # Видалити reference профіль
```

### 2. Agent Core (`src/agent.ts`)

Серце системи. Відповідає за:
- Збірку system prompt (base + context-specific instructions)
- Реєстрацію tools
- Conversation loop з Claude API
- Обробку tool calls
- Управління feedback циклом

```typescript
// Спрощена схема
async function runAgent(userInput: string) {
  const systemPrompt = buildSystemPrompt();
  const tools = registerTools();
  
  const messages = [{ role: "user", content: userInput }];
  
  while (true) {
    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      system: systemPrompt,
      tools,
      messages,
    });
    
    if (response.stop_reason === "tool_use") {
      const toolResults = await executeTools(response.content);
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
      continue;
    }
    
    // Показати результат, чекати фідбек
    const feedback = await promptUser(response.content);
    
    if (feedback === "ok") {
      await saveResult(response.content);
      break;
    }
    
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: feedback });
  }
}
```

### 3. System Prompt (`src/prompts/system.ts`)

Не один монолітний текст, а конструктор:

```typescript
function buildSystemPrompt(): string {
  return [
    BASE_ROLE,           // Хто ти, твоя місія
    DECISION_PRINCIPLES, // Як приймати рішення
    TOOL_GUIDELINES,     // Коли який tool використовувати
    STYLE_RULES,         // Як працювати зі стилем
    FEEDBACK_RULES,      // Як обробляти фідбек
    OUTPUT_FORMAT,       // Як форматувати відповідь
  ].join("\n\n");
}
```

Окремі промпти для специфічних задач (`analyze-style.ts`, `generate-post.ts`) передаються як user message prefix, не як частина system prompt.

### 4. Tools (`src/tools/`)

Кожен tool — окрема функція з трьома компонентами:
- **Schema** — JSON Schema для Claude (що tool робить, які параметри)
- **Handler** — функція яка виконує дію
- **Description** — текст для Claude, щоб він розумів коли це використовувати

```typescript
// Приклад: src/tools/style-profile.ts

export const readStyleProfileSchema = {
  name: "read_style_profile",
  description: "Читає Style Profile користувача. ОБОВ'ЯЗКОВО викликай перед кожною генерацією контенту.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export async function readStyleProfile(): Promise<StyleProfile> {
  const raw = await fs.readFile("data/style-profile.json", "utf-8");
  return JSON.parse(raw);
}
```

### 5. Utils

- **`logger.ts`** — логує рішення агента: який tool викликав, чому, з якими параметрами. Для дебагу і розуміння поведінки.

---

## Data Architecture

### Де що зберігається

```
data/
├── profiles/
│   ├── default.json            # Персональний профіль (єдиний personal)
│   ├── competitor-alex.json    # Reference профіль
│   └── competitor-maria.json   # Reference профіль
├── feedback-tracker.json       # Лічильники повторюваного фідбеку
├── examples/
│   ├── linkedin-posts.md       # Вхідні пости для аналізу
│   └── instagram-posts.md
└── output/
    └── generated/
        ├── 2026-02-08-burnout-linkedin.md
        ├── 2026-02-09-productivity-instagram.md
        └── ...
```

### Profiles — мульти-профільна система

Ghostpen підтримує кілька Style Profiles:

- **personal** (`default.json`) — стиль користувача. Еволюціонує з фідбеком. Один на користувача.
- **reference** (будь-яка кількість) — стилі інших авторів. Для аналізу, генерації в чужому стилі, або mix mode.

Агент обирає профіль через `--profile` прапорець або використовує `default.json`.

**Mix mode** (`--mix profileA profileB`) — комбінує два профілі: голос і характер з першого, прийоми і структуру з другого. Детальна специфікація → `docs/STYLE-PROFILE-SPEC.md`

### Style Profile — джерело правди

Один JSON файл. Читається на кожну генерацію. Оновлюється тільки після explicit підтвердження користувача. Кожне оновлення додає запис у внутрішній changelog.

Детальна специфікація → `docs/STYLE-PROFILE-SPEC.md`

### Feedback Tracker

Окремий файл для підрахунку повторюваного фідбеку:

```json
{
  "too_formal": { "count": 4, "last_seen": "2026-02-08" },
  "hook_weak": { "count": 2, "last_seen": "2026-02-07" },
  "too_long": { "count": 1, "last_seen": "2026-02-06" }
}
```

Коли `count >= 3` → агент пропонує оновити style profile.

### Generated Output

Кожна фінальна чернетка зберігається як Markdown файл з frontmatter:

```markdown
---
platform: linkedin
topic: burnout
created: 2026-02-08T14:30:00Z
style_profile_version: 3
---

[текст поста]
```

---

## Integration Points

### Claude API

- Model: `claude-sonnet-4-20250514` (баланс якість/швидкість/ціна)
- Tool use: native function calling
- Max tokens: 4096 для генерації, 8192 для аналізу стилю
- Temperature: 0.7 для генерації, 0.3 для аналізу

### Web Search

- Через Claude tool use з web_search (якщо доступний)
- Або fallback на Tavily API / SerpAPI
- Мета: свіжа статистика і факти, не генерація контенту

---

## Error Handling

### Принцип: ніколи не крашити, завжди fallback

| Помилка | Fallback |
|---|---|
| Style Profile не знайдений | Пропонуємо `ghostpen init` |
| Web search не працює | Генеруємо без свіжих даних, попереджаємо |
| Claude API rate limit | Retry з exponential backoff (3 спроби) |
| Невалідний style profile JSON | Показуємо помилку, пропонуємо пересторити |

### Логування

Рівні: `debug`, `info`, `warn`, `error`

```
[INFO]  Reading style profile...
[INFO]  Tool: search_web("burnout statistics 2025")
[DEBUG] Search returned 5 results
[INFO]  Generating draft for LinkedIn...
[INFO]  Saving to file
```

Логи пишуться в stdout. В debug режимі (`ghostpen --debug`) показують всі рішення агента.

---

## Security

- API ключі тільки в `.env`, файл в `.gitignore`
- Style profile може містити чутливу інформацію (особистий стиль) — файл локальний, не синхронізується нікуди без явного запиту
- Ніякої телеметрії, ніяких зовнішніх запитів крім Claude API і web search

---

## Future Considerations (v0.2+)

Поточна архітектура навмисно проста, але розширювана:

- **Multi-user:** `data/` стає `data/{user_id}/`, додається Supabase auth
- **Web UI:** agent.ts стає API endpoint, Next.js фронт спілкується через HTTP
- **Нові платформи:** додається новий блок у `platforms` секцію style profile
- **Нові tools:** один файл в `src/tools/`, реєстрація в `tools/index.ts`
- **MCP:** tools можна винести в MCP сервери для інтеграції з Claude Desktop