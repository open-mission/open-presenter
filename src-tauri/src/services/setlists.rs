use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::services::songs;
use crate::state::{EventItem, EventPart, EventSummary, MediaItem, ScriptureRef, ServiceEvent, SongSummary};

#[derive(Serialize, Deserialize)]
struct StoredItem {
    id: String,
    #[serde(rename = "songId", default, skip_serializing_if = "Option::is_none")]
    song_id: Option<String>,
    #[serde(rename = "nextItemId", default)]
    next_item_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    media: Option<MediaItem>,
    #[serde(rename = "scripture", default, skip_serializing_if = "Option::is_none")]
    scripture: Option<ScriptureRef>,
}

#[derive(Serialize, Deserialize)]
struct StoredPart {
    id: String,
    title: String,
    items: Vec<StoredItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    color: Option<String>,
    #[serde(rename = "bgColor", default, skip_serializing_if = "Option::is_none")]
    bg_color: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct StoredEvent {
    parts: Vec<StoredPart>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    wallpaper: Option<String>,
    #[serde(rename = "themeGuid", default, skip_serializing_if = "Option::is_none")]
    theme_guid: Option<String>,
}

fn storage_error(err: rusqlite::Error) -> AppError {
    AppError::Storage(err.to_string())
}

fn serialize_setlist(event: &ServiceEvent) -> Result<String, AppError> {
    let stored = StoredEvent {
        wallpaper: event.wallpaper.clone(),
        theme_guid: event.theme_guid.clone(),
        parts: event
            .parts
            .iter()
            .map(|part| StoredPart {
                id: part.id.clone(),
                title: part.title.clone(),
                color: part.color.clone(),
                bg_color: part.bg_color.clone(),
                items: part
                    .items
                    .iter()
                    .map(|item| StoredItem {
                        id: item.id.clone(),
                        song_id: item.song_id.clone(),
                        next_item_id: item.next_item_id.clone(),
                        media: item.media.clone(),
                        scripture: item.scripture.clone(),
                    })
                    .collect(),
            })
            .collect(),
    };
    serde_json::to_string(&stored).map_err(|e| AppError::Storage(e.to_string()))
}

pub const TEMPORARY_EVENT_ID: &str = "__temporary__";

pub fn list(conn: &Connection) -> Result<Vec<EventSummary>, AppError> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, event_date, json_extract(setlist_json, '$.wallpaper'),
                    json_extract(setlist_json, '$.themeGuid'),
                    CASE WHEN json_valid(setlist_json) THEN (
                        SELECT COUNT(*)
                        FROM json_each(service_events.setlist_json, '$.parts') AS part,
                             json_each(part.value, '$.items')
                    ) ELSE 0 END
             FROM service_events
             WHERE id != ?1
             ORDER BY event_date ASC, title",
        )
        .map_err(storage_error)?;
    let events = stmt
        .query_map(params![TEMPORARY_EVENT_ID], |row| {
            Ok(EventSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                event_date: row.get(2)?,
                wallpaper: row.get::<_, Option<String>>(3).unwrap_or(None),
                theme_guid: row.get::<_, Option<String>>(4).unwrap_or(None),
                item_count: row.get(5)?,
            })
        })
        .map_err(storage_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage_error)?;
    Ok(events)
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<ServiceEvent>, AppError> {
    let row = conn
        .query_row(
            "SELECT title, event_date, setlist_json FROM service_events WHERE id = ?1",
            params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()
        .map_err(storage_error)?;
    let Some((title, event_date, setlist_json)) = row else {
        return Ok(None);
    };

    let stored: StoredEvent =
        serde_json::from_str(&setlist_json).map_err(|e| AppError::Storage(e.to_string()))?;

    let mut parts = Vec::with_capacity(stored.parts.len());
    for part in stored.parts {
        let mut items = Vec::with_capacity(part.items.len());
        for item in part.items {
            let song = match item.song_id.as_deref() {
                Some(song_id) => songs::get(conn, song_id)?.map(|song| SongSummary {
                    id: song.id,
                    title: song.title,
                    artist: song.artist,
                    song_key: song.song_key,
                    bpm: song.bpm,
                    composer: song.composer,
                    album: song.album,
                }),
                None => None,
            };
            items.push(EventItem {
                id: item.id,
                song_id: item.song_id,
                next_item_id: item.next_item_id,
                song,
                media: item.media,
                scripture: item.scripture,
            });
        }
        parts.push(EventPart {
            id: part.id,
            title: part.title,
            items,
            color: part.color,
            bg_color: part.bg_color,
        });
    }

    Ok(Some(ServiceEvent {
        id: id.to_string(),
        title,
        event_date,
        wallpaper: stored.wallpaper,
        theme_guid: stored.theme_guid,
        parts,
    }))
}

pub fn create(conn: &Connection, event: &ServiceEvent) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO service_events (id, title, event_date, setlist_json) VALUES (?1, ?2, ?3, ?4)",
        params![
            event.id,
            event.title,
            event.event_date,
            serialize_setlist(event)?
        ],
    )
    .map_err(storage_error)?;
    Ok(())
}

pub fn save(conn: &Connection, event: &ServiceEvent) -> Result<(), AppError> {
    let affected = conn
        .execute(
            "UPDATE service_events SET title = ?1, event_date = ?2, setlist_json = ?3 WHERE id = ?4",
            params![event.title, event.event_date, serialize_setlist(event)?, event.id],
        )
        .map_err(storage_error)?;
    if affected == 0 {
        return Err(AppError::NotFound("evento não encontrado".into()));
    }
    Ok(())
}

pub fn get_temporary(conn: &Connection) -> Result<ServiceEvent, AppError> {
    if let Some(event) = get(conn, TEMPORARY_EVENT_ID)? {
        return Ok(event);
    }
    let temp = ServiceEvent {
        id: TEMPORARY_EVENT_ID.to_string(),
        title: "Temporário".to_string(),
        event_date: "".to_string(),
        wallpaper: None,
        theme_guid: None,
        parts: vec![],
    };
    create(conn, &temp)?;
    Ok(temp)
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    if id == TEMPORARY_EVENT_ID {
        return Err(AppError::Storage("não é permitido excluir a lista temporária".into()));
    }
    conn.execute("DELETE FROM service_events WHERE id = ?1", params![id])
        .map_err(storage_error)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::database::open_in_memory;
    use crate::services::songs;
    use crate::state::{EventItem, EventPart, MediaItem, MediaKind, ServiceEvent, SongSection};

    #[test]
    fn create_get_roundtrip_hidrata_musicas_da_setlist() {
        let conn = open_in_memory();
        let song_id = songs::insert_new(&conn, "Ousado Amor", "Isaias Saad", &[SongSection { section_type: None, lines: vec!["x".into()] }]).unwrap();
        let event = ServiceEvent { id: "e1".into(), title: "Culto".into(), event_date: "2026-10-18".into(), wallpaper: None, theme_guid: None,
            parts: vec![EventPart { id: "p1".into(), title: "Louvor".into(), items: vec![
                EventItem { id: "i1".into(), song_id: Some(song_id.clone()), next_item_id: Some("i2".into()), song: None, media: None, scripture: None },
                EventItem { id: "i2".into(), song_id: Some(song_id.clone()), next_item_id: None, song: None, media: None, scripture: None },
            ], color: None, bg_color: None }] };
        create(&conn, &event).unwrap();
        let loaded = get(&conn, "e1").unwrap().unwrap();
        assert_eq!(loaded.parts[0].items[0].song.as_ref().unwrap().title, "Ousado Amor");
        assert_eq!(loaded.parts[0].items[0].next_item_id.as_deref(), Some("i2"));
    }

    #[test]
    fn musica_excluida_vira_item_removido_e_next_orfao_nao_quebra() {
        let conn = open_in_memory();
        let song_id = songs::insert_new(&conn, "T", "", &[SongSection { section_type: None, lines: vec!["l".into()] }]).unwrap();
        let event = ServiceEvent { id: "e1".into(), title: "C".into(), event_date: "2026-10-18".into(), wallpaper: None, theme_guid: None,
            parts: vec![EventPart { id: "p1".into(), title: "P".into(), items: vec![
                EventItem { id: "i1".into(), song_id: Some(song_id.clone()), next_item_id: Some("i-que-nao-existe".into()), song: None, media: None, scripture: None }], color: None, bg_color: None }] };
        create(&conn, &event).unwrap();
        songs::delete(&conn, &song_id).unwrap();
        let loaded = get(&conn, "e1").unwrap().unwrap();
        assert!(loaded.parts[0].items[0].song.is_none());
        assert_eq!(loaded.parts[0].items[0].next_item_id.as_deref(), Some("i-que-nao-existe"));
    }

    #[test]
    fn create_get_roundtrip_preserva_item_de_midia() {
        let conn = open_in_memory();
        let event = ServiceEvent {
            id: "e-media".into(),
            title: "Culto".into(),
            event_date: "2026-10-18".into(),
            wallpaper: None,
            theme_guid: None,
            parts: vec![EventPart {
                id: "p1".into(),
                title: "Avisos".into(),
                items: vec![EventItem {
                    id: "i-media".into(),
                    song_id: None,
                    next_item_id: None,
                    song: None,
                    media: Some(MediaItem {
                        kind: MediaKind::Image,
                        title: "Foto do evento".into(),
                        text: None,
                        path: Some("media://library/images/foto.jpg".into()),
                        files: Vec::new(),
                        index: None,
                        fit: Some("contain".into()),
                        theme_id: None,
                    }),
                    scripture: None,
                }],
                color: None,
                bg_color: None,
            }],
        };

        create(&conn, &event).unwrap();
        let loaded = get(&conn, "e-media").unwrap().unwrap();
        let item = &loaded.parts[0].items[0];
        assert!(item.song_id.is_none());
        assert!(item.song.is_none());
        let media = item.media.as_ref().expect("mídia persistida");
        assert_eq!(media.kind, MediaKind::Image);
        assert_eq!(media.title, "Foto do evento");
        assert_eq!(
            media.path.as_deref(),
            Some("media://library/images/foto.jpg")
        );
        assert_eq!(media.fit.as_deref(), Some("contain"));
    }

    #[test]
    fn save_persiste_ordem_e_delete_remove() {
        let conn = open_in_memory();
        let song_id = songs::insert_new(&conn, "T", "", &[SongSection { section_type: None, lines: vec!["l".into()] }]).unwrap();
        let mut event = ServiceEvent { id: "e1".into(), title: "C".into(), event_date: "2026-10-18".into(), wallpaper: None, theme_guid: None,
            parts: vec![EventPart { id: "p1".into(), title: "P".into(), items: vec![EventItem { id: "i1".into(), song_id: Some(song_id.clone()), next_item_id: None, song: None, media: None, scripture: None }], color: None, bg_color: None }] };
        create(&conn, &event).unwrap();
        event.parts[0].items.push(EventItem { id: "i2".into(), song_id: Some(song_id), next_item_id: None, song: None, media: None, scripture: None });
        save(&conn, &event).unwrap();
        assert_eq!(get(&conn, "e1").unwrap().unwrap().parts[0].items.len(), 2);
        assert_eq!(list(&conn).unwrap().len(), 1);
        delete(&conn, "e1").unwrap();
        assert!(get(&conn, "e1").unwrap().is_none());
    }

    #[test]
    fn get_temporary_cria_se_nao_existir_e_reutiliza() {
        let conn = open_in_memory();
        let temp1 = get_temporary(&conn).unwrap();
        assert_eq!(temp1.id, TEMPORARY_EVENT_ID);
        assert_eq!(temp1.title, "Temporário");
        assert!(temp1.parts.is_empty());

        let temp2 = get_temporary(&conn).unwrap();
        assert_eq!(temp2.id, temp1.id);
        assert_eq!(temp2.title, temp1.title);
    }

    #[test]
    fn list_exclui_evento_temporario() {
        let conn = open_in_memory();
        get_temporary(&conn).unwrap();
        let event = ServiceEvent {
            id: "e-culto".into(),
            title: "Culto de Domingo".into(),
            event_date: "2026-10-18".into(),
            wallpaper: None,
            theme_guid: None,
            parts: vec![],
        };
        create(&conn, &event).unwrap();

        let events = list(&conn).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].id, "e-culto");
        assert!(!events.iter().any(|e| e.id == TEMPORARY_EVENT_ID));
    }

    #[test]
    fn list_ordena_eventos_por_data_ascendente() {
        let conn = open_in_memory();
        for (id, date) in [
            ("e-depois", "2026-10-25"),
            ("e-antes", "2026-10-17"),
            ("e-meio", "2026-10-18"),
        ] {
            create(
                &conn,
                &ServiceEvent {
                    id: id.into(),
                    title: id.into(),
                    event_date: date.into(),
                    wallpaper: None,
                    theme_guid: None,
                    parts: vec![],
                },
            )
            .unwrap();
        }

        let events = list(&conn).unwrap();
        assert_eq!(
            events.iter().map(|event| event.id.as_str()).collect::<Vec<_>>(),
            vec!["e-antes", "e-meio", "e-depois"]
        );
    }

    #[test]
    fn list_conta_itens_programados_de_cada_evento() {
        let conn = open_in_memory();
        let event = ServiceEvent {
            id: "e-cheio".into(),
            title: "Culto".into(),
            event_date: "2026-10-18".into(),
            wallpaper: None,
            theme_guid: None,
            parts: vec![
                EventPart {
                    id: "p1".into(),
                    title: "Louvor".into(),
                    items: vec![
                        EventItem {
                            id: "i1".into(),
                            song_id: None,
                            next_item_id: None,
                            song: None,
                            media: None,
                            scripture: None,
                        },
                        EventItem {
                            id: "i2".into(),
                            song_id: None,
                            next_item_id: None,
                            song: None,
                            media: None,
                            scripture: None,
                        },
                    ],
                    color: None,
                    bg_color: None,
                },
                EventPart {
                    id: "p2".into(),
                    title: "Ofertório".into(),
                    items: vec![EventItem {
                        id: "i3".into(),
                        song_id: None,
                        next_item_id: None,
                        song: None,
                        media: None,
                        scripture: None,
                    }],
                    color: None,
                    bg_color: None,
                },
            ],
        };
        create(&conn, &event).unwrap();
        create(
            &conn,
            &ServiceEvent {
                id: "e-vazio".into(),
                title: "Vazio".into(),
                event_date: "2026-10-19".into(),
                wallpaper: None,
                theme_guid: None,
                parts: vec![],
            },
        )
        .unwrap();

        let events = list(&conn).unwrap();
        let cheio = events.iter().find(|e| e.id == "e-cheio").unwrap();
        let vazio = events.iter().find(|e| e.id == "e-vazio").unwrap();
        assert_eq!(cheio.item_count, 3);
        assert_eq!(vazio.item_count, 0);
    }

    #[test]
    fn salva_e_restaura_tema_do_evento() {
        let conn = open_in_memory();
        let mut event = ServiceEvent {
            id: "e-tema".into(),
            title: "Culto".into(),
            event_date: "2026-10-19".into(),
            wallpaper: None,
            theme_guid: None,
            parts: vec![],
        };
        create(&conn, &event).unwrap();
        event.theme_guid = Some("tema-1".into());
        save(&conn, &event).unwrap();

        let loaded = get(&conn, "e-tema").unwrap().unwrap();
        assert_eq!(loaded.theme_guid.as_deref(), Some("tema-1"));
        let summary = list(&conn).unwrap();
        assert_eq!(summary[0].theme_guid.as_deref(), Some("tema-1"));
    }

    #[test]
    fn delete_recusa_exclusao_do_temporario() {
        let conn = open_in_memory();
        get_temporary(&conn).unwrap();
        let res = delete(&conn, TEMPORARY_EVENT_ID);
        assert!(res.is_err());
        assert!(get(&conn, TEMPORARY_EVENT_ID).unwrap().is_some());
    }
}
