pub mod commands;
pub mod error;
pub mod server;
pub mod services;
pub mod state;

use rusqlite::Connection;
use tauri::Manager;
use tokio::sync::broadcast;

use crate::error::AppError;
use crate::services::{database, Broadcaster, SharedBroadcaster};
use crate::state::{OutputsState, PresentationState};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("open_presenter=info".parse().unwrap()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(PresentationState::default())
        .manage(OutputsState::default())
        .setup(|app| {
            let prefs_item = MenuItemBuilder::with_id("preferences", "Preferências…")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let new_song_item = MenuItemBuilder::with_id("new-song", "Nova Música")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;

            let search_online_item = MenuItemBuilder::with_id("search-online-lyrics", "Buscar Música na Internet…")
                .accelerator("CmdOrCtrl+Shift+F")
                .build(app)?;

            let import_holyrics_item = MenuItemBuilder::with_id("import-holyrics", "Importar Músicas do Holyrics…")
                .build(app)?;

            let app_menu = SubmenuBuilder::new(app, "Open Presenter")
                .about(None)
                .separator()
                .item(&prefs_item)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let novo_menu = SubmenuBuilder::new(app, "Novo")
                .item(&new_song_item)
                .item(&search_online_item)
                .build()?;

            let file_menu = SubmenuBuilder::new(app, "Arquivo")
                .item(&novo_menu)
                .separator()
                .item(&import_holyrics_item)
                .separator()
                .close_window()
                .build()?;

            let shortcuts_item = MenuItemBuilder::with_id("shortcuts", "Atalhos de Teclado…")
                .accelerator("CmdOrCtrl+/")
                .build(app)?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&shortcuts_item)
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &file_menu, &novo_menu, &help_menu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                match event.id().as_ref() {
                    "preferences" => {
                        let _ = crate::services::display_manager::open_preferences_window(app_handle);
                        let _ = app_handle.emit("open-preferences", ());
                    }
                    "shortcuts" => {
                        let _ = crate::services::display_manager::open_shortcuts_window(app_handle);
                        let _ = app_handle.emit("open-shortcuts", ());
                    }
                    "new-song" => {
                        let _ = app_handle.emit("new-song", ());
                    }
                    "search-online-lyrics" => {
                        let _ = app_handle.emit("search-online-lyrics", ());
                    }
                    "import-holyrics" => {
                        let _ = app_handle.emit("import-holyrics", ());
                    }
                    _ => {}
                }
            });
            let handle = app.handle().clone();
            let (ws_tx, _) = broadcast::channel::<String>(64);
            let broadcaster: SharedBroadcaster =
                std::sync::Arc::new(Broadcaster::new(handle.clone(), ws_tx.clone()));
            app.manage(broadcaster.clone());

            let conn = database::open(&handle).or_else(|err| -> Result<Connection, AppError> {
                tracing::warn!(error = %err, "banco SQLite indisponível; seguindo sem persistência");
                let conn = Connection::open_in_memory()
                    .map_err(|e| AppError::Storage(e.to_string()))?;
                database::migrate(&conn)?;
                Ok(conn)
            })?;
            let port = crate::commands::server::parse_port(
                conn.query_row(
                    "SELECT value FROM settings WHERE key = 'server.port'",
                    [],
                    |r| r.get::<_, String>(0),
                )
                .ok(),
            );

            let public_cfg_raw: Option<String> = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'outputs.public'",
                    [],
                    |r| r.get::<_, String>(0),
                )
                .ok();
            if let Some(json) = public_cfg_raw {
                if let Ok(cfg) = serde_json::from_str::<crate::state::types::OutputConfig>(&json) {
                    if let Some(wp) = cfg.wallpaper {
                        broadcaster.publish_wallpaper(Some(wp));
                    }
                }
            }

            app.manage(database::Db(std::sync::Mutex::new(conn)));

            let media_dir = crate::services::theme_media::media_base_dir(&handle)
                .unwrap_or_else(|_| std::path::PathBuf::from("theme-media"));
            let clients: crate::server::Clients = std::sync::Arc::new(
                std::sync::Mutex::new(std::collections::HashMap::new()),
            );
            let server_state = crate::server::ServerState {
                broadcaster,
                ws_tx,
                media_dir,
                clients: clients.clone(),
            };
            app.manage(clients);
            app.manage(std::sync::Mutex::new(
                crate::server::ServerControl::stopped(port, server_state),
            ));
            let server_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use tauri::Manager;
                let control = server_handle.state::<std::sync::Mutex<crate::server::ServerControl>>();
                let state = control
                    .lock()
                    .ok()
                    .and_then(|guard| guard.state.clone());
                let Some(state) = state else {
                    return;
                };
                match crate::server::bind(port).await {
                    Ok(listener) => {
                        tracing::info!(port, "servidor de saídas escutando");
                        let handle =
                            crate::server::spawn_with_listener(state, listener);
                        if let Ok(mut guard) = control.lock() {
                            guard.handle = Some(handle);
                            guard.running = true;
                        }
                    }
                    Err(err) => {
                        tracing::error!(
                            %err,
                            "porta do servidor de saídas indisponível; seguindo sem servidor local"
                        );
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::presentation::list_monitors,
            commands::presentation::open_output_window,
            commands::presentation::close_output_window,
            commands::presentation::open_preferences_window,
            commands::presentation::close_preferences_window,
            commands::presentation::open_shortcuts_window,
            commands::presentation::close_shortcuts_window,
            commands::presentation::open_theme_editor,
            commands::outputs::get_output_config,
            commands::outputs::set_output_config,
            commands::outputs::get_public_wallpaper,
            commands::outputs::get_outputs_state,
            commands::server::get_server_status,
            commands::server::set_server_port,
            commands::server::stop_server,
            commands::server::start_server,
            commands::server::get_connected_clients,
            commands::presentation::go_live,
            commands::presentation::set_blackout,
            commands::presentation::get_live_slide,
            commands::presentation::set_live_themes,
            commands::presentation::get_live_themes,
            commands::presentation::timer_start,
            commands::presentation::timer_pause,
            commands::presentation::timer_reset,
            commands::presentation::get_stage_timer,
            commands::presentation::get_server_host,
            commands::setlists::list_events,
            commands::setlists::get_event,
            commands::setlists::create_event,
            commands::setlists::save_event,
            commands::setlists::delete_event,
            commands::songs::list_songs,
            commands::songs::get_song,
            commands::songs::save_song,
            commands::songs::delete_song,
            commands::songs::import_holyrics,
            commands::songs::search_lyrics_online,
            commands::songs::fetch_online_lyrics,
            commands::songs::parse_lyrics,
            commands::songs::lyrics_to_text,
            commands::themes::list_themes,
            commands::themes::get_theme,
            commands::themes::save_theme,
            commands::themes::delete_theme,
            commands::themes::save_theme_media,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Open Presenter");
}
