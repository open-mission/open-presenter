use std::collections::HashMap;

use crate::state::RemoteSlide;
use crate::state::types::{SectionType, SlideContent, SlideKind, Song, SongSection};

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
pub fn build_song_slides(song: &Song) -> Vec<RemoteSlide> {
    let labels = compute_section_labels(&song.sections);

    song.sections
        .iter()
        .enumerate()
        .map(|(index, section)| {
            let label = labels.get(index).and_then(|l| l.clone());
            RemoteSlide {
                index,
                label: label.clone(),
                content: SlideContent {
                    id: format!("{}#{}", song.id, index),
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
        .collect()
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

        let slides = build_song_slides(&song);
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
}
