use serde::Deserialize;

use crate::error::AppError;
use crate::services::lyrics;
use crate::state::{OnlineLyricHit, SongSection};

const BASE_URL: &str = "https://api.vagalume.com.br";
const DEFAULT_API_KEY: &str = "34db1ee757d414ed544882cb36bdfd6f";

#[derive(Deserialize)]
struct ExcerptResponse {
    response: Option<ExcerptDocs>,
}

#[derive(Deserialize)]
struct ExcerptDocs {
    docs: Option<Vec<DocItem>>,
}

#[derive(Deserialize)]
struct DocItem {
    id: String,
    title: String,
    band: Option<String>,
}

#[derive(Deserialize)]
struct MusResponse {
    art: Option<ArtInfo>,
    mus: Option<Vec<MusItem>>,
}

#[derive(Deserialize)]
struct ArtInfo {
    name: Option<String>,
}

#[derive(Deserialize)]
struct MusItem {
    name: Option<String>,
    text: Option<String>,
}

pub async fn search(
    client: &reqwest::Client,
    query: &str,
) -> Result<Vec<OnlineLyricHit>, AppError> {
    let clean = query.trim();
    if clean.is_empty() {
        return Ok(Vec::new());
    }

    let url = format!("{}/search.excerpt", BASE_URL);
    let resp = match client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
        .query(&[("q", clean), ("limit", "15")])
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return Ok(Vec::new()),
    };

    if !resp.status().is_success() {
        return Ok(Vec::new());
    }

    let data: ExcerptResponse = match resp.json().await {
        Ok(d) => d,
        Err(_) => return Ok(Vec::new()),
    };

    let docs = data.response.and_then(|r| r.docs).unwrap_or_default();
    let hits = docs
        .into_iter()
        .map(|doc| OnlineLyricHit {
            track_name: doc.title,
            artist_name: doc.band.unwrap_or_default(),
            album_name: None,
            provider: Some("vagalume".into()),
            provider_id: Some(doc.id),
        })
        .collect();

    Ok(hits)
}

pub async fn fetch(
    client: &reqwest::Client,
    id: &str,
    custom_api_key: Option<&str>,
) -> Result<(String, String, Vec<SongSection>), AppError> {
    let key = custom_api_key
        .filter(|k| !k.trim().is_empty())
        .unwrap_or(DEFAULT_API_KEY);

    let url = format!("{}/search.php", BASE_URL);
    let resp = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
        .query(&[("musid", id), ("apikey", key)])
        .send()
        .await
        .map_err(|e| AppError::Storage(format!("falha ao obter letra do Vagalume: {}", e)))?;

    if !resp.status().is_success() {
        return Err(AppError::Storage("letra não encontrada no Vagalume".into()));
    }

    let data: MusResponse = resp.json().await.map_err(|e| {
        AppError::Storage(format!("resposta inválida do Vagalume: {}", e))
    })?;

    let artist = data.art.and_then(|a| a.name).unwrap_or_default();
    let mus = data.mus.and_then(|m| m.into_iter().next()).ok_or_else(|| {
        AppError::Storage("letra não encontrada no Vagalume".into())
    })?;

    let title = mus.name.unwrap_or_default();
    let text = mus.text.unwrap_or_default();
    let sections = lyrics::parse_sections(&text);

    Ok((title, artist, sections))
}
