# Tools Specification — Ghostpen v0.1

## Overview

Tools — це функції, які агент може викликати для взаємодії зі зовнішнім світом: файлова система, Notion, веб-пошук. Claude бачить опис кожного tool і самостійно вирішує коли і в якій послідовності їх використовувати.

Єдине hardcoded правило: `read_style_profile` викликається ЗАВЖДИ перед генерацією. Все інше — на розсуд агента.

Кожен tool описаний у форматі:
- **Description** — текст який бачить Claude (має бути чітким і конкретним)
- **Parameters** — input schema
- **Returns** — що повертає
- **Behavior** — логіка роботи, edge cases, fallbacks
- **When to use / When NOT to use** — інструкції для агента

---

## Style Profile Tools

### `read_style_profile`

Читає Style Profile з файлової системи.

**Description (для Claude):**
```
Читає Style Profile користувача з data/profiles/. 
ОБОВ'ЯЗКОВО викликай перед кожною генерацією контенту — без виключень. 
Для mix mode викликай двічі з різними profile_name.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "profile_name": {
      "type": "string",
      "description": "Ім'я профілю для читання. Default: 'default'",
      "default": "default"
    }
  },
  "required": []
}
```

**Returns:**
```json
{
  "success": true,
  "profile": { "...повний Style Profile JSON..." }
}
```

**Error returns:**
```json
{
  "success": false,
  "error": "profile_not_found",
  "message": "Profile 'competitor-alex' not found. Available profiles: default, competitor-maria",
  "available_profiles": ["default", "competitor-maria"]
}
```

**Behavior:**
- Читає файл `data/profiles/{profile_name}.json`
- Валідує JSON schema перед поверненням
- Якщо профіль не знайдений → повертає помилку зі списком доступних
- Якщо `default.json` не існує → повертає помилку з підказкою запустити `ghostpen init`
- Якщо JSON невалідний → повертає помилку з описом що саме зламано

**When to use:**
- ЗАВЖДИ перед генерацією поста (це єдине обов'язкове правило)
- Перед аналізом контенту (щоб порівняти з профілем)
- Коли користувач питає про свій стиль

**When NOT to use:**
- Для простих відповідей які не стосуються генерації контенту
- Повторно в тому ж conversation turn (кешувати в пам'яті)

---

### `update_style_profile`

Оновлює поля Style Profile після підтвердженого фідбеку.

**Description (для Claude):**
```
Оновлює Style Profile користувача. Використовуй ТІЛЬКИ після явного підтвердження 
користувача. Ніколи не оновлюй reference профілі через фідбек — тільки personal. 
Кожне оновлення автоматично інкрементує version і додає changelog запис.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "profile_name": {
      "type": "string",
      "description": "Ім'я профілю. Default: 'default'",
      "default": "default"
    },
    "changes": {
      "type": "object",
      "description": "Об'єкт змін у форматі dot-notation path → new value",
      "example": {
        "voice.formality": "casual але експертний",
        "voice.signature_phrases": ["ось у чому штука", "давайте чесно", "спойлер:"]
      }
    },
    "reason": {
      "type": "string",
      "description": "Чому вноситься зміна — для changelog"
    }
  },
  "required": ["changes", "reason"]
}
```

**Returns:**
```json
{
  "success": true,
  "version": 4,
  "changes_applied": ["voice.formality", "voice.signature_phrases"],
  "changelog_entry": {
    "version": 4,
    "date": "2026-02-09T10:00:00Z",
    "action": "updated",
    "description": "Зменшено формальність. Причина: 4 рази фідбек 'занадто формально'.",
    "fields_changed": ["voice.formality", "voice.signature_phrases"]
  }
}
```

**Behavior:**
- Читає поточний профіль
- Перевіряє `profile_type`:
  - `personal` → дозволити оновлення
  - `reference` → відмовити з поясненням
- Застосовує зміни через dot-notation paths
- Інкрементує `version`
- Оновлює `updated_at`
- Додає запис у `changelog`
- Зберігає файл
- Валідує результат перед збереженням

**Валідація змін:**
- Не можна змінити `profile_name`, `profile_type`, `created_at`
- `voice.hooks` і `voice.avoid` — тільки масиви рядків
- `platforms.*.max_length` — тільки число > 0
- Якщо валідація failed → відкат, повернення помилки

**When to use:**
- Після явного підтвердження користувача ("так, оновлюй профіль")
- Коли feedback tracker показує 3+ повторюваних фідбеки одного типу і користувач погоджується

**When NOT to use:**
- Без підтвердження користувача — НІКОЛИ
- Для reference профілів через feedback loop
- Під час генерації (тільки після)

---

### `list_profiles`

Повертає список всіх доступних Style Profiles.

**Description (для Claude):**
```
Показує всі доступні Style Profiles з їх типами і базовою інформацією. 
Використовуй коли користувач хоче побачити профілі, обрати профіль, 
або коли потрібно підказати доступні варіанти.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

**Returns:**
```json
{
  "success": true,
  "profiles": [
    {
      "name": "default",
      "type": "personal",
      "language": "uk",
      "version": 3,
      "updated_at": "2026-02-09T10:00:00Z",
      "tone_summary": "дружній, трохи іронічний"
    },
    {
      "name": "competitor-alex",
      "type": "reference",
      "language": "en",
      "version": 1,
      "updated_at": "2026-02-08T14:00:00Z",
      "tone_summary": "впевнений, прямий, наративний"
    }
  ],
  "total": 2
}
```

**Behavior:**
- Сканує `data/profiles/*.json`
- Читає тільки root fields + `voice.tone` (не весь профіль — для швидкості)
- Якщо папка порожня → повертає порожній масив з підказкою запустити `ghostpen init`
- Сортує: personal першим, далі reference по `updated_at` desc

**When to use:**
- Коли користувач запитує `ghostpen profile list`
- Коли профіль з `--profile` не знайдений — показати доступні
- Коли користувач не впевнений яке ім'я профілю вказати

---

## Content Tools

### `read_past_posts`

Читає раніше згенеровані пости для контексту.

**Description (для Claude):**
```
Шукає серед раніше згенерованих та збережених постів ті, що стосуються вказаної теми. 
Використовуй щоб уникнути повторення і щоб врахувати що автор вже писав на цю тему.
Не обов'язковий — використовуй коли тема може перетинатися з минулими постами.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "keywords": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Ключові слова для пошуку: ['вигорання', 'burnout', 'робота']"
    },
    "platform": {
      "type": "string",
      "enum": ["linkedin", "instagram", "x", "all"],
      "description": "Фільтр по платформі. Default: 'all'",
      "default": "all"
    },
    "limit": {
      "type": "number",
      "description": "Максимальна кількість результатів. Default: 5",
      "default": 5
    }
  },
  "required": ["keywords"]
}
```

**Returns:**
```json
{
  "success": true,
  "posts": [
    {
      "file": "2026-02-01-burnout-linkedin.md",
      "platform": "linkedin",
      "topic": "burnout",
      "created": "2026-02-01T14:30:00Z",
      "profile_used": "default",
      "preview": "Перші 200 символів поста..."
    }
  ],
  "total_found": 1
}
```

**Behavior:**
- Сканує `data/output/generated/*.md`
- Парсить frontmatter для метаданих
- Шукає keywords у: topic (frontmatter), тексті поста, назві файлу
- Пошук case-insensitive, підтримує і кирилицю і латиницю
- Повертає preview (перші 200 символів), не повний текст
- Якщо `data/output/generated/` порожня або нічого не знайдено → `posts: []`

**When to use:**
- Коли тема генерації може перетинатися з минулими постами
- Коли користувач каже "я вже щось про це писав"
- Коли потрібно уникнути повторення

**When NOT to use:**
- Для першої генерації коли history порожній
- Коли тема явно нова і унікальна

---

### `save_to_file`

Зберігає згенерований пост у локальний файл.

**Description (для Claude):**
```
Зберігає фінальну версію поста як Markdown файл з метаданими. 
Викликай після того як користувач підтвердив фінальну версію ("ok", "зберігай").
Файл зберігається з frontmatter для подальшого пошуку.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "content": {
      "type": "string",
      "description": "Повний текст поста"
    },
    "platform": {
      "type": "string",
      "enum": ["linkedin", "instagram", "x"]
    },
    "topic": {
      "type": "string",
      "description": "Тема поста в 2-3 словах для назви файлу"
    },
    "profile_used": {
      "type": "string",
      "description": "Ім'я профілю або 'mix:default+competitor-alex'",
      "default": "default"
    }
  },
  "required": ["content", "platform", "topic"]
}
```

**Returns:**
```json
{
  "success": true,
  "file_path": "data/output/generated/2026-02-08-burnout-linkedin.md"
}
```

**Behavior:**
- Генерує filename: `{date}-{topic-slug}-{platform}.md`
- Topic slug: lowercase, пробіли → дефіси, тільки [a-z0-9-], кирилиця транслітерується
- Додає frontmatter:
  ```yaml
  ---
  platform: linkedin
  topic: burnout
  created: 2026-02-08T14:30:00Z
  profile_used: default
  style_profile_version: 3
  ---
  ```
- Створює `data/output/generated/` якщо не існує
- Якщо файл з такою назвою вже є → додає суфікс `-2`, `-3`

**When to use:**
- ЗАВЖДИ після фінального підтвердження ("ok", "зберігай", "готово")

**When NOT to use:**
- До підтвердження користувача
- Для проміжних чернеток (вони тільки в conversation)

---

## External Tools

### `search_web`

Пошук інформації в інтернеті для збагачення контенту.

**Description (для Claude):**
```
Шукає в інтернеті свіжу інформацію: статистику, факти, тренди, дослідження.
Використовуй коли пост буде сильнішим з конкретними даними або свіжими фактами.
НЕ використовуй для загальновідомих речей — тільки коли потрібна конкретика або актуальність.
Формулюй запити коротко: 2-5 слів, англійською для кращих результатів.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Пошуковий запит, 2-5 слів. Приклад: 'burnout statistics 2025'"
    }
  },
  "required": ["query"]
}
```

**Returns:**
```json
{
  "success": true,
  "results": [
    {
      "title": "WHO: Burnout rates increased 40% since 2020",
      "url": "https://...",
      "snippet": "According to WHO data released in January 2025..."
    }
  ]
}
```

**Behavior:**
- Використовує Anthropic web search tool або Tavily API як fallback
- Повертає top-5 результатів
- Timeout: 10 секунд, потім fallback
- Якщо пошук не працює → генерація продовжується без зовнішніх даних, агент попереджує

**Принципи формулювання запитів (для Claude):**
- Англійською: `burnout statistics 2025`, не `статистика вигорання 2025`
- Коротко: `AI hiring trends`, не `what are the latest trends in AI hiring in 2025`
- Конкретно: `remote work productivity studies`, не `remote work`
- Один запит — одна тема. Якщо потрібно два факти — два запити

**When to use:**
- Пост про тренди або актуальні теми
- Потрібна конкретна статистика або дослідження
- Користувач просить "з фактами" або "з цифрами"
- Тема, де свіжість даних важлива

**When NOT to use:**
- Пост про особистий досвід або історію
- Загальновідомі речі (що таке вигорання, навіщо ставити цілі)
- Коли користувач дав достатньо контексту сам
- Motivational / opinion posts де факти не потрібні

---

## Notion Tools

### `read_notion_page`

Читає вміст сторінки Notion.

**Description (для Claude):**
```
Читає вказану Notion-сторінку і повертає її вміст як Markdown. 
Використовуй коли користувач дає Notion URL як джерело для генерації.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "page_id": {
      "type": "string",
      "description": "Notion page ID або повний URL. Агент витягує ID автоматично."
    }
  },
  "required": ["page_id"]
}
```

**Returns:**
```json
{
  "success": true,
  "title": "Мої думки про AI в маркетингу",
  "content": "# Мої думки про AI в маркетингу\n\nОсновна ідея: ...",
  "last_edited": "2026-02-07T10:00:00Z"
}
```

**Error returns:**
```json
{
  "success": false,
  "error": "notion_not_configured",
  "message": "Notion не налаштований. Додайте NOTION_TOKEN до .env файлу."
}
```

**Behavior:**
- Приймає як повний URL (`https://notion.so/page-name-abc123`) так і bare ID
- Витягує page ID з URL автоматично
- Конвертує Notion blocks → Markdown:
  - `heading_1/2/3` → `# / ## / ###`
  - `paragraph` → текст
  - `bulleted_list_item` → `- item`
  - `numbered_list_item` → `1. item`
  - `quote` → `> quote`
  - `code` → `` ```code``` ``
  - `toggle`, `callout`, `divider` → спрощені markdown еквіваленти
  - `image`, `video`, `embed` → `[media: description]` (не завантажує)
- Рекурсивно читає дочірні блоки (вкладені toggle, списки)
- Якщо `NOTION_TOKEN` відсутній → повертає `notion_not_configured` помилку
- Якщо сторінка не знайдена / немає доступу → відповідна помилка
- Timeout: 15 секунд

**When to use:**
- Користувач дає Notion URL і просить згенерувати пост на основі нотатки
- Користувач каже "візьми з Notion" або дає посилання

**When NOT to use:**
- Коли Notion не згадується — не пропонувати активно
- Для зберігання (це `write_to_notion`)

---

### `write_to_notion`

Створює нову сторінку в Notion Content Calendar.

**Description (для Claude):**
```
Зберігає згенерований пост у Notion database як нову сторінку зі статусом "draft". 
Використовуй тільки після підтвердження користувача. 
Якщо Notion не налаштований — повідом і запропонуй зберегти локально.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "content": {
      "type": "string",
      "description": "Текст поста"
    },
    "title": {
      "type": "string",
      "description": "Заголовок сторінки в Notion"
    },
    "platform": {
      "type": "string",
      "enum": ["linkedin", "instagram", "x"]
    },
    "topic": {
      "type": "string",
      "description": "Тема поста"
    },
    "profile_used": {
      "type": "string",
      "description": "Який профіль використано",
      "default": "default"
    }
  },
  "required": ["content", "title", "platform", "topic"]
}
```

**Returns:**
```json
{
  "success": true,
  "notion_url": "https://notion.so/burnout-post-abc123",
  "page_id": "abc123"
}
```

**Behavior:**
- Створює сторінку в database з `NOTION_DATABASE_ID` з `.env`
- Встановлює properties:
  - `Title` → title параметр
  - `Platform` → select: linkedin / instagram / x
  - `Topic` → text: тема
  - `Status` → select: "Draft"
  - `Created` → date: поточна дата
  - `Profile` → text: profile_used
- Тіло сторінки — content як Notion blocks (paragraph, heading якщо є)
- Якщо `NOTION_TOKEN` або `NOTION_DATABASE_ID` відсутні → `notion_not_configured`
- Якщо Notion API помилка → fallback на `save_to_file`, повідомити користувача

**Notion Database Structure (очікувана):**

Користувач має створити database в Notion з такими properties:
| Property | Type | Description |
|---|---|---|
| Title | Title | Назва поста |
| Platform | Select | linkedin, instagram, x |
| Topic | Rich text | Тема |
| Status | Select | Draft, Ready, Published |
| Created | Date | Дата створення |
| Profile | Rich text | Який style profile використано |

Документація для налаштування → README.md

**When to use:**
- Користувач каже "зберегти в Notion", "так" на пропозицію зберегти
- Тільки після фінального підтвердження

**When NOT to use:**
- Без підтвердження — НІКОЛИ
- Якщо Notion не налаштований — одразу fallback на файл

---

## Feedback Tools

### `track_feedback`

Записує фідбек для аналізу повторюваних патернів.

**Description (для Claude):**
```
Записує фідбек користувача в трекер. Автоматично категоризує за типом. 
Коли лічильник категорії досягає 3 — повідом, що варто запропонувати 
оновлення style profile.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "category": {
      "type": "string",
      "description": "Категорія фідбеку",
      "enum": [
        "too_formal",
        "too_casual",
        "too_long",
        "too_short",
        "hook_weak",
        "hook_strong",
        "tone_off",
        "structure_wrong",
        "vocabulary_wrong",
        "cta_missing",
        "cta_too_pushy",
        "other"
      ]
    },
    "raw_feedback": {
      "type": "string",
      "description": "Оригінальний текст фідбеку від користувача"
    }
  },
  "required": ["category", "raw_feedback"]
}
```

**Returns:**
```json
{
  "success": true,
  "category": "too_formal",
  "count": 3,
  "threshold_reached": true,
  "suggestion": "Користувач 3 рази сказав що текст занадто формальний. Запропонуй оновити voice.formality у style profile."
}
```

**Behavior:**
- Читає/оновлює `data/feedback-tracker.json`
- Інкрементує лічильник для категорії
- Оновлює `last_seen` дату
- Зберігає `raw_feedback` в історії (останні 10 записів на категорію)
- Якщо `count >= 3` → повертає `threshold_reached: true` з suggestion
- Якщо файл не існує → створює новий

**Feedback Tracker Schema:**
```json
{
  "too_formal": {
    "count": 3,
    "last_seen": "2026-02-08T16:30:00Z",
    "history": [
      { "date": "2026-02-06", "raw": "занадто офіційно звучить" },
      { "date": "2026-02-07", "raw": "зроби менш формально" },
      { "date": "2026-02-08", "raw": "ще формально, я так не пишу" }
    ]
  },
  "hook_weak": {
    "count": 1,
    "last_seen": "2026-02-07T10:00:00Z",
    "history": [
      { "date": "2026-02-07", "raw": "hook слабкий" }
    ]
  }
}
```

**When to use:**
- Після кожного стильового фідбеку (не конкретних правок типу "зміни слово X на Y")
- Claude сам категоризує фідбек перед викликом

**When NOT to use:**
- Для конкретних одноразових правок ("заміни третє речення")
- Коли користувач каже "ok" / "зберігай"

---

## Tool Interaction Patterns

### Pattern 1: Стандартна генерація

```
1. read_style_profile("default")
2. [optional] read_past_posts(keywords)
3. [optional] search_web(query)
4. → Claude generates draft
5. → User feedback
6. [if style feedback] track_feedback(category, raw)
7. → Claude regenerates
8. save_to_file(content, platform, topic)
9. [optional] write_to_notion(content, title, platform, topic)
```

### Pattern 2: Mix mode генерація

```
1. read_style_profile("default")        ← base
2. read_style_profile("competitor-alex") ← techniques
3. [optional] search_web(query)
4. → Claude generates with mixed context
5. → User feedback
6. [if style feedback] track_feedback(category, raw)  ← оновлює тільки personal
7. save_to_file(content, platform, topic, "mix:default+competitor-alex")
```

### Pattern 3: Створення профілю

```
1. list_profiles()                       ← перевірити що вже є
2. → User provides posts
3. → Claude analyzes style
4. save_to_file() для профілю            ← зберігає як profile JSON
5. → User confirms/adjusts
6. [if adjustments] update_style_profile(changes)
```

### Pattern 4: Feedback → Profile Update

```
1. track_feedback("too_formal", "занадто офіційно")
2. → threshold_reached: true
3. → Claude пропонує оновити profile
4. → User confirms
5. update_style_profile({ "voice.formality": "..." }, "3x фідбек: too_formal")
```

---

## Error Handling Matrix

| Tool | Error | User sees | Agent does |
|---|---|---|---|
| `read_style_profile` | File not found | "Профіль не знайдений" | Показує доступні або пропонує `init` |
| `read_style_profile` | Invalid JSON | "Профіль пошкоджений" | Пропонує пересторити |
| `update_style_profile` | Reference profile | "Reference профілі не оновлюються автоматично" | Пояснює, пропонує ручне оновлення |
| `update_style_profile` | Validation failed | "Невалідне значення для [field]" | Показує що саме не так |
| `search_web` | Timeout / API error | "Пошук недоступний, генерую без зовнішніх даних" | Продовжує без даних |
| `read_notion_page` | Not configured | "Notion не налаштований" | Пропонує вставити текст вручну |
| `read_notion_page` | Page not found | "Сторінку не знайдено" | Просить перевірити URL |
| `write_to_notion` | Not configured | "Notion не налаштований, зберігаю локально" | Автоматично `save_to_file` |
| `write_to_notion` | API error | "Помилка Notion, зберігаю локально" | Автоматично `save_to_file` |
| `save_to_file` | Disk error | "Помилка збереження" | Показує текст в консолі для copy-paste |
| `track_feedback` | File error | Нічого (silent) | Логує помилку, продовжує |

---

## Performance Targets

| Tool | Target latency | Max latency |
|---|---|---|
| `read_style_profile` | < 50ms | 200ms |
| `update_style_profile` | < 100ms | 500ms |
| `list_profiles` | < 100ms | 500ms |
| `read_past_posts` | < 200ms | 1s |
| `save_to_file` | < 50ms | 200ms |
| `search_web` | < 3s | 10s (timeout) |
| `read_notion_page` | < 2s | 15s (timeout) |
| `write_to_notion` | < 2s | 15s (timeout) |
| `track_feedback` | < 50ms | 200ms |
