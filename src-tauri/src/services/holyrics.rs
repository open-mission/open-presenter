use std::path::Path;

use serde_json::Value;

use crate::error::AppError;
use crate::services::lyrics;
use crate::state::{SectionType, SongSection};

const JSON_INVALIDO: &str = "arquivo JSON inválido";
const FORMATO_NAO_SUPORTADO: &str = "formato não suportado — exporte JSON ou TXT";

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedSong {
    pub title: String,
    pub artist: String,
    pub sections: Vec<SongSection>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HolyricsFormat {
    Json,
    Txt,
}

pub fn parse(text: &str, format: HolyricsFormat) -> Result<Vec<ParsedSong>, AppError> {
    let normalized = lyrics::normalize(text);
    match format {
        HolyricsFormat::Json => parse_json(&normalized),
        HolyricsFormat::Txt => Ok(parse_txt(&normalized)),
    }
}

pub fn format_from_path(path: &Path) -> Result<HolyricsFormat, AppError> {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("json") => Ok(HolyricsFormat::Json),
        Some(ext) if ext.eq_ignore_ascii_case("txt") => Ok(HolyricsFormat::Txt),
        Some(ext) if ext.eq_ignore_ascii_case("mufl") => Err(AppError::Storage(
            "formato .mufl não é suportado — exporte JSON ou TXT".into(),
        )),
        Some(ext) => Err(AppError::Storage(format!(
            "formato .{} não é suportado — exporte JSON ou TXT",
            ext.to_lowercase()
        ))),
        None => Err(AppError::Storage(FORMATO_NAO_SUPORTADO.into())),
    }
}

fn text_lines(text: &str) -> Vec<String> {
    text.split('\n')
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect()
}

fn parse_json(text: &str) -> Result<Vec<ParsedSong>, AppError> {
    let root: Value =
        serde_json::from_str(text).map_err(|_| AppError::Storage(JSON_INVALIDO.into()))?;
    let items: Vec<Value> = match root {
        Value::Array(items) => items,
        Value::Object(_) => vec![root],
        _ => return Err(AppError::Storage(JSON_INVALIDO.into())),
    };

    let mut songs = Vec::new();
    for item in items {
        let title = item
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();
        if title.is_empty() {
            continue;
        }
        let artist = item
            .get("artist")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();

        let lyrics = item.get("lyrics");
        let mut sections = Vec::new();
        if let Some(paragraphs) = lyrics
            .and_then(|value| value.get("paragraphs"))
            .and_then(Value::as_array)
        {
            for paragraph in paragraphs {
                let section_type = paragraph
                    .get("description")
                    .and_then(Value::as_str)
                    .and_then(SectionType::from_label);
                let lines = paragraph
                    .get("text")
                    .and_then(Value::as_str)
                    .map(text_lines)
                    .unwrap_or_default();
                if !lines.is_empty() {
                    sections.push(SongSection {
                        section_type,
                        lines,
                    });
                }
            }
        }

        if sections.is_empty() {
            if let Some(full_text) = lyrics
                .and_then(|value| value.get("full_text"))
                .and_then(Value::as_str)
            {
                sections = lyrics::parse_sections(full_text);
            }
        }

        if sections.is_empty() {
            continue;
        }
        songs.push(ParsedSong {
            title: title.to_string(),
            artist: artist.to_string(),
            sections,
        });
    }
    Ok(songs)
}

fn parse_txt(text: &str) -> Vec<ParsedSong> {
    let mut songs = Vec::new();
    let mut block: Vec<&str> = Vec::new();
    for line in text.lines() {
        if is_separator(line) {
            push_block(&block, &mut songs);
            block.clear();
        } else {
            block.push(line);
        }
    }
    push_block(&block, &mut songs);
    songs
}

fn is_separator(line: &str) -> bool {
    let trimmed = line.trim_matches(|c| c == ' ' || c == '\t');
    trimmed.len() >= 10 && trimmed.chars().all(|c| c == '=')
}

fn push_block(lines: &[&str], songs: &mut Vec<ParsedSong>) {
    let mut title = String::new();
    let mut artist = String::new();
    let mut content: Vec<&str> = Vec::new();

    for line in lines {
        let trimmed = line.trim();
        if let Some(value) = header_value(trimmed, "título:") {
            title = value.trim().to_string();
            continue;
        }
        if let Some(value) = header_value(trimmed, "artista:") {
            artist = value.trim().to_string();
            continue;
        }
        content.push(line);
    }

    let sections = lyrics::parse_sections(&content.join("\n"));

    if !title.is_empty() && !sections.is_empty() {
        songs.push(ParsedSong {
            title,
            artist,
            sections,
        });
    }
}

fn header_value<'a>(line: &'a str, prefix: &str) -> Option<&'a str> {
    let head = line.get(..prefix.len())?;
    if head.to_lowercase() == prefix {
        Some(&line[prefix.len()..])
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TXT: &str = "\u{FEFF}Título: Ousado Amor\r\nArtista: Isaias Saad\r\n\r\n//Primeira Estrofe\r\n##(Verso 1)\r\nAntes de eu falar\r\nTu cantavas sobre mim\r\n\r\n##(Refrão)\r\nOusado amor\r\nDe Deus por mim\r\n\r\n==========\r\nTítulo: Sem Artista\r\n\r\n##(Estrofe A)\r\nLinha qualquer\r\n";
    const FIXTURE_ARRAY: &str = include_str!("../../tests/fixtures/holyrics_array.json");
    const FIXTURE_SINGLE: &str = include_str!("../../tests/fixtures/holyrics_single.json");

    #[test]
    fn parseia_json_do_export_real_com_varias_musicas() {
        let songs = parse(FIXTURE_ARRAY, HolyricsFormat::Json).unwrap();
        let titulos: Vec<&str> = songs.iter().map(|s| s.title.as_str()).collect();
        assert_eq!(
            titulos,
            vec!["A Coroa", "A Estrela da Alva", "A Fonte Salvadora"]
        );
        assert!(!songs[0].sections.is_empty());
        // export sem `description` → nenhum rótulo inventado
        assert!(songs
            .iter()
            .flat_map(|s| &s.sections)
            .all(|s| s.section_type.is_none()));
    }

    #[test]
    fn parseia_json_de_musica_unica_na_raiz() {
        let songs = parse(FIXTURE_SINGLE, HolyricsFormat::Json).unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].title, "A Boa Parte");
        assert_eq!(
            songs[0].artist,
            "Florianópolis House Of Prayer e Nívea Soares"
        );
        assert_eq!(songs[0].sections.len(), 11);
        assert!(songs[0].sections.iter().all(|s| s.section_type.is_none()));
    }

    #[test]
    fn raiz_json_que_nao_e_objeto_nem_array_gera_erro() {
        assert!(parse("42", HolyricsFormat::Json).is_err());
    }

    #[test]
    fn parseia_txt_com_rotulos_artista_e_bom_crlf() {
        let songs = parse(TXT, HolyricsFormat::Txt).unwrap();
        assert_eq!(songs.len(), 2);
        let primeira = &songs[0];
        assert_eq!(primeira.title, "Ousado Amor");
        assert_eq!(primeira.artist, "Isaias Saad");
        assert_eq!(primeira.sections.len(), 2);
        assert_eq!(primeira.sections[0].section_type, Some(SectionType::Verse));
        assert_eq!(
            primeira.sections[0].lines,
            vec!["Antes de eu falar", "Tu cantavas sobre mim"]
        );
        assert_eq!(primeira.sections[1].section_type, Some(SectionType::Chorus));
        // rótulo desconhecido vira "sem rótulo" e o arquivo segue importando
        assert_eq!(songs[1].title, "Sem Artista");
        assert_eq!(songs[1].sections[0].section_type, None);
    }

    #[test]
    fn parseia_txt_com_rotulo_sem_parenteses() {
        let songs = parse(
            "Título: X\nArtista: Y\n\n## Refrão\nlinha",
            HolyricsFormat::Txt,
        )
        .unwrap();
        assert_eq!(songs[0].sections.len(), 1);
        assert_eq!(songs[0].sections[0].section_type, Some(SectionType::Chorus));
        assert_eq!(songs[0].sections[0].lines, vec!["linha"]);
    }

    #[test]
    fn parseia_json_paragraphs_e_mapeia_descricao_numerada() {
        let json = r#"[{"title":"T","artist":"A","lyrics":{"paragraphs":[
        {"description":"Verso 2","text":"linha um\nlinha dois\n"},{"description":"Refrão","text":"refrão"}]}}]"#;
        let songs = parse(json, HolyricsFormat::Json).unwrap();
        assert_eq!(songs[0].sections[0].section_type, Some(SectionType::Verse));
        assert_eq!(songs[0].sections[0].lines, vec!["linha um", "linha dois"]);
        assert_eq!(songs[0].sections[1].section_type, Some(SectionType::Chorus));
    }

    #[test]
    fn parseia_json_fallback_full_text_e_ignora_invalidos() {
        let json = r#"[{"title":"X","artist":"","lyrics":{"full_text":"primeiro\n\n\nsegundo"}},
        {"title":"","artist":"","lyrics":{"paragraphs":[{"text":"a"}]}},
        {"title":"Y","artist":"","lyrics":{"paragraphs":[]}}]"#;
        let songs = parse(json, HolyricsFormat::Json).unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].sections.len(), 3);
        assert!(songs[0].sections[1].lines.is_empty());
        assert!(parse("não é json", HolyricsFormat::Json).is_err());
    }

    #[test]
    fn detecta_formato_pela_extensao_e_rejeita_mufl() {
        assert_eq!(
            format_from_path(Path::new("/tmp/backup.JSON")).unwrap(),
            HolyricsFormat::Json
        );
        assert_eq!(
            format_from_path(Path::new("/tmp/letras.txt")).unwrap(),
            HolyricsFormat::Txt
        );
        assert!(format_from_path(Path::new("/tmp/cancao.mufl")).is_err());
        assert!(format_from_path(Path::new("/tmp/documento.pdf")).is_err());
    }

    #[test]
    fn json_invalido_gera_app_error_storage_com_mensagem() {
        let erro = parse("não é json", HolyricsFormat::Json).unwrap_err();
        assert!(matches!(erro, AppError::Storage(mensagem) if mensagem == "arquivo JSON inválido"));
    }
}
