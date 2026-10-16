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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub section: Option<String>,
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
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "nextUp")]
    pub next_up: Option<SlideContent>,
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum SectionType {
    Verse,
    PreChorus,
    Chorus,
    Bridge,
    Intro,
    Outro,
    Instrumental,
    Tag,
    Ending,
}

impl SectionType {
    pub fn from_label(label: &str) -> Option<Self> {
        let normalized = label.trim().to_lowercase();
        let key = normalized
            .trim_end_matches(|c: char| c.is_ascii_digit())
            .trim_end();
        match key {
            "verso" | "estrofe" | "verse" => Some(SectionType::Verse),
            "refrão" | "refrao" | "coro" | "chorus" => Some(SectionType::Chorus),
            "pré-refrão" | "pre-refrao" | "pre-refrão" | "pre-chorus" | "pre chorus" => {
                Some(SectionType::PreChorus)
            }
            "ponte" | "bridge" => Some(SectionType::Bridge),
            "introdução" | "introducao" | "intro" => Some(SectionType::Intro),
            "final" | "outro" => Some(SectionType::Outro),
            "instrumental" => Some(SectionType::Instrumental),
            "tag" => Some(SectionType::Tag),
            "encerramento" | "ending" => Some(SectionType::Ending),
            _ => None,
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            SectionType::Verse => "verse",
            SectionType::PreChorus => "pre-chorus",
            SectionType::Chorus => "chorus",
            SectionType::Bridge => "bridge",
            SectionType::Intro => "intro",
            SectionType::Outro => "outro",
            SectionType::Instrumental => "instrumental",
            SectionType::Tag => "tag",
            SectionType::Ending => "ending",
        }
    }

    pub const fn as_label(self) -> &'static str {
        match self {
            SectionType::Verse => "Verso",
            SectionType::PreChorus => "Pré-refrão",
            SectionType::Chorus => "Refrão",
            SectionType::Bridge => "Ponte",
            SectionType::Intro => "Introdução",
            SectionType::Outro => "Final",
            SectionType::Instrumental => "Instrumental",
            SectionType::Tag => "Tag",
            SectionType::Ending => "Encerramento",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SongSection {
    pub section_type: Option<SectionType>,
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub sections: Vec<SongSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SongSummary {
    pub id: String,
    pub title: String,
    pub artist: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EventItem {
    pub id: String,
    pub song_id: String,
    pub next_item_id: Option<String>,
    pub song: Option<SongSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EventPart {
    pub id: String,
    pub title: String,
    pub items: Vec<EventItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceEvent {
    pub id: String,
    pub title: String,
    pub event_date: String,
    pub parts: Vec<EventPart>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EventSummary {
    pub id: String,
    pub title: String,
    pub event_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OnlineLyricHit {
    pub track_name: String,
    pub artist_name: String,
    pub album_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ImportSkip {
    pub title: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ImportReport {
    pub imported: Vec<String>,
    pub skipped: Vec<ImportSkip>,
    pub errors: Vec<String>,
}

pub const EVENT_SLIDE: &str = "presentation://slide";
pub const EVENT_STAGE_MESSAGE: &str = "stage://message";
pub const EVENT_OUTPUTS: &str = "outputs://changed";

pub const OUTPUT_HTTP_PORT: u16 = 5050;
pub const WS_PATH: &str = "/ws";
