use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NdiStatus {
    pub available: bool,
    pub active: bool,
    pub stream_name: String,
    pub runtime_path: Option<String>,
}

pub struct NdiState {
    active: AtomicBool,
    stream_name: String,
}

impl NdiState {
    pub fn new() -> Self {
        let has_runtime = detect_ndi_runtime().is_some();
        Self {
            active: AtomicBool::new(has_runtime),
            stream_name: "Open Presenter — Transmissão".to_string(),
        }
    }

    pub fn is_active(&self) -> bool {
        self.active.load(Ordering::Relaxed)
    }

    pub fn set_active(&self, active: bool) {
        self.active.store(active, Ordering::Relaxed);
    }

    pub fn stream_name(&self) -> &str {
        &self.stream_name
    }
}

impl Default for NdiState {
    fn default() -> Self {
        Self::new()
    }
}

pub type SharedNdiState = Arc<NdiState>;

/// Detecta a presença de runtime NDI instalado no sistema operacional
pub fn detect_ndi_runtime() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let candidates = [
            "/Library/Application Support/Adobe/Common/Plug-ins/7.0/MediaCore/NDI_Transmit_AdobeCC.bundle/Contents/Frameworks/libndi.dylib",
            "/Applications/Spresenter.app/Contents/Resources/app.asar.unpacked/win-renderer/libndi.dylib",
            "/usr/local/lib/libndi.dylib",
            "/opt/homebrew/lib/libndi.dylib",
            "/Library/Application Support/NewTek/NDI/libndi.dylib",
        ];
        for path_str in candidates {
            let p = Path::new(path_str);
            if p.is_file() {
                return Some(p.to_path_buf());
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let candidates = [
            r"C:\Program Files\NDI\NDI 6 Runtime\v6\Processing.NDI.Lib.x64.dll",
            r"C:\Program Files\NDI\NDI 5 Runtime\v5\Processing.NDI.Lib.x64.dll",
            r"C:\Windows\System32\Processing.NDI.Lib.x64.dll",
        ];
        for path_str in candidates {
            let p = Path::new(path_str);
            if p.is_file() {
                return Some(p.to_path_buf());
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let candidates = [
            "/usr/lib/libndi.so",
            "/usr/local/lib/libndi.so",
            "/usr/lib/x86_64-linux-gnu/libndi.so",
        ];
        for path_str in candidates {
            let p = Path::new(path_str);
            if p.is_file() {
                return Some(p.to_path_buf());
            }
        }
    }

    None
}

pub fn get_status(state: &NdiState) -> NdiStatus {
    let runtime = detect_ndi_runtime();
    let available = runtime.is_some();
    NdiStatus {
        available,
        active: available && state.is_active(),
        stream_name: state.stream_name().to_string(),
        runtime_path: runtime.map(|p| p.to_string_lossy().to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_set_active_and_status() {
        let state = NdiState {
            active: AtomicBool::new(false),
            stream_name: "Test Stream".to_string(),
        };
        assert!(!state.is_active());
        state.set_active(true);
        assert!(state.is_active());
        let status = get_status(&state);
        assert_eq!(status.stream_name, "Test Stream");
    }
}
