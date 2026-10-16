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
