use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension};

use crate::error::AppError;
use crate::state::{SectionType, Song, SongSection, SongSummary};

fn storage_error(err: rusqlite::Error) -> AppError {
    AppError::Storage(err.to_string())
}

fn escape_like(term: &str) -> String {
    let mut escaped = String::with_capacity(term.len());
    for ch in term.chars() {
        match ch {
            '\\' => escaped.push_str("\\\\"),
            '%' => escaped.push_str("\\%"),
            '_' => escaped.push_str("\\_"),
            _ => escaped.push(ch),
        }
    }
    escaped
}

fn section_type_from_str(value: &str) -> Option<SectionType> {
    match value {
        "verse" => Some(SectionType::Verse),
        "pre-chorus" => Some(SectionType::PreChorus),
        "chorus" => Some(SectionType::Chorus),
        "bridge" => Some(SectionType::Bridge),
        "intro" => Some(SectionType::Intro),
        "outro" => Some(SectionType::Outro),
        "instrumental" => Some(SectionType::Instrumental),
        "tag" => Some(SectionType::Tag),
        "ending" => Some(SectionType::Ending),
        _ => None,
    }
}

pub fn list(conn: &Connection, query: Option<&str>) -> Result<Vec<SongSummary>, AppError> {
    let term = query.unwrap_or("").trim();
    let pattern = format!("%{}%", escape_like(term));
    let mut stmt = conn
        .prepare(
            "SELECT id, title, artist, song_key, bpm, composer, album FROM songs s
             WHERE title LIKE ?1 ESCAPE '\\'
                OR artist LIKE ?1 ESCAPE '\\'
                OR album LIKE ?1 ESCAPE '\\'
                OR composer LIKE ?1 ESCAPE '\\'
                OR EXISTS (
                    SELECT 1 FROM song_lyrics l
                    WHERE l.song_id = s.id AND l.line LIKE ?1 ESCAPE '\\'
                )
             ORDER BY title",
        )
        .map_err(storage_error)?;
    let songs = stmt
        .query_map(params![pattern], |row| {
            Ok(SongSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                song_key: row.get(3)?,
                bpm: row.get(4)?,
                composer: row.get(5)?,
                album: row.get(6)?,
            })
        })
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;
    Ok(songs)
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<Song>, AppError> {
    let base = conn
        .query_row(
            "SELECT title, artist, album, composer, song_key, bpm FROM songs WHERE id = ?1",
            params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<i32>>(5)?,
                ))
            },
        )
        .optional()
        .map_err(storage_error)?;
    let Some((title, artist, album, composer, song_key, bpm)) = base else {
        return Ok(None);
    };

    let mut stmt = conn
        .prepare(
            "SELECT position, section_type FROM song_sections
             WHERE song_id = ?1 ORDER BY position",
        )
        .map_err(storage_error)?;
    let section_rows = stmt
        .query_map(params![id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;

    let mut stmt = conn
        .prepare(
            "SELECT section_position, line FROM song_lyrics
             WHERE song_id = ?1 ORDER BY section_position, line_position",
        )
        .map_err(storage_error)?;
    let lyric_rows = stmt
        .query_map(params![id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;

    let mut lines_by_section: HashMap<i64, Vec<String>> = HashMap::new();
    for (position, line) in lyric_rows {
        lines_by_section.entry(position).or_default().push(line);
    }

    let sections = section_rows
        .into_iter()
        .map(|(position, section_type)| SongSection {
            section_type: section_type.as_deref().and_then(section_type_from_str),
            lines: lines_by_section.remove(&position).unwrap_or_default(),
        })
        .collect();

    let album = album.filter(|v| !v.trim().is_empty());
    let composer = composer.filter(|v| !v.trim().is_empty());
    let song_key = song_key.filter(|v| !v.trim().is_empty());

    Ok(Some(Song {
        id: id.to_string(),
        title,
        artist,
        album,
        composer,
        song_key,
        bpm,
        sections,
    }))
}

pub fn save(conn: &Connection, song: &Song) -> Result<(), AppError> {
    let tx = conn.unchecked_transaction().map_err(storage_error)?;
    tx.execute(
        "INSERT INTO songs (id, title, artist, album, composer, song_key, bpm)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             artist = excluded.artist,
             album = excluded.album,
             composer = excluded.composer,
             song_key = excluded.song_key,
             bpm = excluded.bpm",
        params![
            song.id,
            song.title,
            song.artist,
            song.album.as_deref().unwrap_or(""),
            song.composer.as_deref().unwrap_or(""),
            song.song_key.as_deref().unwrap_or(""),
            song.bpm,
        ],
    )
    .map_err(storage_error)?;
    tx.execute(
        "DELETE FROM song_lyrics WHERE song_id = ?1",
        params![song.id],
    )
    .map_err(storage_error)?;
    tx.execute(
        "DELETE FROM song_sections WHERE song_id = ?1",
        params![song.id],
    )
    .map_err(storage_error)?;
    for (position, section) in song.sections.iter().enumerate() {
        tx.execute(
            "INSERT INTO song_sections (song_id, position, section_type) VALUES (?1, ?2, ?3)",
            params![
                song.id,
                position as i64,
                section.section_type.map(SectionType::as_str)
            ],
        )
        .map_err(storage_error)?;
        for (line_position, line) in section.lines.iter().enumerate() {
            tx.execute(
                "INSERT INTO song_lyrics (song_id, section_position, line_position, line)
                 VALUES (?1, ?2, ?3, ?4)",
                params![song.id, position as i64, line_position as i64, line],
            )
            .map_err(storage_error)?;
        }
    }
    tx.commit().map_err(storage_error)?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM songs WHERE id = ?1", params![id])
        .map_err(storage_error)?;
    Ok(())
}

pub fn find_duplicate(
    conn: &Connection,
    title: &str,
    artist: &str,
) -> Result<Option<String>, AppError> {
    conn.query_row(
        "SELECT id FROM songs
         WHERE lower(title) = lower(?1) AND lower(artist) = lower(?2)
         LIMIT 1",
        params![title.trim(), artist.trim()],
        |row| row.get(0),
    )
    .optional()
    .map_err(storage_error)
}

pub fn insert_new(
    conn: &Connection,
    title: &str,
    artist: &str,
    sections: &[SongSection],
) -> Result<String, AppError> {
    let id: String = conn
        .query_row("SELECT lower(hex(randomblob(16)))", [], |row| row.get(0))
        .map_err(storage_error)?;
    let song = Song {
        id: id.clone(),
        title: title.to_string(),
        artist: artist.to_string(),
        album: None,
        composer: None,
        song_key: None,
        bpm: None,
        sections: sections.to_vec(),
    };
    save(conn, &song)?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::database::open_in_memory;

    #[test]
    fn salva_e_retorna_musica_com_secoes() {
        let conn = open_in_memory();
        let song = Song {
            id: "s1".into(),
            title: "Grandes Coisas".into(),
            artist: "Fernandinho".into(),
            album: Some("Uma Nova História".into()),
            composer: Some("Fernandinho".into()),
            song_key: Some("G".into()),
            bpm: Some(128),
            sections: vec![
                SongSection {
                    section_type: Some(SectionType::Verse),
                    lines: vec!["Grandes coisas".into(), "estão por vir".into()],
                },
                SongSection {
                    section_type: Some(SectionType::Chorus),
                    lines: vec!["Vão acontecer".into()],
                },
            ],
        };
        save(&conn, &song).unwrap();
        assert_eq!(get(&conn, "s1").unwrap().unwrap(), song);
    }

    #[test]
    fn busca_por_trecho_de_letra() {
        let conn = open_in_memory();
        save(
            &conn,
            &Song {
                id: "s1".into(),
                title: "A".into(),
                artist: "B".into(),
                album: None,
                composer: None,
                song_key: None,
                bpm: None,
                sections: vec![SongSection {
                    section_type: None,
                    lines: vec!["ousado amor".into()],
                }],
            },
        )
        .unwrap();
        assert_eq!(list(&conn, Some("ousado")).unwrap().len(), 1);
        assert_eq!(list(&conn, Some("nada")).unwrap().len(), 0);
    }

    #[test]
    fn busca_trata_curingas_like_como_texto_literal() {
        let conn = open_in_memory();
        save(
            &conn,
            &Song {
                id: "s1".into(),
                title: "100%".into(),
                artist: "".into(),
                album: None,
                composer: None,
                song_key: None,
                bpm: None,
                sections: vec![SongSection {
                    section_type: None,
                    lines: vec!["a_b c%d".into()],
                }],
            },
        )
        .unwrap();
        save(
            &conn,
            &Song {
                id: "s2".into(),
                title: "Outra".into(),
                artist: "".into(),
                album: None,
                composer: None,
                song_key: None,
                bpm: None,
                sections: vec![SongSection {
                    section_type: None,
                    lines: vec!["sem curinga".into()],
                }],
            },
        )
        .unwrap();
        assert_eq!(list(&conn, Some("%")).unwrap().len(), 1); // sem escape, casaria 2
        assert_eq!(list(&conn, Some("_")).unwrap().len(), 1); // sem escape, casaria 2
        assert_eq!(list(&conn, Some("%d")).unwrap().len(), 1);
        assert_eq!(list(&conn, Some("curinga")).unwrap().len(), 1);
    }

    #[test]
    fn save_substitui_secoes_anteriores_e_delete_cascateia() {
        let conn = open_in_memory();
        let mut song = Song {
            id: "s1".into(),
            title: "T".into(),
            artist: "".into(),
            album: None,
            composer: None,
            song_key: None,
            bpm: None,
            sections: vec![SongSection {
                section_type: Some(SectionType::Verse),
                lines: vec!["l1".into()],
            }],
        };
        save(&conn, &song).unwrap();
        song.sections = vec![SongSection {
            section_type: Some(SectionType::Bridge),
            lines: vec!["l2".into(), "l3".into()],
        }];
        save(&conn, &song).unwrap();
        assert_eq!(get(&conn, "s1").unwrap().unwrap(), song);
        let linhas: i64 = conn
            .query_row("SELECT count(*) FROM song_lyrics", [], |r| r.get(0))
            .unwrap();
        assert_eq!(linhas, 2);
        delete(&conn, "s1").unwrap();
        assert!(get(&conn, "s1").unwrap().is_none());
    }

    #[test]
    fn insert_new_gera_id_e_find_duplicate_acha_case_insensitive() {
        let conn = open_in_memory();
        let id = insert_new(
            &conn,
            "Ousado Amor",
            "Isaias Saad",
            &[SongSection {
                section_type: None,
                lines: vec!["x".into()],
            }],
        )
        .unwrap();
        assert_eq!(id.len(), 32);
        assert!(find_duplicate(&conn, " ousado amor ", "ISAIAS SAAD")
            .unwrap()
            .is_some());
        assert!(find_duplicate(&conn, "outra", "").unwrap().is_none());
    }
}
