use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SlideKind {
    Lyric,
    Scripture,
    Custom,
    Blank,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideContent {
    pub id: String,
    pub kind: SlideKind,
    pub title: String,
    pub lines: Vec<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BackgroundKind {
    Color,
    Image,
    Video,
    Css,
    Isf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundLayer {
    pub id: String,
    pub kind: BackgroundKind,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveSlide {
    pub content: SlideContent,
    pub background: BackgroundLayer,
    pub blackout: bool,
    pub cleared: bool,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    #[serde(rename = "isPrimary")]
    pub is_primary: bool,
    #[serde(rename = "scaleFactor")]
    pub scale_factor: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OutputTarget {
    Public,
    Stage,
}

impl OutputTarget {
    pub const fn label(self) -> &'static str {
        match self {
            OutputTarget::Public => "output-public",
            OutputTarget::Stage => "output-stage",
        }
    }

    pub const fn route(self) -> &'static str {
        match self {
            OutputTarget::Public => "/#/public",
            OutputTarget::Stage => "/#/stage",
        }
    }

    pub const fn title(self) -> &'static str {
        match self {
            OutputTarget::Public => "Open Presenter — Projeção",
            OutputTarget::Stage => "Open Presenter — Retorno",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsEnvelope {
    pub channel: String,
    pub payload: serde_json::Value,
    pub version: u8,
}

pub const EVENT_SLIDE: &str = "presentation://slide";
pub const EVENT_STAGE_MESSAGE: &str = "stage://message";
pub const EVENT_OUTPUTS: &str = "outputs://changed";

pub const OUTPUT_HTTP_PORT: u16 = 5050;
pub const WS_PATH: &str = "/ws";
