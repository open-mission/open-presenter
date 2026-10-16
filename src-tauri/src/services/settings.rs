use rusqlite::{params, Connection, OptionalExtension};

use crate::error::AppError;

fn storage_error(err: rusqlite::Error) -> AppError {
    AppError::Storage(err.to_string())
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, AppError> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |r| {
        r.get(0)
    })
    .optional()
    .map_err(storage_error)
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(storage_error)?;
    Ok(())
}
