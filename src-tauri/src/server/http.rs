use std::io::SeekFrom;
use std::net::SocketAddr;
use std::path::{Component, PathBuf};
use std::sync::Arc;

use axum::{
    body::{Body, Bytes},
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, Path, State,
    },
    http::{header, HeaderMap, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Router,
};
use futures_util::{SinkExt, StreamExt};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};

use crate::services::SharedBroadcaster;
use crate::state::types::{
    ClientKind, ConnectedClient, OutputTarget, ServerStatus, WsEnvelope, EVENT_CLIENT_HELLO, WS_PATH,
};
use crate::state::SharedRemoteState;

use super::clients::{
    connected_at_now, next_id, register, set_output, user_agent, ClientGuard, Clients,
};

#[derive(serde::Deserialize)]
struct HelloPayload {
    #[serde(default)]
    output: Option<OutputTarget>,
}

#[derive(Debug, Clone)]
pub struct ServerState {
    pub broadcaster: SharedBroadcaster,
    pub ws_tx: broadcast::Sender<String>,
    pub media_dir: PathBuf,
    pub clients: Clients,
    pub remote: SharedRemoteState,
    pub db: Option<crate::services::database::Db>,
    pub app_handle: Option<tauri::AppHandle>,
}

/// Controle de ciclo de vida do servidor local de saídas.
/// Guardado como `Mutex<ServerControl>` no estado gerenciado do Tauri.
pub struct ServerControl {
    pub port: u16,
    pub running: bool,
    pub handle: Option<tokio::task::JoinHandle<()>>,
    pub state: Option<ServerState>,
}

impl ServerControl {
    pub fn stopped(port: u16, state: ServerState) -> Self {
        Self {
            port,
            running: false,
            handle: None,
            state: Some(state),
        }
    }

    pub fn status(&self) -> ServerStatus {
        ServerStatus {
            running: self.running,
            port: self.port,
        }
    }

    pub fn stop(&mut self) {
        if let Some(handle) = self.handle.take() {
            handle.abort();
        }
        self.running = false;
    }
}

use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../dist"]
struct FrontendAssets;

pub fn router(state: ServerState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_private_network(true);

    Router::new()
        .route(WS_PATH, get(ws_handler))
        .route("/health", get(health_handler))
        .route("/ndi/frame.jpg", get(ndi_frame_handler))
        .route("/ndi/stream", get(ndi_stream_handler))
        .route("/api/live", get(live_handler))
        .route("/api/v1/info", get(crate::server::remote::info))
        .route("/api/v1/live", get(crate::server::remote::live))
        .route("/api/v1/setlist", get(crate::server::remote::setlist))
        .route(
            "/api/v1/setlist/active",
            get(crate::server::remote::get_active_event_endpoint)
                .post(crate::server::remote::set_active_event_endpoint),
        )
        .route("/api/v1/present", post(crate::server::remote::present))
        .route("/api/v1/next", post(crate::server::remote::next))
        .route("/api/v1/prev", post(crate::server::remote::prev))
        .route("/api/v1/clear", post(crate::server::remote::clear))
        .route("/api/v1/blackout", post(crate::server::remote::blackout))
        .route(
            "/api/v1/wallpaper",
            get(crate::server::remote::get_wallpaper)
                .post(crate::server::remote::toggle_wallpaper),
        )
        .route(
            "/api/v1/timer",
            get(crate::server::remote::timer_get),
        )
        .route(
            "/api/v1/timer/start",
            post(crate::server::remote::timer_start),
        )
        .route(
            "/api/v1/timer/pause",
            post(crate::server::remote::timer_pause),
        )
        .route(
            "/api/v1/timer/reset",
            post(crate::server::remote::timer_reset),
        )
        .route(
            "/api/v1/timer/countdown",
            post(crate::server::remote::timer_set_countdown),
        )
        .route(
            "/api/v1/stage-message",
            get(get_stage_message_handler)
                .post(post_stage_message_handler)
                .delete(delete_stage_message_handler),
        )
        .route("/api/v1/songs", get(crate::server::remote::list_songs))
        .route("/api/v1/songs/{id}/slides", get(crate::server::remote::song_slides))
        .route("/api/v1/lyrics/search", get(crate::server::remote::search_lyrics))
        .route("/api/v1/lyrics/save", post(crate::server::remote::save_lyrics))
        .route("/api/v1/present-song", post(crate::server::remote::present_song))
        .route("/api/v1/images", get(crate::server::remote::list_images))
        .route("/api/v1/present-image", post(crate::server::remote::present_image))
        .route(
            "/api/v1/bible/versions",
            get(crate::server::remote::list_bible_versions_endpoint),
        )
        .route(
            "/api/v1/bible/books",
            get(crate::server::remote::get_bible_books_endpoint),
        )
        .route(
            "/api/v1/bible/chapter",
            get(crate::server::remote::get_bible_chapter_endpoint),
        )
        .route(
            "/api/v1/bible/search",
            get(crate::server::remote::search_bible_endpoint),
        )
        .route(
            "/api/v1/bible/compare",
            get(crate::server::remote::compare_bible_endpoint),
        )
        .route(
            "/api/v1/present-bible",
            post(crate::server::remote::present_bible),
        )
        .route("/api/v1/openapi.json", get(crate::server::openapi::openapi_json_handler))
        .route("/api/v1/swagger", get(crate::server::openapi::swagger_ui_handler))
        .route("/swagger", get(crate::server::openapi::swagger_ui_handler))
        .route("/api/v1/ws", get(crate::server::remote::ws))
        .route("/output/{slug}", get(output_slug_handler))
        .route("/theme-media/{*path}", get(theme_media_handler))
        .fallback(static_handler)
        .with_state(Arc::new(state))
        .layer(cors)
}

async fn health_handler() -> &'static str {
    "ok"
}

async fn output_slug_handler(Path(slug): Path<String>) -> impl IntoResponse {
    let target = match slug.to_lowercase().as_str() {
        "stream" | "obs" | "transmissao" | "transmissão" | "live" => "/#/stream",
        "stage" | "retorno" | "palco" => "/#/stage",
        "public" | "projecao" | "projeção" | "telao" | "telão" => "/#/public",
        _ => "/#/stream",
    };
    (
        StatusCode::TEMPORARY_REDIRECT,
        [(header::LOCATION, target)],
    )
}

async fn live_handler(State(state): State<Arc<ServerState>>) -> impl IntoResponse {
    let slide = state.broadcaster.current_slide();
    (StatusCode::OK, axum::Json(slide))
}

fn parse_range(raw: &str, total: u64) -> Option<(u64, u64)> {
    let value = raw.strip_prefix("bytes=")?;
    let first = value.split(',').next()?.trim();
    let (start_raw, end_raw) = first.split_once('-')?;

    if start_raw.is_empty() {
        let suffix: u64 = end_raw.parse().ok()?;
        if suffix == 0 || total == 0 {
            return None;
        }
        return Some((total.saturating_sub(suffix), total - 1));
    }

    let start: u64 = start_raw.parse().ok()?;
    if start >= total {
        return None;
    }
    let end: u64 = if end_raw.is_empty() {
        total - 1
    } else {
        end_raw.parse().ok()?
    };
    if end < start {
        return None;
    }
    Some((start, end.min(total - 1)))
}

fn media_stream(
    file: tokio::fs::File,
    remaining: u64,
) -> impl futures_util::Stream<Item = Result<Bytes, std::io::Error>> {
    futures_util::stream::unfold(
        (file, remaining),
        |(mut file, remaining)| async move {
            if remaining == 0 {
                return None;
            }
            let chunk = remaining.min(64 * 1024);
            let mut buffer = vec![0u8; chunk as usize];
            match file.read(&mut buffer).await {
                Ok(0) => None,
                Ok(read) => {
                    buffer.truncate(read);
                    Some((
                        Ok(Bytes::from(buffer)),
                        (file, remaining.saturating_sub(read as u64)),
                    ))
                }
                Err(err) => Some((Err(err), (file, 0))),
            }
        },
    )
}

fn media_response(
    status: StatusCode,
    mime: mime_guess::Mime,
    content_length: u64,
    content_range: Option<String>,
    body: Body,
) -> axum::response::Response {
    let mut builder = axum::http::Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, mime.as_ref())
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, content_length.to_string())
        .header("access-control-allow-origin", "*")
        .header("access-control-allow-methods", "GET, HEAD, OPTIONS")
        .header("access-control-allow-private-network", "true")
        .header("cache-control", "public, max-age=3600");
    if let Some(range) = content_range {
        builder = builder.header(header::CONTENT_RANGE, range);
    }
    builder
        .body(body)
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

async fn theme_media_handler(
    State(state): State<Arc<ServerState>>,
    Path(path): Path<String>,
    headers: HeaderMap,
) -> axum::response::Response {
    let clean = path.trim_start_matches('/');
    let relativo = PathBuf::from(clean);
    if relativo
        .components()
        .any(|c| matches!(c, Component::ParentDir))
    {
        return StatusCode::NOT_FOUND.into_response();
    }
    let arquivo = state.media_dir.join(&relativo);
    if !arquivo.starts_with(&state.media_dir) {
        return StatusCode::NOT_FOUND.into_response();
    }

    let metadata = match tokio::fs::metadata(&arquivo).await {
        Ok(metadata) if metadata.is_file() => metadata,
        _ => return StatusCode::NOT_FOUND.into_response(),
    };
    let total = metadata.len();
    let mime = mime_guess::from_path(&arquivo).first_or_octet_stream();
    let range = headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| parse_range(value, total));

    if let Some((start, end)) = range {
        let mut file = match tokio::fs::File::open(&arquivo).await {
            Ok(file) => file,
            Err(_) => return StatusCode::NOT_FOUND.into_response(),
        };
        if file.seek(SeekFrom::Start(start)).await.is_err() {
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        let length = end - start + 1;
        return media_response(
            StatusCode::PARTIAL_CONTENT,
            mime,
            length,
            Some(format!("bytes {start}-{end}/{total}")),
            Body::from_stream(media_stream(file, length)),
        );
    }

    let file = match tokio::fs::File::open(&arquivo).await {
        Ok(file) => file,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    media_response(
        StatusCode::OK,
        mime,
        total,
        None,
        Body::from_stream(media_stream(file, total)),
    )
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    State(state): State<Arc<ServerState>>,
) -> impl IntoResponse {
    let id = next_id("ws");
    register(
        &state.clients,
        ConnectedClient {
            id: id.clone(),
            ip: addr.ip().to_string(),
            output: None,
            user_agent: user_agent(&headers),
            connected_at: connected_at_now(),
            kind: ClientKind::Output,
        },
    );
    ws.on_upgrade(move |socket| handle_socket(socket, state, id))
}

async fn get_stage_message_handler(
    State(state): State<Arc<ServerState>>,
) -> impl IntoResponse {
    axum::Json(state.broadcaster.current_stage_message())
}

async fn post_stage_message_handler(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    axum::Json(message): axum::Json<crate::state::types::CommunicationAlert>,
) -> impl IntoResponse {
    if let Err(response) = crate::server::remote::guard_headers(&state, &headers) {
        return response;
    }

    let auto_dismiss = message.auto_dismiss_seconds;
    let message_id = message.id.clone();
    let bc = state.broadcaster.clone();
    state.broadcaster.publish_stage_message(Some(message));

    if let Some(secs) = auto_dismiss {
        if secs > 0 {
            tokio::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(secs as u64)).await;
                if bc
                    .current_stage_message()
                    .map(|m| m.id == message_id)
                    .unwrap_or(false)
                {
                    bc.publish_stage_message(None);
                }
            });
        }
    }
    axum::http::StatusCode::OK.into_response()
}

async fn delete_stage_message_handler(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(response) = crate::server::remote::guard_headers(&state, &headers) {
        return response;
    }

    state.broadcaster.publish_stage_message(None);
    axum::http::StatusCode::OK.into_response()
}

async fn ndi_frame_handler(State(state): State<Arc<ServerState>>) -> Response {
    use tauri::Manager;

    let Some(app) = state.app_handle.as_ref() else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    let input = app.state::<crate::services::ndi_input::NdiInputState>();
    match input.latest() {
        Some(frame) => (
            [(header::CONTENT_TYPE, "image/jpeg")],
            Bytes::from(frame.to_vec()),
        )
            .into_response(),
        None => StatusCode::NO_CONTENT.into_response(),
    }
}

async fn ndi_stream_handler(State(state): State<Arc<ServerState>>) -> Response {
    use tauri::Manager;

    let Some(app) = state.app_handle.as_ref() else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    let input = app.state::<crate::services::ndi_input::NdiInputState>();
    let receiver = input.subscribe();

    let stream = futures_util::stream::unfold(receiver, |mut receiver| async move {
        loop {
            match receiver.recv().await {
                Ok(frame) => {
                    let mut chunk = Vec::with_capacity(frame.len() + 64);
                    chunk.extend_from_slice(
                        b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ",
                    );
                    chunk.extend_from_slice(frame.len().to_string().as_bytes());
                    chunk.extend_from_slice(b"\r\n\r\n");
                    chunk.extend_from_slice(&frame);
                    chunk.extend_from_slice(b"\r\n");
                    return Some((Ok::<Bytes, std::io::Error>(Bytes::from(chunk)), receiver));
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => return None,
            }
        }
    });

    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            "multipart/x-mixed-replace; boundary=frame",
        )
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

fn current_display_outputs(state: &ServerState) -> Vec<crate::state::types::DisplayOutput> {
    state
        .db
        .as_ref()
        .and_then(|db| {
            db.with_conn(|conn| crate::services::settings::get_setting(conn, "displays.outputs"))
                .ok()
                .flatten()
        })
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

async fn handle_socket(socket: WebSocket, state: Arc<ServerState>, client_id: String) {
    let _guard = ClientGuard::new(&state.clients, client_id.clone());
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.ws_tx.subscribe();

    let snapshot = serde_json::to_string(&serde_json::json!({
        "channel": crate::state::types::EVENT_SLIDE,
        "payload": state.broadcaster.current_slide(),
        "version": 1,
    }));
    if let Ok(text) = snapshot {
        let _ = sender.send(Message::Text(text.into())).await;
    }

    let output_plans_snapshot = serde_json::to_string(&serde_json::json!({
        "channel": crate::state::types::EVENT_OUTPUT_PLANS,
        "payload": state.broadcaster.current_output_plans(),
        "version": 1,
    }));
    if let Ok(text) = output_plans_snapshot {
        let _ = sender.send(Message::Text(text.into())).await;
    }

    let displays_snapshot = serde_json::to_string(&serde_json::json!({
        "channel": crate::state::types::EVENT_DISPLAYS,
        "payload": current_display_outputs(state.as_ref()),
        "version": 1,
    }));
    if let Ok(text) = displays_snapshot {
        let _ = sender.send(Message::Text(text.into())).await;
    }

    let timer_snapshot = serde_json::to_string(&serde_json::json!({
        "channel": crate::state::types::EVENT_TIMER,
        "payload": state.broadcaster.current_timer(),
        "version": 1,
    }));
    if let Ok(text) = timer_snapshot {
        let _ = sender.send(Message::Text(text.into())).await;
    }

    let wallpaper_snapshot = serde_json::to_string(&serde_json::json!({
        "channel": crate::state::types::EVENT_WALLPAPER,
        "payload": state.broadcaster.current_wallpaper(),
        "version": 1,
    }));
    if let Ok(text) = wallpaper_snapshot {
        let _ = sender.send(Message::Text(text.into())).await;
    }

    let message_snapshot = serde_json::to_string(&serde_json::json!({
        "channel": crate::state::types::EVENT_STAGE_MESSAGE,
        "payload": state.broadcaster.current_stage_message(),
        "version": 1,
    }));
    if let Ok(text) = message_snapshot {
        let _ = sender.send(Message::Text(text.into())).await;
    }

    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            let Ok(envelope) = serde_json::from_str::<WsEnvelope>(text.as_str()) else {
                continue;
            };
            if envelope.channel != EVENT_CLIENT_HELLO {
                continue;
            }
            let Ok(hello) = serde_json::from_value::<HelloPayload>(envelope.payload) else {
                continue;
            };
            set_output(&state.clients, &client_id, hello.output);
        }
    }
    send_task.abort();
}

async fn static_handler(uri: axum::http::Uri) -> impl IntoResponse {
    let raw_path = uri.path().trim_start_matches('/');
    let candidates: Vec<&str> = if raw_path.is_empty() {
        vec!["index.html"]
    } else {
        vec![raw_path, "index.html"]
    };

    for candidate in candidates {
        if let Some(file) = FrontendAssets::get(candidate) {
            let mime = mime_guess::from_path(candidate).first_or_octet_stream();
            let response = axum::http::Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime.as_ref())
                .body(axum::body::Body::from(file.data.to_vec()));
            match response {
                Ok(response) => return response.into_response(),
                Err(_) => break,
            }
        }
        if candidate != "index.html" {
            continue;
        }
    }

    Html("<h1>Open Presenter</h1><p>Frontend ainda não compilado (dist/ ausente).</p>")
        .into_response()
}

pub async fn bind(port: u16) -> Result<tokio::net::TcpListener, String> {
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|err| format!("porta {port} indisponível ({err})"))
}

pub fn spawn_with_listener(
    state: ServerState,
    listener: tokio::net::TcpListener,
) -> tokio::task::JoinHandle<()> {
    let app = router(state).into_make_service_with_connect_info::<SocketAddr>();
    tokio::spawn(async move {
        if let Err(err) = axum::serve(listener, app).await {
            tracing::error!(error = %err, "servidor de saídas encerrou com erro");
        }
    })
}

#[cfg(test)]
mod tests {
    use super::parse_range;

    #[test]
    fn parse_range_aceita_intervalos_e_sufixos() {
        assert_eq!(parse_range("bytes=0-99", 1000), Some((0, 99)));
        assert_eq!(parse_range("bytes=100-", 1000), Some((100, 999)));
        assert_eq!(parse_range("bytes=-100", 1000), Some((900, 999)));
        assert_eq!(parse_range("bytes=0-5000", 1000), Some((0, 999)));
        assert_eq!(parse_range("bytes=100-50", 1000), None);
        assert_eq!(parse_range("bytes=1000-", 1000), None);
        assert_eq!(parse_range("bytes=-0", 1000), None);
        assert_eq!(parse_range("invalid", 1000), None);
    }
}
