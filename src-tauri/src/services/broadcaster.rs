use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::broadcast;

use crate::state::{types::EVENT_SLIDE, LiveSlide, LiveThemes, PresentationState};

#[derive(Debug, Clone)]
pub struct Broadcaster {
    app: AppHandle,
    ws_tx: broadcast::Sender<String>,
}

impl Broadcaster {
    pub fn new(app: AppHandle, ws_tx: broadcast::Sender<String>) -> Self {
        Self { app, ws_tx }
    }

    pub fn publish_slide(&self, slide: &LiveSlide) {
        let state = self.app.state::<PresentationState>();
        state.set(slide.clone());

        let _ = self.app.emit(EVENT_SLIDE, slide);

        if let Ok(payload) = serde_json::to_value(slide) {
            let envelope = serde_json::json!({
                "channel": EVENT_SLIDE,
                "payload": payload,
                "version": 1,
            });
            let _ = self.ws_tx.send(envelope.to_string());
        }
    }

    pub fn current_slide(&self) -> LiveSlide {
        self.app.state::<PresentationState>().get()
    }

    pub fn publish_themes(&self, themes: &LiveThemes) {
        let state = self.app.state::<PresentationState>();
        state.set_themes(themes.clone());

        let _ = self.app.emit(crate::state::types::EVENT_THEMES, themes);

        if let Ok(payload) = serde_json::to_value(themes) {
            let envelope = serde_json::json!({
                "channel": crate::state::types::EVENT_THEMES,
                "payload": payload,
                "version": 1,
            });
            let _ = self.ws_tx.send(envelope.to_string());
        }
    }

    pub fn current_themes(&self) -> LiveThemes {
        self.app.state::<PresentationState>().themes()
    }
}

pub type SharedBroadcaster = Arc<Broadcaster>;
