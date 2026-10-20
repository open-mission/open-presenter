use std::collections::HashMap;

pub fn render_template(template: &str, props: &HashMap<String, String>) -> String {
    let mut out = template.to_string();
    let mut chaves: Vec<&String> = props.keys().collect();
    chaves.sort();
    for k in chaves {
        if k.starts_with("__") {
            continue;
        }
        out = out.replace(&format!("{{{k}}}"), &props[k]);
    }
    limpar_restantes(&out)
}

fn limpar_restantes(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut resto = text;
    while let Some(abertura) = resto.find('{') {
        out.push_str(&resto[..abertura]);
        let apos = &resto[abertura + 1..];
        match apos.find('}') {
            Some(fecho) => resto = &apos[fecho + 1..],
            None => {
                out.push_str(&resto[abertura..]);
                resto = "";
            }
        }
    }
    out.push_str(resto);
    out
}

pub fn next_preview_of(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let first_line = match trimmed.split_once('\n') {
        Some((first, _)) => first.trim(),
        None => trimmed,
    };
    if first_line.chars().count() <= max_chars {
        let clean = first_line.trim_end_matches(|c: char| c == '.' || c == ',' || c == ';' || c == ':' || c.is_whitespace());
        format!("{clean}...")
    } else {
        let chars: Vec<char> = first_line.chars().collect();
        let slice: String = chars[..max_chars].iter().collect();
        let cut = match slice.rfind(' ') {
            Some(space_idx) if space_idx > 20 => &slice[..space_idx],
            _ => &slice,
        };
        let clean = cut.trim_end_matches(|c: char| c == '.' || c == ',' || c == ';' || c == ':' || c.is_whitespace());
        format!("{clean}...")
    }
}

pub fn lyric_props(
    title: &str,
    artist: &str,
    text: &str,
    next_verse: &str,
    section: &str,
    index: usize,
    total: usize,
) -> HashMap<String, String> {
    let next_preview = next_preview_of(next_verse, 75);
    let next_line = next_verse.split_once('\n').map_or(next_verse, |(f, _)| f).trim();
    HashMap::from([
        ("title".into(), title.into()),
        ("artist".into(), artist.into()),
        ("lyrics".into(), text.into()),
        ("text".into(), text.into()),
        ("content".into(), text.into()),
        ("next_verse".into(), next_verse.into()),
        ("next_up".into(), next_verse.into()),
        ("next_preview".into(), next_preview.clone()),
        ("next_verse_preview".into(), next_preview.clone()),
        ("next_snippet".into(), next_preview.clone()),
        ("next_line".into(), next_line.into()),
        ("section".into(), section.into()),
        ("current_slide".into(), index.to_string()),
        ("total_slides".into(), total.to_string()),
        // Legacy pt-BR
        ("titulo".into(), title.into()),
        ("artista".into(), artist.into()),
        ("letra".into(), text.into()),
        ("texto".into(), text.into()),
        ("nextVerse".into(), next_verse.into()),
        ("proximo_resumo".into(), next_preview.clone()),
        ("proximo_versiculo_resumo".into(), next_preview.clone()),
        ("proximo_preview".into(), next_preview.clone()),
        ("proximo_trecho".into(), next_preview),
        ("proxima_linha".into(), next_line.into()),
        ("secao".into(), section.into()),
        ("currentIndex".into(), index.to_string()),
        ("totalCount".into(), total.to_string()),
    ])
}

pub fn scripture_props(
    title: &str,
    text: &str,
    book: &str,
    chapter: &str,
    verse: &str,
    version: &str,
    next_verse: &str,
) -> HashMap<String, String> {
    let next_preview = next_preview_of(next_verse, 75);
    let next_line = next_verse.split_once('\n').map_or(next_verse, |(f, _)| f).trim();
    HashMap::from([
        ("title".into(), title.into()),
        ("verse".into(), text.into()),
        ("text".into(), text.into()),
        ("content".into(), text.into()),
        ("lyrics".into(), text.into()),
        ("current_verse".into(), text.into()),
        ("book".into(), book.into()),
        ("chapter".into(), chapter.into()),
        ("verse_number".into(), verse.into()),
        ("version".into(), version.into()),
        ("next_verse".into(), next_verse.into()),
        ("next_up".into(), next_verse.into()),
        ("next_preview".into(), next_preview.clone()),
        ("next_verse_preview".into(), next_preview.clone()),
        ("next_snippet".into(), next_preview.clone()),
        ("next_line".into(), next_line.into()),
        // Legacy pt-BR
        ("titulo".into(), title.into()),
        ("verso".into(), text.into()),
        ("texto".into(), text.into()),
        ("letra".into(), text.into()),
        ("versiculo_corrente".into(), text.into()),
        ("livro".into(), book.into()),
        ("capitulo".into(), chapter.into()),
        ("versiculo".into(), verse.into()),
        ("versao".into(), version.into()),
        ("nextVerse".into(), next_verse.into()),
        ("proximo_resumo".into(), next_preview.clone()),
        ("proximo_versiculo_resumo".into(), next_preview.clone()),
        ("proximo_preview".into(), next_preview.clone()),
        ("proximo_trecho".into(), next_preview),
        ("proxima_linha".into(), next_line.into()),
    ])
}

pub fn custom_props(
    title: &str,
    text: &str,
    index: usize,
    total: usize,
) -> HashMap<String, String> {
    HashMap::from([
        ("title".into(), title.into()),
        ("text".into(), text.into()),
        ("content".into(), text.into()),
        ("lyrics".into(), text.into()),
        ("current_slide".into(), index.to_string()),
        ("total_slides".into(), total.to_string()),
        // Legacy pt-BR
        ("titulo".into(), title.into()),
        ("texto".into(), text.into()),
        ("letra".into(), text.into()),
        ("currentIndex".into(), index.to_string()),
        ("totalCount".into(), total.to_string()),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn props(pares: &[(&str, &str)]) -> HashMap<String, String> {
        pares
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    #[test]
    fn substitui_letra() {
        let p = props(&[("letra", "Linha1\nLinha2")]);
        assert_eq!(render_template("{letra}", &p), "Linha1\nLinha2");
    }

    #[test]
    fn substitui_todas_ocorrencias() {
        let p = props(&[("titulo", "Amazing")]);
        assert_eq!(
            render_template("{titulo} - {titulo}", &p),
            "Amazing - Amazing"
        );
    }

    #[test]
    fn remove_desconhecida() {
        let p = props(&[]);
        assert_eq!(render_template("A {desconhecida} B", &p), "A  B");
    }

    #[test]
    fn ignora_chave_privada() {
        let p = props(&[("__x", "secreto")]);
        assert_eq!(render_template("{__x}", &p), "");
    }

    #[test]
    fn relogio_presente_quando_em_props() {
        let p = props(&[("HH:MM", "19:30")]);
        assert_eq!(render_template("{HH:MM}", &p), "19:30");
    }

    #[test]
    fn relogio_removido_quando_ausente() {
        let p = props(&[]);
        assert_eq!(render_template("agora {HH:MM} fim", &p), "agora  fim");
        assert_eq!(render_template("{tMM:tSS}", &p), "");
    }

    #[test]
    fn lyric_props_chaves() {
        let p = lyric_props("Titulo", "Artista", "La", "Next", "Verso 1", 2, 5);
        assert_eq!(p.get("titulo").map(String::as_str), Some("Titulo"));
        assert_eq!(p.get("artista").map(String::as_str), Some("Artista"));
        assert_eq!(p.get("letra").map(String::as_str), Some("La"));
        assert_eq!(p.get("nextVerse").map(String::as_str), Some("Next"));
        assert_eq!(p.get("secao").map(String::as_str), Some("Verso 1"));
        assert_eq!(p.get("currentIndex").map(String::as_str), Some("2"));
        assert_eq!(p.get("totalCount").map(String::as_str), Some("5"));
    }

    #[test]
    fn scripture_props_chaves() {
        let p = scripture_props(
            "Salmos 23",
            "O Senhor...",
            "Salmos",
            "23",
            "1",
            "ACF",
            "Next",
        );
        assert_eq!(p.get("titulo").map(String::as_str), Some("Salmos 23"));
        assert_eq!(p.get("verso").map(String::as_str), Some("O Senhor..."));
        assert_eq!(p.get("livro").map(String::as_str), Some("Salmos"));
        assert_eq!(p.get("capitulo").map(String::as_str), Some("23"));
        assert_eq!(p.get("versiculo").map(String::as_str), Some("1"));
        assert_eq!(p.get("versao").map(String::as_str), Some("ACF"));
        assert_eq!(p.get("nextVerse").map(String::as_str), Some("Next"));
        assert_eq!(p.get("next_preview").map(String::as_str), Some("Next..."));
        assert_eq!(p.get("proximo_resumo").map(String::as_str), Some("Next..."));
        assert_eq!(p.get("text").map(String::as_str), Some("O Senhor..."));
    }

    #[test]
    fn next_preview_of_trunca_e_adiciona_reticencias() {
        assert_eq!(next_preview_of("", 50), "");
        assert_eq!(
            next_preview_of("No princípio era o Verbo.", 50),
            "No princípio era o Verbo..."
        );
        assert_eq!(
            next_preview_of("Primeira linha\nSegunda linha", 50),
            "Primeira linha..."
        );
    }

    #[test]
    fn valor_com_chave_em_cascata_ordem_classificada_resulta_x() {
        let p = props(&[("a", "{b}"), ("b", "x")]);
        assert_eq!(render_template("{a}", &p), "x");
    }

    #[test]
    fn custom_props_contem_texto_sem_cifra() {
        let p = custom_props("Aviso", "Bem-vindos", 0, 3);
        assert_eq!(p.get("titulo").map(String::as_str), Some("Aviso"));
        assert_eq!(p.get("texto").map(String::as_str), Some("Bem-vindos"));
        assert_eq!(p.get("currentIndex").map(String::as_str), Some("0"));
        assert_eq!(p.get("totalCount").map(String::as_str), Some("3"));
        assert!(!p.contains_key("cifra"));
        assert!(!p.contains_key("secao"));
    }
}
