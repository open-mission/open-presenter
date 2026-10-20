use tauri::{AppHandle, Manager, State};

use crate::error::AppError;
use crate::services::database::Db;
use crate::services::settings;

pub const CLOSE_TO_TRAY_KEY: &str = "app.close_to_tray";

pub fn close_to_tray(app: &AppHandle) -> bool {
    app.try_state::<Db>()
        .and_then(|db| {
            db.with_conn(|conn| settings::get_setting(conn, CLOSE_TO_TRAY_KEY))
                .ok()
        })
        .flatten()
        .map(|value| value == "true")
        .unwrap_or(false)
}

#[tauri::command]
pub fn get_close_to_tray(app: AppHandle) -> bool {
    close_to_tray(&app)
}

#[tauri::command]
pub fn set_close_to_tray(app: AppHandle, db: State<'_, Db>, enabled: bool) -> Result<(), AppError> {
    db.with_conn(|conn| {
        settings::set_setting(
            conn,
            CLOSE_TO_TRAY_KEY,
            if enabled { "true" } else { "false" },
        )
    })?;
    crate::services::tray::refresh(&app);
    Ok(())
}
