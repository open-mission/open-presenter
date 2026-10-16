use std::sync::{Arc, RwLock};

use super::types::{LiveSlide, LiveThemes};

fn blank_slide() -> LiveSlide {
    serde_json::from_value(serde_json::json!({
        "content": {
            "id": "blank",
            "kind": "blank",
            "title": "Nenhum slide ao vivo",
            "lines": ["Aguardando operador…"],
            "notes": null
        },
        "background": { "id": "bg-default", "kind": "color", "value": "#000000" },
        "blackout": false,
        "cleared": true,
        "updatedAt": "1970-01-01T00:00:00.000Z"
    }))
    .expect("blank slide JSON é válido")
}

#[derive(Debug, Clone)]
pub struct PresentationState {
    live: Arc<RwLock<LiveSlide>>,
    themes: Arc<RwLock<LiveThemes>>,
}

impl Default for PresentationState {
    fn default() -> Self {
        Self {
            live: Arc::new(RwLock::new(blank_slide())),
            themes: Arc::new(RwLock::new(LiveThemes::default())),
        }
    }
}

impl PresentationState {
    pub fn get(&self) -> LiveSlide {
        self.live.read().map(|s| s.clone()).unwrap_or_else(|_| blank_slide())
    }

    pub fn set(&self, slide: LiveSlide) {
        if let Ok(mut guard) = self.live.write() {
            *guard = slide;
        }
    }

    pub fn set_blackout(&self, blackout: bool) {
        if let Ok(mut guard) = self.live.write() {
            guard.blackout = blackout;
        }
    }

    pub fn themes(&self) -> LiveThemes {
        self.themes
            .read()
            .map(|t| t.clone())
            .unwrap_or_default()
    }

    pub fn set_themes(&self, themes: LiveThemes) {
        if let Ok(mut guard) = self.themes.write() {
            *guard = themes;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::types::SlideTheme;

    fn theme(guid: &str) -> SlideTheme {
        serde_json::from_value(serde_json::json!({
            "guid": guid,
            "title": "Tema de teste",
            "css": { "background": "#000" },
            "elements": [],
        }))
        .expect("tema JSON válido")
    }

    #[test]
    fn temas_comecam_vazios() {
        let state = PresentationState::default();
        let themes = state.themes();
        assert!(themes.public.is_none());
        assert!(themes.stage.is_none());
    }

    #[test]
    fn guarda_e_le_temas() {
        let state = PresentationState::default();
        state.set_themes(LiveThemes {
            public: Some(theme("pub")),
            stage: Some(theme("stg")),
        });
        let themes = state.themes();
        assert_eq!(themes.public.as_ref().map(|t| t.guid.as_str()), Some("pub"));
        assert_eq!(themes.stage.as_ref().map(|t| t.guid.as_str()), Some("stg"));
    }
}
