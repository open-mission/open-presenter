use tauri::State;

use crate::error::AppError;
use crate::services::display_manager;
use crate::services::SharedBroadcaster;
use crate::state::{LiveOutputPlans, LiveSlide, MonitorInfo, OutputTarget, StageTimer};

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
pub async fn timer_start(
    app: tauri::AppHandle,
    broadcaster: State<'_, SharedBroadcaster>,
) -> Result<StageTimer, AppError> {
    use crate::state::PresentationState;
    use tauri::Manager;

    let state = app.state::<PresentationState>();
    state.timer_start();
    let timer = state.timer();
    broadcaster.publish_timer(&timer);
    Ok(timer)
}

#[tauri::command]
pub async fn timer_pause(
    app: tauri::AppHandle,
    broadcaster: State<'_, SharedBroadcaster>,
) -> Result<StageTimer, AppError> {
    use crate::state::PresentationState;
    use tauri::Manager;

    let state = app.state::<PresentationState>();
    state.timer_pause();
    let timer = state.timer();
    broadcaster.publish_timer(&timer);
    Ok(timer)
}

#[tauri::command]
pub async fn timer_reset(
    app: tauri::AppHandle,
    broadcaster: State<'_, SharedBroadcaster>,
) -> Result<StageTimer, AppError> {
    use crate::state::PresentationState;
    use tauri::Manager;

    let state = app.state::<PresentationState>();
    state.timer_reset();
    let timer = state.timer();
    broadcaster.publish_timer(&timer);
    Ok(timer)
}

#[tauri::command]
pub async fn timer_set_countdown(
    app: tauri::AppHandle,
    broadcaster: State<'_, SharedBroadcaster>,
    secs: u64,
) -> Result<StageTimer, AppError> {
    use crate::state::PresentationState;
    use tauri::Manager;

    let state = app.state::<PresentationState>();
    state.timer_set_countdown(secs);
    let timer = state.timer();
    broadcaster.publish_timer(&timer);
    Ok(timer)
}

#[tauri::command]
pub async fn get_stage_timer(
    broadcaster: State<'_, SharedBroadcaster>,
) -> Result<StageTimer, AppError> {
    Ok(broadcaster.current_timer())
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

#[tauri::command]
pub async fn close_theme_editor(app: tauri::AppHandle) -> Result<(), AppError> {
    display_manager::close_theme_editor_window(&app)
}

#[tauri::command]
pub async fn open_shortcuts_window(app: tauri::AppHandle) -> Result<(), AppError> {
    display_manager::open_shortcuts_window(&app)
}

#[tauri::command]
pub async fn close_shortcuts_window(app: tauri::AppHandle) -> Result<(), AppError> {
    display_manager::close_shortcuts_window(&app)
}

#[tauri::command]
pub async fn open_communication_window(app: tauri::AppHandle) -> Result<(), AppError> {
    display_manager::open_communication_window(&app)
}

#[tauri::command]
pub async fn close_communication_window(app: tauri::AppHandle) -> Result<(), AppError> {
    display_manager::close_communication_window(&app)
}

#[tauri::command]
pub async fn open_displays_window(app: tauri::AppHandle) -> Result<(), AppError> {
    display_manager::open_displays_window(&app)
}

#[tauri::command]
pub async fn close_displays_window(app: tauri::AppHandle) -> Result<(), AppError> {
    display_manager::close_displays_window(&app)
}

#[tauri::command]
pub async fn toggle_fullscreen(app: tauri::AppHandle) -> Result<bool, AppError> {
    use tauri::Manager;

    let window = app
        .webview_windows()
        .into_values()
        .find(|window| window.is_focused().unwrap_or(false))
        .or_else(|| app.get_webview_window("main"))
        .ok_or_else(|| AppError::Storage("janela não encontrada".into()))?;

    let next = !window.is_fullscreen().unwrap_or(false);
    if next {
        // No macOS uma janela não redimensionável pode recusar entrar em tela cheia.
        let _ = window.set_resizable(true);
    }
    window.set_fullscreen(next).map_err(AppError::Tauri)?;
    if next {
        let _ = window.set_focus();
    }
    Ok(next)
}

#[tauri::command]
pub async fn show_main_window(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        if !window.is_visible().unwrap_or(false) {
            crate::services::window_state::apply_startup_geometry(&window);
            window.show().map_err(AppError::Tauri)?;
            let _ = window.set_focus();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn send_stage_message(
    broadcaster: State<'_, SharedBroadcaster>,
    message: crate::state::types::CommunicationAlert,
) -> Result<(), AppError> {
    let auto_dismiss = message.auto_dismiss_seconds;
    let message_id = message.id.clone();
    let bc = broadcaster.inner().clone();
    broadcaster.publish_stage_message(Some(message));

    if let Some(secs) = auto_dismiss {
        if secs > 0 {
            tauri::async_runtime::spawn(async move {
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
    Ok(())
}

#[tauri::command]
pub async fn clear_stage_message(
    broadcaster: State<'_, SharedBroadcaster>,
) -> Result<(), AppError> {
    broadcaster.publish_stage_message(None);
    Ok(())
}

#[tauri::command]
pub async fn get_stage_message(
    broadcaster: State<'_, SharedBroadcaster>,
) -> Result<Option<crate::state::types::CommunicationAlert>, AppError> {
    Ok(broadcaster.current_stage_message())
}

#[tauri::command]
pub async fn set_live_output_plans(
    broadcaster: State<'_, SharedBroadcaster>,
    plans: LiveOutputPlans,
) -> Result<(), AppError> {
    broadcaster.publish_output_plans(&plans);
    Ok(())
}

#[tauri::command]
pub async fn get_live_output_plans(
    broadcaster: State<'_, SharedBroadcaster>,
) -> Result<LiveOutputPlans, AppError> {
    Ok(broadcaster.current_output_plans())
}

