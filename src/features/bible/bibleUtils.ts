import type { BibleVersion } from "../../core/types/bible";

const KNOWN_BIBLE_NAMES: Record<string, string> = {
  ARA: "Almeida Revista e Atualizada",
  ARC: "Almeida Revista e Corrigida",
  NVI: "Nova Versão Internacional",
  NTLH: "Nova Tradução na Linguagem de Hoje",
  NAA: "Nova Almeida Atualizada",
  NVT: "Nova Versão Transformadora",
  ACF: "Almeida Corrigida Fiel",
  BKJ: "Bíblia King James Atualizada",
  KJV: "King James Version",
  ASV: "American Standard Version",
  JFA: "João Ferreira de Almeida",
  AA: "Almeida Antiga",
};

export function cleanVersionIdentifier(val: string): string {
  return val
    .replace(/^(bibles?[-_])/i, "")
    .replace(/[-_]bibles?$/i, "")
    .trim();
}

export function formatBibleVersionAbbrev(v: { id: string; abbrev?: string }): string {
  const raw = v.abbrev || v.id;
  const cleaned = cleanVersionIdentifier(raw).toUpperCase();
  return cleaned || v.id;
}

export function formatBibleVersionLabel(v: { id: string; name?: string; abbrev?: string }): string {
  const abbrev = formatBibleVersionAbbrev(v);
  const cleanId = cleanVersionIdentifier(v.id).toUpperCase();

  let rawName = cleanVersionIdentifier(v.name || "").replace(/[_-]+/g, " ").trim();

  const knownName = KNOWN_BIBLE_NAMES[abbrev] || KNOWN_BIBLE_NAMES[cleanId];
  if (knownName) {
    return `${knownName} (${abbrev})`;
  }

  if (!rawName || rawName.toUpperCase() === abbrev) {
    return abbrev;
  }

  if (rawName.endsWith(`(${abbrev})`)) {
    return rawName;
  }

  return `${rawName} (${abbrev})`;
}

export function matchInstalledBibleVersion(
  versions: BibleVersion[],
  query?: string,
): BibleVersion | null {
  if (!query || versions.length === 0) return null;
  const q = query.trim().toLowerCase();
  const qClean = cleanVersionIdentifier(q).toLowerCase();

  const exact = versions.find((v) => {
    const abbrev = formatBibleVersionAbbrev(v).toLowerCase();
    const idClean = cleanVersionIdentifier(v.id).toLowerCase();
    return abbrev === qClean || idClean === qClean || v.id.toLowerCase() === q;
  });
  if (exact) return exact;

  return (
    versions.find((v) => {
      const name = cleanVersionIdentifier(v.name).toLowerCase();
      return name.startsWith(qClean) || name.includes(qClean);
    }) ?? null
  );
}
