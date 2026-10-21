use crate::state::{SectionType, SongSection};

pub fn normalize(text: &str) -> String {
    let text = text.strip_prefix('\u{FEFF}').unwrap_or(text);
    text.replace("\r\n", "\n").replace('\r', "\n")
}

fn flush(
    sections: &mut Vec<SongSection>,
    lines: &mut Vec<String>,
    label: &mut Option<SectionType>,
) {
    if lines.is_empty() {
        return;
    }
    sections.push(SongSection {
        section_type: label.take(),
        lines: std::mem::take(lines),
    });
}

fn label_from_line(line: &str) -> Option<String> {
    let rest = line.strip_prefix("##")?.trim();
    let rest = rest.strip_prefix('(').unwrap_or(rest);
    let rest = rest.strip_suffix(')').unwrap_or(rest);
    Some(rest.trim().to_string())
}

fn is_chord_token(token: &str) -> bool {
    let clean = token.trim_matches(|c: char| {
        c == '(' || c == ')' || c == '[' || c == ']' || c == '{' || c == '}' || c == ',' || c == '.' || c == ';'
    });
    if clean.is_empty() {
        return false;
    }
    if clean == "%" || clean == "N.C." || clean == "NC" {
        return true;
    }
    let first = clean.chars().next().unwrap();
    if !('A'..='G').contains(&first) {
        return false;
    }
    clean.chars().all(|c| {
        c.is_alphanumeric()
            || c == '#'
            || c == '/'
            || c == '+'
            || c == '-'
            || c == '('
            || c == ')'
            || c == '^'
    })
}

pub fn is_chord_line(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with("##") {
        return false;
    }
    let tokens: Vec<&str> = trimmed.split_whitespace().collect();
    !tokens.is_empty() && tokens.iter().all(|t| is_chord_token(t))
}

pub fn parse_sections(text: &str) -> Vec<SongSection> {
    let normalized = normalize(text);
    let mut sections = Vec::new();
    let mut lines: Vec<String> = Vec::new();
    let mut label: Option<SectionType> = None;
    let mut blank_run = 0usize;
    let mut can_blank = false;

    for raw in normalized.lines() {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            if lines.is_empty() {
                if can_blank {
                    blank_run += 1;
                }
                continue;
            }
            // Se as linhas até agora contêm apenas comentários, permite que a linha
            // em branco seja apenas espaçamento entre o comentário e a letra
            if lines.iter().all(|l| l.trim().starts_with("//")) {
                blank_run = 0;
                can_blank = false;
                continue;
            }
            flush(&mut sections, &mut lines, &mut label);
            blank_run = 1;
            can_blank = true;
            continue;
        }

        if let Some(name) = label_from_line(trimmed) {
            if blank_run >= 2 && can_blank {
                sections.push(SongSection {
                    section_type: None,
                    lines: Vec::new(),
                });
            }
            // Comentários que imediatamente antecedem um rótulo ## (como //Primeira Estrofe em Holyrics)
            // são cabeçalhos descritivos e não pertencem ao bloco anterior
            lines.retain(|l| !l.trim().starts_with("//"));
            flush(&mut sections, &mut lines, &mut label);
            label = SectionType::from_label(&name);
            blank_run = 0;
            can_blank = false;
            continue;
        }

        // Um bloco que começa com comentário suprime o slide vazio, como o
        // comportamento anterior de espaçamento ao redor de comentários.
        if !trimmed.starts_with("//") && blank_run >= 2 && can_blank {
            sections.push(SongSection {
                section_type: None,
                lines: Vec::new(),
            });
        }

        if is_chord_line(raw) {
            lines.push(raw.trim_end().to_string());
        } else {
            lines.push(trimmed.to_string());
        }
        blank_run = 0;
        can_blank = false;
    }

    flush(&mut sections, &mut lines, &mut label);
    sections
}

pub fn sections_to_text(sections: &[SongSection]) -> String {
    let mut out = String::new();
    let mut wrote_block = false;
    let mut pending_empty = false;

    for section in sections {
        let lines: Vec<&str> = section
            .lines
            .iter()
            .map(|line| line.trim_end())
            .filter(|line| !line.trim().is_empty())
            .collect();
        if lines.is_empty() {
            if wrote_block {
                pending_empty = true;
            }
            continue;
        }

        if wrote_block {
            out.push_str(if pending_empty { "\n\n\n" } else { "\n\n" });
        }

        if let Some(section_type) = section.section_type {
            out.push_str("##(");
            out.push_str(section_type.as_label());
            out.push_str(")\n");
        }
        out.push_str(&lines.join("\n"));
        wrote_block = true;
        pending_empty = false;
    }

    out
}

pub fn split_sections(sections: &[SongSection], lines_per_slide: usize) -> Vec<SongSection> {
    let per = lines_per_slide.max(1);
    let mut result = Vec::new();
    for section in sections {
        if section.lines.len() <= per {
            result.push(section.clone());
            continue;
        }
        for (index, chunk) in section.lines.chunks(per).enumerate() {
            result.push(SongSection {
                section_type: if index == 0 { section.section_type } else { None },
                lines: chunk.to_vec(),
            });
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn blocks(pairs: Vec<(Option<SectionType>, Vec<&str>)>) -> Vec<SongSection> {
        pairs
            .into_iter()
            .map(|(section_type, lines)| SongSection {
                section_type,
                lines: lines.into_iter().map(str::to_string).collect(),
            })
            .collect()
    }

    #[test]
    fn uma_linha_em_branco_nao_cria_slide_vazio() {
        let sections = parse_sections("A\n\nB");
        assert_eq!(
            sections,
            blocks(vec![(None, vec!["A"]), (None, vec!["B"])])
        );
    }

    #[test]
    fn duas_linhas_em_branco_criam_um_slide_vazio() {
        let sections = parse_sections("A\n\n\nB");
        assert_eq!(
            sections,
            blocks(vec![
                (None, vec!["A"]),
                (None, vec![]),
                (None, vec!["B"]),
            ])
        );
    }

    #[test]
    fn tres_ou_mais_linhas_em_branco_colapsam_em_um_slide_vazio() {
        let sections = parse_sections("A\n\n\n\n\nB");
        assert_eq!(sections.len(), 3);
        assert!(sections[1].lines.is_empty());
    }

    #[test]
    fn brancos_iniciais_e_finais_sao_ignorados() {
        assert_eq!(
            parse_sections("\n\nA\n\n\n"),
            blocks(vec![(None, vec!["A"])])
        );
    }

    #[test]
    fn comentarios_sozinhos_nao_criam_slide_vazio() {
        let sections = parse_sections("A\n\n\n// observação\nB");
        assert_eq!(sections.len(), 2);
        assert_eq!(sections[0].lines, vec!["A"]);
        assert_eq!(sections[1].lines, vec!["// observação", "B"]);
    }

    #[test]
    fn round_trip_preserva_slide_vazio_entre_blocos() {
        let original = blocks(vec![
            (None, vec!["A"]),
            (None, vec![]),
            (None, vec!["B"]),
        ]);
        let text = sections_to_text(&original);
        assert_eq!(text, "A\n\n\nB");
        assert_eq!(parse_sections(&text), original);
    }

    #[test]
    fn rotulo_apos_slide_vazio_preserva_o_vazio() {
        let sections = parse_sections("A\n\n\n##(Refrão)\nB");
        assert_eq!(
            sections,
            blocks(vec![
                (None, vec!["A"]),
                (None, vec![]),
                (Some(SectionType::Chorus), vec!["B"]),
            ])
        );
    }

    #[test]
    fn round_trip_preserva_vazio_antes_de_rotulo() {
        let original = blocks(vec![
            (None, vec!["A"]),
            (None, vec![]),
            (Some(SectionType::Chorus), vec!["B"]),
        ]);
        let text = sections_to_text(&original);
        assert_eq!(text, "A\n\n\n##(Refrão)\nB");
        assert_eq!(parse_sections(&text), original);
    }

    #[test]
    fn saida_do_editor_com_rotulo_mantem_o_vazio() {
        let sections = parse_sections("A\n\n\n## Refrão\nB");
        assert_eq!(
            sections,
            blocks(vec![
                (None, vec!["A"]),
                (None, vec![]),
                (Some(SectionType::Chorus), vec!["B"]),
            ])
        );
    }

    #[test]
    fn split_sections_preserva_secao_vazia() {
        let sections = blocks(vec![(None, vec![]), (None, vec!["A", "B"])]);
        let split = split_sections(&sections, 1);
        assert!(split[0].lines.is_empty());
        assert_eq!(split.len(), 3);
    }

    #[test]
    fn separa_blocos_por_linha_em_branco() {
        let sections = parse_sections("linha um\nlinha dois\n\nlinha três");
        assert_eq!(
            sections,
            blocks(vec![
                (None, vec!["linha um", "linha dois"]),
                (None, vec!["linha três"]),
            ])
        );
    }

    #[test]
    fn rotulo_marca_o_bloco_seguinte() {
        let sections = parse_sections("##(Refrão)\nousado amor\n\nverso solto");
        assert_eq!(
            sections,
            blocks(vec![
                (Some(SectionType::Chorus), vec!["ousado amor"]),
                (None, vec!["verso solto"]),
            ])
        );
    }

    #[test]
    fn aceita_rotulo_com_e_sem_parenteses() {
        for linha in ["##(Verso 1)", "## Verso 1", "##Verso 1", "  ## (Verso 1)  "] {
            let sections = parse_sections(&format!("{linha}\nlinha"));
            assert_eq!(
                sections,
                blocks(vec![(Some(SectionType::Verse), vec!["linha"])]),
                "falhou para {linha:?}"
            );
        }
    }

    #[test]
    fn rotulo_encerra_o_bloco_anterior_mesmo_sem_linha_em_branco() {
        let sections = parse_sections("primeiro\n##(Refrão)\nsegundo");
        assert_eq!(
            sections,
            blocks(vec![
                (None, vec!["primeiro"]),
                (Some(SectionType::Chorus), vec!["segundo"]),
            ])
        );
    }

    #[test]
    fn comentarios_com_barras_sao_preservados_para_retorno() {
        let sections = parse_sections("//Primeira Estrofe\n##(Verso 1)\na\n//anotação\nb");
        assert_eq!(
            sections,
            blocks(vec![(Some(SectionType::Verse), vec!["a", "//anotação", "b"])])
        );
    }

    #[test]
    fn rotulos_desconhecidos_ficam_sem_tipo_mas_separam() {
        let sections = parse_sections("##(Estrofe A)\nlinha\n##()\noutra");
        assert_eq!(
            sections,
            blocks(vec![(None, vec!["linha"]), (None, vec!["outra"])])
        );
    }

    #[test]
    fn sinonimos_pt_e_en_viram_tipo() {
        let casos = [
            ("Coro", SectionType::Chorus),
            ("Estrofe 2", SectionType::Verse),
            ("Verse", SectionType::Verse),
            ("Chorus", SectionType::Chorus),
            ("Bridge", SectionType::Bridge),
            ("Pre-Chorus", SectionType::PreChorus),
            ("Ending", SectionType::Ending),
            ("Outro", SectionType::Outro),
        ];
        for (label, esperado) in casos {
            let sections = parse_sections(&format!("##({label})\nlinha"));
            assert_eq!(
                sections[0].section_type,
                Some(esperado),
                "falhou para {label:?}"
            );
        }
    }

    #[test]
    fn normaliza_bom_crlf_espacos_e_linhas_em_branco_repetidas() {
        let sections = parse_sections("\u{FEFF}a  \r\n\r\n\r\n\r\n  b\t\r\n");
        assert_eq!(
            sections,
            blocks(vec![(None, vec!["a"]), (None, vec![]), (None, vec!["b"])])
        );
    }

    #[test]
    fn texto_sem_conteudo_nao_gera_blocos() {
        assert!(parse_sections("").is_empty());
        assert!(parse_sections("\n\n\n").is_empty());
        assert!(parse_sections("##(Refrão)").is_empty());
    }

    #[test]
    fn serializa_no_mesmo_formato_e_reparseia_igual() {
        let original = blocks(vec![
            (Some(SectionType::Verse), vec!["a", "b"]),
            (None, vec!["c"]),
            (Some(SectionType::Chorus), vec!["d"]),
        ]);
        let texto = sections_to_text(&original);
        assert_eq!(texto, "##(Verso)\na\nb\n\nc\n\n##(Refrão)\nd");
        assert_eq!(parse_sections(&texto), original);
    }

    #[test]
    fn serializacao_ignora_blocos_vazios() {
        let texto = sections_to_text(&blocks(vec![(None, vec![]), (None, vec!["x"])]));
        assert_eq!(texto, "x");
    }

    #[test]
    fn rotulos_canonicos_reparseiam_para_o_mesmo_tipo() {
        let todos = [
            SectionType::Verse,
            SectionType::PreChorus,
            SectionType::Chorus,
            SectionType::Bridge,
            SectionType::Intro,
            SectionType::Outro,
            SectionType::Instrumental,
            SectionType::Tag,
            SectionType::Ending,
        ];
        for tipo in todos {
            assert_eq!(
                SectionType::from_label(tipo.as_label()),
                Some(tipo),
                "falhou para {:?}",
                tipo.as_label()
            );
        }
    }

    #[test]
    fn round_trip_cobre_todos_os_tipos() {
        let original: Vec<SongSection> = [
            SectionType::Verse,
            SectionType::PreChorus,
            SectionType::Chorus,
            SectionType::Bridge,
            SectionType::Intro,
            SectionType::Outro,
            SectionType::Instrumental,
            SectionType::Tag,
            SectionType::Ending,
        ]
        .into_iter()
        .map(|section_type| SongSection {
            section_type: Some(section_type),
            lines: vec![format!("linha de {}", section_type.as_label())],
        })
        .collect();

        assert_eq!(parse_sections(&sections_to_text(&original)), original);
    }

    #[test]
    fn rotulo_permanece_apos_comentario_ou_linha_em_branco() {
        let sections = parse_sections("##(Refrão)\n//comentário\n\nlinha");
        assert_eq!(
            sections,
            blocks(vec![(Some(SectionType::Chorus), vec!["//comentário", "linha"])])
        );
    }

    #[test]
    fn comentarios_e_linhas_sao_preservados_ao_salvar() {
        let salvo = sections_to_text(&blocks(vec![(
            None,
            vec!["//comentário", "resto"],
        )]));
        assert_eq!(parse_sections(&salvo), blocks(vec![(None, vec!["//comentário", "resto"])]));
    }

    #[test]
    fn divide_estrofe_e_so_o_primeiro_fragmento_mantem_rotulo() {
        let original = blocks(vec![(
            Some(SectionType::Verse),
            vec!["a", "b", "c", "d", "e"],
        )]);
        assert_eq!(
            split_sections(&original, 2),
            blocks(vec![
                (Some(SectionType::Verse), vec!["a", "b"]),
                (None, vec!["c", "d"]),
                (None, vec!["e"]),
            ])
        );
    }

    #[test]
    fn secao_curta_fica_intacta() {
        let original = blocks(vec![(Some(SectionType::Chorus), vec!["a", "b"])]);
        assert_eq!(split_sections(&original, 2), original);
    }

    #[test]
    fn uma_linha_por_slide_quebra_cada_linha() {
        let original = blocks(vec![(None, vec!["a", "b", "c"])]);
        assert_eq!(
            split_sections(&original, 1),
            blocks(vec![(None, vec!["a"]), (None, vec!["b"]), (None, vec!["c"])])
        );
    }
}
