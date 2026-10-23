use tauri::{AppHandle, Emitter, State};

use crate::error::AppError;
use crate::services::database::Db;
use crate::services::{
    display_manager, holyrics_online, import, lrclib, lyrics, lyrics_search, songs, vagalume,
};
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

#[tauri::command(async)]
pub fn import_holyrics(db: State<'_, Db>, paths: Vec<String>) -> Result<ImportReport, AppError> {
    db.with_conn(|conn| import::import_holyrics_files(conn, &paths))
}

#[tauri::command]
pub async fn search_lyrics_online(
    db: State<'_, Db>,
    query: String,
    provider: Option<String>,
) -> Result<Vec<OnlineLyricHit>, AppError> {
    let defaults = db.with_conn(|conn| songs::song_defaults(conn))?;
    let client = lrclib::client();
    lyrics_search::search_all(&client, &query, provider.as_deref(), &defaults).await
}

#[tauri::command]
pub async fn fetch_online_lyrics(
    db: State<'_, Db>,
    id: String,
    track_name: String,
    artist_name: String,
    provider: Option<String>,
    provider_id: Option<String>,
) -> Result<Song, AppError> {
    let defaults = db.with_conn(|conn| songs::song_defaults(conn))?;
    let client = lrclib::client();

    match provider.as_deref() {
        Some("holyrics") => {
            let song_id = provider_id.as_deref().unwrap_or("");
            if !song_id.is_empty() {
                if let Ok((title, artist, composer, song_key, bpm, sections)) =
                    holyrics_online::fetch(&client, song_id).await
                {
                    let sections = songs::apply_layout(sections, defaults);
                    return Ok(Song {
                        id,
                        title,
                        artist,
                        album: None,
                        composer,
                        song_key,
                        bpm,
                        sections,
                    });
                }
            }
        }
        Some("vagalume") => {
            let doc_id = provider_id.as_deref().unwrap_or("");
            if !doc_id.is_empty() {
                if let Ok((title, artist, sections)) =
                    vagalume::fetch(&client, doc_id, defaults.vagalume_api_key.as_deref()).await
                {
                    let sections = songs::apply_layout(sections, defaults);
                    return Ok(Song {
                        id,
                        title,
                        artist,
                        album: None,
                        composer: None,
                        song_key: None,
                        bpm: None,
                        sections,
                    });
                }
            }
        }
        _ => {}
    }

    let (title, artist, sections) = lrclib::fetch(&client, &track_name, &artist_name).await?;
    let sections = songs::apply_layout(sections, defaults);
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
