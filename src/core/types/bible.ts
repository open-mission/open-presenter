export interface BibleVersion {
  id: string;
  name: string;
  abbrev: string;
  path: string;
}

export interface BibleBook {
  id: number;
  bookReferenceId: number;
  testamentReferenceId: number;
  name: string;
  abbrev: string;
  chapterCount: number;
}

export interface BibleVerse {
  id: number;
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
  version?: string;
}

export interface BibleSearchResult {
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  version: string;
}

export interface BibleVerseCompare {
  versionId: string;
  versionName: string;
  verse: BibleVerse | null;
}
