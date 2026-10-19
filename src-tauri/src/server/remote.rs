use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, Path, Query, State,
    },
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;

use crate::server::clients::{
    connected_at_now, next_id, register, user_agent, ClientGuard,
};
use crate::server::ServerState;
use crate::services::{lrclib, media_library, slide_builder, songs};
use crate::state::types::{
    now_millis, ClientKind, ConnectedClient, MediaItem, MediaKind, SlideContent, SlideKind,
    EVENT_REMOTE_SETLIST, EVENT_SLIDE, EVENT_WALLPAPER,
};
use crate::state::{LiveSlide, RemoteItem, RemoteSetlist};

#[derive(Debug, Deserialize)]
pub struct RemoteWsQuery {
    token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchSongsQuery {
    pub q: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchLyricsQuery {
    pub q: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLyricsRequest {
    pub track_name: String,
    pub artist_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresentSongRequest {
    pub song_id: String,
    #[serde(default)]
    pub index: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresentImageRequest {
    pub path: String,
    #[serde(default)]
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PresentRequest {
    #[serde(rename = "itemId")]
    item_id: String,
    index: usize,
}

#[derive(Debug, Deserialize)]
pub struct BlackoutRequest {
    blackout: bool,
}

fn unauthorized(message: &str) -> Response {
    (StatusCode::UNAUTHORIZED, message.to_string()).into_response()
}

fn forbidden(message: &str) -> Response {
    (StatusCode::FORBIDDEN, message.to_string()).into_response()
}

fn internal(message: &str) -> Response {
    (StatusCode::INTERNAL_SERVER_ERROR, message.to_string()).into_response()
}

pub fn guard_headers_remote(remote: &crate::state::SharedRemoteState, headers: &HeaderMap) -> Result<(), Response> {
    let remote = remote
        .lock()
        .map_err(|_| internal("estado remoto indisponível"))?;

    if !remote.enabled {
        return Err(forbidden("controle remoto desativado"));
    }
    if remote.token.is_empty() {
        return Err(unauthorized("token remoto não configurado"));
    }

    let provided = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));

    if provided != Some(remote.token.as_str()) {
        return Err(unauthorized("token remoto inválido"));
    }
    Ok(())
}

fn guard_headers(state: &ServerState, headers: &HeaderMap) -> Result<(), Response> {
    guard_headers_remote(&state.remote, headers)
}

pub fn guard_token_remote(remote: &crate::state::SharedRemoteState, token: Option<&str>) -> Result<(), Response> {
    let remote = remote
        .lock()
        .map_err(|_| internal("estado remoto indisponível"))?;

    if !remote.enabled {
        return Err(forbidden("controle remoto desativado"));
    }
    if remote.token.is_empty() {
        return Err(unauthorized("token remoto não configurado"));
    }
    if token != Some(remote.token.as_str()) {
        return Err(unauthorized("token remoto inválido"));
    }
    Ok(())
}

fn guard_token(state: &ServerState, token: Option<&str>) -> Result<(), Response> {
    guard_token_remote(&state.remote, token)
}

pub async fn info(State(state): State<Arc<ServerState>>, headers: HeaderMap) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    Json(serde_json::json!({
        "app": "Open Presenter",
        "version": env!("CARGO_PKG_VERSION"),
        "ok": true,
    }))
    .into_response()
}

pub async fn live(State(state): State<Arc<ServerState>>, headers: HeaderMap) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    Json(state.broadcaster.current_slide()).into_response()
}

pub async fn setlist(State(state): State<Arc<ServerState>>, headers: HeaderMap) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let snapshot = state
        .remote
        .lock()
        .ok()
        .and_then(|remote| remote.setlist.clone());
    Json(snapshot).into_response()
}

fn find_item<'a>(setlist: &'a RemoteSetlist, item_id: &str) -> Option<&'a RemoteItem> {
    setlist
        .parts
        .iter()
        .flat_map(|part| part.items.iter())
        .find(|item| item.id == item_id)
}

fn prev_content(
    _setlist: &RemoteSetlist,
    item: &RemoteItem,
    index: usize,
) -> Option<SlideContent> {
    if index > 0 {
        item.slides
            .iter()
            .find(|slide| slide.index == index - 1)
            .map(|s| s.content.clone())
    } else {
        None
    }
}

fn next_content(
    setlist: &RemoteSetlist,
    item: &RemoteItem,
    index: usize,
) -> Option<SlideContent> {
    if let Some(next) = item.slides.iter().find(|slide| slide.index == index + 1) {
        return Some(next.content.clone());
    }
    let next_item_id = item.next_item_id.as_deref()?;
    let next_item = find_item(setlist, next_item_id)?;
    next_item.slides.first().map(|slide| slide.content.clone())
}

pub async fn present(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Json(request): Json<PresentRequest>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }

    let snapshot = match state.remote.lock() {
        Ok(remote) => remote.setlist.clone(),
        Err(_) => return internal("estado remoto indisponível"),
    };
    let Some(setlist) = snapshot else {
        return (StatusCode::NOT_FOUND, "nenhuma programação ativa").into_response();
    };
    let Some(item) = find_item(&setlist, &request.item_id) else {
        return (StatusCode::NOT_FOUND, "item não encontrado").into_response();
    };
    let Some(slide) = item
        .slides
        .iter()
        .find(|slide| slide.index == request.index)
    else {
        return (StatusCode::NOT_FOUND, "slide não encontrado").into_response();
    };

    let prev_up = prev_content(&setlist, item, request.index);
    let next_up = next_content(&setlist, item, request.index);
    let current = state.broadcaster.current_slide();
    let live = LiveSlide {
        content: slide.content.clone(),
        background: current.background,
        blackout: false,
        cleared: false,
        updated_at: now_millis().to_string(),
        next_up,
        prev_up,
    };
    state.broadcaster.publish_slide(&live);
    Json(live).into_response()
}

pub async fn clear(State(state): State<Arc<ServerState>>, headers: HeaderMap) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let current = state.broadcaster.current_slide();
    let live = LiveSlide {
        cleared: true,
        blackout: false,
        next_up: None,
        prev_up: None,
        updated_at: now_millis().to_string(),
        ..current
    };
    state.broadcaster.publish_slide(&live);
    Json(live).into_response()
}

pub async fn blackout(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Json(request): Json<BlackoutRequest>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let current = state.broadcaster.current_slide();
    let live = LiveSlide {
        blackout: request.blackout,
        updated_at: now_millis().to_string(),
        ..current
    };
    state.broadcaster.publish_slide(&live);
    Json(live).into_response()
}

pub async fn get_wallpaper(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    Json(serde_json::json!({
        "wallpaper": state.broadcaster.current_wallpaper(),
    }))
    .into_response()
}

pub async fn toggle_wallpaper(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let current = state.broadcaster.current_slide();
    let next_cleared = !current.cleared;
    let live = LiveSlide {
        cleared: next_cleared,
        blackout: false,
        updated_at: now_millis().to_string(),
        ..current
    };
    state.broadcaster.publish_slide(&live);
    Json(live).into_response()
}

pub async fn list_songs(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Query(query): Query<SearchSongsQuery>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let Some(db) = &state.db else {
        return internal("banco de dados indisponível");
    };
    let songs = match db.with_conn(|conn| songs::list(conn, query.q.as_deref())) {
        Ok(s) => s,
        Err(err) => return internal(&err.to_string()),
    };
    Json(songs).into_response()
}

pub async fn song_slides(
    State(state): State<Arc<ServerState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let Some(db) = &state.db else {
        return internal("banco de dados indisponível");
    };
    let song = match db.with_conn(|conn| songs::get(conn, &id)) {
        Ok(Some(s)) => s,
        Ok(None) => return (StatusCode::NOT_FOUND, "música não encontrada").into_response(),
        Err(err) => return internal(&err.to_string()),
    };
    let slides = slide_builder::build_song_slides(&song);
    Json(slides).into_response()
}

pub async fn search_lyrics(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Query(query): Query<SearchLyricsQuery>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let client = lrclib::client();
    match lrclib::search(&client, &query.q).await {
        Ok(results) => Json(results).into_response(),
        Err(err) => (StatusCode::BAD_GATEWAY, err.to_string()).into_response(),
    }
}

pub async fn save_lyrics(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Json(request): Json<SaveLyricsRequest>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let Some(db) = &state.db else {
        return internal("banco de dados indisponível");
    };
    let client = lrclib::client();
    let (title, artist, sections) =
        match lrclib::fetch(&client, &request.track_name, &request.artist_name).await {
            Ok(data) => data,
            Err(err) => return (StatusCode::BAD_GATEWAY, err.to_string()).into_response(),
        };

    let song_result = db.with_conn(|conn| {
        let defaults = songs::song_defaults(conn)?;
        let sections = songs::apply_layout(sections, defaults);
        songs::insert_new(conn, &title, &artist, &sections)
    });

    match song_result {
        Ok(saved) => {
            if let Some(app) = &state.app_handle {
                use tauri::Emitter;
                let _ = app.emit("songs://changed", ());
            }
            Json(saved).into_response()
        }
        Err(err) => internal(&err.to_string()),
    }
}

pub async fn present_song(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Json(request): Json<PresentSongRequest>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let Some(db) = &state.db else {
        return internal("banco de dados indisponível");
    };
    let song = match db.with_conn(|conn| songs::get(conn, &request.song_id)) {
        Ok(Some(s)) => s,
        Ok(None) => return (StatusCode::NOT_FOUND, "música não encontrada").into_response(),
        Err(err) => return internal(&err.to_string()),
    };
    let slides = slide_builder::build_song_slides(&song);
    let Some(slide) = slides.get(request.index) else {
        return (StatusCode::NOT_FOUND, "slide não encontrado").into_response();
    };

    let prev_up = if request.index > 0 {
        slides.get(request.index - 1).map(|s| s.content.clone())
    } else {
        None
    };
    let next_up = slides.get(request.index + 1).map(|s| s.content.clone());
    let current = state.broadcaster.current_slide();
    let live = LiveSlide {
        content: slide.content.clone(),
        background: current.background,
        blackout: false,
        cleared: false,
        updated_at: now_millis().to_string(),
        next_up,
        prev_up,
    };
    state.broadcaster.publish_slide(&live);

    if let Some(app) = &state.app_handle {
        use tauri::Emitter;
        let _ = app.emit("remote://imprevisto", &request.song_id);
    }

    Json(live).into_response()
}

pub async fn list_images(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let root = state.media_dir.join("library").join("images");
    match media_library::list_images_in_dir(&root) {
        Ok(tree) => Json(tree).into_response(),
        Err(err) => internal(&err.to_string()),
    }
}

pub async fn present_image(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Json(request): Json<PresentImageRequest>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let mut clean = request.path.trim().to_string();
    if let Some(stripped) = clean.strip_prefix("media://library/images/") {
        clean = stripped.to_string();
    } else if let Some(stripped) = clean.strip_prefix("media://library/") {
        clean = stripped.to_string();
    }
    if let Some(stripped) = clean.strip_prefix("images/") {
        clean = stripped.to_string();
    }
    let clean = clean.trim_start_matches('/');
    let relative = std::path::PathBuf::from(clean);
    if relative
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return (StatusCode::BAD_REQUEST, "caminho de imagem inválido").into_response();
    }
    let images_root = state.media_dir.join("library").join("images");
    let image_file = images_root.join(&relative);
    if !image_file.starts_with(&images_root) || !image_file.is_file() {
        return (StatusCode::NOT_FOUND, "imagem não encontrada").into_response();
    }

    let relative_str = relative.to_string_lossy().replace('\\', "/");
    let image_url = format!("media://library/images/{relative_str}");
    let title = request.title.unwrap_or_else(|| {
        relative
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Imagem")
            .to_string()
    });

    let content = SlideContent {
        id: format!("remote_img_{}", now_millis()),
        kind: SlideKind::Media,
        title: title.clone(),
        lines: Vec::new(),
        notes: None,
        section: None,
        media: Some(MediaItem {
            kind: MediaKind::Image,
            title: title.clone(),
            text: None,
            path: Some(image_url),
            files: Vec::new(),
            index: None,
            fit: None,
            theme_id: None,
        }),
    };
    let current = state.broadcaster.current_slide();
    let live = LiveSlide {
        content,
        background: current.background,
        blackout: false,
        cleared: false,
        updated_at: now_millis().to_string(),
        next_up: None,
        prev_up: None,
    };
    state.broadcaster.publish_slide(&live);
    Json(live).into_response()
}

#[derive(Deserialize)]
pub struct BibleBooksQuery {
    pub version: String,
}

#[derive(Deserialize)]
pub struct BibleChapterQuery {
    pub version: String,
    pub book: i32,
    pub chapter: i32,
}

#[derive(Deserialize)]
pub struct BibleSearchQuery {
    pub version: String,
    pub q: String,
    pub limit: Option<usize>,
}

#[derive(Deserialize)]
pub struct BibleCompareQuery {
    pub book: i32,
    pub chapter: i32,
    pub verse: i32,
    pub versions: String,
}

#[derive(Deserialize)]
pub struct PresentBibleRequest {
    pub version_id: String,
    pub book_id: i32,
    pub book_name: String,
    pub chapter: i32,
    pub verse: i32,
    pub text: String,
    pub part_suffix: Option<String>,
    pub prev_text: Option<String>,
    pub next_text: Option<String>,
}

pub async fn list_bible_versions_endpoint(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let Some(app) = &state.app_handle else {
        return internal("instância da aplicação indisponível");
    };
    match crate::services::bible::list_bible_versions(app) {
        Ok(versions) => Json(versions).into_response(),
        Err(err) => internal(&err.to_string()),
    }
}

pub async fn get_bible_books_endpoint(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Query(query): Query<BibleBooksQuery>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let Some(app) = &state.app_handle else {
        return internal("instância da aplicação indisponível");
    };
    match crate::services::bible::get_bible_books(app, &query.version) {
        Ok(books) => Json(books).into_response(),
        Err(err) => internal(&err.to_string()),
    }
}

pub async fn get_bible_chapter_endpoint(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Query(query): Query<BibleChapterQuery>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let Some(app) = &state.app_handle else {
        return internal("instância da aplicação indisponível");
    };
    match crate::services::bible::get_bible_chapter(app, &query.version, query.book, query.chapter) {
        Ok(verses) => Json(verses).into_response(),
        Err(err) => internal(&err.to_string()),
    }
}

pub async fn search_bible_endpoint(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Query(query): Query<BibleSearchQuery>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let Some(app) = &state.app_handle else {
        return internal("instância da aplicação indisponível");
    };
    match crate::services::bible::search_bible_verses(
        app,
        &query.version,
        &query.q,
        query.limit.unwrap_or(50),
    ) {
        Ok(results) => Json(results).into_response(),
        Err(err) => internal(&err.to_string()),
    }
}

pub async fn compare_bible_endpoint(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Query(query): Query<BibleCompareQuery>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let Some(app) = &state.app_handle else {
        return internal("instância da aplicação indisponível");
    };
    let version_ids: Vec<String> = query
        .versions
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    match crate::services::bible::compare_bible_verse(
        app,
        query.book,
        query.chapter,
        query.verse,
        version_ids,
    ) {
        Ok(comps) => Json(comps).into_response(),
        Err(err) => internal(&err.to_string()),
    }
}

pub async fn present_bible(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Json(request): Json<PresentBibleRequest>,
) -> Response {
    if let Err(response) = guard_headers(&state, &headers) {
        return response;
    }
    let part_suffix = request.part_suffix.as_deref().unwrap_or("");
    let title = format!(
        "{} {}:{}{} ({})",
        request.book_name, request.chapter, request.verse, part_suffix, request.version_id
    );
    let section = format!(
        "{} {}:{}{}",
        request.book_name, request.chapter, request.verse, part_suffix
    );

    let next_up = request.next_text.map(|t| SlideContent {
        id: format!(
            "bible-{}-{}-{}",
            request.book_id,
            request.chapter,
            request.verse + 1
        ),
        kind: SlideKind::Scripture,
        title: format!(
            "{} {}:{} ({})",
            request.book_name,
            request.chapter,
            request.verse + 1,
            request.version_id
        ),
        lines: vec![t],
        notes: None,
        section: Some(format!(
            "{} {}:{}",
            request.book_name,
            request.chapter,
            request.verse + 1
        )),
        media: None,
    });

    let prev_up = request.prev_text.map(|t| SlideContent {
        id: format!(
            "bible-{}-{}-{}",
            request.book_id,
            request.chapter,
            request.verse.saturating_sub(1)
        ),
        kind: SlideKind::Scripture,
        title: format!(
            "{} {}:{} ({})",
            request.book_name,
            request.chapter,
            request.verse.saturating_sub(1),
            request.version_id
        ),
        lines: vec![t],
        notes: None,
        section: Some(format!(
            "{} {}:{}",
            request.book_name,
            request.chapter,
            request.verse.saturating_sub(1)
        )),
        media: None,
    });

    let current = state.broadcaster.current_slide();
    let live = LiveSlide {
        content: SlideContent {
            id: format!(
                "bible-{}-{}-{}",
                request.book_id, request.chapter, request.verse
            ),
            kind: SlideKind::Scripture,
            title,
            lines: vec![request.text],
            notes: None,
            section: Some(section),
            media: None,
        },
        background: current.background,
        blackout: false,
        cleared: false,
        updated_at: now_millis().to_string(),
        next_up,
        prev_up,
    };
    state.broadcaster.publish_slide(&live);
    Json(live).into_response()
}

pub async fn ws(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Query(query): Query<RemoteWsQuery>,
    State(state): State<Arc<ServerState>>,
) -> Response {
    if let Err(response) = guard_token(&state, query.token.as_deref()) {
        return response;
    }

    let client_id = next_id("remote");
    register(
        &state.clients,
        ConnectedClient {
            id: client_id.clone(),
            ip: addr.ip().to_string(),
            output: None,
            user_agent: user_agent(&headers),
            connected_at: connected_at_now(),
            kind: ClientKind::Remote,
        },
    );

    ws.on_upgrade(move |socket| handle_remote_socket(socket, state, client_id))
}

async fn handle_remote_socket(socket: WebSocket, state: Arc<ServerState>, client_id: String) {
    let _guard = ClientGuard::new(&state.clients, client_id);
    let (mut sender, mut receiver) = socket.split();

    let slide = serde_json::json!({
        "channel": EVENT_SLIDE,
        "payload": state.broadcaster.current_slide(),
        "version": 1,
    });
    let setlist = serde_json::json!({
        "channel": EVENT_REMOTE_SETLIST,
        "payload": state
            .remote
            .lock()
            .ok()
            .and_then(|remote| remote.setlist.clone()),
        "version": 1,
    });
    let wallpaper = serde_json::json!({
        "channel": EVENT_WALLPAPER,
        "payload": state.broadcaster.current_wallpaper(),
        "version": 1,
    });

    if sender
        .send(Message::Text(slide.to_string().into()))
        .await
        .is_err()
    {
        return;
    }
    if sender
        .send(Message::Text(setlist.to_string().into()))
        .await
        .is_err()
    {
        return;
    }
    if sender
        .send(Message::Text(wallpaper.to_string().into()))
        .await
        .is_err()
    {
        return;
    }

    let mut rx = state.ws_tx.subscribe();
    let send_task = tokio::spawn(async move {
        while let Ok(message) = rx.recv().await {
            if sender
                .send(Message::Text(message.into()))
                .await
                .is_err()
            {
                break;
            }
        }
    });

    while let Some(Ok(_)) = receiver.next().await {}
    send_task.abort();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::types::SlideKind;
    use crate::state::{RemotePart, RemoteSlide};

    fn make_test_setlist() -> RemoteSetlist {
        RemoteSetlist {
            event_id: "evt-1".into(),
            title: "Culto de Domingo".into(),
            event_date: "2026-10-18".into(),
            parts: vec![RemotePart {
                id: "part-1".into(),
                title: "Louvor".into(),
                items: vec![
                    RemoteItem {
                        id: "item-1".into(),
                        kind: "song".into(),
                        title: "Porque Ele Vive".into(),
                        subtitle: Some("Harpa".into()),
                        next_item_id: Some("item-2".into()),
                        slides: vec![
                            RemoteSlide {
                                index: 0,
                                label: Some("V1".into()),
                                content: SlideContent {
                                    id: "item-1#0".into(),
                                    kind: SlideKind::Lyric,
                                    title: "Porque Ele Vive".into(),
                                    lines: vec!["Deus enviou seu Filho amado".into()],
                                    notes: None,
                                    section: Some("V1".into()),
                                    media: None,
                                },
                            },
                            RemoteSlide {
                                index: 1,
                                label: Some("C".into()),
                                content: SlideContent {
                                    id: "item-1#1".into(),
                                    kind: SlideKind::Lyric,
                                    title: "Porque Ele Vive".into(),
                                    lines: vec!["Porque Ele vive, posso crer no amanhã".into()],
                                    notes: None,
                                    section: Some("C".into()),
                                    media: None,
                                },
                            },
                        ],
                    },
                    RemoteItem {
                        id: "item-2".into(),
                        kind: "media".into(),
                        title: "Avisos".into(),
                        subtitle: Some("Imagem".into()),
                        next_item_id: None,
                        slides: vec![RemoteSlide {
                            index: 0,
                            label: Some("Slide 1".into()),
                            content: SlideContent {
                                id: "item-2#0".into(),
                                kind: SlideKind::Custom,
                                title: "Avisos".into(),
                                lines: vec!["Culto de Jovens às 19h".into()],
                                notes: None,
                                section: None,
                                media: None,
                            },
                        }],
                    },
                ],
            }],
        }
    }

    #[test]
    fn find_item_encontra_item_existente_e_ignora_inexistente() {
        let setlist = make_test_setlist();
        assert_eq!(find_item(&setlist, "item-1").unwrap().title, "Porque Ele Vive");
        assert_eq!(find_item(&setlist, "item-2").unwrap().title, "Avisos");
        assert!(find_item(&setlist, "item-999").is_none());
    }

    #[test]
    fn next_content_avanca_no_mesmo_item_e_encadeia_proximo_item() {
        let setlist = make_test_setlist();
        let item1 = find_item(&setlist, "item-1").unwrap();
        let item2 = find_item(&setlist, "item-2").unwrap();

        // Slide 0 -> Slide 1 do mesmo item
        let next_from_0 = next_content(&setlist, item1, 0).unwrap();
        assert_eq!(next_from_0.id, "item-1#1");

        // Slide 1 (último de item-1) -> primeiro slide de item-2 (via next_item_id)
        let next_from_1 = next_content(&setlist, item1, 1).unwrap();
        assert_eq!(next_from_1.id, "item-2#0");

        // Slide 0 de item-2 (sem next_item_id) -> None
        assert!(next_content(&setlist, item2, 0).is_none());
    }

    #[test]
    fn guard_headers_valida_bearer_token_e_status_ativo() {
        use crate::state::RemoteSettings;
        use std::sync::Mutex;

        let remote = Arc::new(Mutex::new(RemoteSettings {
            enabled: true,
            token: "secret-token-123".into(),
            setlist: None,
        }));

        // Header ausente -> 401
        let empty_headers = HeaderMap::new();
        assert_eq!(guard_headers_remote(&remote, &empty_headers).unwrap_err().status(), StatusCode::UNAUTHORIZED);

        // Header correto -> Ok
        let mut ok_headers = HeaderMap::new();
        ok_headers.insert(header::AUTHORIZATION, "Bearer secret-token-123".parse().unwrap());
        assert!(guard_headers_remote(&remote, &ok_headers).is_ok());

        // Header incorreto -> 401
        let mut bad_headers = HeaderMap::new();
        bad_headers.insert(header::AUTHORIZATION, "Bearer wrong-token".parse().unwrap());
        assert_eq!(guard_headers_remote(&remote, &bad_headers).unwrap_err().status(), StatusCode::UNAUTHORIZED);

        // Desativado -> 403
        remote.lock().unwrap().enabled = false;
        assert_eq!(guard_headers_remote(&remote, &ok_headers).unwrap_err().status(), StatusCode::FORBIDDEN);

        // Token de consulta para WebSocket (guard_token_remote)
        remote.lock().unwrap().enabled = true;
        assert!(guard_token_remote(&remote, Some("secret-token-123")).is_ok());
        assert_eq!(guard_token_remote(&remote, Some("errado")).unwrap_err().status(), StatusCode::UNAUTHORIZED);
        assert_eq!(guard_token_remote(&remote, None).unwrap_err().status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn list_songs_e_song_slides_retornam_dados_autenticados() {
        use rusqlite::Connection;
        use crate::services::database::{migrate, Db};
        use crate::services::songs;
        use crate::state::types::{SectionType, Song, SongSection};
        use crate::state::RemoteSettings;
        use std::sync::Mutex;

        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        let db = Db::new(conn);

        db.with_conn(|conn| {
            let song = Song {
                id: "test-song-1".into(),
                title: "Grandes Coisas".into(),
                artist: "Fernandinho".into(),
                album: None,
                composer: None,
                song_key: None,
                bpm: None,
                sections: vec![SongSection {
                    section_type: Some(SectionType::Verse),
                    lines: vec!["Tu és o Deus que faz maravilhas".into()],
                }],
            };
            songs::save(conn, &song)
        })
        .unwrap();

        let remote = Arc::new(Mutex::new(RemoteSettings {
            enabled: true,
            token: "tok123".into(),
            setlist: None,
        }));
        let (ws_tx, _) = tokio::sync::broadcast::channel(16);
        let broadcaster = Arc::new(crate::services::Broadcaster::new_test(ws_tx.clone()));
        let clients = Arc::new(Mutex::new(std::collections::HashMap::new()));
        let state = Arc::new(ServerState {
            broadcaster,
            ws_tx,
            media_dir: std::path::PathBuf::from("/tmp"),
            clients,
            remote,
            db: Some(db),
            app_handle: None,
        });

        let mut headers = HeaderMap::new();
        headers.insert(header::AUTHORIZATION, "Bearer tok123".parse().unwrap());

        let res = list_songs(
            State(state.clone()),
            headers.clone(),
            Query(SearchSongsQuery {
                q: Some("Grandes".into()),
            }),
        )
        .await;
        assert_eq!(res.status(), StatusCode::OK);

        let res_slides = song_slides(
            State(state.clone()),
            Path("test-song-1".into()),
            headers.clone(),
        )
        .await;
        assert_eq!(res_slides.status(), StatusCode::OK);

        let res_img_bad = present_image(
            State(state.clone()),
            headers.clone(),
            Json(PresentImageRequest {
                path: "../../../etc/passwd".into(),
                title: None,
            }),
        )
        .await;
        assert_eq!(res_img_bad.status(), StatusCode::BAD_REQUEST);
    }
}
