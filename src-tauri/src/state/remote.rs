use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

use super::types::SlideContent;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSlide {
    pub index: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub content: SlideContent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteItem {
    pub id: String,
    pub kind: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitle: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_item_id: Option<String>,
    pub slides: Vec<RemoteSlide>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemotePart {
    pub id: String,
    pub title: String,
    pub items: Vec<RemoteItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSetlist {
    pub event_id: String,
    pub title: String,
    pub event_date: String,
    pub parts: Vec<RemotePart>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteConfig {
    pub enabled: bool,
    pub token: String,
}

#[derive(Debug, Clone, Default)]
pub struct RemoteSettings {
    pub enabled: bool,
    pub token: String,
    pub setlist: Option<RemoteSetlist>,
}

pub type SharedRemoteState = Arc<Mutex<RemoteSettings>>;
