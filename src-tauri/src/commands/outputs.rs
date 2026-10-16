use tauri::{AppHandle, Manager, State};

use crate::error::AppError;
use crate::services::database::Db;
use crate::services::settings;
use crate::state::outputs::OutputsState;
use crate::state::types::{OutputConfig, OutputRuntime, OutputTarget};

fn config_key(target: OutputTarget) -> &'static str {
    match target {
        OutputTarget::Public => "outputs.public",
        OutputTarget::Stage => "outputs.stage",
    }
}

#[tauri::command]
pub fn get_output_config(
    db: State<'_, Db>,
    target: OutputTarget,
) -> Result<OutputConfig, AppError> {
    let raw: Option<String> = db.with_conn(|conn| settings::get_setting(conn, config_key(target)))?;
    match raw {
        Some(json) => serde_json::from_str(&json).map_err(|e| AppError::Storage(e.to_string())),
        None => Ok(OutputConfig::off(target)),
    }
}

#[tauri::command]
pub fn set_output_config(
    app: AppHandle,
    db: State<'_, Db>,
    config: OutputConfig,
) -> Result<(), AppError> {
    let json = serde_json::to_string(&config).map_err(|e| AppError::Storage(e.to_string()))?;
    let target = config.target;
    db.with_conn(|conn| settings::set_setting(conn, config_key(target), &json))?;
    app.state::<OutputsState>().set_config(target, config);
    Ok(())
}

#[tauri::command]
pub fn get_outputs_state(
    app: AppHandle,
    outputs: State<'_, OutputsState>,
) -> Result<Vec<OutputRuntime>, AppError> {
    crate::services::display_manager::reconcile_open_state(&app);
    Ok(outputs.snapshot())
}
