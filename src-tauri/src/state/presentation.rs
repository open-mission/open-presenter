use std::sync::{Arc, RwLock};

use super::types::{now_millis, LiveSlide, LiveThemes, StageTimer};

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
    timer: Arc<RwLock<StageTimer>>,
}

impl Default for PresentationState {
    fn default() -> Self {
        Self {
            live: Arc::new(RwLock::new(blank_slide())),
            themes: Arc::new(RwLock::new(LiveThemes::default())),
            timer: Arc::new(RwLock::new(StageTimer::default())),
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

    pub fn timer(&self) -> StageTimer {
        self.timer.read().map(|t| t.clone()).unwrap_or_default()
    }

    pub fn timer_start(&self) {
        if let Ok(mut guard) = self.timer.write() {
            guard.start_at(now_millis());
        }
    }

    pub fn timer_pause(&self) {
        if let Ok(mut guard) = self.timer.write() {
            guard.pause_at(now_millis());
        }
    }

    pub fn timer_reset(&self) {
        if let Ok(mut guard) = self.timer.write() {
            guard.reset();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::types::{SlideTheme, StageTimer};

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

    #[test]
    fn cronometro_comeca_zerado_e_parado() {
        let state = PresentationState::default();
        let timer = state.timer();
        assert!(!timer.running);
        assert_eq!(timer.elapsed_secs, 0);
        assert_eq!(timer.started_at_millis, None);
        assert_eq!(timer.elapsed_at(1_000_000), 0);
    }

    #[test]
    fn cronometro_acumula_entre_start_e_pause() {
        let mut timer = StageTimer::default();
        timer.start_at(1_000_000);
        assert!(timer.running);
        assert_eq!(timer.elapsed_at(1_005_500), 5);
        timer.pause_at(1_010_000);
        assert!(!timer.running);
        assert_eq!(timer.elapsed_secs, 10);
        assert_eq!(timer.elapsed_at(1_099_000), 10);
        timer.start_at(1_100_000);
        timer.pause_at(1_103_000);
        assert_eq!(timer.elapsed_secs, 13);
    }

    #[test]
    fn start_repetido_mantem_inicio_original() {
        let mut timer = StageTimer::default();
        timer.start_at(1_000_000);
        timer.start_at(1_005_000);
        timer.pause_at(1_010_000);
        assert_eq!(timer.elapsed_secs, 10);
    }

    #[test]
    fn pause_parado_e_idempotente_e_reset_limpa() {
        let mut timer = StageTimer::default();
        timer.pause_at(1_000_000);
        assert!(!timer.running);
        assert_eq!(timer.elapsed_secs, 0);
        timer.start_at(1_000_000);
        timer.reset();
        assert!(!timer.running);
        assert_eq!(timer.elapsed_secs, 0);
        assert_eq!(timer.started_at_millis, None);
    }

    #[test]
    fn estado_compartilha_cronometro() {
        let state = PresentationState::default();
        state.timer_start();
        assert!(state.timer().running);
        state.timer_reset();
        let timer = state.timer();
        assert!(!timer.running);
        assert_eq!(timer.elapsed_secs, 0);
    }
}
