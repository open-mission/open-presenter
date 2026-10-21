export interface PaletteKeyInput {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

const GLOBAL_KEYS = new Set(["b", "c", "f"]);

export function shouldOpenPaletteOnKey(
  input: PaletteKeyInput,
  presentationActive: boolean,
): boolean {
  if (input.metaKey || input.ctrlKey || input.altKey) return false;
  if (input.key.length !== 1) return false;
  if (!/[\p{L}\p{N}]/u.test(input.key)) return false;
  if (presentationActive && GLOBAL_KEYS.has(input.key.toLowerCase())) return false;
  return true;
}