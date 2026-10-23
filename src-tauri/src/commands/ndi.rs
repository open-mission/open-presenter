use std::time::Duration;

use tauri::State;
use crate::error::AppError;
use crate::services::ndi::{self, NdiState, NdiStatus};
use crate::services::ndi_input::{self, NdiInputState, NdiInputStatus};

#[tauri::command]
pub fn get_ndi_status(ndi: State<'_, NdiState>) -> Result<NdiStatus, AppError> {
    Ok(ndi::get_status(&ndi))
}

#[tauri::command]
pub fn set_ndi_active(ndi: State<'_, NdiState>, active: bool) -> Result<NdiStatus, AppError> {
    ndi.set_active(active);
    Ok(ndi::get_status(&ndi))
}

#[tauri::command]
pub async fn list_ndi_sources() -> Result<Vec<String>, AppError> {
    tauri::async_runtime::spawn_blocking(|| ndi_input::list_sources(Duration::from_secs(2)))
        .await
        .map_err(|e| AppError::Storage(e.to_string()))?
        .map_err(AppError::Storage)
}

#[tauri::command]
pub fn get_ndi_input_status(input: State<'_, NdiInputState>) -> Result<NdiInputStatus, AppError> {
    Ok(input.status())
}

#[tauri::command]
pub async fn start_ndi_input(
    input: State<'_, NdiInputState>,
    source: String,
) -> Result<NdiInputStatus, AppError> {
    input.start(source).map_err(AppError::Storage)?;
    Ok(input.status())
}

#[tauri::command]
pub async fn stop_ndi_input(input: State<'_, NdiInputState>) -> Result<NdiInputStatus, AppError> {
    input.stop();
    Ok(input.status())
}
