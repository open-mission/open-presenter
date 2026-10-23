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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .register_asynchronous_uri_scheme_protocol("media", move |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            std::thread::spawn(move || {
                let response = match crate::services::theme_media::read_media(&app, request.uri()) {
                    Some((mime, bytes)) => tauri::http::Response::builder()
                        .status(tauri::http::StatusCode::OK)
                        .header(tauri::http::header::CONTENT_TYPE, mime)
                        .header("Access-Control-Allow-Origin", "*")
                        .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                        .header("Cache-Control", "public, max-age=3600")
                        .body(bytes)
                        .unwrap_or_else(|_| {
                            tauri::http::Response::builder()
                                .status(tauri::http::StatusCode::INTERNAL_SERVER_ERROR)
                                .body(Vec::new())
                                .unwrap()
                        }),
                    None => tauri::http::Response::builder()
                        .status(tauri::http::StatusCode::NOT_FOUND)
                        .body(Vec::new())
                        .unwrap(),
                };
                responder.respond(response);
            });
        })
        .manage(PresentationState::default())
        .manage(OutputsState::default())
        .manage(crate::services::ndi::NdiState::new())
        .setup(|app| {
            let prefs_item = MenuItemBuilder::with_id("preferences", "Preferências…")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let new_event_item = MenuItemBuilder::with_id("new-event", "Novo Culto / Evento…")
                .accelerator("CmdOrCtrl+E")
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
                .item(&new_event_item)
                .item(&new_song_item)
                .item(&search_online_item)
                .build()?;

            let quit_item = MenuItemBuilder::with_id("quit-app", "Sair")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "Arquivo")
                .item(&novo_menu)
                .separator()
                .item(&import_holyrics_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let whats_new_item = MenuItemBuilder::with_id("whats-new", "Novidades desta versão…")
                .build(app)?;

            let shortcuts_item = MenuItemBuilder::with_id("shortcuts", "Atalhos de Teclado…")
                .accelerator("CmdOrCtrl+/")
                .build(app)?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&whats_new_item)
                .separator()
                .item(&shortcuts_item)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Editar")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .separator()
                .select_all()
                .build()?;

            let next_slide_item = MenuItemBuilder::with_id("presentation-next", "Próximo Slide")
                .accelerator("Right")
                .build(app)?;

            let prev_slide_item = MenuItemBuilder::with_id("presentation-prev", "Slide Anterior")
                .accelerator("Left")
                .build(app)?;

            let blackout_item = MenuItemBuilder::with_id("presentation-blackout", "Tela Preta (Blackout)")
                .accelerator("CmdOrCtrl+B")
                .build(app)?;

            let clear_item = MenuItemBuilder::with_id("presentation-clear", "Limpar Texto")
                .accelerator("CmdOrCtrl+Shift+L")
                .build(app)?;

            let presentation_menu = SubmenuBuilder::new(app, "Apresentação")
                .item(&next_slide_item)
                .item(&prev_slide_item)
                .separator()
                .item(&blackout_item)
                .item(&clear_item)
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &file_menu, &edit_menu, &presentation_menu, &help_menu])
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
                    "whats-new" => {
                        let _ = app_handle.emit("whats-new", ());
                    }
                    "new-event" => {
                        let _ = app_handle.emit("new-event", ());
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
                    "presentation-next" => {
                        let _ = app_handle.emit("presentation-next", ());
                    }
                    "presentation-prev" => {
                        let _ = app_handle.emit("presentation-prev", ());
                    }
                    "presentation-blackout" => {
                        let _ = app_handle.emit("presentation-blackout", ());
                    }
                    "presentation-clear" => {
                        let _ = app_handle.emit("presentation-clear", ());
                    }
                    "quit-app" => {
                        let app = app_handle.clone();
                        use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
                        app.dialog()
                            .message("Deseja realmente sair do Open Presenter?")
                            .title("Sair do Open Presenter")
                            .kind(MessageDialogKind::Warning)
                            .buttons(MessageDialogButtons::OkCancelCustom(
                                "Sair".to_string(),
                                "Cancelar".to_string(),
                            ))
                            .show(move |confirmed| {
                                if confirmed {
                                    app.exit(0);
                                }
                            });
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

            let remote_token = crate::services::settings::get_setting(&conn, "remote.token")
                .ok()
                .flatten()
                .unwrap_or_default();
            let remote_enabled = crate::services::settings::get_setting(&conn, "remote.enabled")
                .ok()
                .flatten()
                .map(|value| value != "false")
                .unwrap_or(true);
            let remote_state: crate::state::SharedRemoteState =
                std::sync::Arc::new(std::sync::Mutex::new(crate::state::RemoteSettings {
                    enabled: remote_enabled,
                    token: remote_token,
                    setlist: None,
                }));
            app.manage(remote_state.clone());

            let db = database::Db::new(conn);
            app.manage(db.clone());

            // Carrega e hidrata o evento ativo configurado no SQLite (se houver),
            // tornando o motor de apresentação e a API imediatamente funcionais
            // mesmo sem abrir o painel de controle (modo autônomo / headless).
            let _ = db.with_conn(|conn| {
                crate::services::setlists::reload_active_event(
                    conn,
                    Some(&handle),
                    &remote_state,
                    &broadcaster,
                )
            });

            if let Some(window) = app.get_webview_window("main") {
                crate::services::window_state::apply_startup_geometry(&window);
            }

            let timeout_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(2500)).await;
                if let Some(window) = timeout_handle.get_webview_window("main") {
                    if !window.is_visible().unwrap_or(false) {
                        crate::services::window_state::apply_startup_geometry(&window);
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });

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
                remote: remote_state.clone(),
                db: Some(db),
                app_handle: Some(app.handle().clone()),
            };
            app.manage(clients);
            app.manage(std::sync::Mutex::new(
                crate::server::ServerControl::stopped(port, server_state),
            ));
            if let Err(err) = crate::services::tray::init(app.handle()) {
                tracing::error!(%err, "não foi possível criar o ícone da bandeja");
            }
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
                crate::services::tray::refresh(&server_handle);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::presentation::show_main_window,
            commands::presentation::list_monitors,
            commands::presentation::open_output_window,
            commands::presentation::close_output_window,
            commands::presentation::open_preferences_window,
            commands::presentation::close_preferences_window,
            commands::presentation::open_shortcuts_window,
            commands::presentation::close_shortcuts_window,
            commands::presentation::open_communication_window,
            commands::presentation::close_communication_window,
            commands::presentation::open_displays_window,
            commands::presentation::close_displays_window,
            commands::presentation::open_theme_editor,
            commands::presentation::close_theme_editor,
            commands::presentation::send_stage_message,
            commands::presentation::clear_stage_message,
            commands::presentation::get_stage_message,
            commands::outputs::get_output_config,
            commands::outputs::set_output_config,
            commands::outputs::get_public_wallpaper,
            commands::outputs::set_public_wallpaper,
            commands::outputs::get_outputs_state,
            commands::outputs::get_display_outputs,
            commands::outputs::save_display_outputs,
            commands::outputs::get_displays_settings,
            commands::outputs::save_displays_settings,
            commands::outputs::identify_displays,
            commands::outputs::open_native_output,
            commands::outputs::close_native_output,
            commands::ndi::get_ndi_status,
            commands::ndi::set_ndi_active,
            commands::server::get_server_status,
            commands::server::set_server_port,
            commands::server::stop_server,
            commands::server::start_server,
            commands::server::get_connected_clients,
            commands::server::get_remote_clients,
            commands::preferences::get_close_to_tray,
            commands::preferences::set_close_to_tray,
            commands::preferences::get_start_maximized,
            commands::preferences::set_start_maximized,
            commands::presentation::go_live,
            commands::presentation::set_blackout,
            commands::presentation::get_live_slide,
            commands::presentation::set_live_output_plans,
            commands::presentation::get_live_output_plans,
            commands::presentation::timer_start,
            commands::presentation::timer_pause,
            commands::presentation::timer_reset,
            commands::presentation::timer_set_countdown,
            commands::presentation::get_stage_timer,
            commands::presentation::get_server_host,
            commands::setlists::list_events,
            commands::setlists::get_event,
            commands::setlists::get_temporary_event,
            commands::setlists::create_event,
            commands::setlists::save_event,
            commands::setlists::delete_event,
            commands::setlists::get_active_event_id,
            commands::setlists::set_active_event_id,
            commands::songs::list_songs,
            commands::songs::get_song,
            commands::songs::save_song,
            commands::songs::delete_song,
            commands::songs::open_song_editor,
            commands::songs::close_song_editor,
            commands::songs::import_holyrics,
            commands::songs::search_lyrics_online,
            commands::songs::fetch_online_lyrics,
            commands::songs::parse_lyrics,
            commands::songs::lyrics_to_text,
            commands::songs::get_song_defaults,
            commands::songs::set_song_defaults,
            commands::themes::list_themes,
            commands::themes::get_theme,
            commands::themes::save_theme,
            commands::themes::delete_theme,
            commands::themes::save_theme_media,
            commands::media::import_media_file,
            commands::media::import_media_folder,
            commands::media::open_media_library,
            commands::media::list_image_library,
            commands::media::import_images_folder,
            commands::media::open_images_folder,
            commands::remote::get_remote_config,
            commands::remote::set_remote_token,
            commands::remote::set_remote_enabled,
            commands::remote::set_remote_setlist,
            commands::bible::list_bible_versions,
            commands::bible::import_bible,
            commands::bible::get_bible_books,
            commands::bible::get_bible_chapter,
            commands::bible::search_bible_verses,
            commands::bible::compare_bible_verse,
            commands::bible::delete_bible,
        ])
        .on_window_event(|window, event| {
            if matches!(
                event,
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_)
            ) {
                crate::services::window_state::save_geometry(window);
                return;
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    crate::services::window_state::save_geometry(window);
                    api.prevent_close();
                    let app = window.app_handle().clone();
                    if crate::commands::preferences::close_to_tray(&app)
                        && crate::services::tray::is_available(&app)
                    {
                        let _ = window.hide();
                        return;
                    }
                    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
                    app.dialog()
                        .message("Deseja realmente sair do Open Presenter?")
                        .title("Sair do Open Presenter")
                        .kind(MessageDialogKind::Warning)
                        .buttons(MessageDialogButtons::OkCancelCustom(
                            "Sair".to_string(),
                            "Cancelar".to_string(),
                        ))
                        .show(move |confirmed| {
                            if confirmed {
                                app.exit(0);
                            }
                        });
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("erro ao iniciar o Open Presenter")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app, event);
            }
        });
}
