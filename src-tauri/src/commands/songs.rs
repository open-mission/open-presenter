use std::path::Path;

use tauri::{AppHandle, Emitter, State};

use crate::error::AppError;
use crate::services::database::Db;
use crate::services::{display_manager, import, lrclib, lyrics, songs};
use crate::state::{ImportReport, OnlineLyricHit, Song, SongDefaults, SongSection, SongSummary};

#[tauri::command]
pub fn list_songs(db: State<'_, Db>, query: Option<String>) -> Result<Vec<SongSummary>, AppError> {
    db.with_conn(|conn| songs::list(conn, query.as_deref()))
}

#[tauri::command]
pub fn get_song(db: State<'_, Db>, id: String) -> Result<Option<Song>, AppError> {
    db.with_conn(|conn| songs::get(conn, &id))
}

#[tauri::command]
pub fn save_song(app: AppHandle, db: State<'_, Db>, song: Song) -> Result<(), AppError> {
    db.with_conn(|conn| songs::save(conn, &song))?;
    let _ = app.emit("songs://changed", ());
    Ok(())
}

#[tauri::command]
pub fn delete_song(app: AppHandle, db: State<'_, Db>, id: String) -> Result<(), AppError> {
    db.with_conn(|conn| songs::delete(conn, &id))?;
    let _ = app.emit("songs://changed", ());
    Ok(())
}

#[tauri::command]
pub async fn open_song_editor(app: AppHandle, song_id: Option<String>) -> Result<(), AppError> {
    display_manager::open_song_editor_window(&app, song_id)
}

#[tauri::command]
pub async fn close_song_editor(app: AppHandle) -> Result<(), AppError> {
    display_manager::close_song_editor_window(&app)
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
        album: None,
        composer: None,
        song_key: None,
        bpm: None,
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

#[tauri::command]
pub fn get_song_defaults(db: State<'_, Db>) -> Result<SongDefaults, AppError> {
    db.with_conn(songs::song_defaults)
}

#[tauri::command]
pub fn set_song_defaults(
    db: State<'_, Db>,
    defaults: SongDefaults,
) -> Result<SongDefaults, AppError> {
    db.with_conn(|conn| {
        songs::save_song_defaults(conn, defaults)?;
        songs::song_defaults(conn)
    })
}
