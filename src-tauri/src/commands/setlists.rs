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
