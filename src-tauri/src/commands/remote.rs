use std::sync::MutexGuard;

use tauri::State;

use crate::error::AppError;
use crate::services::database::Db;
use crate::services::{settings, SharedBroadcaster};
use crate::state::types::EVENT_REMOTE_SETLIST;
use crate::state::{RemoteConfig, RemoteSetlist, SharedRemoteState};

const TOKEN_KEY: &str = "remote.token";
const ENABLED_KEY: &str = "remote.enabled";

fn lock<'a>(state: &'a State<'_, SharedRemoteState>) -> Result<MutexGuard<'a, crate::state::RemoteSettings>, AppError> {
    state
        .lock()
        .map_err(|_| AppError::Storage("estado remoto indisponível".into()))
}

#[tauri::command]
pub fn get_remote_config(remote: State<'_, SharedRemoteState>) -> Result<RemoteConfig, AppError> {
    let guard = lock(&remote)?;
    Ok(RemoteConfig {
        enabled: guard.enabled,
        token: guard.token.clone(),
    })
}

#[tauri::command]
pub fn set_remote_token(
    db: State<'_, Db>,
    remote: State<'_, SharedRemoteState>,
    token: String,
) -> Result<RemoteConfig, AppError> {
    let token = token.trim().to_string();
    if token.len() < 16 {
        return Err(AppError::Storage("token remoto muito curto".into()));
    }

    db.with_conn(|conn| settings::set_setting(conn, TOKEN_KEY, &token))?;
    let mut guard = lock(&remote)?;
    guard.token = token;
    Ok(RemoteConfig {
        enabled: guard.enabled,
        token: guard.token.clone(),
    })
}

#[tauri::command]
pub fn set_remote_enabled(
    db: State<'_, Db>,
    remote: State<'_, SharedRemoteState>,
    enabled: bool,
) -> Result<RemoteConfig, AppError> {
    db.with_conn(|conn| {
        settings::set_setting(conn, ENABLED_KEY, if enabled { "true" } else { "false" })
    })?;
    let mut guard = lock(&remote)?;
    guard.enabled = enabled;
    Ok(RemoteConfig {
        enabled: guard.enabled,
        token: guard.token.clone(),
    })
}

#[tauri::command]
pub fn set_remote_setlist(
    remote: State<'_, SharedRemoteState>,
    broadcaster: State<'_, SharedBroadcaster>,
    setlist: Option<RemoteSetlist>,
) -> Result<(), AppError> {
    {
        let mut guard = lock(&remote)?;
        guard.setlist = setlist.clone();
    }
    broadcaster.publish_value(EVENT_REMOTE_SETLIST, &setlist);
    Ok(())
}
