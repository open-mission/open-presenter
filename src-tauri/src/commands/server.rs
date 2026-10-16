use std::sync::Mutex;

use tauri::State;

use crate::error::AppError;
use crate::server::{bind, spawn_with_listener, Clients, ServerControl};
use crate::services::database::Db;
use crate::services::settings;
use crate::state::types::{ConnectedClient, ServerStatus, OUTPUT_HTTP_PORT};

pub const SERVER_PORT_KEY: &str = "server.port";

pub fn parse_port(raw: Option<String>) -> u16 {
    raw.and_then(|v| v.trim().parse::<u16>().ok())
        .filter(|port| *port >= 1024)
        .unwrap_or(OUTPUT_HTTP_PORT)
}

fn lock<'a>(control: &'a State<'_, Mutex<ServerControl>>) -> Result<std::sync::MutexGuard<'a, ServerControl>, AppError> {
    control
        .lock()
        .map_err(|_| AppError::Storage("servidor indisponível".into()))
}

async fn start_locked(control: &State<'_, Mutex<ServerControl>>, port: u16) -> Result<ServerStatus, AppError> {
    let state = {
        let mut guard = lock(control)?;
        guard.stop();
        guard.port = port;
        guard.state.clone()
    };
    let Some(state) = state else {
        return Err(AppError::Storage("estado do servidor ausente".into()));
    };
    let listener = bind(port).await.map_err(AppError::Network)?;
    tracing::info!(port, "servidor de saídas escutando");
    let handle = spawn_with_listener(state, listener);
    let mut guard = lock(control)?;
    guard.handle = Some(handle);
    guard.running = true;
    Ok(guard.status())
}

#[tauri::command]
pub async fn get_server_status(
    control: State<'_, Mutex<ServerControl>>,
) -> Result<ServerStatus, AppError> {
    Ok(lock(&control)?.status())
}

fn swap_with_listener(
    control: &State<'_, Mutex<ServerControl>>,
    port: u16,
    listener: tokio::net::TcpListener,
) -> Result<ServerStatus, AppError> {
    let state = {
        let mut guard = lock(control)?;
        guard.stop();
        guard.port = port;
        guard.state.clone()
    };
    let Some(state) = state else {
        return Err(AppError::Storage("estado do servidor ausente".into()));
    };
    tracing::info!(port, "servidor de saídas escutando");
    let handle = spawn_with_listener(state, listener);
    let mut guard = lock(control)?;
    guard.handle = Some(handle);
    guard.running = true;
    Ok(guard.status())
}

#[tauri::command]
pub async fn set_server_port(
    db: State<'_, Db>,
    control: State<'_, Mutex<ServerControl>>,
    port: u16,
) -> Result<ServerStatus, AppError> {
    if port < 1024 {
        return Err(AppError::Network("porta fora do intervalo 1024–65535".into()));
    }
    if port != lock(&control)?.port {
        let listener = bind(port).await.map_err(AppError::Network)?;
        db.with_conn(|conn| settings::set_setting(conn, SERVER_PORT_KEY, &port.to_string()))?;
        return swap_with_listener(&control, port, listener);
    }
    db.with_conn(|conn| settings::set_setting(conn, SERVER_PORT_KEY, &port.to_string()))?;
    start_locked(&control, port).await
}

#[tauri::command]
pub async fn stop_server(
    control: State<'_, Mutex<ServerControl>>,
) -> Result<ServerStatus, AppError> {
    let mut guard = lock(&control)?;
    guard.stop();
    Ok(guard.status())
}

#[tauri::command]
pub async fn start_server(
    control: State<'_, Mutex<ServerControl>>,
) -> Result<ServerStatus, AppError> {
    let port = lock(&control)?.port;
    start_locked(&control, port).await
}

#[tauri::command]
pub async fn get_connected_clients(
    clients: State<'_, Clients>,
) -> Result<Vec<ConnectedClient>, AppError> {
    let mut list = clients
        .lock()
        .map_err(|_| AppError::Storage("clientes indisponíveis".into()))?
        .values()
        .cloned()
        .collect::<Vec<_>>();
    list.sort_by_key(|client| client.connected_at);
    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_port_aceita_faixa_valida_e_recai_no_padrao() {
        assert_eq!(parse_port(Some("5050".into())), 5050);
        assert_eq!(parse_port(Some("1024".into())), 1024);
        assert_eq!(parse_port(Some("65535".into())), 65535);
        assert_eq!(parse_port(None), OUTPUT_HTTP_PORT);
        assert_eq!(parse_port(Some("abc".into())), OUTPUT_HTTP_PORT);
        assert_eq!(parse_port(Some("80".into())), OUTPUT_HTTP_PORT);
        assert_eq!(parse_port(Some("99999".into())), OUTPUT_HTTP_PORT);
    }
}
