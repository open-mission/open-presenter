use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;

use crate::server::ServerState;
use crate::state::types::{
    now_millis, SlideContent, EVENT_REMOTE_SETLIST, EVENT_SLIDE, EVENT_WALLPAPER,
};
use crate::state::{LiveSlide, RemoteItem, RemoteSetlist};

#[derive(Debug, Deserialize)]
pub struct RemoteWsQuery {
    token: Option<String>,
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

    let next_up = next_content(&setlist, item, request.index);
    let current = state.broadcaster.current_slide();
    let live = LiveSlide {
        content: slide.content.clone(),
        background: current.background,
        blackout: false,
        cleared: false,
        updated_at: now_millis().to_string(),
        next_up,
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

pub async fn ws(
    ws: WebSocketUpgrade,
    Query(query): Query<RemoteWsQuery>,
    State(state): State<Arc<ServerState>>,
) -> Response {
    if let Err(response) = guard_token(&state, query.token.as_deref()) {
        return response;
    }
    ws.on_upgrade(move |socket| handle_remote_socket(socket, state))
}

async fn handle_remote_socket(socket: WebSocket, state: Arc<ServerState>) {
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
}
