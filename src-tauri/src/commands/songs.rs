use std::path::Path;

use tauri::State;

use crate::error::AppError;
use crate::services::database::Db;
use crate::services::{import, lrclib, lyrics, songs};
use crate::state::{ImportReport, OnlineLyricHit, Song, SongSection, SongSummary};

#[tauri::command]
pub fn list_songs(db: State<'_, Db>, query: Option<String>) -> Result<Vec<SongSummary>, AppError> {
    db.with_conn(|conn| songs::list(conn, query.as_deref()))
}

#[tauri::command]
pub fn get_song(db: State<'_, Db>, id: String) -> Result<Option<Song>, AppError> {
    db.with_conn(|conn| songs::get(conn, &id))
}

#[tauri::command]
pub fn save_song(db: State<'_, Db>, song: Song) -> Result<(), AppError> {
    db.with_conn(|conn| songs::save(conn, &song))
}

#[tauri::command]
pub fn delete_song(db: State<'_, Db>, id: String) -> Result<(), AppError> {
    db.with_conn(|conn| songs::delete(conn, &id))
}

#[tauri::command]
pub fn import_holyrics(db: State<'_, Db>, path: String) -> Result<ImportReport, AppError> {
    db.with_conn(|conn| import::import_holyrics_file(conn, Path::new(&path)))
}

#[tauri::command]
pub async fn search_lyrics_online(query: String) -> Result<Vec<OnlineLyricHit>, AppError> {
    let client = lrclib::client();
    lrclib::search(&client, &query).await
}

#[tauri::command]
pub async fn fetch_online_lyrics(
    id: String,
    track_name: String,
    artist_name: String,
) -> Result<Song, AppError> {
    let client = lrclib::client();
    let (title, artist, sections) = lrclib::fetch(&client, &track_name, &artist_name).await?;
    Ok(Song {
        id,
        title,
        artist,
        sections,
    })
}

#[tauri::command]
pub fn parse_lyrics(text: String) -> Vec<SongSection> {
    lyrics::parse_sections(&text)
}

#[tauri::command]
pub fn lyrics_to_text(sections: Vec<SongSection>) -> String {
    lyrics::sections_to_text(&sections)
}
