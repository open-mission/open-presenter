use tauri::AppHandle;

use crate::error::AppError;
use crate::services::media_library::{self, ImageTreeNode, ImportedFolder, ImportedMedia};

#[tauri::command]
pub fn import_media_file(
    app: AppHandle,
    path: String,
    kind: String,
) -> Result<ImportedMedia, AppError> {
    media_library::import_file(&app, &path, &kind)
}

#[tauri::command]
pub fn import_media_folder(app: AppHandle, path: String) -> Result<ImportedFolder, AppError> {
    media_library::import_folder(&app, &path)
}

#[tauri::command]
pub fn open_media_library(app: AppHandle) -> Result<(), AppError> {
    media_library::open_library(&app)
}

#[tauri::command]
pub fn list_image_library(app: AppHandle) -> Result<Vec<ImageTreeNode>, AppError> {
    media_library::list_images(&app)
}

#[tauri::command]
pub fn list_backgrounds_library(app: AppHandle) -> Result<Vec<ImageTreeNode>, AppError> {
    media_library::list_backgrounds(&app)
}

#[tauri::command]
pub fn list_video_library(app: AppHandle) -> Result<Vec<ImageTreeNode>, AppError> {
    media_library::list_videos(&app)
}

#[tauri::command]
pub fn list_audio_library(app: AppHandle) -> Result<Vec<ImageTreeNode>, AppError> {
    media_library::list_audios(&app)
}

#[tauri::command]
pub fn create_media_folder(
    app: AppHandle,
    library: String,
    parent_path: String,
    name: String,
) -> Result<String, AppError> {
    media_library::create_media_folder(&app, &library, &parent_path, &name)
}

#[tauri::command]
pub fn import_media_files(
    app: AppHandle,
    library: String,
    subfolder: Option<String>,
    files: Vec<String>,
) -> Result<Vec<ImportedMedia>, AppError> {
    media_library::import_files_to_library(&app, &library, subfolder.as_deref(), &files)
}

#[tauri::command]
pub fn open_library_folder(app: AppHandle, library: String) -> Result<(), AppError> {
    media_library::open_library_folder(&app, &library)
}

#[tauri::command]
pub fn import_images_folder(app: AppHandle, path: String) -> Result<String, AppError> {
    media_library::import_images_folder(&app, &path)
}

#[tauri::command]
pub fn open_images_folder(app: AppHandle) -> Result<(), AppError> {
    media_library::open_images_folder(&app)
}
