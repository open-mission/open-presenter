use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SlideKind {
    Lyric,
    Scripture,
    Custom,
    Blank,
    Media,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    #[serde(alias = "title")]
    Text,
    Image,
    Folder,
    Video,
}

impl MediaKind {
    pub fn as_label(&self) -> &'static str {
        match self {
            MediaKind::Text => "Texto",
            MediaKind::Image => "Imagem",
            MediaKind::Folder => "Pasta de imagens",
            MediaKind::Video => "Vídeo",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaItem {
    pub kind: MediaKind,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub files: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub index: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScriptureRef {
    #[serde(rename = "versionId")]
    pub version_id: String,
    #[serde(rename = "bookId")]
    pub book_id: i32,
    #[serde(rename = "bookName")]
    pub book_name: String,
    pub chapter: i32,
    pub verse: i32,
    pub part: usize,
    #[serde(rename = "totalParts")]
    pub total_parts: usize,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media: Option<MediaItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scripture: Option<ScriptureRef>,
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
    #[serde(default, rename = "textHidden")]
    pub text_hidden: bool,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "nextUp")]
    pub next_up: Option<SlideContent>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "prevUp")]
    pub prev_up: Option<SlideContent>,
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum OutputTarget {
    Public,
    Stage,
    Stream,
}

impl OutputTarget {
    pub const fn label(self) -> &'static str {
        match self {
            OutputTarget::Public => "output-public",
            OutputTarget::Stage => "output-stage",
            OutputTarget::Stream => "output-stream",
        }
    }

    pub const fn route(self) -> &'static str {
        match self {
            OutputTarget::Public => "index.html#/public",
            OutputTarget::Stage => "index.html#/stage",
            OutputTarget::Stream => "index.html#/stream",
        }
    }

    pub const fn title(self) -> &'static str {
        match self {
            OutputTarget::Public => "Open Presenter — Projeção",
            OutputTarget::Stage => "Open Presenter — Retorno",
            OutputTarget::Stream => "Open Presenter — Transmissão (OBS)",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsEnvelope {
    pub channel: String,
    pub payload: serde_json::Value,
    pub version: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SongGroupConfig {
    pub id: String,
    pub name: String,
    pub color: String,
    pub shortcut: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub type_key: Option<SectionType>,
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
#[serde(rename_all = "camelCase")]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: String,
    #[serde(default)]
    pub album: Option<String>,
    #[serde(default)]
    pub composer: Option<String>,
    #[serde(default)]
    pub song_key: Option<String>,
    #[serde(default)]
    pub bpm: Option<i32>,
    pub sections: Vec<SongSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SongSummary {
    pub id: String,
    pub title: String,
    pub artist: String,
    #[serde(default)]
    pub song_key: Option<String>,
    #[serde(default)]
    pub bpm: Option<i32>,
    #[serde(default)]
    pub composer: Option<String>,
    #[serde(default)]
    pub album: Option<String>,
}

/// Linhas por slide ao importar/salvar letras de músicas.
/// Valor ausente ou desconhecido equivale a `Two` (`"2"`).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum LinesPerSlide {
    #[serde(rename = "1")]
    One,
    #[serde(rename = "2")]
    Two,
    #[serde(rename = "keep")]
    Keep,
}

impl LinesPerSlide {
    pub fn from_setting(value: Option<&str>) -> Self {
        match value {
            Some("1") => LinesPerSlide::One,
            Some("2") => LinesPerSlide::Two,
            Some("keep") => LinesPerSlide::Keep,
            _ => LinesPerSlide::Two,
        }
    }

    pub const fn as_str(&self) -> &'static str {
        match self {
            LinesPerSlide::One => "1",
            LinesPerSlide::Two => "2",
            LinesPerSlide::Keep => "keep",
        }
    }

    pub const fn lines_per_slide(self) -> Option<usize> {
        match self {
            LinesPerSlide::One => Some(1),
            LinesPerSlide::Two => Some(2),
            LinesPerSlide::Keep => None,
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SongDefaults {
    pub lines_per_slide: LinesPerSlide,
    #[serde(default)]
    pub add_empty_slide_at_start: bool,
    #[serde(default = "default_true")]
    pub vagalume_enabled: bool,
    #[serde(default = "default_true")]
    pub holyrics_enabled: bool,
    #[serde(default = "default_true")]
    pub lrclib_enabled: bool,
    #[serde(default)]
    pub vagalume_api_key: Option<String>,
}

impl Default for SongDefaults {
    fn default() -> Self {
        Self {
            lines_per_slide: LinesPerSlide::Two,
            add_empty_slide_at_start: false,
            vagalume_enabled: true,
            holyrics_enabled: true,
            lrclib_enabled: true,
            vagalume_api_key: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EventItem {
    pub id: String,
    #[serde(default)]
    pub song_id: Option<String>,
    pub next_item_id: Option<String>,
    pub song: Option<SongSummary>,
    #[serde(default)]
    pub media: Option<MediaItem>,
    #[serde(default)]
    pub scripture: Option<ScriptureRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EventPart {
    pub id: String,
    pub title: String,
    pub items: Vec<EventItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bg_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceEvent {
    pub id: String,
    pub title: String,
    pub event_date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wallpaper: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_guid: Option<String>,
    pub parts: Vec<EventPart>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EventSummary {
    pub id: String,
    pub title: String,
    pub event_date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wallpaper: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_guid: Option<String>,
    #[serde(default)]
    pub item_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OnlineLyricHit {
    pub track_name: String,
    pub artist_name: String,
    pub album_name: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub provider_id: Option<String>,
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
pub const EVENT_TIMER: &str = "stage://timer";
pub const EVENT_OUTPUTS: &str = "outputs://changed";
pub const EVENT_OUTPUT_PLANS: &str = "presentation://output-plans";
pub const EVENT_THEMES_CHANGED: &str = "themes://changed";
pub const EVENT_REMOTE_SETLIST: &str = "remote://setlist";
pub const EVENT_SETLIST_ACTIVE_CHANGED: &str = "setlist://active-changed";
pub const EVENT_WALLPAPER: &str = "presentation://wallpaper";
pub const EVENT_CLIENT_HELLO: &str = "client://hello";
pub const EVENT_DISPLAYS: &str = "displays://changed";
pub const EVENT_DISPLAYS_IDENTIFY: &str = "displays://identify";

pub const OUTPUT_HTTP_PORT: u16 = 5050;
pub const WS_PATH: &str = "/ws";

/// Estado do servidor local de saídas, espelhado no frontend (`ServerStatus`).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum OutputMode {
    #[default]
    Off,
    Native,
    Web,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OutputConfig {
    pub target: OutputTarget,
    pub mode: OutputMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub monitor_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub monitor_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wallpaper: Option<String>,
}

impl OutputConfig {
    pub fn off(target: OutputTarget) -> Self {
        Self {
            target,
            mode: OutputMode::Off,
            monitor_id: None,
            monitor_label: None,
            url: None,
            wallpaper: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OutputRuntime {
    pub target: OutputTarget,
    pub open: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub monitor_id: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OutputType {
    Monitor,
    Html,
    Ndi,
    Virtual,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum OutputCategory {
    Public,
    Stage,
    Lower,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OutputResolution {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CornerPinning {
    pub top_left: (f64, f64),
    pub top_right: (f64, f64),
    pub bottom_left: (f64, f64),
    pub bottom_right: (f64, f64),
}

/// Configuração de camadas de uma saída ("Look"). Não guarda elementos: apenas
/// liga/desliga as camadas mestras no render. `screen_color` é fachada para
/// `background_color_enabled` (fonte única na saída).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OutputLook {
    pub mask: bool,
    pub messages: bool,
    pub props: bool,
    pub announcements: bool,
    pub slide: bool,
    pub media: bool,
    pub video_input: bool,
    pub screen_color: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScreenColorConfig {
    pub enabled: bool,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DisplayOutput {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    pub category: OutputCategory,
    #[serde(rename = "type")]
    pub output_type: OutputType,
    pub enabled: bool,
    pub resolution: OutputResolution,
    pub aspect_ratio: String,
    pub background_color: String,
    pub background_color_enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_theme_guid: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub idle_theme_guid: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub look: Option<OutputLook>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub monitor_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub monitor_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ndi_stream_name: Option<String>,
    #[serde(default)]
    pub frame_rate: u32,
    #[serde(default)]
    pub video_delay_frames: u32,
    #[serde(default)]
    pub alpha_key: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_destination: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub corner_pinning: Option<CornerPinning>,
    #[serde(default)]
    pub placeholder_enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder_fit: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DisplaysSettings {
    pub auto_activate_on_launch: bool,
    pub show_performance_stats: bool,
    pub ignore_background_colors: bool,
    pub show_keynote_screens: bool,
    pub timer_font_mode: String,
    pub bit_depth: String,
    pub public_enabled: bool,
    pub stage_enabled: bool,
    pub lower_enabled: bool,
}

impl Default for DisplaysSettings {
    fn default() -> Self {
        Self {
            auto_activate_on_launch: true,
            show_performance_stats: false,
            ignore_background_colors: false,
            show_keynote_screens: false,
            timer_font_mode: "auto".to_string(),
            bit_depth: "8bit".to_string(),
            public_enabled: true,
            stage_enabled: true,
            lower_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ClientKind {
    #[default]
    Output,
    Remote,
}

/// Navegador web conectado ao servidor local (`GET /ws` ou `/api/v1/ws`).
/// O `output` é anunciado pelo próprio cliente via `client://hello`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectedClient {
    pub id: String,
    pub ip: String,
    pub output: Option<OutputTarget>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
    pub connected_at: u64,
    #[serde(default)]
    pub kind: ClientKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ThemeElementType {
    Text,
    Image,
    Video,
    Rectangle,
    Circle,
    Triangle,
    Star,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeElement {
    pub id: String,
    #[serde(rename = "type")]
    pub element_type: ThemeElementType,
    pub x: f64,
    pub y: f64,
    pub visible: bool,
    pub locked: bool,
    pub css: HashMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub src: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "assetTypeVisibility"
    )]
    pub asset_type_visibility: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fill: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "groupId")]
    pub group_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "groupName")]
    pub group_name: Option<String>,
    /// Camada mestra de saída. Ausente = "slide" (temas v1/v2).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeGuide {
    pub id: String,
    pub axis: String,
    pub pos: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemePage {
    pub id: String,
    pub context: String,
    pub css: HashMap<String, String>,
    pub elements: Vec<ThemeElement>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub guides: Option<Vec<ThemeGuide>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideTheme {
    pub guid: String,
    pub title: String,
    pub css: HashMap<String, String>,
    pub elements: Vec<ThemeElement>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pages: Option<Vec<ThemePage>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub guides: Option<Vec<ThemeGuide>>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PlanThemeSource {
    Override,
    Event,
    Default,
    Fallback,
}

/// Plano resolvido de uma saída. O admin é o único resolvedor; o Rust apenas
/// guarda e publica. `content_theme` é aplicado no renderer, por cima.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputPlan {
    pub output_id: String,
    pub category: OutputCategory,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme: Option<SlideTheme>,
    pub theme_source: PlanThemeSource,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_theme: Option<SlideTheme>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rest_theme: Option<SlideTheme>,
    pub look: OutputLook,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background_override: Option<BackgroundLayer>,
    pub screen_color: ScreenColorConfig,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LiveOutputPlans {
    #[serde(default)]
    pub plans: HashMap<String, OutputPlan>,
}

/// Cronômetro do palco. Fonte da verdade no Rust: todas as saídas e o painel
/// de controle espelham este estado via `stage://timer`. Os instantes são
/// milissegundos Unix; cada cliente calcula o visor como
/// `elapsed + (running ? now - started_at : 0)`.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StageTimer {
    pub running: bool,
    pub elapsed_secs: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at_millis: Option<u64>,
    #[serde(default)]
    pub countdown_secs: u64,
}

impl StageTimer {
    pub fn start_at(&mut self, now_millis: u64) {
        if !self.running {
            self.running = true;
            self.started_at_millis = Some(now_millis);
        }
    }

    pub fn pause_at(&mut self, now_millis: u64) {
        if self.running {
            if let Some(started) = self.started_at_millis {
                self.elapsed_secs += now_millis.saturating_sub(started) / 1000;
            }
            self.running = false;
            self.started_at_millis = None;
        }
    }

    pub fn reset(&mut self) {
        self.running = false;
        self.elapsed_secs = 0;
        self.started_at_millis = None;
    }

    pub fn set_countdown_secs(&mut self, secs: u64) {
        self.countdown_secs = secs;
        self.elapsed_secs = 0;
        self.started_at_millis = None;
        self.running = false;
    }

    pub fn elapsed_at(&self, now_millis: u64) -> u64 {
        self.elapsed_secs
            + if self.running {
                self.started_at_millis
                    .map(|s| now_millis.saturating_sub(s) / 1000)
                    .unwrap_or(0)
            } else {
                0
            }
    }
}

pub fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum CommunicationDisplayMode {
    #[default]
    BannerTop,
    BannerBottom,
    Overlay,
    VariableOnly,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum CommunicationLevel {
    #[default]
    Info,
    Warning,
    Urgent,
}

fn default_comm_scroll() -> bool {
    true
}

fn default_comm_target() -> String {
    "stage".to_string()
}

fn default_comm_targets() -> Vec<String> {
    vec!["stage".to_string()]
}

/// Alerta / Mensagem do painel de comunicação, exibido no retorno (Stage),
/// telão público, transmissão (OBS) e extensível para outros canais.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CommunicationAlert {
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub display_mode: CommunicationDisplayMode,
    #[serde(default = "default_comm_scroll")]
    pub scroll: bool,
    #[serde(default)]
    pub level: CommunicationLevel,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sender: Option<String>,
    #[serde(default = "default_comm_target")]
    pub target: String,
    #[serde(default = "default_comm_targets")]
    pub targets: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_dismiss_seconds: Option<u32>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleVersion {
    pub id: String,
    pub name: String,
    pub abbrev: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleBook {
    pub id: i32,
    pub book_reference_id: i32,
    pub testament_reference_id: i32,
    pub name: String,
    pub abbrev: String,
    pub chapter_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleVerse {
    pub id: i32,
    pub book_id: i32,
    pub chapter: i32,
    pub verse: i32,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleSearchResult {
    pub book_id: i32,
    pub book_name: String,
    pub chapter: i32,
    pub verse: i32,
    pub text: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleVerseCompare {
    pub version_id: String,
    pub version_name: String,
    pub verse: Option<BibleVerse>,
}

