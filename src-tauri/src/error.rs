use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("erro do Tauri: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("erro de armazenamento: {0}")]
    Storage(String),
    #[error("erro de rede: {0}")]
    Network(String),
    #[error("não encontrado: {0}")]
    NotFound(String),
    #[error("validação: {0}")]
    Validation(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
