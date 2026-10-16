use serde::Deserialize;

use crate::error::AppError;
use crate::services::lyrics;
use crate::state::{OnlineLyricHit, SongSection};

const BASE_URL: &str = "https://lrclib.net/api";
const USER_AGENT: &str = "Open Presenter/0.1.0";
const MENSAGEM_REDE: &str = "falha ao consultar o LRCLIB — verifique a conexão";
const MENSAGEM_RESPOSTA: &str = "resposta inválida do LRCLIB";
const MENSAGEM_NAO_ENCONTRADA: &str = "letra não encontrada no LRCLIB";
const MENSAGEM_LIMITE: &str =
    "o LRCLIB limitou as consultas — aguarde alguns segundos e tente de novo";
const MENSAGEM_INDISPONIVEL: &str =
    "o LRCLIB está indisponível no momento — tente de novo em instantes";
const RETRY_MAX_SEGUNDOS: u64 = 3;
const RETRY_PADRAO_SEGUNDOS: u64 = 1;
const RETRY_ESPERAS_SEGUNDOS: [u64; 2] = [1, 2];

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
        .timeout(std::time::Duration::from_secs(15))
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

pub fn parse_get_payload(body: &str) -> Result<(String, String, Vec<SongSection>), AppError> {
    let payload: GetPayload = serde_json::from_str(body).map_err(|_| erro_resposta())?;
    let sections = lyrics::parse_sections(&payload.plain_lyrics);
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
    let mut response = enviar(client, path, query).await?;
    let mut tentativa = 0;
    while response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        let header = response
            .headers()
            .get(reqwest::header::RETRY_AFTER)
            .and_then(|value| value.to_str().ok());
        let Some(espera) = espera_tentativa(tentativa, header) else {
            break;
        };
        tracing::warn!(?espera, tentativa, "LRCLIB limitou as consultas; tentando de novo");
        tokio::time::sleep(espera).await;
        response = enviar(client, path, query).await?;
        tentativa += 1;
    }
    Ok(response)
}

async fn enviar(
    client: &reqwest::Client,
    path: &str,
    query: &[(&str, &str)],
) -> Result<reqwest::Response, AppError> {
    client
        .get(format!("{BASE_URL}{path}"))
        .query(query)
        .send()
        .await
        .map_err(|err| {
            tracing::warn!(error = %err, "falha de rede ao consultar o LRCLIB");
            erro_rede()
        })
}

fn espera_tentativa(tentativa: usize, header: Option<&str>) -> Option<std::time::Duration> {
    let base = *RETRY_ESPERAS_SEGUNDOS.get(tentativa)?;
    let segundos_header = match header.map(str::trim).and_then(|valor| valor.parse::<u64>().ok()) {
        Some(segundos) if segundos > RETRY_MAX_SEGUNDOS => return None,
        Some(segundos) => segundos,
        None => RETRY_PADRAO_SEGUNDOS,
    };
    Some(std::time::Duration::from_secs(base.max(segundos_header)))
}

fn sucesso(response: reqwest::Response) -> Result<reqwest::Response, AppError> {
    let status = response.status();
    if status.is_success() {
        Ok(response)
    } else {
        Err(erro_status(status))
    }
}

fn erro_status(status: reqwest::StatusCode) -> AppError {
    tracing::warn!(%status, "LRCLIB respondeu com erro");
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        AppError::Network(MENSAGEM_LIMITE.into())
    } else if status.is_server_error() {
        AppError::Network(MENSAGEM_INDISPONIVEL.into())
    } else {
        erro_rede()
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
    fn parse_get_payload_aguenta_linhas_em_branco_variadas() {
        let body = r#"{"trackName":"T","plainLyrics":"um\n\ndois\n\n\n\ntres  \nquatro\n"}"#;
        let (_, _, sections) = parse_get_payload(body).unwrap();
        assert_eq!(
            sections,
            vec![
                SongSection {
                    section_type: None,
                    lines: vec!["um".to_string()]
                },
                SongSection {
                    section_type: None,
                    lines: vec!["dois".to_string()]
                },
                SongSection {
                    section_type: None,
                    lines: vec!["tres".to_string(), "quatro".to_string()]
                }
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

    #[test]
    fn erro_status_mapeia_limite_indisponivel_e_rede() {
        let limite = erro_status(reqwest::StatusCode::TOO_MANY_REQUESTS).to_string();
        assert!(limite.contains("limitou as consultas"), "mensagem: {limite}");
        let indisponivel = erro_status(reqwest::StatusCode::SERVICE_UNAVAILABLE).to_string();
        assert!(
            indisponivel.contains("indisponível"),
            "mensagem: {indisponivel}"
        );
        let rede = erro_status(reqwest::StatusCode::FORBIDDEN).to_string();
        assert!(rede.contains(MENSAGEM_REDE), "mensagem: {rede}");
    }

    #[test]
    fn espera_tentativa_escala_com_a_tentativa_e_respeita_header() {
        let espera = std::time::Duration::from_secs;
        assert_eq!(espera_tentativa(0, None), Some(espera(1)));
        assert_eq!(espera_tentativa(0, Some("2")), Some(espera(2)));
        assert_eq!(espera_tentativa(0, Some(" 3 ")), Some(espera(3)));
        assert_eq!(espera_tentativa(0, Some("abc")), Some(espera(1)));
        assert_eq!(espera_tentativa(0, Some("60")), None);
    }

    #[test]
    fn espera_tentativa_mantem_piso_da_escada_e_encerra_no_fim() {
        let espera = std::time::Duration::from_secs;
        assert_eq!(espera_tentativa(1, None), Some(espera(2)));
        assert_eq!(espera_tentativa(1, Some("1")), Some(espera(2)));
        assert_eq!(espera_tentativa(1, Some("3")), Some(espera(3)));
        assert_eq!(espera_tentativa(2, None), None);
    }
}
