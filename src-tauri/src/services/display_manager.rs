use tauri::{AppHandle, Emitter, Manager, Monitor, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::error::AppError;
use crate::state::outputs::OutputsState;
use crate::state::types::{OutputTarget, EVENT_OUTPUTS};
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
    monitor_label: Option<String>,
) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window(target.label()) {
        window.set_focus().map_err(AppError::Tauri)?;
        let state = app.state::<OutputsState>();
        let current = state
            .snapshot()
            .into_iter()
            .find(|r| r.target == target)
            .and_then(|r| r.monitor_id);
        if state.set_open(target, true, monitor_id.or(current)) {
            let _ = app.emit(EVENT_OUTPUTS, state.snapshot());
        }
        return Ok(());
    }

    let monitors = app.available_monitors().map_err(AppError::Tauri)?;
    let chosen = pick_monitor(&monitors, monitor_id.as_deref(), monitor_label.as_deref());
    let resolved_id: Option<String> = chosen
        .as_ref()
        .map(|(index, _)| format!("monitor-{index}"))
        .or(monitor_id.clone());
    let chosen_monitor = chosen.map(|(_, monitor)| monitor);

    let mut builder = WebviewWindowBuilder::new(&app, target.label(), WebviewUrl::App(target.route().into()))
        .title(target.title())
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .focused(false)
        .visible(true)
        .transparent(target == OutputTarget::Stream);

    if let Some(monitor) = chosen_monitor {
        let position = monitor.position();
        let size = monitor.size();
        builder = builder
            .position(position.x.into(), position.y.into())
            .inner_size(size.width.into(), size.height.into())
            .fullscreen(true);
    } else {
        builder = builder.fullscreen(true);
    }

    let window = builder.build().map_err(AppError::Tauri)?;
    let watcher_app = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { .. } = event {
            let state = watcher_app.state::<OutputsState>();
            if state.set_open(target, false, None) {
                let _ = watcher_app.emit(EVENT_OUTPUTS, state.snapshot());
            }
        }
    });
    let state = app.state::<OutputsState>();
    if state.set_open(target, true, resolved_id) {
        let _ = app.emit(EVENT_OUTPUTS, state.snapshot());
    }
    Ok(())
}

fn pick_monitor(
    monitors: &[Monitor],
    monitor_id: Option<&str>,
    monitor_label: Option<&str>,
) -> Option<(usize, Monitor)> {
    if let Some(wanted) = monitor_id {
        let by_id = monitors
            .iter()
            .enumerate()
            .find(|(index, _)| format!("monitor-{index}") == wanted)
            .map(|(index, monitor)| (index, monitor.clone()));
        if by_id.is_some() {
            return by_id;
        }
    }
    if let Some(label) = monitor_label {
        let by_label = monitors
            .iter()
            .enumerate()
            .find(|(_, monitor)| monitor.name().is_some_and(|name| name == label))
            .map(|(index, monitor)| (index, monitor.clone()));
        if by_label.is_some() {
            return by_label;
        }
    }
    first_non_primary(monitors).or_else(|| monitors.first().cloned().map(|m| (0, m)))
}

fn first_non_primary(monitors: &[Monitor]) -> Option<(usize, Monitor)> {
    if monitors.len() > 1 {
        monitors.get(1).cloned().map(|m| (1, m))
    } else {
        None
    }
}

pub fn close_output_window(app: &AppHandle, target: OutputTarget) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window(target.label()) {
        window.close().map_err(AppError::Tauri)?;
    }
    let state = app.state::<OutputsState>();
    if state.set_open(target, false, None) {
        let _ = app.emit(EVENT_OUTPUTS, state.snapshot());
    }
    Ok(())
}

/// Reconcilia o `open` com as janelas reais (rede de segurança além do
/// `on_window_event(CloseRequested)` anexado na abertura). Emite
/// `EVENT_OUTPUTS` se corrigir algo.
pub fn reconcile_open_state(app: &AppHandle) -> bool {
    let state = app.state::<OutputsState>();
    let mut fixed = false;
    for runtime in state.snapshot() {
        if runtime.open && app.get_webview_window(runtime.target.label()).is_none() {
            state.set_open(runtime.target, false, None);
            fixed = true;
        }
    }
    if fixed {
        let _ = app.emit(EVENT_OUTPUTS, state.snapshot());
    }
    fixed
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
        WebviewUrl::App("index.html#/preferences".into()),
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

pub fn open_shortcuts_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("shortcuts") {
        let _ = window.unminimize();
        let _ = window.show();
        window.set_focus().map_err(AppError::Tauri)?;
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(
        app,
        "shortcuts",
        WebviewUrl::App("index.html#/shortcuts".into()),
    )
    .title("Atalhos de Teclado — Open Presenter")
    .inner_size(700.0, 580.0)
    .min_inner_size(540.0, 420.0)
    .resizable(true)
    .center()
    .focused(true)
    .decorations(true);

    builder.build().map_err(AppError::Tauri)?;
    Ok(())
}

pub fn close_shortcuts_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("shortcuts") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}

pub fn open_theme_editor_window(app: &AppHandle, guid: Option<String>) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("theme-editor") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("theme-editor://open", guid);
        return Ok(());
    }

    let route = format!(
        "index.html#/theme-editor?guid={}",
        guid.as_deref().unwrap_or("")
    );
    let builder = WebviewWindowBuilder::new(app, "theme-editor", WebviewUrl::App(route.into()))
        .title("Editor de Temas — Open Presenter")
        .inner_size(1280.0, 800.0)
        .min_inner_size(1024.0, 640.0)
        .resizable(true)
        .center()
        .focused(true)
        .decorations(true);

    builder.build().map_err(AppError::Tauri)?;
    Ok(())
}

pub fn open_song_editor_window(app: &AppHandle, song_id: Option<String>) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("song-editor") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("song-editor://open", song_id);
        return Ok(());
    }

    let route = match &song_id {
        Some(id) if !id.trim().is_empty() => format!("index.html#/song-editor?id={}", id),
        _ => "index.html#/song-editor".to_string(),
    };

    let title = if song_id.is_some() {
        "Editar Música — Open Presenter"
    } else {
        "Nova Música — Open Presenter"
    };

    let builder = WebviewWindowBuilder::new(app, "song-editor", WebviewUrl::App(route.into()))
        .title(title)
        .inner_size(1240.0, 820.0)
        .min_inner_size(960.0, 600.0)
        .resizable(true)
        .center()
        .focused(true)
        .decorations(true);

    builder.build().map_err(AppError::Tauri)?;
    Ok(())
}

pub fn close_song_editor_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("song-editor") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}
