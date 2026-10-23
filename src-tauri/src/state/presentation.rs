use std::sync::{Arc, RwLock};

use super::types::{
    now_millis, CommunicationAlert, LiveOutputPlans, LiveSlide, StageTimer,
};

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
        "textHidden": false,
        "updatedAt": "1970-01-01T00:00:00.000Z"
    }))
    .expect("blank slide JSON é válido")
}

#[derive(Debug, Clone)]
pub struct PresentationState {
    live: Arc<RwLock<LiveSlide>>,
    timer: Arc<RwLock<StageTimer>>,
    wallpaper: Arc<RwLock<Option<String>>>,
    stage_message: Arc<RwLock<Option<CommunicationAlert>>>,
    output_plans: Arc<RwLock<LiveOutputPlans>>,
}

impl Default for PresentationState {
    fn default() -> Self {
        Self {
            live: Arc::new(RwLock::new(blank_slide())),
            timer: Arc::new(RwLock::new(StageTimer::default())),
            wallpaper: Arc::new(RwLock::new(None)),
            stage_message: Arc::new(RwLock::new(None)),
            output_plans: Arc::new(RwLock::new(LiveOutputPlans::default())),
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

    pub fn timer_set_countdown(&self, secs: u64) {
        if let Ok(mut guard) = self.timer.write() {
            guard.set_countdown_secs(secs);
        }
    }

    pub fn wallpaper(&self) -> Option<String> {
        self.wallpaper.read().ok().and_then(|w| w.clone())
    }

    pub fn set_wallpaper(&self, wallpaper: Option<String>) {
        if let Ok(mut guard) = self.wallpaper.write() {
            *guard = wallpaper;
        }
    }

    pub fn stage_message(&self) -> Option<CommunicationAlert> {
        self.stage_message.read().ok().and_then(|m| m.clone())
    }

    pub fn set_stage_message(&self, message: Option<CommunicationAlert>) {
        if let Ok(mut guard) = self.stage_message.write() {
            *guard = message;
        }
    }

    pub fn output_plans(&self) -> LiveOutputPlans {
        self.output_plans
            .read()
            .map(|p| p.clone())
            .unwrap_or_default()
    }

    pub fn set_output_plans(&self, plans: LiveOutputPlans) {
        if let Ok(mut guard) = self.output_plans.write() {
            *guard = plans;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::types::StageTimer;

    #[test]
    fn live_slide_sem_text_hidden_no_json_usa_false() {
        let live: LiveSlide = serde_json::from_value(serde_json::json!({
            "content": {
                "id": "x",
                "kind": "lyric",
                "title": "T",
                "lines": ["L"],
                "notes": null
            },
            "background": { "id": "bg", "kind": "color", "value": "#000" },
            "blackout": false,
            "cleared": false,
            "updatedAt": "0"
        }))
        .unwrap();
        assert!(!live.text_hidden);
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

    #[test]
    fn planos_comecam_vazios() {
        let state = PresentationState::default();
        assert!(state.output_plans().plans.is_empty());
    }

    #[test]
    fn output_plan_round_trip_serde() {
        use crate::state::types::{
            LiveOutputPlans, OutputLook, OutputPlan, PlanThemeSource, ScreenColorConfig,
        };

        let plan = OutputPlan {
            output_id: "out-1".to_string(),
            category: crate::state::types::OutputCategory::Public,
            theme: None,
            theme_source: PlanThemeSource::Default,
            content_theme: None,
            rest_theme: None,
            look: OutputLook {
                mask: false,
                messages: true,
                props: true,
                announcements: true,
                slide: true,
                media: true,
                video_input: true,
                screen_color: true,
            },
            background_override: None,
            screen_color: ScreenColorConfig {
                enabled: true,
                value: "#000000".to_string(),
            },
            updated_at: "2026-01-01T00:00:00.000Z".to_string(),
        };

        let mut plans = LiveOutputPlans::default();
        plans.plans.insert("out-1".to_string(), plan.clone());
        let json = serde_json::to_string(&plans).unwrap();
        assert!(json.contains("\"videoInput\":true"));
        assert!(json.contains("\"themeSource\":\"default\""));
        let back: LiveOutputPlans = serde_json::from_str(&json).unwrap();
        let back_plan = back.plans.get("out-1").expect("plano presente");
        assert_eq!(
            serde_json::to_value(back_plan).unwrap(),
            serde_json::to_value(&plan).unwrap()
        );
    }

    #[test]
    fn tema_antigo_sem_layer_e_output_sem_look_abrem() {
        use crate::state::types::{DisplayOutput, SlideTheme};

        let theme: SlideTheme = serde_json::from_value(serde_json::json!({
            "guid": "t",
            "title": "T",
            "css": {},
            "elements": [{ "id": "e", "type": "TEXT", "x": 0, "y": 0, "visible": true, "locked": false, "css": {} }],
        }))
        .unwrap();
        assert_eq!(theme.elements[0].layer, None);

        let output: DisplayOutput = serde_json::from_value(serde_json::json!({
            "id": "o",
            "name": "O",
            "category": "public",
            "type": "monitor",
            "enabled": true,
            "resolution": { "width": 1920, "height": 1080 },
            "aspectRatio": "16:9",
            "backgroundColor": "#000",
            "backgroundColorEnabled": true,
            "frameRate": 60,
            "videoDelayFrames": 0,
            "alphaKey": false
        }))
        .unwrap();
        assert!(output.look.is_none());
        assert!(output.idle_theme_guid.is_none());
    }
}
