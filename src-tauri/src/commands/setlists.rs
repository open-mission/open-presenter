use tauri::State;

use crate::error::AppError;
use crate::services::database::Db;
use crate::services::setlists;
use crate::state::{EventSummary, ServiceEvent};

#[tauri::command]
pub fn list_events(db: State<'_, Db>) -> Result<Vec<EventSummary>, AppError> {
    db.with_conn(|conn| setlists::list(conn))
}

#[tauri::command]
pub fn get_event(db: State<'_, Db>, id: String) -> Result<Option<ServiceEvent>, AppError> {
    db.with_conn(|conn| setlists::get(conn, &id))
}

#[tauri::command]
pub fn create_event(db: State<'_, Db>, event: ServiceEvent) -> Result<(), AppError> {
    db.with_conn(|conn| setlists::create(conn, &event))
}

#[tauri::command]
pub fn save_event(db: State<'_, Db>, event: ServiceEvent) -> Result<(), AppError> {
    db.with_conn(|conn| setlists::save(conn, &event))
}

#[tauri::command]
pub fn delete_event(db: State<'_, Db>, id: String) -> Result<(), AppError> {
    db.with_conn(|conn| setlists::delete(conn, &id))
}

#[tauri::command]
pub fn get_temporary_event(db: State<'_, Db>) -> Result<ServiceEvent, AppError> {
    db.with_conn(|conn| setlists::get_temporary(conn))
}

#[tauri::command]
pub fn get_active_event_id(db: State<'_, Db>) -> Result<Option<String>, AppError> {
    db.with_conn(|conn| setlists::get_active_event_id(conn))
}

#[tauri::command]
pub fn set_active_event_id(
    app: tauri::AppHandle,
    db: State<'_, Db>,
    remote: State<'_, crate::state::SharedRemoteState>,
    broadcaster: State<'_, crate::services::SharedBroadcaster>,
    id: Option<String>,
) -> Result<(), AppError> {
    db.with_conn(|conn| {
        setlists::set_active_event_id(conn, id.as_deref())?;
        setlists::reload_active_event(conn, Some(&app), &remote, &broadcaster)?;
        Ok(())
    })
}
