// src/lib/utf8.ts
export function truncateUtf8(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text
  const chars = Array.from(text)
  let result = ""
  let bytes = 0
  for (const char of chars) {
    const size = Buffer.byteLength(char, "utf8")
    if (bytes + size > maxBytes - 3) break
    result += char
    bytes += size
  }
  return `${result}…`
}
