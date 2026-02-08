export function buildCreateProfilePrompt(
  analysisResult: string,
  profileType: "personal" | "reference",
  profileName: string,
): string {
  return `
ЗАДАЧА: Створити Style Profile JSON на основі аналізу стилю.

ТИП ПРОФІЛЮ: ${profileType}
НАЗВА: ${profileName}

РЕЗУЛЬТАТИ АНАЛІЗУ:
${analysisResult}

Створи валідний JSON згідно з цією структурою:

{
  "profile_name": "${profileName}",
  "profile_type": "${profileType}",
  "source": "опис звідки взяті тексти",
  "version": 1,
  "created_at": "${new Date().toISOString()}",
  "updated_at": "${new Date().toISOString()}",
  "language": "uk або en — визнач з постів",
  "voice": {
    "tone": "string — тон в 3-5 словах",
    "formality": "string — рівень формальності з поясненням",
    "personality": "string — характер автора, 2-3 речення",
    "sentence_style": "string — як виглядають типові речення",
    "paragraph_style": "string — як будує абзаци",
    "hooks": ["string[] — 3-4 типи початків, від найчастішого"],
    "closings": ["string[] — 2-3 типи завершень"],
    "signature_phrases": ["string[] — характерні фрази"],
    "avoid": ["string[] — що автор ніколи не пише"],
    "emoji_usage": "string — як використовує emoji"
  },
  "platforms": {
    "linkedin": {
      "max_length": 1500,
      "structure": "string — типова структура поста",
      "tone_override": null,
      "formatting": "string — правила форматування",
      "hashtags": "string — правила хештегів",
      "notes": "string — додаткові нотатки"
    }
  },
  "examples": [
    {
      "id": "ex_001",
      "platform": "linkedin",
      "text": "повний текст поста",
      "why_good": "чому цей пост хороший — конкретно",
      "added_at": "${new Date().toISOString()}"
    }
  ],
  "changelog": [
    {
      "version": 1,
      "date": "${new Date().toISOString()}",
      "action": "created",
      "description": "Початковий профіль на основі аналізу постів"
    }
  ]
}

Обери 3-5 найкращих постів для секції examples.
Для кожного example напиши why_good — конкретно, з прикладами.

Заповни platform rules для тих платформ, пости для яких є в аналізі.
Якщо постів для якоїсь платформи немає — залиш розумні defaults
на основі загального стилю автора.

Поверни ТІЛЬКИ JSON. Без пояснень, без markdown code blocks.
`;
}