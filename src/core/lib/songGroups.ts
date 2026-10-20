import { SECTION_COLOR } from "../config/lyrics.ts";
import type { SectionType, SongGroupConfig } from "../types/index.ts";

/**
 * Localiza a configuração de grupo (cor e atalho) que corresponde a uma
 * seção de música. O casamento por tipo é o mais confiável; quando a seção não
 * tem tipo, caímos no nome do grupo comparado com o rótulo exibido.
 */
export function findSongGroup(
  groups: readonly SongGroupConfig[],
  sectionType: SectionType | null | undefined,
  label: string | null | undefined,
): SongGroupConfig | undefined {
  if (sectionType) {
    const byType = groups.find((group) => group.typeKey === sectionType);
    if (byType) return byType;
  }
  if (label) {
    const normalized = label.toLowerCase();
    return groups.find(
      (group) =>
        normalized.includes(group.name.toLowerCase()) ||
        group.name.toLowerCase().includes(normalized.replace(/\s*\d+$/, "")),
    );
  }
  return undefined;
}

/**
 * Cor do grupo da seção. Usa a cor configurada pelo operador e, quando não
 * há grupo correspondente, cai na cor padrão do tipo de seção. Retorna
 * `null` quando a seção não pertence a nenhum grupo, para que a interface
 * mantenha a borda neutra.
 */
export function songGroupColor(
  groups: readonly SongGroupConfig[],
  sectionType: SectionType | null | undefined,
  label: string | null | undefined,
): string | null {
  const group = findSongGroup(groups, sectionType, label);
  if (group) return group.color;
  if (sectionType) return SECTION_COLOR[sectionType] ?? null;
  return null;
}

/** Atalho de teclado configurado para o grupo da seção. */
export function songGroupShortcut(
  groups: readonly SongGroupConfig[],
  sectionType: SectionType | null | undefined,
  label: string | null | undefined,
): string {
  return findSongGroup(groups, sectionType, label)?.shortcut ?? "";
}
