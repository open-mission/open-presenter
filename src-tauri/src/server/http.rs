use std::path::{Component, PathBuf};
use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::{header, StatusCode},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};

use crate::services::SharedBroadcaster;
use crate::state::types::{ServerStatus, WS_PATH};

#[derive(Debug, Clone)]
pub struct ServerState {
    pub broadcaster: SharedBroadcaster,
    pub ws_tx: broadcast::Sender<String>,
    pub media_dir: PathBuf,
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
        .allow_headers(Any);

    Router::new()
        .route(WS_PATH, get(ws_handler))
        .route("/health", get(health_handler))
        .route("/api/live", get(live_handler))
        .route("/theme-media/{*path}", get(theme_media_handler))
        .fallback(static_handler)
        .with_state(Arc::new(state))
        .layer(cors)
}

async fn health_handler() -> &'static str {
    "ok"
}

async fn live_handler(State(state): State<Arc<ServerState>>) -> impl IntoResponse {
    let slide = state.broadcaster.current_slide();
    (StatusCode::OK, axum::Json(slide))
}

async fn theme_media_handler(
    State(state): State<Arc<ServerState>>,
    Path(path): Path<String>,
) -> impl IntoResponse {
    let relativo = PathBuf::from(&path);
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
    match tokio::fs::read(&arquivo).await {
        Ok(bytes) => {
            let mime = mime_guess::from_path(&arquivo).first_or_octet_stream();
            match axum::http::Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime.as_ref())
                .body(axum::body::Body::from(bytes))
            {
                Ok(response) => response.into_response(),
                Err(_) => StatusCode::NOT_FOUND.into_response(),
            }
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<ServerState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<ServerState>) {
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

    let themes_snapshot = serde_json::to_string(&serde_json::json!({
        "channel": crate::state::types::EVENT_THEMES,
        "payload": state.broadcaster.current_themes(),
        "version": 1,
    }));
    if let Ok(text) = themes_snapshot {
        let _ = sender.send(Message::Text(text.into())).await;
    }

    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    while receiver.next().await.is_some() {}
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
    let app = router(state);
    tokio::spawn(async move {
        if let Err(err) = axum::serve(listener, app).await {
            tracing::error!(error = %err, "servidor de saídas encerrou com erro");
        }
    })
}
