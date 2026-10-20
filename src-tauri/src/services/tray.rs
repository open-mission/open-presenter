use std::sync::Mutex;

use tauri::menu::{MenuBuilder, MenuEvent, MenuItem, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_opener::OpenerExt;

use crate::server::ServerControl;
use crate::services::database::Db;
use crate::services::settings;
use crate::state::types::{OutputConfig, OutputMode, OutputTarget, OUTPUT_HTTP_PORT};
use crate::state::SharedRemoteState;

const TRAY_ID: &str = "main-tray";

#[derive(Clone, Copy, PartialEq, Eq)]
enum AccessTarget {
    Public,
    Stage,
    Remote,
}

struct TrayMenuState {
    status: MenuItem<Wry>,
    public: MenuItem<Wry>,
    stage: MenuItem<Wry>,
    remote: MenuItem<Wry>,
    restart: MenuItem<Wry>,
}

pub fn init(app: &AppHandle) -> tauri::Result<()> {
    let status = MenuItemBuilder::with_id("tray-status", "Servidor parado")
        .enabled(false)
        .build(app)?;
    let public = MenuItemBuilder::with_id("tray-open-public", "Público")
        .enabled(false)
        .build(app)?;
    let stage = MenuItemBuilder::with_id("tray-open-stage", "Palco")
        .enabled(false)
        .build(app)?;
    let remote = MenuItemBuilder::with_id("tray-open-remote", "Controle remoto")
        .enabled(false)
        .build(app)?;

    let links = SubmenuBuilder::new(app, "Links de acesso")
        .items(&[&public, &stage, &remote])
        .build()?;

    let show = MenuItemBuilder::with_id("tray-show", "Abrir Open Presenter").build(app)?;
    let restart = MenuItemBuilder::with_id("tray-restart-server", "Iniciar servidor").build(app)?;
    let preferences = MenuItemBuilder::with_id("tray-preferences", "Preferências…").build(app)?;
    let quit = MenuItemBuilder::with_id("tray-quit", "Sair do Open Presenter").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show)
        .item(&status)
        .separator()
        .item(&links)
        .item(&restart)
        .item(&preferences)
        .separator()
        .item(&quit)
        .build()?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Open Presenter")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(handle_menu_event)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    #[cfg(target_os = "macos")]
    {
        let icon =
            tauri::image::Image::from_bytes(include_bytes!("../../icons/tray-icon.png"))?;
        builder = builder.icon(icon).icon_as_template(true);
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Some(icon) = app.default_window_icon() {
            builder = builder.icon(icon.clone());
        }
    }

    builder.build(app)?;

    app.manage(TrayMenuState {
        status,
        public,
        stage,
        remote,
        restart,
    });

    refresh(app);
    Ok(())
}

pub fn is_available(app: &AppHandle) -> bool {
    app.tray_by_id(TRAY_ID).is_some()
}

pub fn refresh(app: &AppHandle) {
    let Some(menu) = app.try_state::<TrayMenuState>() else {
        return;
    };
    let (running, port) = server_snapshot(app);

    let status = if running {
        format!("Servidor ativo · porta {port}")
    } else {
        "Servidor parado".to_string()
    };
    let restart = if running {
        "Reiniciar servidor".to_string()
    } else {
        "Iniciar servidor".to_string()
    };

    let _ = menu.status.set_text(status);
    let _ = menu.restart.set_text(restart);
    let _ = menu
        .public
        .set_enabled(running && output_active(app, OutputTarget::Public));
    let _ = menu
        .stage
        .set_enabled(running && output_active(app, OutputTarget::Stage));
    let _ = menu.remote.set_enabled(running && remote_enabled(app));

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let tooltip = if running {
            format!("Open Presenter — servidor ativo na porta {port}")
        } else {
            "Open Presenter — servidor parado".to_string()
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

fn handle_menu_event(app: &AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
        "tray-show" => show_main(app),
        "tray-open-public" => open_access_url(app, AccessTarget::Public),
        "tray-open-stage" => open_access_url(app, AccessTarget::Stage),
        "tray-open-remote" => open_access_url(app, AccessTarget::Remote),
        "tray-restart-server" => restart_server(app),
        "tray-preferences" => {
            let _ = crate::services::display_manager::open_preferences_window(app);
            let _ = app.emit("open-preferences", ());
        }
        "tray-quit" => app.exit(0),
        _ => {}
    }
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn restart_server(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let control = app.state::<Mutex<ServerControl>>();
        let result = crate::commands::server::start_server(app.clone(), control).await;
        let _ = crate::services::tray::refresh(&app);
        if let Err(err) = result {
            tracing::error!(%err, "falha ao reiniciar o servidor pela bandeja");
            use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
            app.dialog()
                .message(format!(
                    "Não foi possível reiniciar o servidor local:\n{err}"
                ))
                .title("Open Presenter")
                .kind(MessageDialogKind::Error)
                .show(|_| {});
        }
    });
}

fn open_access_url(app: &AppHandle, target: AccessTarget) {
    let Some(url) = access_url(app, target) else {
        return;
    };
    if let Err(err) = app.opener().open_url(url, None::<&str>) {
        tracing::error!(%err, "falha ao abrir link de acesso pela bandeja");
    }
}

fn access_url(app: &AppHandle, target: AccessTarget) -> Option<String> {
    let (running, port) = server_snapshot(app);
    if !running {
        return None;
    }

    let host = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    let token = if target == AccessTarget::Remote {
        if let Some(state) = app.try_state::<SharedRemoteState>() {
            state
                .lock()
                .ok()
                .map(|guard| guard.token.clone())
                .unwrap_or_default()
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    Some(build_access_url(&host, port, target, &token))
}

fn build_access_url(host: &str, port: u16, target: AccessTarget, token: &str) -> String {
    match target {
        AccessTarget::Public => format!("http://{host}:{port}/#/public"),
        AccessTarget::Stage => format!("http://{host}:{port}/#/stage"),
        AccessTarget::Remote => {
            let base = format!("http://{host}:{port}/#/remote");
            if token.is_empty() {
                base
            } else {
                let token = percent_encoding::utf8_percent_encode(
                    token,
                    percent_encoding::NON_ALPHANUMERIC,
                );
                format!("{base}?token={token}")
            }
        }
    }
}

fn server_snapshot(app: &AppHandle) -> (bool, u16) {
    if let Some(control) = app.try_state::<Mutex<ServerControl>>() {
        if let Ok(guard) = control.lock() {
            return (guard.running, guard.port);
        }
    }
    (false, OUTPUT_HTTP_PORT)
}

fn output_active(app: &AppHandle, target: OutputTarget) -> bool {
    let key = match target {
        OutputTarget::Public => "outputs.public",
        OutputTarget::Stage => "outputs.stage",
    };
    let Some(db) = app.try_state::<Db>() else {
        return false;
    };
    db.with_conn(|conn| settings::get_setting(conn, key))
        .ok()
        .flatten()
        .and_then(|raw| serde_json::from_str::<OutputConfig>(&raw).ok())
        .map(|config| config.mode != OutputMode::Off)
        .unwrap_or(false)
}

fn remote_enabled(app: &AppHandle) -> bool {
    if let Some(state) = app.try_state::<SharedRemoteState>() {
        if let Ok(guard) = state.lock() {
            return guard.enabled;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn monta_urls_de_acesso_com_host_porta_e_token() {
        assert_eq!(
            build_access_url("192.168.0.10", 5050, AccessTarget::Public, ""),
            "http://192.168.0.10:5050/#/public"
        );
        assert_eq!(
            build_access_url("192.168.0.10", 5050, AccessTarget::Stage, ""),
            "http://192.168.0.10:5050/#/stage"
        );
        assert_eq!(
            build_access_url("192.168.0.10", 5050, AccessTarget::Remote, ""),
            "http://192.168.0.10:5050/#/remote"
        );
        assert_eq!(
            build_access_url("192.168.0.10", 5050, AccessTarget::Remote, "abc-123"),
            "http://192.168.0.10:5050/#/remote?token=abc%2D123"
        );
    }
}
