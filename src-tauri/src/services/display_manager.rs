use tauri::webview::Color;
use tauri::{AppHandle, Emitter, Manager, Monitor, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::error::AppError;
use crate::state::outputs::OutputsState;
use crate::state::types::{OutputTarget, EVENT_OUTPUTS};
use crate::state::MonitorInfo;

/// Identidade estável de um monitor. O índice retornado por
/// `available_monitors()` varia entre chamadas (principalmente no Windows),
/// então usamos nome + resolução e só caímos para geometria quando o nome não
/// existe.
fn monitor_key(monitor: &Monitor) -> String {
    let size = monitor.size();
    match monitor.name() {
        Some(name) if !name.trim().is_empty() => {
            format!("monitor:{}:{}x{}", name, size.width, size.height)
        }
        _ => {
            let position = monitor.position();
            format!(
                "monitor:{}x{}@{},{}",
                size.width, size.height, position.x, position.y
            )
        }
    }
}

fn is_primary_monitor(primary: Option<&Monitor>, monitor: &Monitor) -> bool {
    let Some(primary) = primary else {
        return false;
    };
    if let (Some(a), Some(b)) = (primary.name(), monitor.name()) {
        if !a.trim().is_empty() && !b.trim().is_empty() {
            return a == b;
        }
    }
    let primary_position = primary.position();
    let primary_size = primary.size();
    let position = monitor.position();
    let size = monitor.size();
    primary_position.x == position.x
        && primary_position.y == position.y
        && primary_size.width == size.width
        && primary_size.height == size.height
}

fn to_info(monitor: &Monitor, primary: Option<&Monitor>) -> MonitorInfo {
    let position = monitor.position();
    let size = monitor.size();
    MonitorInfo {
        id: monitor_key(monitor),
        name: monitor
            .name()
            .map(String::as_str)
            .unwrap_or("Monitor")
            .to_string(),
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        is_primary: is_primary_monitor(primary, monitor),
        scale_factor: monitor.scale_factor(),
    }
}

pub fn list_monitors(app: &AppHandle) -> Result<Vec<MonitorInfo>, AppError> {
    let primary = app.primary_monitor().map_err(AppError::Tauri)?;
    let monitors = app.available_monitors().map_err(AppError::Tauri)?;

    Ok(monitors
        .iter()
        .map(|monitor| to_info(monitor, primary.as_ref()))
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
    let primary = app.primary_monitor().ok().flatten();
    let chosen = pick_monitor(
        &monitors,
        primary.as_ref(),
        monitor_id.as_deref(),
        monitor_label.as_deref(),
    );
    let resolved_id: Option<String> = chosen
        .as_ref()
        .map(|(_, monitor)| monitor_key(monitor))
        .or(monitor_id.clone());
    let chosen_monitor = chosen.map(|(_, monitor)| monitor);

    let mut builder = WebviewWindowBuilder::new(&app, target.label(), WebviewUrl::App(target.route().into()))
        .title(target.title())
        .decorations(false)
        .resizable(true)
        .skip_taskbar(true)
        .focused(false)
        .visible(true)
        .transparent(target == OutputTarget::Stream);

    if target != OutputTarget::Stream {
        builder = builder.background_color(Color(0, 0, 0, 255));
    }

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
    primary: Option<&Monitor>,
    monitor_id: Option<&str>,
    monitor_label: Option<&str>,
) -> Option<(usize, Monitor)> {
    if let Some(wanted) = monitor_id {
        if let Some(index) = monitors.iter().position(|m| monitor_key(m) == wanted) {
            return Some((index, monitors[index].clone()));
        }
        // Compatibilidade: configurações antigas gravavam `monitor-{índice}`.
        if let Some(index) = wanted
            .strip_prefix("monitor-")
            .and_then(|rest| rest.parse::<usize>().ok())
        {
            if let Some(monitor) = monitors.get(index) {
                return Some((index, monitor.clone()));
            }
        }
    }
    if let Some(label) = monitor_label {
        if let Some(index) = monitors
            .iter()
            .position(|m| m.name().is_some_and(|name| name == label))
        {
            return Some((index, monitors[index].clone()));
        }
    }
    // Fallback: prefere monitor secundário. Se houver apenas 1 monitor (a tela principal do operador),
    // e a saída estava vinculada a um monitor externo que não existe mais, não sequestra a tela principal.
    let fallback = first_non_primary(monitors, primary);
    if fallback.is_some() || (monitor_id.is_none() && monitor_label.is_none()) {
        fallback.or_else(|| monitors.first().cloned().map(|m| (0, m)))
    } else {
        None
    }
}

fn first_non_primary(
    monitors: &[Monitor],
    primary: Option<&Monitor>,
) -> Option<(usize, Monitor)> {
    monitors
        .iter()
        .enumerate()
        .find(|(_, monitor)| !is_primary_monitor(primary, monitor))
        .map(|(index, monitor)| (index, monitor.clone()))
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
    .background_color(Color(10, 10, 10, 255))
    .decorations(true);

    let window = builder.build().map_err(AppError::Tauri)?;
    let _ = window.show();
    let _ = window.set_focus();
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
    .background_color(Color(10, 10, 10, 255))
    .decorations(true);

    let window = builder.build().map_err(AppError::Tauri)?;
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

pub fn close_shortcuts_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("shortcuts") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}

pub fn open_communication_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("communication") {
        let _ = window.unminimize();
        let _ = window.show();
        window.set_focus().map_err(AppError::Tauri)?;
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(
        app,
        "communication",
        WebviewUrl::App("index.html#/communication".into()),
    )
    .title("Painel de Comunicação & Avisos — Open Presenter")
    .inner_size(1120.0, 700.0)
    .min_inner_size(860.0, 520.0)
    .resizable(true)
    .center()
    .focused(true)
    .background_color(Color(10, 10, 10, 255))
    .decorations(true);

    let window = builder.build().map_err(AppError::Tauri)?;
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

pub fn close_communication_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("communication") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}

pub fn open_agenda_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("agenda") {
        let _ = window.unminimize();
        let _ = window.show();
        window.set_focus().map_err(AppError::Tauri)?;
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(
        app,
        "agenda",
        WebviewUrl::App("index.html#/agenda".into()),
    )
    .title("Agenda de Eventos & Cultos — Open Presenter")
    .inner_size(1080.0, 720.0)
    .min_inner_size(800.0, 560.0)
    .resizable(true)
    .center()
    .focused(true)
    .background_color(Color(10, 10, 10, 255))
    .decorations(true);

    let window = builder.build().map_err(AppError::Tauri)?;
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

pub fn close_agenda_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("agenda") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}

pub fn open_displays_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("displays") {
        let _ = window.unminimize();
        let _ = window.show();
        window.set_focus().map_err(AppError::Tauri)?;
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(
        app,
        "displays",
        WebviewUrl::App("index.html#/displays".into()),
    )
    .title("Configuração de tela — Open Presenter")
    .inner_size(1040.0, 720.0)
    .min_inner_size(880.0, 580.0)
    .resizable(true)
    .center()
    .focused(true)
    .background_color(Color(15, 15, 17, 255))
    .decorations(true);

    let window = builder.build().map_err(AppError::Tauri)?;
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

pub fn close_displays_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("displays") {
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
        .background_color(Color(10, 10, 10, 255))
        .decorations(true);

    let window = builder.build().map_err(AppError::Tauri)?;
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

pub fn close_theme_editor_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("theme-editor") {
        window.close().map_err(AppError::Tauri)?;
    }
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
        .background_color(Color(10, 10, 10, 255))
        .decorations(true);

    let window = builder.build().map_err(AppError::Tauri)?;
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

pub fn close_song_editor_window(app: &AppHandle) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window("song-editor") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}

pub fn set_identify_displays(app: &AppHandle, active: bool) -> Result<(), AppError> {
    let monitors = app.available_monitors().map_err(AppError::Tauri)?;
    for (index, monitor) in monitors.iter().enumerate() {
        let label = format!("identify-monitor-{}", index);
        if active {
            if let Some(existing) = app.get_webview_window(&label) {
                let _ = existing.show();
                continue;
            }
            let size = monitor.size();
            let mon_name = monitor
                .name()
                .map(String::as_str)
                .unwrap_or("Monitor")
                .to_string();
            let safe_name = mon_name.replace(' ', "+");
            let route = format!(
                "index.html#/identify?index={}&name={}&w={}&h={}",
                index + 1,
                safe_name,
                size.width,
                size.height
            );
            let pos = monitor.position();
            let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(route.into()))
                .title("Identificar Tela")
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .position(pos.x as f64, pos.y as f64)
                .fullscreen(true);
            match builder.build() {
                Ok(w) => {
                    let _ = w.show();
                }
                Err(e) => {
                    eprintln!("Falha ao criar janela de identificação {}: {}", label, e);
                }
            }
        } else if let Some(w) = app.get_webview_window(&label) {
            let _ = w.close();
        }
    }
    let _ = app.emit("displays://identify", active);
    Ok(())
}

pub async fn open_native_output(
    app: AppHandle,
    output_id: String,
    monitor_id: Option<String>,
    monitor_label: Option<String>,
    route: String,
    title: String,
) -> Result<(), AppError> {
    let window_label = format!("output-{}", output_id);
    let legacy_label = format!("display-{}", output_id);
    let existing = app
        .get_webview_window(&window_label)
        .or_else(|| app.get_webview_window(&legacy_label));

    let monitors = app.available_monitors().map_err(AppError::Tauri)?;
    let primary = app.primary_monitor().ok().flatten();
    let chosen = pick_monitor(
        &monitors,
        primary.as_ref(),
        monitor_id.as_deref(),
        monitor_label.as_deref(),
    );
    let chosen_monitor = chosen.as_ref().map(|(_, monitor)| monitor.clone());

    if chosen_monitor.is_none() && (monitor_id.is_some() || monitor_label.is_some()) {
        tracing::warn!("monitor configurado não encontrado e nenhum secundário disponível; saída nativa não aberta para não cobrir tela principal");
        return Ok(());
    }

    if let Some(window) = existing {
        if let Some(monitor) = chosen_monitor {
            let position = monitor.position();
            let size = monitor.size();
            let already_there = window
                .outer_position()
                .map(|current| current.x == position.x && current.y == position.y)
                .unwrap_or(false);
            if !already_there {
                let _ = window.set_position(tauri::PhysicalPosition::new(position.x, position.y));
                let _ = window.set_size(tauri::PhysicalSize::new(size.width, size.height));
                let _ = window.set_fullscreen(true);
            }
        }
        return Ok(());
    }

    // Limpa a rota para garantir exatamente "index.html#/<path>", sem hashes duplicados ("##")
    let normalized = route
        .trim_start_matches('/')
        .trim_start_matches("index.html")
        .trim_start_matches('/')
        .trim_start_matches('#')
        .trim_start_matches('/');

    let clean_route = format!("index.html#/{}", normalized);

    let is_transparent = route.contains("stream") || route.contains("lower");

    let mut builder = WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App(clean_route.into()))
        .title(&title)
        .decorations(false)
        .resizable(true)
        .skip_taskbar(true)
        .focused(false)
        .visible(true)
        .transparent(is_transparent)
        .background_color(if is_transparent { Color(0, 0, 0, 0) } else { Color(0, 0, 0, 255) });

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
    let _ = window.show();

    let target = if route.contains("public") {
        Some(OutputTarget::Public)
    } else if route.contains("stage") {
        Some(OutputTarget::Stage)
    } else if route.contains("stream") || route.contains("lower") {
        Some(OutputTarget::Stream)
    } else {
        None
    };

    if let Some(target) = target {
        let state = app.state::<OutputsState>();
        let mon_str = chosen
            .as_ref()
            .map(|(_, monitor)| monitor_key(monitor))
            .or(monitor_id.clone());
        if state.set_open(target, true, mon_str) {
            let _ = app.emit(EVENT_OUTPUTS, state.snapshot());
        }

        let watcher_app = app.clone();
        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed = event {
                let state = watcher_app.state::<OutputsState>();
                if state.set_open(target, false, None) {
                    let _ = watcher_app.emit(EVENT_OUTPUTS, state.snapshot());
                }
            }
        });
    }

    Ok(())
}

pub fn close_native_output(app: &AppHandle, output_id: &str) -> Result<(), AppError> {
    let window_label = format!("output-{}", output_id);
    if let Some(window) = app.get_webview_window(&window_label) {
        window.close().map_err(AppError::Tauri)?;
    }
    let legacy_label = format!("display-{}", output_id);
    if let Some(window) = app.get_webview_window(&legacy_label) {
        window.close().map_err(AppError::Tauri)?;
    }
    reconcile_open_state(app);
    Ok(())
}
