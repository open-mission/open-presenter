use std::path::{Component, Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::error::AppError;

pub const MAX_MEDIA_BYTES: usize = 20 * 1024 * 1024;

const EXTENSOES_PERMITIDAS: &[&str] = &["png", "jpg", "jpeg", "webp", "mp4"];

pub fn sanitize_filename(name: &str) -> Result<String, AppError> {
    if name.is_empty() {
        return Err(AppError::Storage("nome de arquivo inválido".into()));
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::Storage("nome de arquivo inválido".into()));
    }
    let safe: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if safe.is_empty() || safe.chars().all(|c| c == '.' || c == '_') {
        return Err(AppError::Storage("nome de arquivo inválido".into()));
    }
    Ok(safe)
}

fn base_media_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(AppError::Tauri)?
        .join("theme-media"))
}

pub fn media_base_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = base_media_dir(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Storage(e.to_string()))?;
    Ok(dir)
}

pub fn media_dir(app: &AppHandle, guid: &str) -> Result<PathBuf, AppError> {
    let seguro = sanitize_filename(guid)?;
    let dir = base_media_dir(app)?.join(seguro);
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Storage(e.to_string()))?;
    Ok(dir)
}

fn validar_extensao(sanitized: &str) -> Result<(), AppError> {
    let ext = Path::new(sanitized)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if EXTENSOES_PERMITIDAS.contains(&ext.as_str()) {
        Ok(())
    } else {
        Err(AppError::Storage(
            "extensão de arquivo não suportada (use png, jpg, jpeg, webp ou mp4)".into(),
        ))
    }
}

fn write_media(dir: &Path, filename: &str, contents: &[u8]) -> Result<String, AppError> {
    let sanitized = sanitize_filename(filename)?;
    validar_extensao(&sanitized)?;
    if contents.len() > MAX_MEDIA_BYTES {
        return Err(AppError::Storage("arquivo excede o limite de 20MB".into()));
    }
    std::fs::create_dir_all(dir).map_err(|e| AppError::Storage(e.to_string()))?;
    std::fs::write(dir.join(&sanitized), contents)
        .map_err(|e| AppError::Storage(e.to_string()))?;
    Ok(sanitized)
}

pub fn save_media(
    app: &AppHandle,
    guid: &str,
    filename: &str,
    contents: &[u8],
) -> Result<String, AppError> {
    let seguro = sanitize_filename(guid)?;
    let dir = media_dir(app, &seguro)?;
    let sanitized = write_media(&dir, filename, contents)?;
    Ok(format!("media://{seguro}/{sanitized}"))
}

pub fn parse_media_uri_relative_path(uri: &tauri::http::Uri) -> Option<PathBuf> {
    let host = uri.host().unwrap_or_default();
    let raw_path = uri.path();
    let decoded = percent_encoding::percent_decode_str(raw_path).decode_utf8_lossy();
    let clean_path = decoded.trim_start_matches('/');

    let relative_str = if !host.is_empty() && host != "localhost" && host != "media.localhost" {
        format!("{}/{}", host, clean_path)
    } else {
        clean_path.to_string()
    };

    let relative = PathBuf::from(&relative_str);
    if relative.components().any(|c| matches!(c, Component::ParentDir)) {
        return None;
    }
    Some(relative)
}

pub fn read_media(app: &AppHandle, uri: &tauri::http::Uri) -> Option<(String, Vec<u8>)> {
    let relative = parse_media_uri_relative_path(uri)?;
    let base = media_base_dir(app).ok()?;
    let file_path = base.join(&relative);
    if !file_path.starts_with(&base) {
        return None;
    }
    let bytes = std::fs::read(&file_path).ok()?;
    let mime = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();
    Some((mime, bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_media_uri_suporta_formatos_diversos() {
        let uri1: tauri::http::Uri = "media://wallpapers/fundo.jpg".parse().unwrap();
        assert_eq!(
            parse_media_uri_relative_path(&uri1).unwrap(),
            PathBuf::from("wallpapers/fundo.jpg")
        );

        let uri2: tauri::http::Uri = "http://media.localhost/wallpapers/fundo.jpg"
            .parse()
            .unwrap();
        assert_eq!(
            parse_media_uri_relative_path(&uri2).unwrap(),
            PathBuf::from("wallpapers/fundo.jpg")
        );

        let uri3: tauri::http::Uri = "media://localhost/wallpapers/fundo.jpg".parse().unwrap();
        assert_eq!(
            parse_media_uri_relative_path(&uri3).unwrap(),
            PathBuf::from("wallpapers/fundo.jpg")
        );

        let uri_space: tauri::http::Uri = "media://wallpapers/foto%201.PNG".parse().unwrap();
        assert_eq!(
            parse_media_uri_relative_path(&uri_space).unwrap(),
            PathBuf::from("wallpapers/foto 1.PNG")
        );

        let uri_malicioso: tauri::http::Uri = "media://wallpapers/../secreto.txt".parse().unwrap();
        assert!(parse_media_uri_relative_path(&uri_malicioso).is_none());
    }

    #[test]
    fn sanitize_rejeita_traversal() {
        assert!(sanitize_filename("../x.png").is_err());
        assert!(sanitize_filename("a/b.png").is_err());
        assert!(sanitize_filename("").is_err());
        assert_eq!(sanitize_filename("foto 1.PNG").unwrap(), "foto_1.PNG");
    }

    #[test]
    fn save_recusa_extensao_e_tamanho() {
        let dir = std::env::temp_dir().join(format!(
            "open-presenter-theme-media-test-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        assert!(write_media(&dir, "malware.exe", b"conteudo").is_err());
        let grande = vec![0u8; 20 * 1024 * 1024 + 1];
        assert!(write_media(&dir, "grande.png", &grande).is_err());
        assert!(!dir.join("malware.exe").exists());
        assert!(!dir.join("grande.png").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn save_escreve_arquivo_valido() {
        let dir = std::env::temp_dir().join(format!(
            "open-presenter-theme-media-ok-{}",
            std::process::id()
        ));
        let escrito = write_media(&dir, "fundo.png", b"png-falso").unwrap();
        assert_eq!(escrito, "fundo.png");
        assert_eq!(
            std::fs::read(dir.join("fundo.png")).unwrap(),
            b"png-falso"
        );
        std::fs::remove_dir_all(&dir).ok();
    }
}
