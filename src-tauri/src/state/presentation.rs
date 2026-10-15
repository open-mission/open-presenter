use std::sync::{Arc, RwLock};

use super::types::LiveSlide;

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
}

impl Default for PresentationState {
    fn default() -> Self {
        Self {
            live: Arc::new(RwLock::new(blank_slide())),
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
}
