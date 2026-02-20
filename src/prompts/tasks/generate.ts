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
${params.pastPosts.map((p, i) => `--- Post ${i + 1} ---\n${p}`).join("\n\n")}`;
  }

  return prompt;
}