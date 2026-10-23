use std::io::Read;

use flate2::read::GzDecoder;
use serde::Deserialize;

use crate::error::AppError;
use crate::services::{crypto_utils, lyrics};
use crate::state::{OnlineLyricHit, SongSection};

const SEARCH_URL: &str = "https://lyrics.holyrics.com.br/search.php";
const CDN_BASE_URL: &str = "https://lyrics-cache.holyricscdn.com";
const HMAC_KEY: &[u8] = b"zjz8FXCFa8gE4jXebl7ETqd6IOrRoQZr";
const USER_AGENT: &str = "Holyrics Desktop v2.30.0";

#[derive(Deserialize)]
struct SearchResponse {
    items: Option<Vec<SearchItem>>,
}

#[derive(Deserialize)]
struct SearchItem {
    id: String,
    title: String,
    artist: String,
}

#[derive(Deserialize)]
pub struct SongPayload {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub author: Option<String>,
    pub lyrics: Option<String>,
    pub key: Option<String>,
    pub bpm: Option<String>,
}

pub async fn search(
    client: &reqwest::Client,
    query: &str,
) -> Result<Vec<OnlineLyricHit>, AppError> {
    let clean_query = query.trim();
    if clean_query.is_empty() {
        return Ok(Vec::new());
    }

    let resp = match client
        .get(SEARCH_URL)
        .header("User-Agent", USER_AGENT)
        .header("lang", "pt")
        .header("device_type", "pc")
        .query(&[
            ("q", clean_query),
            ("t", "1"),
            ("a", "1"),
            ("l", "1"),
            ("uid", "987654321"),
            ("sl", "1"),
        ])
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return Ok(Vec::new()),
    };

    if !resp.status().is_success() {
        return Ok(Vec::new());
    }

    let data: SearchResponse = match resp.json().await {
        Ok(d) => d,
        Err(_) => return Ok(Vec::new()),
    };

    let items = data.items.unwrap_or_default();
    let hits = items
        .into_iter()
        .map(|item| OnlineLyricHit {
            track_name: item.title,
            artist_name: item.artist,
            album_name: None,
            provider: Some("holyrics".into()),
            provider_id: Some(item.id),
        })
        .collect();

    Ok(hits)
}

pub async fn fetch(
    client: &reqwest::Client,
    song_id: &str,
) -> Result<(String, String, Option<String>, Option<String>, Option<i32>, Vec<SongSection>), AppError> {
    let key = format!("{};S4", song_id.trim().to_lowercase());
    let step1 = crypto_utils::md5_hex(key.as_bytes());
    let step2 = crypto_utils::hmac_sha512_hex(HMAC_KEY, step1.as_bytes());
    let final_hash = crypto_utils::md5_hex(step2.as_bytes());
    let prefix = &final_hash[..3];

    let url = format!("{}/{}/{}.txt.gz", CDN_BASE_URL, prefix, final_hash);
    let resp = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| AppError::Storage(format!("falha ao baixar letra do Holyrics: {}", e)))?;

    if !resp.status().is_success() {
        return Err(AppError::Storage("letra não encontrada no Holyrics".into()));
    }

    let gz_bytes = resp.bytes().await.map_err(|e| {
        AppError::Storage(format!("falha ao ler dados comprimidos do Holyrics: {}", e))
    })?;

    let mut decoder = GzDecoder::new(&gz_bytes[..]);
    let mut decompressed = String::new();
    decoder.read_to_string(&mut decompressed).map_err(|e| {
        AppError::Storage(format!("falha ao descompactar dados do Holyrics: {}", e))
    })?;

    let payload: SongPayload = serde_json::from_str(&decompressed).map_err(|e| {
        AppError::Storage(format!("resposta JSON inválida do Holyrics: {}", e))
    })?;

    let title = payload.title.unwrap_or_default();
    let artist = payload.artist.unwrap_or_default();
    let composer = payload.author.filter(|s| !s.trim().is_empty());
    let song_key = payload.key.filter(|s| !s.trim().is_empty());
    let bpm = payload.bpm.and_then(|s| s.parse::<i32>().ok());

    let raw_lyrics = payload.lyrics.unwrap_or_default();
    let normalized_lyrics = raw_lyrics.replace("\n.\n", "\n\n");
    let sections = lyrics::parse_sections(&normalized_lyrics);

    Ok((title, artist, composer, song_key, bpm, sections))
}
