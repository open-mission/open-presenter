use tauri::State;

use crate::error::AppError;
use crate::services::database::Db;
use crate::services::themes;
use crate::state::types::SlideTheme;

#[tauri::command]
pub fn list_themes(db: State<'_, Db>) -> Result<Vec<SlideTheme>, AppError> {
    db.with_conn(|conn| themes::list_themes(conn))
}

#[tauri::command]
pub fn get_theme(db: State<'_, Db>, guid: String) -> Result<Option<SlideTheme>, AppError> {
    db.with_conn(|conn| themes::get_theme(conn, &guid))
}

#[tauri::command]
pub fn save_theme(db: State<'_, Db>, theme: SlideTheme) -> Result<(), AppError> {
    db.with_conn(|conn| themes::save_theme(conn, &theme))
}

#[tauri::command]
pub fn delete_theme(db: State<'_, Db>, guid: String) -> Result<(), AppError> {
    db.with_conn(|conn| themes::delete_theme(conn, &guid))
}

#[tauri::command]
pub fn save_theme_media(
    app: tauri::AppHandle,
    guid: String,
    filename: String,
    contents: Vec<u8>,
) -> Result<String, AppError> {
    crate::services::theme_media::save_media(&app, &guid, &filename, &contents)
}
