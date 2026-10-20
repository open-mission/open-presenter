use tauri::AppHandle;

use crate::error::AppError;
use crate::services::bible;
use crate::state::types::{BibleBook, BibleSearchResult, BibleVerse, BibleVerseCompare, BibleVersion};

#[tauri::command]
pub async fn list_bible_versions(app: AppHandle) -> Result<Vec<BibleVersion>, AppError> {
    bible::list_bible_versions(&app)
}

#[tauri::command]
pub async fn import_bible(
    app: AppHandle,
    source_path: String,
    custom_name: Option<String>,
) -> Result<BibleVersion, AppError> {
    bible::import_bible(&app, &source_path, custom_name)
}

#[tauri::command]
pub async fn get_bible_books(
    app: AppHandle,
    version_id: String,
) -> Result<Vec<BibleBook>, AppError> {
    bible::get_bible_books(&app, &version_id)
}

#[tauri::command]
pub async fn get_bible_chapter(
    app: AppHandle,
    version_id: String,
    book_id: i32,
    chapter: i32,
) -> Result<Vec<BibleVerse>, AppError> {
    bible::get_bible_chapter(&app, &version_id, book_id, chapter)
}

#[tauri::command]
pub async fn search_bible_verses(
    app: AppHandle,
    version_id: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<BibleSearchResult>, AppError> {
    bible::search_bible_verses(&app, &version_id, &query, limit.unwrap_or(100))
}

#[tauri::command]
pub async fn compare_bible_verse(
    app: AppHandle,
    book_id: i32,
    chapter: i32,
    verse: i32,
    version_ids: Vec<String>,
) -> Result<Vec<BibleVerseCompare>, AppError> {
    bible::compare_bible_verse(&app, book_id, chapter, verse, version_ids)
}

#[tauri::command]
pub async fn delete_bible(app: AppHandle, version_id: String) -> Result<(), AppError> {
    bible::delete_bible(&app, &version_id)
}
