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
use crate::state::PresentationState;
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
        .setup(|app| {
            let prefs_item = MenuItemBuilder::with_id("preferences", "Preferências…")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let new_song_item = MenuItemBuilder::with_id("new-song", "Nova Música")
                .accelerator("CmdOrCtrl+N")
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

            let file_menu = SubmenuBuilder::new(app, "Arquivo")
                .item(&new_song_item)
                .separator()
                .item(&import_holyrics_item)
                .separator()
                .close_window()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Editar")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .separator()
                .item(&prefs_item)
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &file_menu, &edit_menu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                match event.id().as_ref() {
                    "preferences" => {
                        let _ = crate::services::display_manager::open_preferences_window(app_handle);
                        let _ = app_handle.emit("open-preferences", ());
                    }
                    "new-song" => {
                        let _ = app_handle.emit("new-song", ());
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
            app.manage(database::Db(std::sync::Mutex::new(conn)));

            let server_state = crate::server::ServerState {
                broadcaster,
                ws_tx,
            };
            tauri::async_runtime::spawn(crate::server::serve(server_state));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::presentation::list_monitors,
            commands::presentation::open_output_window,
            commands::presentation::close_output_window,
            commands::presentation::open_preferences_window,
            commands::presentation::close_preferences_window,
            commands::presentation::go_live,
            commands::presentation::set_blackout,
            commands::presentation::get_live_slide,
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
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Open Presenter");
}
