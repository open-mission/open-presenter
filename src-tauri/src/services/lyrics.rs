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

pub fn parse_sections(text: &str) -> Vec<SongSection> {
    let normalized = normalize(text);
    let mut sections = Vec::new();
    let mut lines: Vec<String> = Vec::new();
    let mut label: Option<SectionType> = None;

    for raw in normalized.lines() {
        let line = raw.trim();
        if line.is_empty() {
            flush(&mut sections, &mut lines, &mut label);
            continue;
        }
        if line.starts_with("//") {
            continue;
        }
        if let Some(name) = label_from_line(line) {
            flush(&mut sections, &mut lines, &mut label);
            label = SectionType::from_label(&name);
            continue;
        }
        lines.push(line.to_string());
    }

    flush(&mut sections, &mut lines, &mut label);
    sections
}

pub fn sections_to_text(sections: &[SongSection]) -> String {
    let mut blocks: Vec<String> = Vec::new();

    for section in sections {
        let lines: Vec<&str> = section
            .lines
            .iter()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect();
        if lines.is_empty() {
            continue;
        }

        let mut block = String::new();
        if let Some(section_type) = section.section_type {
            block.push_str("##(");
            block.push_str(section_type.as_label());
            block.push_str(")\n");
        }
        block.push_str(&lines.join("\n"));
        blocks.push(block);
    }

    blocks.join("\n\n")
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
    fn comentarios_com_barras_sao_ignorados() {
        let sections = parse_sections("//Primeira Estrofe\n##(Verso 1)\na\n//anotação\nb");
        assert_eq!(
            sections,
            blocks(vec![(Some(SectionType::Verse), vec!["a", "b"])])
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
            blocks(vec![(None, vec!["a"]), (None, vec!["b"])])
        );
    }

    #[test]
    fn texto_sem_conteudo_nao_gera_blocos() {
        assert!(parse_sections("").is_empty());
        assert!(parse_sections("\n\n\n").is_empty());
        assert!(parse_sections("// só comentário").is_empty());
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
}
