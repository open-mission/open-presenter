use std::path::{Path, PathBuf};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use tauri::{AppHandle, Manager};

use crate::error::AppError;
use crate::state::types::{BibleBook, BibleSearchResult, BibleVerse, BibleVerseCompare, BibleVersion};

pub const STANDARD_BOOKS: [(&str, &str, i32); 66] = [
    // Antigo Testamento (39)
    ("Gênesis", "Gn", 1),
    ("Êxodo", "Êx", 1),
    ("Levítico", "Lv", 1),
    ("Números", "Nm", 1),
    ("Deuteronômio", "Dt", 1),
    ("Josué", "Js", 1),
    ("Juízes", "Jz", 1),
    ("Rute", "Rt", 1),
    ("1 Samuel", "1Sm", 1),
    ("2 Samuel", "2Sm", 1),
    ("1 Reis", "1Rs", 1),
    ("2 Reis", "2Rs", 1),
    ("1 Crônicas", "1Cr", 1),
    ("2 Crônicas", "2Cr", 1),
    ("Esdras", "Ed", 1),
    ("Neemias", "Ne", 1),
    ("Ester", "Et", 1),
    ("Jó", "Jó", 1),
    ("Salmos", "Sl", 1),
    ("Provérbios", "Pv", 1),
    ("Eclesiastes", "Ec", 1),
    ("Cânticos", "Ct", 1),
    ("Isaías", "Is", 1),
    ("Jeremias", "Jr", 1),
    ("Lamentações", "Lm", 1),
    ("Ezequiel", "Ez", 1),
    ("Daniel", "Dn", 1),
    ("Oseias", "Os", 1),
    ("Joel", "Jl", 1),
    ("Amós", "Am", 1),
    ("Obadias", "Ob", 1),
    ("Jonas", "Jn", 1),
    ("Miqueias", "Mq", 1),
    ("Naum", "Na", 1),
    ("Habacuque", "Hc", 1),
    ("Sofonias", "Sf", 1),
    ("Ageu", "Ag", 1),
    ("Zacarias", "Zc", 1),
    ("Malaquias", "Ml", 1),
    // Novo Testamento (27)
    ("Mateus", "Mt", 2),
    ("Marcos", "Mc", 2),
    ("Lucas", "Lc", 2),
    ("João", "Jo", 2),
    ("Atos", "At", 2),
    ("Romanos", "Rm", 2),
    ("1 Coríntios", "1Co", 2),
    ("2 Coríntios", "2Co", 2),
    ("Gálatas", "Gl", 2),
    ("Efésios", "Ef", 2),
    ("Filipenses", "Fp", 2),
    ("Colossenses", "Cl", 2),
    ("1 Tessalonicenses", "1Ts", 2),
    ("2 Tessalonicenses", "2Ts", 2),
    ("1 Timóteo", "1Tm", 2),
    ("2 Timóteo", "2Tm", 2),
    ("Tito", "Tt", 2),
    ("Filemom", "Fm", 2),
    ("Hebreus", "Hb", 2),
    ("Tiago", "Tg", 2),
    ("1 Pedro", "1Pe", 2),
    ("2 Pedro", "2Pe", 2),
    ("1 João", "1Jo", 2),
    ("2 João", "2Jo", 2),
    ("3 João", "3Jo", 2),
    ("Judas", "Jd", 2),
    ("Apocalipse", "Ap", 2),
];

fn storage_err(err: impl std::fmt::Display) -> AppError {
    AppError::Storage(err.to_string())
}

pub fn bibles_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(AppError::Tauri)?
        .join("bibles");
    std::fs::create_dir_all(&dir).map_err(storage_err)?;
    Ok(dir)
}

fn sanitize_id(raw: &str) -> String {
    raw.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect::<String>()
        .to_uppercase()
}

pub fn list_bible_versions(app: &AppHandle) -> Result<Vec<BibleVersion>, AppError> {
    let dir = bibles_dir(app)?;
    let mut versions = Vec::new();

    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(versions),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if ext != "sqlite" && ext != "db" {
            continue;
        }

        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        if stem.is_empty() {
            continue;
        }

        let conn = match Connection::open_with_flags(
            &path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
        ) {
            Ok(c) => c,
            Err(_) => continue,
        };

        // Verifica se possui as tabelas básicas
        let is_valid: bool = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('verse', 'book')",
                [],
                |r| r.get::<_, i64>(0),
            )
            .map(|c| c >= 2)
            .unwrap_or(false);

        if !is_valid {
            continue;
        }

        // Tenta ler metadados
        let name: String = conn
            .query_row(
                "SELECT value FROM metadata WHERE key = 'name' LIMIT 1",
                [],
                |r| r.get(0),
            )
            .optional()
            .unwrap_or(None)
            .unwrap_or_else(|| stem.clone());

        let abbrev: String = conn
            .query_row(
                "SELECT value FROM metadata WHERE key IN ('version_id', 'abbrev') LIMIT 1",
                [],
                |r| r.get(0),
            )
            .optional()
            .unwrap_or(None)
            .unwrap_or_else(|| stem.clone());

        versions.push(BibleVersion {
            id: stem.clone(),
            name,
            abbrev,
            path: path.to_string_lossy().to_string(),
        });
    }

    versions.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(versions)
}

#[derive(Debug, Deserialize)]
struct JsonBook {
    name: String,
    #[serde(default)]
    abbrev: Option<String>,
    chapters: Vec<Vec<String>>,
}

pub fn import_bible(
    app: &AppHandle,
    source_path_str: &str,
    custom_name: Option<String>,
) -> Result<BibleVersion, AppError> {
    let source_path = Path::new(source_path_str);
    if !source_path.exists() {
        return Err(AppError::NotFound(format!(
            "Arquivo bíblico não encontrado: {}",
            source_path_str
        )));
    }

    let dir = bibles_dir(app)?;
    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let stem = source_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("BIBLIA")
        .to_string();

    let base_id = if let Some(ref name) = custom_name {
        let clean = sanitize_id(name);
        if clean.is_empty() {
            sanitize_id(&stem)
        } else {
            clean
        }
    } else {
        sanitize_id(&stem)
    };

    let target_id = if base_id.is_empty() {
        "BIBLIA".to_string()
    } else {
        base_id
    };

    let target_file = dir.join(format!("{}.sqlite", target_id));

    if ext == "sqlite" || ext == "db" {
        // Valida arquivo de origem
        {
            let conn = Connection::open_with_flags(
                source_path,
                rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
            )
            .map_err(storage_err)?;

            let tables: i64 = conn
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('verse', 'book')",
                    [],
                    |r| r.get(0),
                )
                .map_err(storage_err)?;

            if tables < 2 {
                return Err(AppError::Validation(
                    "O banco SQLite não contém as tabelas necessárias ('book' e 'verse').".into(),
                ));
            }
        }

        // Copia para a pasta de bibles da aplicação
        std::fs::copy(source_path, &target_file).map_err(storage_err)?;

        // Abre a cópia para normalizar metadados e índices
        let conn = Connection::open(&target_file).map_err(storage_err)?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS metadata (key VARCHAR(255) PRIMARY KEY, value VARCHAR(255));
             CREATE INDEX IF NOT EXISTS idx_verse_lookup ON verse(book_id, chapter, verse);
             CREATE INDEX IF NOT EXISTS idx_verse_text ON verse(text);",
        )
        .map_err(storage_err)?;

        // Verifica se a tabela 'book' tem a coluna 'abbrev'
        let has_abbrev: bool = conn
            .prepare("SELECT abbrev FROM book LIMIT 1")
            .is_ok();

        if !has_abbrev {
            let _ = conn.execute("ALTER TABLE book ADD COLUMN abbrev VARCHAR(10)", []);
            for (idx, &(_name, abbrev, _testament)) in STANDARD_BOOKS.iter().enumerate() {
                let id = (idx + 1) as i32;
                let _ = conn.execute(
                    "UPDATE book SET abbrev = ?1 WHERE id = ?2",
                    params![abbrev, id],
                );
            }
        }

        let name = if let Some(n) = custom_name {
            let _ = conn.execute(
                "INSERT OR REPLACE INTO metadata (key, value) VALUES ('name', ?1)",
                params![n],
            );
            n
        } else {
            let existing: Option<String> = conn
                .query_row(
                    "SELECT value FROM metadata WHERE key = 'name' LIMIT 1",
                    [],
                    |r| r.get(0),
                )
                .optional()
                .unwrap_or(None);

            if let Some(n) = existing {
                n
            } else {
                let _ = conn.execute(
                    "INSERT OR REPLACE INTO metadata (key, value) VALUES ('name', ?1)",
                    params![target_id],
                );
                target_id.clone()
            }
        };

        let _ = conn.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES ('version_id', ?1)",
            params![target_id],
        );

        Ok(BibleVersion {
            id: target_id.clone(),
            name,
            abbrev: target_id,
            path: target_file.to_string_lossy().to_string(),
        })
    } else if ext == "json" {
        let content = std::fs::read_to_string(source_path).map_err(storage_err)?;
        let books: Vec<JsonBook> = serde_json::from_str(&content).map_err(|e| {
            AppError::Validation(format!("Estrutura JSON inválida para Bíblia: {}", e))
        })?;

        if books.is_empty() {
            return Err(AppError::Validation(
                "O arquivo JSON não contém livros.".into(),
            ));
        }

        // Se arquivo de destino já existe, remove antes
        if target_file.exists() {
            let _ = std::fs::remove_file(&target_file);
        }

        let mut conn = Connection::open(&target_file).map_err(storage_err)?;
        conn.execute_batch(
            "PRAGMA synchronous = OFF;
             PRAGMA journal_mode = MEMORY;
             CREATE TABLE metadata (key VARCHAR(255) PRIMARY KEY, value VARCHAR(255));
             CREATE TABLE book (
                 id INTEGER PRIMARY KEY,
                 book_reference_id INTEGER,
                 testament_reference_id INTEGER,
                 name VARCHAR(50),
                 abbrev VARCHAR(10)
             );
             CREATE TABLE verse (
                 id INTEGER PRIMARY KEY,
                 book_id INTEGER,
                 chapter INTEGER,
                 verse INTEGER,
                 text TEXT,
                 FOREIGN KEY (book_id) REFERENCES book (id)
             );",
        )
        .map_err(storage_err)?;

        let tx = conn.transaction().map_err(storage_err)?;

        let version_name = custom_name.unwrap_or_else(|| target_id.clone());
        tx.execute(
            "INSERT INTO metadata (key, value) VALUES ('name', ?1)",
            params![version_name],
        )
        .map_err(storage_err)?;
        tx.execute(
            "INSERT INTO metadata (key, value) VALUES ('version_id', ?1)",
            params![target_id],
        )
        .map_err(storage_err)?;

        let mut verse_id_counter: i32 = 1;

        for (b_idx, book) in books.iter().enumerate() {
            let book_id = (b_idx + 1) as i32;
            let testament_id = if book_id <= 39 { 1 } else { 2 };
            let abbrev = book.abbrev.clone().unwrap_or_else(|| {
                STANDARD_BOOKS
                    .get(b_idx)
                    .map(|b| b.1.to_string())
                    .unwrap_or_else(|| format!("B{}", book_id))
            });

            tx.execute(
                "INSERT INTO book (id, book_reference_id, testament_reference_id, name, abbrev)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![book_id, book_id, testament_id, book.name, abbrev],
            )
            .map_err(storage_err)?;

            for (c_idx, chapter) in book.chapters.iter().enumerate() {
                let chapter_num = (c_idx + 1) as i32;
                for (v_idx, text) in chapter.iter().enumerate() {
                    let verse_num = (v_idx + 1) as i32;
                    tx.execute(
                        "INSERT INTO verse (id, book_id, chapter, verse, text)
                         VALUES (?1, ?2, ?3, ?4, ?5)",
                        params![verse_id_counter, book_id, chapter_num, verse_num, text.trim()],
                    )
                    .map_err(storage_err)?;
                    verse_id_counter += 1;
                }
            }
        }

        tx.execute_batch(
            "CREATE INDEX idx_verse_lookup ON verse(book_id, chapter, verse);
             CREATE INDEX idx_verse_text ON verse(text);",
        )
        .map_err(storage_err)?;

        tx.commit().map_err(storage_err)?;

        Ok(BibleVersion {
            id: target_id.clone(),
            name: version_name,
            abbrev: target_id,
            path: target_file.to_string_lossy().to_string(),
        })
    } else {
        Err(AppError::Validation(
            "Formato não suportado. Importe um arquivo SQLite (.sqlite, .db) ou JSON (.json)."
                .into(),
        ))
    }
}

fn open_version_db(app: &AppHandle, version_id: &str) -> Result<Connection, AppError> {
    let dir = bibles_dir(app)?;
    let target = dir.join(format!("{}.sqlite", version_id));
    let path = if target.exists() {
        target
    } else {
        let fallback = dir.join(format!("{}.db", version_id));
        if fallback.exists() {
            fallback
        } else {
            return Err(AppError::NotFound(format!(
                "Versão da Bíblia '{}' não encontrada em {:?}",
                version_id, dir
            )));
        }
    };

    Connection::open_with_flags(
        &path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(storage_err)
}

pub fn get_bible_books(app: &AppHandle, version_id: &str) -> Result<Vec<BibleBook>, AppError> {
    let conn = open_version_db(app, version_id)?;

    // Detecta se existe coluna abbrev
    let has_abbrev = conn.prepare("SELECT abbrev FROM book LIMIT 1").is_ok();

    let query = if has_abbrev {
        "SELECT b.id, b.book_reference_id, b.testament_reference_id, b.name,
                COALESCE(b.abbrev, ''),
                COALESCE(MAX(v.chapter), 0) as chapter_count
         FROM book b
         LEFT JOIN verse v ON v.book_id = b.id
         GROUP BY b.id
         ORDER BY b.id ASC"
    } else {
        "SELECT b.id, b.book_reference_id, b.testament_reference_id, b.name,
                '',
                COALESCE(MAX(v.chapter), 0) as chapter_count
         FROM book b
         LEFT JOIN verse v ON v.book_id = b.id
         GROUP BY b.id
         ORDER BY b.id ASC"
    };

    let mut stmt = conn.prepare(query).map_err(storage_err)?;
    let rows = stmt
        .query_map([], |row| {
            let id: i32 = row.get(0)?;
            let book_ref: i32 = row.get(1)?;
            let test_ref: i32 = row.get(2)?;
            let name: String = row.get(3)?;
            let mut abbrev: String = row.get(4)?;
            let chapter_count: i32 = row.get(5)?;

            if abbrev.is_empty() {
                if let Some(std_b) = STANDARD_BOOKS.get((id - 1) as usize) {
                    abbrev = std_b.1.to_string();
                }
            }

            Ok(BibleBook {
                id,
                book_reference_id: book_ref,
                testament_reference_id: test_ref,
                name,
                abbrev,
                chapter_count,
            })
        })
        .map_err(storage_err)?;

    let mut books = Vec::new();
    for b in rows {
        books.push(b.map_err(storage_err)?);
    }
    Ok(books)
}

pub fn get_bible_chapter(
    app: &AppHandle,
    version_id: &str,
    book_id: i32,
    chapter: i32,
) -> Result<Vec<BibleVerse>, AppError> {
    let conn = open_version_db(app, version_id)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, book_id, chapter, verse, text
             FROM verse
             WHERE book_id = ?1 AND chapter = ?2
             ORDER BY verse ASC",
        )
        .map_err(storage_err)?;

    let rows = stmt
        .query_map(params![book_id, chapter], |r| {
            Ok(BibleVerse {
                id: r.get(0)?,
                book_id: r.get(1)?,
                chapter: r.get(2)?,
                verse: r.get(3)?,
                text: r.get(4)?,
                version: Some(version_id.to_string()),
            })
        })
        .map_err(storage_err)?;

    let mut verses = Vec::new();
    for v in rows {
        verses.push(v.map_err(storage_err)?);
    }
    Ok(verses)
}

pub fn search_bible_verses(
    app: &AppHandle,
    version_id: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<BibleSearchResult>, AppError> {
    let clean = query.trim();
    if clean.is_empty() {
        return Ok(Vec::new());
    }

    let conn = open_version_db(app, version_id)?;
    let like_pattern = format!("%{}%", clean);

    let mut stmt = conn
        .prepare(
            "SELECT v.book_id, b.name, v.chapter, v.verse, v.text
             FROM verse v
             JOIN book b ON b.id = v.book_id
             WHERE v.text LIKE ?1
             ORDER BY v.book_id ASC, v.chapter ASC, v.verse ASC
             LIMIT ?2",
        )
        .map_err(storage_err)?;

    let max_results = if limit == 0 || limit > 500 { 100 } else { limit };

    let rows = stmt
        .query_map(params![like_pattern, max_results as i64], |r| {
            Ok(BibleSearchResult {
                book_id: r.get(0)?,
                book_name: r.get(1)?,
                chapter: r.get(2)?,
                verse: r.get(3)?,
                text: r.get(4)?,
                version: version_id.to_string(),
            })
        })
        .map_err(storage_err)?;

    let mut results = Vec::new();
    for res in rows {
        results.push(res.map_err(storage_err)?);
    }
    Ok(results)
}

pub fn compare_bible_verse(
    app: &AppHandle,
    book_id: i32,
    chapter: i32,
    verse: i32,
    version_ids: Vec<String>,
) -> Result<Vec<BibleVerseCompare>, AppError> {
    let mut comparisons = Vec::new();

    for v_id in version_ids {
        let conn = match open_version_db(app, &v_id) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let version_name: String = conn
            .query_row(
                "SELECT value FROM metadata WHERE key = 'name' LIMIT 1",
                [],
                |r| r.get(0),
            )
            .optional()
            .unwrap_or(None)
            .unwrap_or_else(|| v_id.clone());

        let verse_obj: Option<BibleVerse> = conn
            .query_row(
                "SELECT id, book_id, chapter, verse, text
                 FROM verse
                 WHERE book_id = ?1 AND chapter = ?2 AND verse = ?3
                 LIMIT 1",
                params![book_id, chapter, verse],
                |r| {
                    Ok(BibleVerse {
                        id: r.get(0)?,
                        book_id: r.get(1)?,
                        chapter: r.get(2)?,
                        verse: r.get(3)?,
                        text: r.get(4)?,
                        version: Some(v_id.clone()),
                    })
                },
            )
            .optional()
            .unwrap_or(None);

        comparisons.push(BibleVerseCompare {
            version_id: v_id,
            version_name,
            verse: verse_obj,
        });
    }

    Ok(comparisons)
}

pub fn delete_bible(app: &AppHandle, version_id: &str) -> Result<(), AppError> {
    let dir = bibles_dir(app)?;
    let target = dir.join(format!("{}.sqlite", version_id));
    if target.exists() {
        std::fs::remove_file(target).map_err(storage_err)?;
    }
    let db_target = dir.join(format!("{}.db", version_id));
    if db_target.exists() {
        std::fs::remove_file(db_target).map_err(storage_err)?;
    }
    Ok(())
}
