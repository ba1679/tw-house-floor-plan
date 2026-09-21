export function sentenceLines(text: string) {
  return text.match(/[^。]+。?/g) ?? [text];
}
