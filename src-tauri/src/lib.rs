pub mod commands;
pub mod error;
pub mod server;
pub mod services;
pub mod state;

use tauri::Manager;
use tokio::sync::broadcast;

use crate::services::{Broadcaster, SharedBroadcaster};
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

            if let Err(err) = crate::services::database::init_database(&handle) {
                tracing::warn!(error = %err, "banco SQLite indisponível; seguindo sem persistência");
            }

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
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Open Presenter");
}
