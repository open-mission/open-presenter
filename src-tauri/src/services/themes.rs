use rusqlite::{params, Connection, OptionalExtension};

use crate::error::AppError;
use crate::state::types::SlideTheme;

fn storage_error(err: rusqlite::Error) -> AppError {
    AppError::Storage(err.to_string())
}

fn decode(definition: String) -> Result<SlideTheme, AppError> {
    serde_json::from_str(&definition).map_err(|e| AppError::Storage(e.to_string()))
}

pub fn list_themes(conn: &Connection) -> Result<Vec<SlideTheme>, AppError> {
    let mut stmt = conn
        .prepare("SELECT definition FROM themes ORDER BY title")
        .map_err(storage_error)?;
    let temas = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(storage_error)?
        .filter_map(|row| row.map_err(storage_error).ok())
        .filter_map(|definition| decode(definition).ok())
        .collect::<Vec<_>>();
    Ok(temas)
}

pub fn get_theme(conn: &Connection, guid: &str) -> Result<Option<SlideTheme>, AppError> {
    let definition: Option<String> = conn
        .query_row(
            "SELECT definition FROM themes WHERE guid = ?1",
            params![guid],
            |row| row.get(0),
        )
        .optional()
        .map_err(storage_error)?;
    definition.map(decode).transpose()
}

pub fn save_theme(conn: &Connection, theme: &SlideTheme) -> Result<(), AppError> {
    if theme.elements.is_empty() {
        return Err(AppError::Storage("tema deve ter ao menos um elemento".into()));
    }
    let definition =
        serde_json::to_string(theme).map_err(|e| AppError::Storage(e.to_string()))?;
    conn.execute(
        "INSERT INTO themes (guid, title, definition) VALUES (?1, ?2, ?3)
         ON CONFLICT(guid) DO UPDATE SET title = excluded.title,
            definition = excluded.definition,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
        params![theme.guid, theme.title, definition],
    )
    .map_err(storage_error)?;
    Ok(())
}

pub fn delete_theme(conn: &Connection, guid: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM themes WHERE guid = ?1", params![guid])
        .map_err(storage_error)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::database::open_in_memory;
    use crate::state::types::{ThemeElement, ThemeElementType};
    use std::collections::HashMap;

    fn elemento(id: &str) -> ThemeElement {
        ThemeElement {
            id: id.into(),
            element_type: ThemeElementType::Text,
            x: 0.0,
            y: 0.0,
            visible: true,
            locked: false,
            css: HashMap::new(),
            text: Some("texto".into()),
            src: None,
            asset_type_visibility: None,
            fill: None,
            url: None,
        }
    }

    fn tema(guid: &str, title: &str) -> SlideTheme {
        SlideTheme {
            guid: guid.into(),
            title: title.into(),
            css: HashMap::new(),
            elements: vec![elemento("e1")],
            category: None,
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn save_e_list_roundtrip() {
        let conn = open_in_memory();
        save_theme(&conn, &tema("g2", "Beta")).unwrap();
        save_theme(&conn, &tema("g1", "Alfa")).unwrap();
        let temas = list_themes(&conn).unwrap();
        assert_eq!(temas.len(), 2);
        assert_eq!(temas[0].title, "Alfa");
        assert_eq!(temas[1].title, "Beta");
        assert_eq!(temas[0].guid, "g1");
        assert_eq!(temas[0].elements.len(), 1);
    }

    #[test]
    fn save_invalido_sem_elementos_erro() {
        let conn = open_in_memory();
        let vazio = SlideTheme {
            guid: "g".into(),
            title: "Vazio".into(),
            css: HashMap::new(),
            elements: vec![],
            category: None,
            created_at: None,
            updated_at: None,
        };
        assert!(save_theme(&conn, &vazio).is_err());
    }

    #[test]
    fn delete_remove() {
        let conn = open_in_memory();
        save_theme(&conn, &tema("g1", "Alfa")).unwrap();
        delete_theme(&conn, "g1").unwrap();
        assert!(get_theme(&conn, "g1").unwrap().is_none());
        assert!(list_themes(&conn).unwrap().is_empty());
    }

    #[test]
    fn get_inexistente_none() {
        let conn = open_in_memory();
        assert!(get_theme(&conn, "nao-existe").unwrap().is_none());
    }

    #[test]
    fn list_ignora_linha_corrompida() {
        let conn = open_in_memory();
        save_theme(&conn, &tema("g1", "Valido")).unwrap();
        conn.execute(
            "INSERT INTO themes (guid, title, definition) VALUES (?1, ?2, ?3)",
            params!["corrompido", "Corrompido", "{json invalido"],
        )
        .unwrap();
        let temas = list_themes(&conn).unwrap();
        assert_eq!(temas.len(), 1);
        assert_eq!(temas[0].guid, "g1");
    }
}
