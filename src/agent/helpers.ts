export function extractTopic(input: string): string {
  return input
    .replace(
      /^(напиши|створи|згенеруй|зроби|write|create|generate|make)\s+(пост|допис|тред|статтю|текст|post|thread|article)\s+(про|на тему|about)\s+/i,
      "",
    )
    .trim();
}

/**
 * Strip the model's preamble line (e.g. "Прочитав профіль, генерую для LinkedIn.")
 */
export function stripPreamble(text: string): string {
  const idx = text.indexOf("\n\n");
  if (idx === -1) return text;
  const firstLine = text.slice(0, idx);
  if (
    firstLine.length < 200 &&
    /профіль|генерую|profile|generating/i.test(firstLine)
  ) {
    return text.slice(idx + 2);
  }
  return text;
}

export function extractDefaultPlatform(profile: object | undefined): string {
  if (!profile || typeof profile !== "object") return "linkedin";
  const p = profile as Record<string, unknown>;
  if (p.platforms && typeof p.platforms === "object") {
    const platforms = Object.keys(p.platforms as object);
    if (platforms.length > 0) return platforms[0];
  }
  return "linkedin";
}
