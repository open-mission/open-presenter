use tauri::{AppHandle, Manager, Monitor, WebviewUrl, WebviewWindowBuilder};

use crate::error::AppError;
use crate::state::types::OutputTarget;
use crate::state::MonitorInfo;

fn to_info(monitor: &Monitor, index: usize, is_primary: bool) -> MonitorInfo {
    let position = monitor.position();
    let size = monitor.size();
    MonitorInfo {
        id: format!("monitor-{index}"),
        name: monitor
            .name()
            .map(String::as_str)
            .unwrap_or("Monitor")
            .to_string(),
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        is_primary,
        scale_factor: monitor.scale_factor(),
    }
}

pub fn list_monitors(app: &AppHandle) -> Result<Vec<MonitorInfo>, AppError> {
    let primary = app.primary_monitor().map_err(AppError::Tauri)?;
    let monitors = app.available_monitors().map_err(AppError::Tauri)?;
    let primary_name: Option<String> =
        primary.as_ref().and_then(|m| m.name().cloned());

    Ok(monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            let is_primary = primary_name
                .as_deref()
                .zip(monitor.name().map(String::as_str))
                .map(|(a, b)| a == b)
                .unwrap_or(index == 0);
            to_info(monitor, index, is_primary)
        })
        .collect())
}

pub async fn open_output_window(
    app: AppHandle,
    target: OutputTarget,
    monitor_id: Option<String>,
) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window(target.label()) {
        window.set_focus().map_err(AppError::Tauri)?;
        return Ok(());
    }

    let monitors = app.available_monitors().map_err(AppError::Tauri)?;
    let chosen = pick_monitor(&monitors, monitor_id.as_deref());

    let mut builder = WebviewWindowBuilder::new(&app, target.label(), WebviewUrl::App(target.route().into()))
        .title(target.title())
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .focused(false)
        .visible(true);

    if let Some(monitor) = chosen {
        let position = monitor.position();
        let size = monitor.size();
        builder = builder
            .position(position.x.into(), position.y.into())
            .inner_size(size.width.into(), size.height.into())
            .fullscreen(true);
    } else {
        builder = builder.fullscreen(true);
    }

    builder.build().map_err(AppError::Tauri)?;
    Ok(())
}

fn pick_monitor(monitors: &[Monitor], monitor_id: Option<&str>) -> Option<Monitor> {
    let Some(wanted) = monitor_id else {
        return first_non_primary(monitors).or_else(|| monitors.first().cloned());
    };
    monitors
        .iter()
        .enumerate()
        .find(|(index, _)| format!("monitor-{index}") == wanted)
        .map(|(_, m)| m.clone())
        .or_else(|| first_non_primary(monitors))
        .or_else(|| monitors.first().cloned())
}

fn first_non_primary(monitors: &[Monitor]) -> Option<Monitor> {
    if monitors.len() > 1 {
        monitors.get(1).cloned()
    } else {
        None
    }
}

pub fn close_output_window(app: &AppHandle, target: OutputTarget) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window(target.label()) {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}

pub fn open_preferences_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("preferences") {
        let _ = window.unminimize();
        let _ = window.show();
        window.set_focus().map_err(AppError::Tauri)?;
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(
        app,
        "preferences",
        WebviewUrl::App("/#/preferences".into()),
    )
    .title("Preferências — Open Presenter")
    .inner_size(880.0, 640.0)
    .min_inner_size(720.0, 520.0)
    .resizable(true)
    .center()
    .focused(true)
    .decorations(true);

    builder.build().map_err(AppError::Tauri)?;
    Ok(())
}

pub fn close_preferences_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("preferences") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}
