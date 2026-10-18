use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::error::AppError;
use crate::services::theme_media;

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"];
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "webm", "mov", "m4v", "ogv", "ogg"];
const MAX_FOLDER_FILES: usize = 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedMedia {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedFolder {
    pub path: String,
    pub name: String,
    pub files: Vec<ImportedMedia>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ImageNodeKind {
    Folder,
    Image,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageTreeNode {
    pub name: String,
    pub path: String,
    pub kind: ImageNodeKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<ImageTreeNode>,
}

fn storage_error(err: std::io::Error) -> AppError {
    AppError::Storage(err.to_string())
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default()
}

fn is_image(path: &Path) -> bool {
    IMAGE_EXTENSIONS.contains(&extension(path).as_str())
}

fn is_video(path: &Path) -> bool {
    VIDEO_EXTENSIONS.contains(&extension(path).as_str())
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0)
}

fn sanitize_component(value: &str, fallback: &str) -> String {
    theme_media::sanitize_filename(value).unwrap_or_else(|_| fallback.to_string())
}

fn unique_path(dir: &Path, filename: &str) -> PathBuf {
    let candidate = dir.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let path = Path::new(filename);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("media");
    let ext = path.extension().and_then(|value| value.to_str()).unwrap_or("");

    for index in 1..=10_000 {
        let name = if ext.is_empty() {
            format!("{stem}_{index}")
        } else {
            format!("{stem}_{index}.{ext}")
        };
        let candidate = dir.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }

    if ext.is_empty() {
        dir.join(format!("{stem}_{}", now_seconds()))
    } else {
        dir.join(format!("{stem}_{}.{}", now_seconds(), ext))
    }
}

fn unique_dir(base: &Path, name: &str) -> PathBuf {
    let candidate = base.join(name);
    if !candidate.exists() {
        return candidate;
    }
    for index in 1..=10_000 {
        let candidate = base.join(format!("{name}-{index}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    base.join(format!("{name}-{}", now_seconds()))
}

fn library_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = theme_media::media_base_dir(app)?.join("library");
    std::fs::create_dir_all(&dir).map_err(storage_error)?;
    Ok(dir)
}

fn kind_dir(kind: &str) -> Result<&'static str, AppError> {
    match kind {
        "image" => Ok("images"),
        "video" => Ok("videos"),
        _ => Err(AppError::Storage(
            "tipo de mídia inválido (use image ou video)".into(),
        )),
    }
}

fn media_uri(relative: &str) -> String {
    format!("media://library/{relative}")
}

pub fn import_file(
    app: &AppHandle,
    source: &str,
    kind: &str,
) -> Result<ImportedMedia, AppError> {
    let source = Path::new(source);
    if !source.is_file() {
        return Err(AppError::NotFound("arquivo de mídia não encontrado".into()));
    }

    let (allowed, subdir) = match kind {
        "image" => (is_image(source), kind_dir("image")?),
        "video" => (is_video(source), kind_dir("video")?),
        _ => {
            return Err(AppError::Storage(
                "tipo de mídia inválido (use image ou video)".into(),
            ))
        }
    };
    if !allowed {
        return Err(AppError::Storage(
            "extensão de arquivo não suportada para este tipo de mídia".into(),
        ));
    }

    let original_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("midia");
    let library = library_dir(app)?;

    if let (Ok(source_canonical), Ok(library_canonical)) =
        (source.canonicalize(), library.canonicalize())
    {
        if let Ok(relative) = source_canonical.strip_prefix(&library_canonical) {
            let relative = relative.to_string_lossy().replace('\\', "/");
            return Ok(ImportedMedia {
                path: media_uri(&relative),
                name: original_name.to_string(),
            });
        }
    }

    let safe_name = sanitize_component(original_name, "midia");
    let dir = library.join(subdir);
    std::fs::create_dir_all(&dir).map_err(storage_error)?;

    let target = unique_path(&dir, &safe_name);
    std::fs::copy(source, &target).map_err(storage_error)?;

    let filename = target
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::Storage("nome de arquivo inválido".into()))?;

    Ok(ImportedMedia {
        path: media_uri(&format!("{subdir}/{filename}")),
        name: original_name.to_string(),
    })
}

fn collect_images(dir: &Path, output: &mut Vec<PathBuf>) -> std::io::Result<()> {
    if output.len() >= MAX_FOLDER_FILES {
        return Ok(());
    }

    let mut entries = std::fs::read_dir(dir)?.collect::<Result<Vec<_>, _>>()?;
    entries.sort_by_key(|entry| {
        entry
            .file_name()
            .to_string_lossy()
            .to_ascii_lowercase()
    });

    for entry in entries {
        if output.len() >= MAX_FOLDER_FILES {
            break;
        }
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            collect_images(&path, output)?;
        } else if file_type.is_file() && is_image(&path) {
            output.push(path);
        }
    }

    Ok(())
}

pub fn import_folder(app: &AppHandle, source: &str) -> Result<ImportedFolder, AppError> {
    let source = Path::new(source);
    if !source.is_dir() {
        return Err(AppError::NotFound("pasta de imagens não encontrada".into()));
    }

    let mut images = Vec::new();
    collect_images(source, &mut images).map_err(storage_error)?;

    if images.is_empty() {
        return Err(AppError::Storage(
            "a pasta selecionada não contém imagens suportadas".into(),
        ));
    }

    let original_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Pasta de imagens");
    let folder_name = sanitize_component(original_name, "pasta");
    let images_root = images_dir(app)?;
    let target_dir = unique_dir(&images_root, &folder_name);
    std::fs::create_dir_all(&target_dir).map_err(storage_error)?;

    let safe_dir_name = target_dir
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::Storage("nome de pasta inválido".into()))?;

    let mut files = Vec::with_capacity(images.len());
    for (index, image) in images.iter().enumerate() {
        let original = image
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("imagem");
        let safe_name = sanitize_component(original, "imagem");
        let filename = format!("{:03}_{}", index + 1, safe_name);
        let target = target_dir.join(&filename);
        std::fs::copy(image, &target).map_err(storage_error)?;
        files.push(ImportedMedia {
            path: media_uri(&format!("images/{safe_dir_name}/{filename}")),
            name: original.to_string(),
        });
    }

    Ok(ImportedFolder {
        path: media_uri(&format!("images/{safe_dir_name}")),
        name: original_name.to_string(),
        files,
    })
}

pub fn open_library(app: &AppHandle) -> Result<(), AppError> {
    let dir = library_dir(app)?;
    app.opener()
        .open_path(dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|err| AppError::Storage(format!("falha ao abrir a pasta de mídias: {err}")))
}

pub fn images_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = library_dir(app)?.join("images");
    std::fs::create_dir_all(&dir).map_err(storage_error)?;
    Ok(dir)
}

fn relative_name(parent: &Path, name: &str) -> String {
    if parent.as_os_str().is_empty() {
        name.to_string()
    } else {
        format!(
            "{}/{}",
            parent.to_string_lossy().replace('\\', "/"),
            name
        )
    }
}

fn build_image_tree(
    base: &Path,
    current: &Path,
    depth: usize,
    budget: &mut usize,
) -> std::io::Result<Vec<ImageTreeNode>> {
    if *budget == 0 || depth > 32 {
        return Ok(Vec::new());
    }

    let dir = base.join(current);
    let mut entries = std::fs::read_dir(&dir)?.collect::<Result<Vec<_>, _>>()?;
    entries.sort_by_key(|entry| {
        let is_file = entry.file_type().map(|kind| kind.is_file()).unwrap_or(true);
        (is_file, entry.file_name().to_string_lossy().to_ascii_lowercase())
    });

    let mut nodes = Vec::new();
    for entry in entries {
        if *budget == 0 {
            break;
        }
        let file_type = entry.file_type()?;
        let name = entry.file_name().to_string_lossy().to_string();
        let path = relative_name(current, &name);

        if file_type.is_dir() {
            *budget -= 1;
            let children = build_image_tree(base, Path::new(&path), depth + 1, budget)?;
            nodes.push(ImageTreeNode {
                name,
                path,
                kind: ImageNodeKind::Folder,
                url: None,
                children,
            });
        } else if file_type.is_file() && is_image(&entry.path()) {
            *budget -= 1;
            nodes.push(ImageTreeNode {
                name,
                path: path.clone(),
                kind: ImageNodeKind::Image,
                url: Some(media_uri(&format!("images/{path}"))),
                children: Vec::new(),
            });
        }
    }

    Ok(nodes)
}

pub fn list_images_in_dir(root: &Path) -> Result<Vec<ImageTreeNode>, AppError> {
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut budget = 5000;
    build_image_tree(root, Path::new(""), 0, &mut budget).map_err(storage_error)
}

pub fn list_images(app: &AppHandle) -> Result<Vec<ImageTreeNode>, AppError> {
    let root = images_dir(app)?;
    list_images_in_dir(&root)
}

fn copy_images_tree(
    source: &Path,
    target: &Path,
    budget: &mut usize,
) -> Result<(), AppError> {
    if *budget == 0 {
        return Ok(());
    }
    std::fs::create_dir_all(target).map_err(storage_error)?;

    let mut entries = std::fs::read_dir(source)
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;
    entries.sort_by_key(|entry| entry.file_name().to_string_lossy().to_ascii_lowercase());

    for entry in entries {
        if *budget == 0 {
            break;
        }
        let file_type = entry.file_type().map_err(storage_error)?;
        let original = entry.file_name().to_string_lossy().to_string();

        if file_type.is_dir() {
            *budget -= 1;
            let safe = sanitize_component(&original, "pasta");
            let child_target = unique_dir(target, &safe);
            copy_images_tree(&entry.path(), &child_target, budget)?;
        } else if file_type.is_file() && is_image(&entry.path()) {
            *budget -= 1;
            let safe = sanitize_component(&original, "imagem");
            let destination = unique_path(target, &safe);
            std::fs::copy(entry.path(), destination).map_err(storage_error)?;
        }
    }

    Ok(())
}

pub fn import_images_folder(app: &AppHandle, source: &str) -> Result<String, AppError> {
    let source = Path::new(source);
    if !source.is_dir() {
        return Err(AppError::NotFound("pasta de imagens não encontrada".into()));
    }

    let root = images_dir(app)?;
    if let (Ok(source_canonical), Ok(root_canonical)) =
        (source.canonicalize(), root.canonicalize())
    {
        if let Ok(relative) = source_canonical.strip_prefix(&root_canonical) {
            return Ok(relative.to_string_lossy().replace('\\', "/"));
        }
    }

    let original_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Pasta de imagens");
    let safe_name = sanitize_component(original_name, "pasta");
    let target = unique_dir(&root, &safe_name);
    let mut budget = 5000;
    copy_images_tree(source, &target, &mut budget)?;

    let folder_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::Storage("nome de pasta inválido".into()))?;

    Ok(folder_name.to_string())
}

pub fn open_images_folder(app: &AppHandle) -> Result<(), AppError> {
    let dir = images_dir(app)?;
    app.opener()
        .open_path(dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|err| AppError::Storage(format!("falha ao abrir a pasta de imagens: {err}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifica_extensoes_de_midia() {
        assert!(is_image(Path::new("/tmp/foto.JPG")));
        assert!(is_image(Path::new("/tmp/foto.webp")));
        assert!(!is_image(Path::new("/tmp/video.mp4")));
        assert!(is_video(Path::new("/tmp/video.MOV")));
        assert!(is_video(Path::new("/tmp/video.webm")));
        assert!(!is_video(Path::new("/tmp/foto.png")));
    }

    #[test]
    fn sanitiza_e_evita_colisao_de_nomes() {
        let dir = std::env::temp_dir().join(format!(
            "open-presenter-media-library-test-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("foto.png"), b"x").unwrap();
        let target = unique_path(&dir, "foto.png");
        assert_eq!(target.file_name().unwrap(), "foto_1.png");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn monta_arvore_de_imagens_com_subpastas_e_filtra_nao_imagens() {
        let dir = std::env::temp_dir().join(format!(
            "open-presenter-image-tree-test-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(dir.join("pasta1")).unwrap();
        std::fs::write(dir.join("image1.png"), b"x").unwrap();
        std::fs::write(dir.join("image2.jpg"), b"x").unwrap();
        std::fs::write(dir.join("ignore.txt"), b"x").unwrap();
        std::fs::write(dir.join("pasta1").join("image1.png"), b"x").unwrap();

        let mut budget = 100;
        let tree = build_image_tree(&dir, Path::new(""), 0, &mut budget).unwrap();

        assert_eq!(tree[0].name, "pasta1");
        assert_eq!(tree[0].kind, ImageNodeKind::Folder);
        assert_eq!(
            tree[0].children[0].url.as_deref(),
            Some("media://library/images/pasta1/image1.png")
        );

        let top_images: Vec<_> = tree
            .iter()
            .filter(|node| node.kind == ImageNodeKind::Image)
            .collect();
        assert_eq!(top_images.len(), 2);
        assert!(tree.iter().all(|node| node.name != "ignore.txt"));

        std::fs::remove_dir_all(&dir).ok();
    }
}
