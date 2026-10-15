use std::path::PathBuf;

use rusqlite::{params, Connection, OptionalExtension};
use tauri::{AppHandle, Manager};

use crate::error::AppError;

pub const SCHEMA_VERSION: i64 = 2;

const SCHEMA_V2: &str = "
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    song_key TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS song_sections (
    song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    section_type TEXT,
    PRIMARY KEY (song_id, position)
);
CREATE TABLE IF NOT EXISTS song_lyrics (
    song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    section_position INTEGER NOT NULL,
    line_position INTEGER NOT NULL,
    line TEXT NOT NULL,
    PRIMARY KEY (song_id, section_position, line_position)
);
CREATE TABLE IF NOT EXISTS service_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    setlist_json TEXT NOT NULL DEFAULT '{\"parts\":[]}'
);
";

pub struct Db(pub std::sync::Mutex<Connection>);

impl Db {
    pub fn with_conn<T>(
        &self,
        f: impl FnOnce(&Connection) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let conn = self
            .0
            .lock()
            .map_err(|_| AppError::Storage("banco indisponível".into()))?;
        f(&conn)
    }
}

fn storage_error(err: rusqlite::Error) -> AppError {
    AppError::Storage(err.to_string())
}

fn db_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(AppError::Tauri)?;
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Storage(e.to_string()))?;
    Ok(dir.join("open-presenter.db"))
}

pub fn migrate(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(storage_error)?;
    conn.execute_batch("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);")
        .map_err(storage_error)?;
    let version: i64 = conn
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |r| r.get(0))
        .optional()
        .map_err(storage_error)?
        .unwrap_or(0);
    if version >= SCHEMA_VERSION {
        return Ok(());
    }
    conn.execute_batch(
        "DROP TABLE IF EXISTS setlist_items;
        DROP TABLE IF EXISTS song_lyrics;
        DROP TABLE IF EXISTS song_sections;
        DROP TABLE IF EXISTS service_events;
        DROP TABLE IF EXISTS songs;",
    )
    .map_err(storage_error)?;
    conn.execute_batch(SCHEMA_V2).map_err(storage_error)?;
    conn.execute("DELETE FROM schema_version", [])
        .map_err(storage_error)?;
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (?1)",
        params![SCHEMA_VERSION],
    )
    .map_err(storage_error)?;
    Ok(())
}

pub fn open(app: &AppHandle) -> Result<Connection, AppError> {
    let path = db_path(app)?;
    let conn = Connection::open(path).map_err(storage_error)?;
    migrate(&conn)?;
    Ok(conn)
}

#[cfg(test)]
pub(crate) fn open_in_memory() -> Connection {
    let conn = Connection::open_in_memory().expect("abrir banco em memória");
    migrate(&conn).expect("migrar banco em memória");
    conn
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrate_cria_schema_v2_e_marca_versao() {
        let conn = open_in_memory();
        let v: i64 = conn.query_row("SELECT version FROM schema_version", [], |r| r.get(0)).unwrap();
        assert_eq!(v, 2);
        let tabelas: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |r| r.get(0)).unwrap().collect::<Result<_, _>>().unwrap();
        for esperada in ["songs", "song_sections", "song_lyrics", "service_events"] {
            assert!(tabelas.contains(&esperada.to_string()), "faltou {esperada}");
        }
    }

    #[test]
    fn migrate_e_idempotente() {
        let conn = open_in_memory();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap();
        let v: i64 = conn.query_row("SELECT version FROM schema_version", [], |r| r.get(0)).unwrap();
        assert_eq!(v, 2);
    }

    #[test]
    fn migrate_descarta_schema_v1_vazio() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE songs (id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL DEFAULT '', song_key TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
            CREATE TABLE song_lyrics (song_id TEXT NOT NULL, position INTEGER NOT NULL, line TEXT NOT NULL, PRIMARY KEY (song_id, position));
            CREATE TABLE setlist_items (event_id TEXT NOT NULL, position INTEGER NOT NULL, label TEXT NOT NULL, slide_json TEXT NOT NULL, PRIMARY KEY (event_id, position));").unwrap();
        migrate(&conn).unwrap();
        let n: i64 = conn.query_row("SELECT count(*) FROM songs", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 0);
        let tem_secoes: bool = conn.query_row("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='song_sections'", [], |r| r.get::<_, i64>(0)).unwrap() == 1;
        assert!(tem_secoes);
    }
}
