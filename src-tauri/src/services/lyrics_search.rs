use rusqlite::Connection;

use crate::error::AppError;
use crate::services::{holyrics_online, lrclib, songs, vagalume};
use crate::state::{OnlineLyricHit, Song, SongDefaults};

pub async fn search_all(
    client: &reqwest::Client,
    query: &str,
    provider_filter: Option<&str>,
    defaults: &SongDefaults,
) -> Result<Vec<OnlineLyricHit>, AppError> {
    let clean = query.trim();
    if clean.is_empty() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();

    match provider_filter {
        Some("vagalume") => {
            if defaults.vagalume_enabled {
                if let Ok(hits) = vagalume::search(client, clean).await {
                    results.extend(hits);
                }
            }
        }
        Some("holyrics") => {
            if defaults.holyrics_enabled {
                if let Ok(hits) = holyrics_online::search(client, clean).await {
                    results.extend(hits);
                }
            }
        }
        Some("lrclib") => {
            if defaults.lrclib_enabled {
                if let Ok(hits) = lrclib::search(client, clean).await {
                    for mut hit in hits {
                        hit.provider = Some("lrclib".into());
                        results.push(hit);
                    }
                }
            }
        }
        _ => {
            // Ordem de busca multi-provedor:
            // 1. Holyrics (melhor acervo para músicas cristãs e hinos)
            if defaults.holyrics_enabled {
                if let Ok(hits) = holyrics_online::search(client, clean).await {
                    results.extend(hits);
                }
            }
            // 2. Vagalume
            if defaults.vagalume_enabled {
                if let Ok(hits) = vagalume::search(client, clean).await {
                    results.extend(hits);
                }
            }
            // 3. LRCLIB (músicas internacionais)
            if defaults.lrclib_enabled {
                if let Ok(hits) = lrclib::search(client, clean).await {
                    for mut hit in hits {
                        hit.provider = Some("lrclib".into());
                        results.push(hit);
                    }
                }
            }
        }
    }

    Ok(results)
}

pub async fn fetch_song(
    conn: &Connection,
    client: &reqwest::Client,
    id: String,
    track_name: String,
    artist_name: String,
    provider: Option<String>,
    provider_id: Option<String>,
) -> Result<Song, AppError> {
    let defaults = songs::song_defaults(conn)?;

    match provider.as_deref() {
        Some("holyrics") => {
            let song_id = provider_id.unwrap_or_default();
            if !song_id.is_empty() {
                if let Ok((title, artist, composer, song_key, bpm, sections)) =
                    holyrics_online::fetch(client, &song_id).await
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
            let doc_id = provider_id.unwrap_or_default();
            if !doc_id.is_empty() {
                if let Ok((title, artist, sections)) =
                    vagalume::fetch(client, &doc_id, defaults.vagalume_api_key.as_deref()).await
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

    let (title, artist, sections) = lrclib::fetch(client, &track_name, &artist_name).await?;
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
