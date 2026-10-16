use tauri::State;

use crate::error::AppError;
use crate::services::display_manager;
use crate::services::SharedBroadcaster;
use crate::state::{LiveSlide, LiveThemes, MonitorInfo, OutputTarget};

#[tauri::command]
pub async fn list_monitors(app: tauri::AppHandle) -> Result<Vec<MonitorInfo>, AppError> {
    display_manager::list_monitors(&app)
}

#[tauri::command]
pub async fn open_output_window(
    app: tauri::AppHandle,
    target: OutputTarget,
    monitor_id: Option<String>,
    monitor_label: Option<String>,
) -> Result<(), AppError> {
    display_manager::open_output_window(app, target, monitor_id, monitor_label).await
}

#[tauri::command]
pub async fn close_output_window(
    app: tauri::AppHandle,
    target: OutputTarget,
) -> Result<(), AppError> {
    display_manager::close_output_window(&app, target)
}

#[tauri::command]
pub async fn go_live(
    broadcaster: State<'_, SharedBroadcaster>,
    slide: LiveSlide,
) -> Result<(), AppError> {
    broadcaster.publish_slide(&slide);
    Ok(())
}

#[tauri::command]
pub async fn set_blackout(
    app: tauri::AppHandle,
    broadcaster: State<'_, SharedBroadcaster>,
    blackout: bool,
) -> Result<(), AppError> {
    use crate::state::PresentationState;
    use tauri::Manager;

    let state = app.state::<PresentationState>();
    state.set_blackout(blackout);
    broadcaster.publish_slide(&state.get());
    Ok(())
}

#[tauri::command]
pub async fn get_live_slide(
    broadcaster: State<'_, SharedBroadcaster>,
) -> Result<LiveSlide, AppError> {
    Ok(broadcaster.current_slide())
}

#[tauri::command]
pub async fn set_live_themes(
    broadcaster: State<'_, SharedBroadcaster>,
    themes: LiveThemes,
) -> Result<(), AppError> {
    broadcaster.publish_themes(&themes);
    Ok(())
}

#[tauri::command]
pub async fn get_live_themes(
    broadcaster: State<'_, SharedBroadcaster>,
) -> Result<LiveThemes, AppError> {
    Ok(broadcaster.current_themes())
}

#[tauri::command]
pub async fn get_server_host() -> Result<String, AppError> {
    let ip = local_ip_address::local_ip().map_err(|e| AppError::Network(e.to_string()))?;
    Ok(ip.to_string())
}

#[tauri::command]
pub async fn open_preferences_window(app: tauri::AppHandle) -> Result<(), AppError> {
    display_manager::open_preferences_window(&app)
}

#[tauri::command]
pub async fn close_preferences_window(app: tauri::AppHandle) -> Result<(), AppError> {
    display_manager::close_preferences_window(&app)
}

#[tauri::command]
pub async fn open_theme_editor(
    app: tauri::AppHandle,
    guid: Option<String>,
) -> Result<(), AppError> {
    display_manager::open_theme_editor_window(&app, guid)
}
