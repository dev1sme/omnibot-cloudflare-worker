function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function findBreak(text: string, limit: number): number {
  const window = text.slice(0, limit);
  const newline = window.lastIndexOf("\n");
  if (newline > 0) return newline;
  const space = window.lastIndexOf(" ");
  if (space > 0) return space;
  return isHighSurrogate(text.charCodeAt(limit - 1)) && limit > 1 ? limit - 1 : limit;
}

// Measures UTF-16 code units, which is never lower than the character count.
export function splitMessage(text: string, limit: number): string[] {
  const chunks: string[] = [];
  let rest = text;

  while (rest.length > limit) {
    const end = findBreak(rest, limit);
    const chunk = rest.slice(0, end).trimEnd();
    if (chunk) chunks.push(chunk);
    rest = rest.slice(end).trimStart();
  }

  if (rest.trim()) chunks.push(rest);
  return chunks;
}
