use std::collections::HashMap;

use rusqlite::Connection;
use tauri::AppHandle;

use crate::state::{RemoteItem, RemotePart, RemoteSetlist, RemoteSlide};
use crate::state::types::{
    EventItem, MediaItem, MediaKind, ScriptureRef, SectionType, ServiceEvent, SlideContent,
    SlideKind, Song, SongSection,
};

/// Computa os rótulos de cada estrofe da música, espelhando fielmente
/// a função `computeSectionLabels` de `src/core/lib/lyrics.ts`.
/// - Chorus nunca recebe sufixo numérico (sempre "Refrão").
/// - Tipos que aparecem apenas 1 vez não recebem número (ex.: "Verso").
/// - Tipos que aparecem 2 ou mais vezes recebem contador sequencial (ex.: "Verso 1", "Verso 2").
/// - Seções sem tipo (`section_type: None`) recebem `None`.
pub fn compute_section_labels(sections: &[SongSection]) -> Vec<Option<String>> {
    let mut totals: HashMap<SectionType, usize> = HashMap::new();
    for section in sections {
        if let Some(st) = section.section_type {
            *totals.entry(st).or_insert(0) += 1;
        }
    }

    let mut counters: HashMap<SectionType, usize> = HashMap::new();
    sections
        .iter()
        .map(|section| {
            let st = section.section_type?;
            let label = st.as_label();
            if st == SectionType::Chorus || totals.get(&st).copied().unwrap_or(0) <= 1 {
                Some(label.to_string())
            } else {
                let counter = counters.entry(st).or_insert(0);
                *counter += 1;
                Some(format!("{label} {counter}"))
            }
        })
        .collect()
}

/// Monta a lista de `RemoteSlide` de uma música.
/// Cada seção vira um slide com:
/// - `index`: índice ordinal (0..N-1)
/// - `label`: rótulo computado
/// - `content`: SlideContent com ID `{song_id}#{index}`, kind Lyric, lines e section espelhando o rótulo.
pub fn build_song_slides(song: &Song, add_empty_slide_at_start: bool) -> Vec<RemoteSlide> {
    let labels = compute_section_labels(&song.sections);
    let offset = usize::from(add_empty_slide_at_start);

    let mut slides: Vec<RemoteSlide> = song
        .sections
        .iter()
        .enumerate()
        .map(|(section_index, section)| {
            let label = labels.get(section_index).and_then(|l| l.clone());
            RemoteSlide {
                index: section_index + offset,
                label: label.clone(),
                section_type: section.section_type,
                content: SlideContent {
                    id: format!("{}#{}", song.id, section_index),
                    kind: SlideKind::Lyric,
                    title: song.title.clone(),
                    lines: section.lines.clone(),
                    notes: None,
                    section: label,
                    media: None,
                    scripture: None,
                },
            }
        })
        .collect();

    if offset == 1 {
        slides.insert(
            0,
            RemoteSlide {
                index: 0,
                label: None,
                section_type: None,
                content: SlideContent {
                    id: format!("{}#empty-start", song.id),
                    kind: SlideKind::Lyric,
                    title: String::new(),
                    lines: Vec::new(),
                    notes: None,
                    section: None,
                    media: None,
                    scripture: None,
                },
            },
        );
    }

    slides
}

pub fn bible_slide_id(
    book_id: i32,
    chapter: i32,
    verse: i32,
    part: usize,
    total_parts: usize,
) -> String {
    if total_parts > 1 {
        format!("bible-{book_id}-{chapter}-{verse}#{}", part + 1)
    } else {
        format!("bible-{book_id}-{chapter}-{verse}")
    }
}

pub fn bible_part_suffix(part: usize, total_parts: usize) -> String {
    if total_parts > 1 {
        format!(" ({}/{})", part + 1, total_parts)
    } else {
        String::new()
    }
}

#[allow(clippy::too_many_arguments)]
pub fn build_bible_slide(
    version_id: &str,
    book_id: i32,
    book_name: &str,
    chapter: i32,
    verse: i32,
    text: String,
    part: usize,
    total_parts: usize,
) -> SlideContent {
    let suffix = bible_part_suffix(part, total_parts);
    SlideContent {
        id: bible_slide_id(book_id, chapter, verse, part, total_parts),
        kind: SlideKind::Scripture,
        title: format!("{book_name} {chapter}:{verse}{suffix} ({version_id})"),
        lines: vec![text],
        notes: None,
        section: Some(format!("{book_name} {chapter}:{verse}{suffix}")),
        media: None,
        scripture: Some(ScriptureRef {
            version_id: version_id.to_string(),
            book_id,
            book_name: book_name.to_string(),
            chapter,
            verse,
            part,
            total_parts,
        }),
    }
}

pub fn build_media_slides(item_id: &str, media: &MediaItem) -> Vec<RemoteSlide> {
    match media.kind {
        MediaKind::Text => {
            let raw_text = media.text.as_deref().unwrap_or("");
            let blocks: Vec<Vec<String>> = raw_text
                .replace("\r\n", "\n")
                .split("\n\n")
                .map(|block| {
                    block
                        .lines()
                        .map(|l| l.trim_end().to_string())
                        .filter(|l| !l.trim().is_empty())
                        .collect::<Vec<_>>()
                })
                .filter(|b| !b.is_empty())
                .collect();

            if blocks.is_empty() && media.theme_id.is_some() {
                return vec![RemoteSlide {
                    index: 0,
                    label: Some("Apresentação".to_string()),
                    section_type: None,
                    content: SlideContent {
                        id: format!("{item_id}#0"),
                        kind: SlideKind::Custom,
                        title: media.title.clone(),
                        lines: Vec::new(),
                        notes: None,
                        section: None,
                        media: Some(media.clone()),
                        scripture: None,
                    },
                }];
            }

            let total = blocks.len();
            blocks
                .into_iter()
                .enumerate()
                .map(|(index, lines)| {
                    let label = if total > 1 {
                        format!("Texto {}", index + 1)
                    } else if media.theme_id.is_some() {
                        "Apresentação".to_string()
                    } else {
                        "Texto".to_string()
                    };
                    let section = if total > 1 {
                        Some(format!("{}/{}", index + 1, total))
                    } else {
                        None
                    };
                    RemoteSlide {
                        index,
                        label: Some(label),
                        section_type: None,
                        content: SlideContent {
                            id: format!("{item_id}#{index}"),
                            kind: SlideKind::Custom,
                            title: media.title.clone(),
                            lines,
                            notes: None,
                            section,
                            media: Some(media.clone()),
                            scripture: None,
                        },
                    }
                })
                .collect()
        }
        MediaKind::Image => {
            vec![RemoteSlide {
                index: 0,
                label: Some("Imagem".to_string()),
                section_type: None,
                content: SlideContent {
                    id: format!("{item_id}#0"),
                    kind: SlideKind::Media,
                    title: media.title.clone(),
                    lines: Vec::new(),
                    notes: None,
                    section: None,
                    media: Some(media.clone()),
                    scripture: None,
                },
            }]
        }
        MediaKind::Folder => {
            if media.files.is_empty() {
                vec![RemoteSlide {
                    index: 0,
                    label: Some("Pasta de imagens".to_string()),
                    section_type: None,
                    content: SlideContent {
                        id: format!("{item_id}#0"),
                        kind: SlideKind::Media,
                        title: media.title.clone(),
                        lines: Vec::new(),
                        notes: None,
                        section: None,
                        media: Some(media.clone()),
                        scripture: None,
                    },
                }]
            } else {
                media
                    .files
                    .iter()
                    .enumerate()
                    .map(|(idx, file)| {
                        let mut m = media.clone();
                        m.path = Some(file.clone());
                        m.index = Some(idx);
                        RemoteSlide {
                            index: idx,
                            label: Some(format!("Imagem {}", idx + 1)),
                            section_type: None,
                            content: SlideContent {
                                id: format!("{item_id}#{idx}"),
                                kind: SlideKind::Media,
                                title: media.title.clone(),
                                lines: Vec::new(),
                                notes: None,
                                section: Some(format!("{}/{}", idx + 1, media.files.len())),
                                media: Some(m),
                                scripture: None,
                            },
                        }
                    })
                    .collect()
            }
        }
        MediaKind::Video => {
            vec![RemoteSlide {
                index: 0,
                label: Some("Vídeo".to_string()),
                section_type: None,
                content: SlideContent {
                    id: format!("{item_id}#0"),
                    kind: SlideKind::Media,
                    title: media.title.clone(),
                    lines: Vec::new(),
                    notes: None,
                    section: None,
                    media: Some(media.clone()),
                    scripture: None,
                },
            }]
        }
    }
}

pub fn build_remote_item(
    conn: &Connection,
    app: Option<&AppHandle>,
    item: &EventItem,
    add_empty_slide_at_start: bool,
) -> RemoteItem {
    if let Some(ref scrip) = item.scripture {
        let text = if let Some(app) = app {
            crate::services::bible::get_bible_chapter(
                app,
                &scrip.version_id,
                scrip.book_id,
                scrip.chapter,
            )
            .ok()
            .and_then(|verses| {
                verses
                    .into_iter()
                    .find(|v| v.verse == scrip.verse)
                    .map(|v| v.text)
            })
            .unwrap_or_default()
        } else {
            String::new()
        };

        let label = if scrip.total_parts > 1 {
            Some(format!("Parte {}/{}", scrip.part + 1, scrip.total_parts))
        } else {
            None
        };

        let content = build_bible_slide(
            &scrip.version_id,
            scrip.book_id,
            &scrip.book_name,
            scrip.chapter,
            scrip.verse,
            text,
            scrip.part,
            scrip.total_parts,
        );

        let slide = RemoteSlide {
            index: scrip.part,
            label,
            section_type: None,
            content,
        };

        return RemoteItem {
            id: item.id.clone(),
            kind: "scripture".to_string(),
            title: format!("{} {}:{}", scrip.book_name, scrip.chapter, scrip.verse),
            subtitle: Some(scrip.version_id.clone()),
            next_item_id: item.next_item_id.clone(),
            slides: vec![slide],
        };
    }

    if let Some(ref media) = item.media {
        if let Some(ref theme_id) = media.theme_id {
            if let Ok(Some(theme)) = crate::services::themes::get_theme(conn, theme_id) {
                if theme.category.as_deref() == Some("presentation") {
                    if let Some(ref pages) = theme.pages {
                        if !pages.is_empty() {
                            let total = pages.len();
                            let slides = pages
                                .iter()
                                .enumerate()
                                .map(|(index, page)| {
                                    let label = page
                                        .name
                                        .clone()
                                        .unwrap_or_else(|| format!("Slide {}", index + 1));
                                    let section = if total > 1 {
                                        Some(format!("{}/{}", index + 1, total))
                                    } else {
                                        None
                                    };
                                    let mut slide_media = media.clone();
                                    slide_media.index = Some(index);
                                    RemoteSlide {
                                        index,
                                        label: Some(label),
                                        section_type: None,
                                        content: SlideContent {
                                            id: format!("{}#{index}", item.id),
                                            kind: SlideKind::Custom,
                                            title: page.name.clone().unwrap_or_else(|| media.title.clone()),
                                            lines: Vec::new(),
                                            notes: None,
                                            section,
                                            media: Some(slide_media),
                                            scripture: None,
                                        },
                                    }
                                })
                                .collect();
                            return RemoteItem {
                                id: item.id.clone(),
                                kind: "media".to_string(),
                                title: media.title.clone(),
                                subtitle: Some("Apresentação".to_string()),
                                next_item_id: item.next_item_id.clone(),
                                slides,
                            };
                        }
                    }
                }
            }
        }

        let slides = build_media_slides(&item.id, media);
        return RemoteItem {
            id: item.id.clone(),
            kind: "media".to_string(),
            title: media.title.clone(),
            subtitle: Some(media.kind.as_label().to_string()),
            next_item_id: item.next_item_id.clone(),
            slides,
        };
    }

    if let Some(ref song_id) = item.song_id {
        if let Ok(Some(song)) = crate::services::songs::get(conn, song_id) {
            let slides = build_song_slides(&song, add_empty_slide_at_start);
            return RemoteItem {
                id: item.id.clone(),
                kind: "song".to_string(),
                title: song.title,
                subtitle: Some(song.artist),
                next_item_id: item.next_item_id.clone(),
                slides,
            };
        }
    }

    RemoteItem {
        id: item.id.clone(),
        kind: if item.song_id.is_some() {
            "song".to_string()
        } else {
            "media".to_string()
        },
        title: item
            .song
            .as_ref()
            .map(|s| s.title.clone())
            .unwrap_or_else(|| "Item sem mídia".to_string()),
        subtitle: None,
        next_item_id: item.next_item_id.clone(),
        slides: Vec::new(),
    }
}

pub fn build_remote_setlist(
    conn: &Connection,
    app: Option<&AppHandle>,
    event: &ServiceEvent,
    add_empty_slide_at_start: bool,
) -> RemoteSetlist {
    let mut parts = Vec::with_capacity(event.parts.len());
    for part in &event.parts {
        let mut items = Vec::with_capacity(part.items.len());
        for item in &part.items {
            let remote_item = build_remote_item(conn, app, item, add_empty_slide_at_start);
            items.push(remote_item);
        }
        parts.push(RemotePart {
            id: part.id.clone(),
            title: if part.title.is_empty() {
                "Programação".to_string()
            } else {
                part.title.clone()
            },
            items,
        });
    }

    RemoteSetlist {
        event_id: event.id.clone(),
        title: event.title.clone(),
        event_date: event.event_date.clone(),
        parts,
        groups: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compute_section_labels_numera_apenas_quando_ha_multiplas_ocorrencias() {
        let sections = vec![
            SongSection {
                section_type: Some(SectionType::Verse),
                lines: vec!["Linha 1".into()],
            },
            SongSection {
                section_type: Some(SectionType::Chorus),
                lines: vec!["Linha 2".into()],
            },
            SongSection {
                section_type: Some(SectionType::Verse),
                lines: vec!["Linha 3".into()],
            },
            SongSection {
                section_type: Some(SectionType::Chorus),
                lines: vec!["Linha 4".into()],
            },
            SongSection {
                section_type: Some(SectionType::Bridge),
                lines: vec!["Linha 5".into()],
            },
            SongSection {
                section_type: None,
                lines: vec!["Linha 6".into()],
            },
        ];

        let labels = compute_section_labels(&sections);
        assert_eq!(
            labels,
            vec![
                Some("Verso 1".into()),
                Some("Refrão".into()),
                Some("Verso 2".into()),
                Some("Refrão".into()),
                Some("Ponte".into()), // única -> sem número
                None,                  // sem tipo -> None
            ]
        );
    }

    #[test]
    fn prefixa_slide_vazio_quando_solicitado() {
        let song = song_com_uma_secao();
        let slides = build_song_slides(&song, true);
        assert_eq!(slides.len(), 2);
        assert_eq!(slides[0].index, 0);
        assert_eq!(slides[0].content.id, format!("{}#empty-start", song.id));
        assert!(slides[0].content.lines.is_empty());
        assert!(slides[0].label.is_none());
        assert_eq!(slides[1].index, 1);
        assert_eq!(slides[1].section_type, Some(SectionType::Verse));
    }

    fn song_com_uma_secao() -> Song {
        Song {
            id: "musica-1".into(),
            title: "Uma música".into(),
            artist: "Artista".into(),
            album: None,
            composer: None,
            song_key: None,
            bpm: None,
            sections: vec![SongSection {
                section_type: Some(SectionType::Verse),
                lines: vec!["Linha".into()],
            }],
        }
    }

    #[test]
    fn build_song_slides_monta_slides_com_ids_e_rotulos_corretos() {
        let song = Song {
            id: "musica-1".into(),
            title: "Porque Ele Vive".into(),
            artist: "Harpa Cristã".into(),
            album: None,
            composer: None,
            song_key: None,
            bpm: None,
            sections: vec![
                SongSection {
                    section_type: Some(SectionType::Verse),
                    lines: vec!["Deus enviou".into(), "Seu Filho amado".into()],
                },
                SongSection {
                    section_type: None,
                    lines: vec!["Para perdoar".into()],
                },
                SongSection {
                    section_type: Some(SectionType::Chorus),
                    lines: vec!["Porque Ele vive".into()],
                },
            ],
        };

        let slides = build_song_slides(&song, false);
        assert_eq!(slides.len(), 3);

        // Slide 0: Verso único -> "Verso"
        assert_eq!(slides[0].index, 0);
        assert_eq!(slides[0].label, Some("Verso".into()));
        assert_eq!(slides[0].content.id, "musica-1#0");
        assert_eq!(slides[0].content.title, "Porque Ele Vive");
        assert_eq!(slides[0].content.section, Some("Verso".into()));
        assert_eq!(slides[0].content.lines, vec!["Deus enviou", "Seu Filho amado"]);

        // Slide 1: Sem tipo -> label None
        assert_eq!(slides[1].index, 1);
        assert_eq!(slides[1].label, None);
        assert_eq!(slides[1].content.id, "musica-1#1");
        assert_eq!(slides[1].content.section, None);
        assert_eq!(slides[1].content.lines, vec!["Para perdoar"]);

        // Slide 2: Refrão -> "Refrão"
        assert_eq!(slides[2].index, 2);
        assert_eq!(slides[2].label, Some("Refrão".into()));
        assert_eq!(slides[2].content.id, "musica-1#2");
        assert_eq!(slides[2].content.section, Some("Refrão".into()));
        assert_eq!(slides[2].content.lines, vec!["Porque Ele vive"]);
    }

    #[test]
    fn build_bible_slide_formata_titulo_e_referencia() {
        let slide = build_bible_slide("NVI", 43, "João", 3, 16, "Porque Deus amou o mundo...".into(), 0, 1);
        assert_eq!(slide.id, "bible-43-3-16");
        assert_eq!(slide.title, "João 3:16 (NVI)");
        assert_eq!(slide.lines, vec!["Porque Deus amou o mundo..."]);
        assert_eq!(slide.scripture.unwrap().book_name, "João");

        // Com múltiplas partes
        let slide_part = build_bible_slide("NVI", 43, "João", 3, 16, "Parte dois".into(), 1, 2);
        assert_eq!(slide_part.id, "bible-43-3-16#2");
        assert_eq!(slide_part.title, "João 3:16 (2/2) (NVI)");
    }

    #[test]
    fn build_media_slides_quebra_blocos_de_texto() {
        let media = MediaItem {
            kind: MediaKind::Text,
            title: "Avisos".into(),
            text: Some("Primeiro aviso linha 1\nLinha 2\n\nSegundo aviso linha 1".into()),
            path: None,
            files: vec![],
            index: None,
            fit: None,
            theme_id: None,
        };

        let slides = build_media_slides("item-avisos", &media);
        assert_eq!(slides.len(), 2);
        assert_eq!(slides[0].label, Some("Texto 1".into()));
        assert_eq!(slides[0].content.lines, vec!["Primeiro aviso linha 1", "Linha 2"]);
        assert_eq!(slides[1].label, Some("Texto 2".into()));
        assert_eq!(slides[1].content.lines, vec!["Segundo aviso linha 1"]);
    }
}
