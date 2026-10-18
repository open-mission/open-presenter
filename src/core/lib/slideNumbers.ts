const DIGIT_KEY_REGEX = /^[0-9]$/;

export const MAX_SLIDE_NUMBER_DIGITS = 3;

export function isSlideNumberKey(key: string): boolean {
  return DIGIT_KEY_REGEX.test(key);
}

export function appendSlideNumberDigit(buffer: string, key: string): string {
  if (!isSlideNumberKey(key) || buffer.length >= MAX_SLIDE_NUMBER_DIGITS) {
    return buffer;
  }
  return buffer + key;
}

export function removeLastSlideNumberDigit(buffer: string): string {
  return buffer.slice(0, -1);
}

export function resolveSlideNumberIndex(buffer: string, total: number): number | null {
  if (!/^[0-9]+$/.test(buffer)) return null;
  const value = Number.parseInt(buffer, 10);
  if (value < 1 || value > total) return null;
  return value - 1;
}
