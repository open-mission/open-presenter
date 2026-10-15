use std::path::Path;

use rusqlite::Connection;

use crate::error::AppError;
use crate::services::{holyrics, songs};
use crate::state::{ImportReport, ImportSkip, SongSection};

pub fn import_holyrics_file(conn: &Connection, path: &Path) -> Result<ImportReport, AppError> {
    let text = std::fs::read_to_string(path).map_err(|e| AppError::Storage(e.to_string()))?;
    let format = holyrics::format_from_path(path)?;
    let parsed = holyrics::parse(&text, format)?;

    let mut report = ImportReport {
        imported: Vec::new(),
        skipped: Vec::new(),
        errors: Vec::new(),
    };

    for song in parsed {
        if songs::find_duplicate(conn, &song.title, &song.artist)?.is_some() {
            report.skipped.push(ImportSkip {
                title: song.title,
                reason: "já existe".into(),
            });
            continue;
        }
        let sections: Vec<SongSection> = song
            .sections
            .into_iter()
            .map(|section| SongSection {
                section_type: section.section_type,
                lines: section.lines,
            })
            .collect();
        songs::insert_new(conn, &song.title, &song.artist, &sections)?;
        report.imported.push(song.title);
    }

    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::database::open_in_memory;

    #[test]
    fn importa_txt_e_pula_duplicadas_na_segunda_vez() {
        let conn = open_in_memory();
        let path = std::env::temp_dir().join(format!("holyrics-{}.txt", std::process::id()));
        std::fs::write(&path, "Título: A\nArtista: X\n\nUm\n\n==========\n\nTítulo: B\nArtista: Y\n\nDois\n").unwrap();
        let r1 = import_holyrics_file(&conn, &path).unwrap();
        assert_eq!(r1.imported, vec!["A".to_string(), "B".to_string()]);
        let r2 = import_holyrics_file(&conn, &path).unwrap();
        assert!(r2.imported.is_empty());
        assert_eq!(r2.skipped.len(), 2);
        let n: i64 = conn.query_row("SELECT count(*) FROM songs", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 2);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn arquivo_invalido_e_extensao_mufl_geram_erro() {
        let conn = open_in_memory();
        let json = std::env::temp_dir().join(format!("holyrics-{}.json", std::process::id()));
        std::fs::write(&json, "{nada").unwrap();
        assert!(import_holyrics_file(&conn, &json).is_err());
        std::fs::remove_file(&json).ok();
        let mufl = std::env::temp_dir().join(format!("holyrics-{}.mufl", std::process::id()));
        std::fs::write(&mufl, "x").unwrap();
        assert!(import_holyrics_file(&conn, &mufl).is_err());
        std::fs::remove_file(&mufl).ok();
    }
}
