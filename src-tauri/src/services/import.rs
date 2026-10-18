use std::path::Path;

use rusqlite::Connection;

use crate::error::AppError;
use crate::services::{holyrics, songs};
use crate::state::{ImportReport, ImportSkip};

pub fn import_holyrics_file(conn: &Connection, path: &Path) -> Result<ImportReport, AppError> {
    let text = std::fs::read_to_string(path).map_err(|e| AppError::Storage(e.to_string()))?;
    let format = holyrics::format_from_path(path)?;
    let parsed = holyrics::parse(&text, format)?;
    let defaults = songs::song_defaults(conn)?;

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
        let sections = songs::apply_layout(song.sections, defaults);
        songs::insert_new(conn, &song.title, &song.artist, &sections)?;
        report.imported.push(song.title);
    }

    Ok(report)
}

pub fn import_holyrics_files(conn: &Connection, paths: &[String]) -> Result<ImportReport, AppError> {
    let mut report = ImportReport {
        imported: Vec::new(),
        skipped: Vec::new(),
        errors: Vec::new(),
    };

    for path in paths {
        match import_holyrics_file(conn, Path::new(path)) {
            Ok(partial) => {
                report.imported.extend(partial.imported);
                report.skipped.extend(partial.skipped);
            }
            Err(e) => {
                let name = Path::new(path)
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_else(|| path.clone());
                report.errors.push(format!("{} — {}", name, e));
            }
        }
    }

    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::database::open_in_memory;
    use crate::state::{LinesPerSlide, SectionType, SongDefaults};

    const FIXTURE_SINGLE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/holyrics_single.json");
    const FIXTURE_ARRAY: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/holyrics_array.json");

    #[test]
    fn importa_quebrando_estrofes_no_layout_padrao() {
        let conn = open_in_memory();
        let report = import_holyrics_file(&conn, Path::new(FIXTURE_SINGLE)).unwrap();
        assert_eq!(report.imported, vec!["A Boa Parte".to_string()]);
        let summary = songs::list(&conn, Some("A Boa Parte")).unwrap();
        let song = songs::get(&conn, &summary[0].id).unwrap().unwrap();
        // 11 parágrafos quebrados de 2 em 2 linhas → 19 seções (default = "2")
        assert_eq!(song.sections.len(), 19);
        assert_eq!(song.sections[0].lines, vec!["Precioso Jesus", "Aos Teus pés aqui estou"]);
    }

    #[test]
    fn estrofe_rotulada_quebrada_mantem_rotulo_so_no_primeiro_fragmento() {
        let conn = open_in_memory();
        let path = std::env::temp_dir().join(format!("layout-{}.txt", std::process::id()));
        std::fs::write(
            &path,
            "Título: Hino\nArtista: X\n\n##(Verso 1)\nlinha 1\nlinha 2\nlinha 3\nlinha 4\n",
        )
        .unwrap();
        import_holyrics_file(&conn, &path).unwrap();
        let summary = songs::list(&conn, Some("Hino")).unwrap();
        let song = songs::get(&conn, &summary[0].id).unwrap().unwrap();
        assert_eq!(song.sections.len(), 2);
        assert_eq!(song.sections[0].section_type, Some(SectionType::Verse));
        assert_eq!(song.sections[1].section_type, None);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn layout_keep_nao_quebra_estrofes() {
        let conn = open_in_memory();
        songs::save_song_defaults(
            &conn,
            SongDefaults { lines_per_slide: LinesPerSlide::Keep },
        )
        .unwrap();
        import_holyrics_file(&conn, Path::new(FIXTURE_SINGLE)).unwrap();
        let summary = songs::list(&conn, Some("A Boa Parte")).unwrap();
        let song = songs::get(&conn, &summary[0].id).unwrap().unwrap();
        assert_eq!(song.sections.len(), 11);
    }

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

    #[test]
    fn importa_varios_arquivos_e_reporta_erro_por_arquivo() {
        let conn = open_in_memory();
        let ausente = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/nao-existe.json").to_string();
        let report = import_holyrics_files(
            &conn,
            &[FIXTURE_ARRAY.to_string(), FIXTURE_SINGLE.to_string(), ausente],
        )
        .unwrap();
        assert_eq!(report.imported.len(), 4);
        assert!(report.skipped.is_empty());
        assert_eq!(report.errors.len(), 1);
        assert!(report.errors[0].contains("nao-existe.json"));

        let segunda_rodada = import_holyrics_files(
            &conn,
            &[FIXTURE_ARRAY.to_string(), FIXTURE_SINGLE.to_string()],
        )
        .unwrap();
        assert!(segunda_rodada.imported.is_empty());
        assert_eq!(segunda_rodada.skipped.len(), 4);
    }
}
