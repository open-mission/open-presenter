/**
 * Utilitário de divisão inteligente de versículos longos em múltiplos slides.
 * Evita fontes excessivamente pequenas ou quebras bruscas no telão e no retorno,
 * dividindo em fronteiras naturais de pontuação (ponto, ponto e vírgula, vírgula).
 */

const DEFAULT_THRESHOLD_CHARS = 220;

/**
 * Encontra a melhor posição de quebra ao redor de `targetIdx`, respeitando
 * pontuações primárias (; . : ! ? —) e secundárias (,).
 */
function findSplitIndex(text: string, targetIdx: number, searchRadius: number): number {
  const minIdx = Math.max(15, targetIdx - searchRadius);
  const maxIdx = Math.min(text.length - 15, targetIdx + searchRadius);
  if (minIdx >= maxIdx) return targetIdx;

  const window = text.substring(minIdx, maxIdx);

  // 1. Prioridade alta: pontuação forte de pausa ou fim de oração
  const primaryDelims = ["; ", ". ", ": ", "! ", "? ", "— ", " - "];
  let bestPos = -1;
  let bestDist = Infinity;

  for (const delim of primaryDelims) {
    let searchFrom = 0;
    while (true) {
      const found = window.indexOf(delim, searchFrom);
      if (found === -1) break;
      const actualPos = minIdx + found + delim.length;
      const dist = Math.abs(actualPos - targetIdx);
      if (dist < bestDist) {
        bestDist = dist;
        bestPos = actualPos;
      }
      searchFrom = found + 1;
    }
  }

  if (bestPos !== -1) {
    return bestPos;
  }

  // 2. Prioridade média: vírgula
  let searchFrom = 0;
  while (true) {
    const found = window.indexOf(", ", searchFrom);
    if (found === -1) break;
    const actualPos = minIdx + found + 2;
    const dist = Math.abs(actualPos - targetIdx);
    if (dist < bestDist) {
      bestDist = dist;
      bestPos = actualPos;
    }
    searchFrom = found + 1;
  }

  if (bestPos !== -1) {
    return bestPos;
  }

  // 3. Fallback: espaço mais próximo
  searchFrom = 0;
  while (true) {
    const found = window.indexOf(" ", searchFrom);
    if (found === -1) break;
    const actualPos = minIdx + found + 1;
    const dist = Math.abs(actualPos - targetIdx);
    if (dist < bestDist) {
      bestDist = dist;
      bestPos = actualPos;
    }
    searchFrom = found + 1;
  }

  return bestPos !== -1 ? bestPos : targetIdx;
}

/**
 * Divide um versículo em 2 ou mais partes naturais se ultrapassar `maxChars`.
 */
export function splitVerseText(
  text: string,
  maxChars = DEFAULT_THRESHOLD_CHARS,
): string[] {
  const clean = text.trim();
  if (!clean || clean.length <= maxChars) {
    return [clean];
  }

  const numParts = Math.min(4, Math.ceil(clean.length / maxChars));
  const parts: string[] = [];
  let remaining = clean;

  for (let p = 0; p < numParts - 1; p++) {
    if (remaining.length <= maxChars) {
      break;
    }
    const partsLeft = numParts - p;
    const idealLen = Math.round(remaining.length / partsLeft);
    const splitAt = findSplitIndex(remaining, idealLen, Math.round(idealLen * 0.45));
    const part = remaining.substring(0, splitAt).trim();
    remaining = remaining.substring(splitAt).trim();
    if (part) {
      parts.push(part);
    }
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts.length > 0 ? parts : [clean];
}
