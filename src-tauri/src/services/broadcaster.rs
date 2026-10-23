use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::broadcast;

use crate::state::{
    types::{EVENT_SLIDE, EVENT_STAGE_MESSAGE},
    CommunicationAlert, LiveOutputPlans, LiveSlide, PresentationState, StageTimer,
};

#[derive(Debug, Clone)]
pub struct Broadcaster {
    app: Option<AppHandle>,
    ws_tx: broadcast::Sender<String>,
    fallback: PresentationState,
}

impl Broadcaster {
    pub fn new(app: AppHandle, ws_tx: broadcast::Sender<String>) -> Self {
        Self {
            app: Some(app),
            ws_tx,
            fallback: PresentationState::default(),
        }
    }

    #[cfg(test)]
    pub fn new_test(ws_tx: broadcast::Sender<String>) -> Self {
        Self {
            app: None,
            ws_tx,
            fallback: PresentationState::default(),
        }
    }

    pub fn publish_slide(&self, slide: &LiveSlide) {
        if let Some(app) = &self.app {
            let state = app.state::<PresentationState>();
            state.set(slide.clone());
            let _ = app.emit(EVENT_SLIDE, slide);
        } else {
            self.fallback.set(slide.clone());
        }

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
        if let Some(app) = &self.app {
            app.state::<PresentationState>().get()
        } else {
            self.fallback.get()
        }
    }

    pub fn publish_output_plans(&self, plans: &LiveOutputPlans) {
        if let Some(app) = &self.app {
            app.state::<PresentationState>().set_output_plans(plans.clone());
            let _ = app.emit(crate::state::types::EVENT_OUTPUT_PLANS, plans);
        } else {
            self.fallback.set_output_plans(plans.clone());
        }

        if let Ok(payload) = serde_json::to_value(plans) {
            let envelope = serde_json::json!({
                "channel": crate::state::types::EVENT_OUTPUT_PLANS,
                "payload": payload,
                "version": 1,
            });
            let _ = self.ws_tx.send(envelope.to_string());
        }
    }

    pub fn current_output_plans(&self) -> LiveOutputPlans {
        if let Some(app) = &self.app {
            app.state::<PresentationState>().output_plans()
        } else {
            self.fallback.output_plans()
        }
    }

    pub fn publish_timer(&self, timer: &StageTimer) {
        if let Some(app) = &self.app {
            let _ = app.emit(crate::state::types::EVENT_TIMER, timer);
        }

        if let Ok(payload) = serde_json::to_value(timer) {
            let envelope = serde_json::json!({
                "channel": crate::state::types::EVENT_TIMER,
                "payload": payload,
                "version": 1,
            });
            let _ = self.ws_tx.send(envelope.to_string());
        }
    }

    pub fn current_timer(&self) -> StageTimer {
        if let Some(app) = &self.app {
            app.state::<PresentationState>().timer()
        } else {
            self.fallback.timer()
        }
    }

    pub fn publish_wallpaper(&self, wallpaper: Option<String>) {
        if let Some(app) = &self.app {
            let state = app.state::<PresentationState>();
            state.set_wallpaper(wallpaper.clone());
            let _ = app.emit(crate::state::types::EVENT_WALLPAPER, &wallpaper);
        } else {
            self.fallback.set_wallpaper(wallpaper.clone());
        }

        let envelope = serde_json::json!({
            "channel": crate::state::types::EVENT_WALLPAPER,
            "payload": wallpaper,
            "version": 1,
        });
        let _ = self.ws_tx.send(envelope.to_string());
    }

    pub fn current_wallpaper(&self) -> Option<String> {
        if let Some(app) = &self.app {
            app.state::<PresentationState>().wallpaper()
        } else {
            self.fallback.wallpaper()
        }
    }

    pub fn publish_stage_message(&self, message: Option<CommunicationAlert>) {
        if let Some(app) = &self.app {
            let state = app.state::<PresentationState>();
            state.set_stage_message(message.clone());
            let _ = app.emit(EVENT_STAGE_MESSAGE, &message);
        } else {
            self.fallback.set_stage_message(message.clone());
        }

        let envelope = serde_json::json!({
            "channel": EVENT_STAGE_MESSAGE,
            "payload": message,
            "version": 1,
        });
        let _ = self.ws_tx.send(envelope.to_string());
    }

    pub fn current_stage_message(&self) -> Option<CommunicationAlert> {
        if let Some(app) = &self.app {
            app.state::<PresentationState>().stage_message()
        } else {
            self.fallback.stage_message()
        }
    }

    pub fn publish_value<T: serde::Serialize>(&self, channel: &str, payload: &T) {
        if let Some(app) = &self.app {
            let _ = app.emit(channel, payload);
        }

        if let Ok(payload) = serde_json::to_value(payload) {
            let envelope = serde_json::json!({
                "channel": channel,
                "payload": payload,
                "version": 1,
            });
            let _ = self.ws_tx.send(envelope.to_string());
        }
    }
}

pub type SharedBroadcaster = Arc<Broadcaster>;
