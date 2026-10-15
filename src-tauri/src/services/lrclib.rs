use serde::Deserialize;

use crate::error::AppError;
use crate::state::{OnlineLyricHit, SongSection};

const BASE_URL: &str = "https://lrclib.net/api";
const USER_AGENT: &str = "Open Presenter/0.1.0";
const MENSAGEM_REDE: &str = "falha ao consultar o LRCLIB — verifique a conexão";
const MENSAGEM_RESPOSTA: &str = "resposta inválida do LRCLIB";
const MENSAGEM_NAO_ENCONTRADA: &str = "letra não encontrada no LRCLIB";

#[derive(Deserialize)]
struct SearchItem {
    #[serde(rename = "trackName")]
    track_name: Option<String>,
    #[serde(rename = "artistName")]
    artist_name: Option<String>,
    #[serde(rename = "albumName")]
    album_name: Option<String>,
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
}

#[derive(Deserialize)]
struct GetPayload {
    #[serde(rename = "trackName")]
    track_name: String,
    #[serde(rename = "artistName")]
    artist_name: Option<String>,
    #[serde(rename = "plainLyrics")]
    plain_lyrics: String,
}

pub fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .expect("falha ao inicializar o cliente HTTP")
}

pub fn parse_search_payload(body: &str) -> Result<Vec<OnlineLyricHit>, AppError> {
    let items: Vec<SearchItem> = serde_json::from_str(body).map_err(|_| erro_resposta())?;
    Ok(items
        .into_iter()
        .filter(|item| item.plain_lyrics.is_some())
        .filter_map(|item| {
            Some(OnlineLyricHit {
                track_name: item.track_name?,
                artist_name: item.artist_name.unwrap_or_default(),
                album_name: item.album_name,
            })
        })
        .collect())
}

pub fn split_plain_lyrics(plain: &str) -> Vec<Vec<String>> {
    plain
        .split("\n\n")
        .map(|paragraph| {
            paragraph
                .split('\n')
                .map(str::trim_end)
                .filter(|line| !line.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|lines| !lines.is_empty())
        .collect()
}

pub fn parse_get_payload(body: &str) -> Result<(String, String, Vec<SongSection>), AppError> {
    let payload: GetPayload = serde_json::from_str(body).map_err(|_| erro_resposta())?;
    let sections = split_plain_lyrics(&payload.plain_lyrics)
        .into_iter()
        .map(|lines| SongSection {
            section_type: None,
            lines,
        })
        .collect();
    Ok((
        payload.track_name,
        payload.artist_name.unwrap_or_default(),
        sections,
    ))
}

pub async fn search(
    client: &reqwest::Client,
    query: &str,
) -> Result<Vec<OnlineLyricHit>, AppError> {
    let response = get(client, "/search", &[("q", query)]).await?;
    let body = sucesso(response)?.text().await.map_err(|_| erro_rede())?;
    parse_search_payload(&body)
}

pub async fn fetch(
    client: &reqwest::Client,
    track: &str,
    artist: &str,
) -> Result<(String, String, Vec<SongSection>), AppError> {
    let response = get(
        client,
        "/get",
        &[("track_name", track), ("artist_name", artist)],
    )
    .await?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(AppError::NotFound(MENSAGEM_NAO_ENCONTRADA.into()));
    }
    let body = sucesso(response)?.text().await.map_err(|_| erro_rede())?;
    parse_get_payload(&body)
}

async fn get(
    client: &reqwest::Client,
    path: &str,
    query: &[(&str, &str)],
) -> Result<reqwest::Response, AppError> {
    client
        .get(format!("{BASE_URL}{path}"))
        .query(query)
        .send()
        .await
        .map_err(|_| erro_rede())
}

fn sucesso(response: reqwest::Response) -> Result<reqwest::Response, AppError> {
    if response.status().is_success() {
        Ok(response)
    } else {
        Err(erro_rede())
    }
}

fn erro_rede() -> AppError {
    AppError::Network(MENSAGEM_REDE.into())
}

fn erro_resposta() -> AppError {
    AppError::Network(MENSAGEM_RESPOSTA.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn busca_filtra_resultados_sem_letra_plana() {
        let body = r#"[{"trackName":"A","artistName":"X","albumName":"Al","plainLyrics":"um\n\ndois"},
                   {"trackName":"B","artistName":"Y","albumName":null,"plainLyrics":null},
                   {"trackName":"C","artistName":"Z","albumName":"Al2","plainLyrics":"tres"}]"#;
        let hits = parse_search_payload(body).unwrap();
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].track_name, "A");
        assert_eq!(hits[1].album_name, Some("Al2".into()));
    }

    #[test]
    fn split_plain_lyrics_aguenta_linhas_em_branco_variadas() {
        let sections = split_plain_lyrics("um\n\ndois\n\n\n\ntres  \nquatro\n");
        assert_eq!(
            sections,
            vec![
                vec!["um".to_string()],
                vec!["dois".to_string()],
                vec!["tres".to_string(), "quatro".to_string()]
            ]
        );
    }

    #[test]
    fn parse_get_payload_monta_secoes_sem_rotulo() {
        let body = r#"{"trackName":"T","artistName":"A","plainLyrics":"um\n\ndois"}"#;
        let (title, artist, sections) = parse_get_payload(body).unwrap();
        assert_eq!(title, "T");
        assert_eq!(artist, "A");
        assert_eq!(sections.len(), 2);
        assert_eq!(sections[0].section_type, None);
        assert!(parse_get_payload(r#"{"trackName":"T"}"#).is_err());
    }
}
