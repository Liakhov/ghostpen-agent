export const MIX_MODE_TEMPLATE = `МІХ-РЕЖИМ:
Ти отримав два профілі: BASE (основний) та REFERENCE (для технік).

Правила міксу:
- ГОЛОС (tone, personality, formality, sentence_style) → бери з BASE
- ТЕХНІКИ (hooks, closings, structure) → бери з REFERENCE
- AVOID → об'єднуй обидва списки
- SIGNATURE PHRASES → тільки з BASE
- EXAMPLES → враховуй обидва, але пріоритет BASE

Результат має звучати як автор BASE, але з прийомами REFERENCE.`;
