use tauri::State;
use crate::error::AppError;
use crate::services::ndi::{self, NdiState, NdiStatus};

#[tauri::command]
pub fn get_ndi_status(ndi: State<'_, NdiState>) -> Result<NdiStatus, AppError> {
    Ok(ndi::get_status(&ndi))
}

#[tauri::command]
pub fn set_ndi_active(ndi: State<'_, NdiState>, active: bool) -> Result<NdiStatus, AppError> {
    ndi.set_active(active);
    Ok(ndi::get_status(&ndi))
}
