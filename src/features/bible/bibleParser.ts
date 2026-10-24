export interface ParsedBibleReference {
  bookId: number;
  bookName: string;
  bookAbbrev: string;
  chapter: number;
  verse?: number;
  verseEnd?: number;
  raw: string;
  versionQuery?: string;
}

interface BookDefinition {
  id: number;
  name: string;
  abbrev: string;
  aliases: string[];
}

function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const BIBLE_BOOKS: BookDefinition[] = [
  // Antigo Testamento (39)
  { id: 1, name: "Gênesis", abbrev: "Gn", aliases: ["gn", "gen", "genesis", "ge"] },
  { id: 2, name: "Êxodo", abbrev: "Êx", aliases: ["ex", "exo", "exodo", "êxodo"] },
  { id: 3, name: "Levítico", abbrev: "Lv", aliases: ["lv", "lev", "levitico", "levítico"] },
  { id: 4, name: "Números", abbrev: "Nm", aliases: ["nm", "num", "numeros", "números", "nu"] },
  { id: 5, name: "Deuteronômio", abbrev: "Dt", aliases: ["dt", "deu", "deut", "deuteronomio", "deuteronômio"] },
  { id: 6, name: "Josué", abbrev: "Js", aliases: ["js", "jos", "josue", "josué"] },
  { id: 7, name: "Juízes", abbrev: "Jz", aliases: ["jz", "jui", "juizes", "juízes"] },
  { id: 8, name: "Rute", abbrev: "Rt", aliases: ["rt", "rut", "rute"] },
  { id: 9, name: "1 Samuel", abbrev: "1Sm", aliases: ["1sm", "1 sm", "1sam", "1 sam", "1samuel", "1 samuel", "i samuel", "i sam"] },
  { id: 10, name: "2 Samuel", abbrev: "2Sm", aliases: ["2sm", "2 sm", "2sam", "2 sam", "2samuel", "2 samuel", "ii samuel", "ii sam"] },
  { id: 11, name: "1 Reis", abbrev: "1Rs", aliases: ["1rs", "1 rs", "1re", "1 re", "1reis", "1 reis", "i reis"] },
  { id: 12, name: "2 Reis", abbrev: "2Rs", aliases: ["2rs", "2 rs", "2re", "2 re", "2reis", "2 reis", "ii reis"] },
  { id: 13, name: "1 Crônicas", abbrev: "1Cr", aliases: ["1cr", "1 cr", "1cro", "1 cro", "1cronicas", "1 crônicas", "1 cronicas", "i cronicas"] },
  { id: 14, name: "2 Crônicas", abbrev: "2Cr", aliases: ["2cr", "2 cr", "2cro", "2 cro", "2cronicas", "2 crônicas", "2 cronicas", "ii cronicas"] },
  { id: 15, name: "Esdras", abbrev: "Ed", aliases: ["ed", "esd", "esdras"] },
  { id: 16, name: "Neemias", abbrev: "Ne", aliases: ["ne", "nee", "neemias"] },
  { id: 17, name: "Ester", abbrev: "Et", aliases: ["et", "est", "ester"] },
  { id: 18, name: "Jó", abbrev: "Jó", aliases: ["job", "jó"] },
  { id: 19, name: "Salmos", abbrev: "Sl", aliases: ["sl", "sal", "ps", "psa", "salmo", "salmos"] },
  { id: 20, name: "Provérbios", abbrev: "Pv", aliases: ["pv", "pro", "prov", "proverbios", "provérbios"] },
  { id: 21, name: "Eclesiastes", abbrev: "Ec", aliases: ["ec", "ecl", "eclesiastes"] },
  { id: 22, name: "Cânticos", abbrev: "Ct", aliases: ["ct", "can", "cantares", "canticos", "cânticos", "song"] },
  { id: 23, name: "Isaías", abbrev: "Is", aliases: ["is", "isa", "isaias", "isaías"] },
  { id: 24, name: "Jeremias", abbrev: "Jr", aliases: ["jr", "jer", "jeremias"] },
  { id: 25, name: "Lamentações", abbrev: "Lm", aliases: ["lm", "lam", "lamentacoes", "lamentações"] },
  { id: 26, name: "Ezequiel", abbrev: "Ez", aliases: ["ez", "eze", "ezequiel"] },
  { id: 27, name: "Daniel", abbrev: "Dn", aliases: ["dn", "dan", "daniel"] },
  { id: 28, name: "Oseias", abbrev: "Os", aliases: ["os", "oze", "oseias", "oséias"] },
  { id: 29, name: "Joel", abbrev: "Jl", aliases: ["jl", "joe", "joel"] },
  { id: 30, name: "Amós", abbrev: "Am", aliases: ["am", "amo", "amos", "amós"] },
  { id: 31, name: "Obadias", abbrev: "Ob", aliases: ["ob", "oba", "obadias"] },
  { id: 32, name: "Jonas", abbrev: "Jn", aliases: ["jn", "jon", "jonas"] },
  { id: 33, name: "Miqueias", abbrev: "Mq", aliases: ["mq", "miq", "miqueias", "miqéias"] },
  { id: 34, name: "Naum", abbrev: "Na", aliases: ["na", "nau", "naum"] },
  { id: 35, name: "Habacuque", abbrev: "Hc", aliases: ["hc", "hab", "habacuque"] },
  { id: 36, name: "Sofonias", abbrev: "Sf", aliases: ["sf", "sof", "sofonias"] },
  { id: 37, name: "Ageu", abbrev: "Ag", aliases: ["ag", "age", "ageu"] },
  { id: 38, name: "Zacarias", abbrev: "Zc", aliases: ["zc", "zac", "zacarias"] },
  { id: 39, name: "Malaquias", abbrev: "Ml", aliases: ["ml", "mal", "malaquias"] },

  // Novo Testamento (27)
  { id: 40, name: "Mateus", abbrev: "Mt", aliases: ["mt", "mat", "mateus"] },
  { id: 41, name: "Marcos", abbrev: "Mc", aliases: ["mc", "mar", "marcos", "mk"] },
  { id: 42, name: "Lucas", abbrev: "Lc", aliases: ["lc", "luc", "lucas", "lk"] },
  { id: 43, name: "João", abbrev: "Jo", aliases: ["jo", "jhn", "john", "joao", "joão"] },
  { id: 44, name: "Atos", abbrev: "At", aliases: ["at", "ato", "atos", "act", "acts"] },
  { id: 45, name: "Romanos", abbrev: "Rm", aliases: ["rm", "rom", "romanos", "ro"] },
  { id: 46, name: "1 Coríntios", abbrev: "1Co", aliases: ["1co", "1 co", "1cor", "1 cor", "1corintios", "1 coríntios", "1 corintios", "i corintios"] },
  { id: 47, name: "2 Coríntios", abbrev: "2Co", aliases: ["2co", "2 co", "2cor", "2 cor", "2corintios", "2 coríntios", "2 corintios", "ii corintios"] },
  { id: 48, name: "Gálatas", abbrev: "Gl", aliases: ["gl", "gal", "galatas", "gálatas"] },
  { id: 49, name: "Efésios", abbrev: "Ef", aliases: ["ef", "efe", "efesios", "efésios"] },
  { id: 50, name: "Filipenses", abbrev: "Fp", aliases: ["fp", "fl", "fil", "filipenses", "php"] },
  { id: 51, name: "Colossenses", abbrev: "Cl", aliases: ["cl", "col", "colossenses"] },
  { id: 52, name: "1 Tessalonicenses", abbrev: "1Ts", aliases: ["1ts", "1 ts", "1tes", "1 tes", "1tessalonicenses", "1 tessalonicenses", "i tessalonicenses"] },
  { id: 53, name: "2 Tessalonicenses", abbrev: "2Ts", aliases: ["2ts", "2 ts", "2tes", "2 tes", "2tessalonicenses", "2 tessalonicenses", "ii tessalonicenses"] },
  { id: 54, name: "1 Timóteo", abbrev: "1Tm", aliases: ["1tm", "1 tm", "1tim", "1 tim", "1timoteo", "1 timóteo", "1 timoteo", "i timoteo"] },
  { id: 55, name: "2 Timóteo", abbrev: "2Tm", aliases: ["2tm", "2 tm", "2tim", "2 tim", "2timoteo", "2 timóteo", "2 timoteo", "ii timoteo"] },
  { id: 56, name: "Tito", abbrev: "Tt", aliases: ["tt", "tit", "tito"] },
  { id: 57, name: "Filemom", abbrev: "Fm", aliases: ["fm", "flm", "filemom"] },
  { id: 58, name: "Hebreus", abbrev: "Hb", aliases: ["hb", "heb", "hebreus"] },
  { id: 59, name: "Tiago", abbrev: "Tg", aliases: ["tg", "tia", "tiago", "jas"] },
  { id: 60, name: "1 Pedro", abbrev: "1Pe", aliases: ["1pe", "1 pe", "1ped", "1 ped", "1pedro", "1 pedro", "i pedro"] },
  { id: 61, name: "2 Pedro", abbrev: "2Pe", aliases: ["2pe", "2 pe", "2ped", "2 ped", "2pedro", "2 pedro", "ii pedro"] },
  { id: 62, name: "1 João", abbrev: "1Jo", aliases: ["1jo", "1 jo", "1jao", "1joao", "1 joão", "1 joao", "i joao"] },
  { id: 63, name: "2 João", abbrev: "2Jo", aliases: ["2jo", "2 jo", "2jao", "2joao", "2 joão", "2 joao", "ii joao"] },
  { id: 64, name: "3 João", abbrev: "3Jo", aliases: ["3jo", "3 jo", "3jao", "3joao", "3 joão", "3 joao", "iii joao"] },
  { id: 65, name: "Judas", abbrev: "Jd", aliases: ["jd", "jud", "judas"] },
  { id: 66, name: "Apocalipse", abbrev: "Ap", aliases: ["ap", "apo", "apoc", "apocalipse", "apc", "rev"] },
];

// Prepara mapa normalizado de apelidos para busca instantânea O(1)
const ALIAS_MAP = new Map<string, BookDefinition>();

for (const book of BIBLE_BOOKS) {
  ALIAS_MAP.set(removeAccents(book.name), book);
  ALIAS_MAP.set(removeAccents(book.abbrev), book);
  for (const alias of book.aliases) {
    ALIAS_MAP.set(removeAccents(alias), book);
  }
}

/**
 * Analisa e extrai referências bíblicas escritas pelo usuário.
 * Suporta formatos:
 * - "João 3:16", "Jo 3.16", "jo 3 16", "jo3.16", "joao 3:16-18"
 * - "1 Jo 1:9", "1jo 1 9", "1co 13", "sl 23", "gn 1.1"
 */
export function parseBibleReference(input: string): ParsedBibleReference | null {
  const clean = input.trim();
  if (!clean) return null;

  // Regex para capturar:
  // Grupo 1: prefixo do livro (letras, números iniciais, espaços)
  // Grupo 2: capítulo
  // Grupo 3: versículo inicial (opcional)
  // Grupo 4: versículo final (opcional, ex: -18)
  // Grupo 5: versão bíblica opcional (ex: "ara", "nvi", "arc")
  const pattern = /^([1-3iI]{0,3}\s*[a-zA-ZÀ-ÿ]+)\s*(\d+)[\s.:,]*(?:(\d+)(?:\s*-\s*(\d+))?)?(?:\s+([a-zA-Z0-9_\-]+))?$/;
  const match = clean.match(pattern);

  if (!match) {
    // Tenta formato onde só digitou livro e capítulo, ex: "Salmos 23" ou "1Co 13"
    return null;
  }

  const rawBook = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const verse = match[3] ? parseInt(match[3], 10) : undefined;
  const verseEnd = match[4] ? parseInt(match[4], 10) : undefined;
  const versionQuery = match[5] ? match[5].trim() : undefined;

  const normalizedBook = removeAccents(rawBook).replace(/\s+/g, " ");
  const book = ALIAS_MAP.get(normalizedBook);

  if (!book) {
    // Tenta encontrar por prefixo se não achou exato
    const found = BIBLE_BOOKS.find((b) => {
      const bNorm = removeAccents(b.name);
      return bNorm.startsWith(normalizedBook) || b.aliases.some((a) => a.startsWith(normalizedBook));
    });
    if (!found) return null;

    return {
      bookId: found.id,
      bookName: found.name,
      bookAbbrev: found.abbrev,
      chapter,
      verse,
      verseEnd,
      raw: clean,
      versionQuery,
    };
  }

  return {
    bookId: book.id,
    bookName: book.name,
    bookAbbrev: book.abbrev,
    chapter,
    verse,
    verseEnd,
    raw: clean,
    versionQuery,
  };
}
