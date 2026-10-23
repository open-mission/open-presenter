use std::ffi::{CStr, CString};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock, RwLock};
use std::time::{Duration, Instant};

use libloading::{Library, Symbol};
use ndi_sdk::sys::{
    NDIlib_find_create_t, NDIlib_frame_type_e, NDIlib_recv_bandwidth_e,
    NDIlib_recv_color_format_e, NDIlib_recv_create_v3_t, NDIlib_source_t,
    NDIlib_source_t__bindgen_ty_1, NDIlib_v5, NDIlib_video_frame_v2_t,
};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

const ENCODE_INTERVAL: Duration = Duration::from_millis(66);
const CAPTURE_TIMEOUT_MS: u32 = 100;
const JPEG_QUALITY: u8 = 72;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NdiInputStatus {
    pub available: bool,
    pub running: bool,
    pub source: Option<String>,
    pub width: u32,
    pub height: u32,
    pub error: Option<String>,
}

struct NdiRuntime {
    _library: Library,
    v5: *const NDIlib_v5,
}

unsafe impl Send for NdiRuntime {}
unsafe impl Sync for NdiRuntime {}

impl NdiRuntime {
    fn api(&self) -> &NDIlib_v5 {
        unsafe { &*self.v5 }
    }
}

static RUNTIME: OnceLock<Option<Arc<NdiRuntime>>> = OnceLock::new();

fn runtime() -> Option<Arc<NdiRuntime>> {
    RUNTIME
        .get_or_init(|| load_runtime().ok().map(Arc::new))
        .clone()
}

fn library_candidates() -> Vec<String> {
    let mut paths = Vec::new();

    if let Ok(dir) = std::env::var("NDI_RUNTIME_DIR_V6") {
        #[cfg(target_os = "macos")]
        paths.push(format!("{dir}/libndi.dylib"));
        #[cfg(target_os = "linux")]
        {
            paths.push(format!("{dir}/libndi.so.6"));
            paths.push(format!("{dir}/libndi.so"));
        }
        #[cfg(target_os = "windows")]
        paths.push(format!("{dir}/lib/Processing.NDI.Lib.x64.dll"));
    }

    #[cfg(target_os = "macos")]
    {
        for dir in ["/usr/local/lib", "/opt/homebrew/lib"] {
            paths.push(format!("{dir}/libndi.dylib"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        for dir in ["/usr/lib", "/usr/local/lib", "/usr/lib/x86_64-linux-gnu"] {
            paths.push(format!("{dir}/libndi.so.6"));
            paths.push(format!("{dir}/libndi.so"));
        }
    }

    paths
}

fn default_library_name() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "libndi.dylib"
    }
    #[cfg(target_os = "linux")]
    {
        "libndi.so.6"
    }
    #[cfg(target_os = "windows")]
    {
        "Processing.NDI.Lib.x64.dll"
    }
}

fn load_runtime() -> Result<NdiRuntime, String> {
    let mut library = None;
    for path in library_candidates() {
        if let Ok(candidate) = unsafe { Library::new(&path) } {
            library = Some(candidate);
            break;
        }
    }
    let library = match library {
        Some(library) => library,
        None => unsafe { Library::new(default_library_name()) }
            .map_err(|_| "Runtime NDI não encontrado".to_string())?,
    };

    let load: Symbol<unsafe extern "C" fn() -> *const NDIlib_v5> =
        unsafe { library.get(b"NDIlib_v5_load\0") }.map_err(|e| e.to_string())?;
    let v5 = unsafe { load() };
    if v5.is_null() {
        return Err("NDIlib_v5_load retornou nulo".to_string());
    }
    let initialize = unsafe { (*v5).initialize }.ok_or("NDI initialize ausente")?;
    if !unsafe { initialize() } {
        return Err("Falha ao inicializar o NDI".to_string());
    }
    Ok(NdiRuntime {
        _library: library,
        v5,
    })
}

#[derive(Default, Clone)]
struct StatusInner {
    running: bool,
    source: Option<String>,
    width: u32,
    height: u32,
    error: Option<String>,
}

struct Session {
    stop: Arc<AtomicBool>,
    handle: Option<std::thread::JoinHandle<()>>,
}

pub struct NdiInputState {
    session: Mutex<Option<Session>>,
    latest: Arc<RwLock<Option<Arc<Vec<u8>>>>>,
    tx: broadcast::Sender<Arc<Vec<u8>>>,
    status: Arc<Mutex<StatusInner>>,
}

impl Default for NdiInputState {
    fn default() -> Self {
        Self::new()
    }
}

impl NdiInputState {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(8);
        Self {
            session: Mutex::new(None),
            latest: Arc::new(RwLock::new(None)),
            tx,
            status: Arc::new(Mutex::new(StatusInner::default())),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Arc<Vec<u8>>> {
        self.tx.subscribe()
    }

    pub fn latest(&self) -> Option<Arc<Vec<u8>>> {
        self.latest.read().ok().and_then(|slot| slot.clone())
    }

    pub fn status(&self) -> NdiInputStatus {
        let inner = self
            .status
            .lock()
            .map(|status| status.clone())
            .unwrap_or_default();
        NdiInputStatus {
            available: runtime().is_some(),
            running: inner.running,
            source: inner.source,
            width: inner.width,
            height: inner.height,
            error: inner.error,
        }
    }

    pub fn start(&self, source: String) -> Result<(), String> {
        let rt = runtime().ok_or_else(|| "Runtime NDI não encontrado".to_string())?;
        self.stop();

        let stop = Arc::new(AtomicBool::new(false));
        let latest = self.latest.clone();
        let tx = self.tx.clone();
        let status = self.status.clone();
        let thread_stop = stop.clone();
        let thread_source = source.clone();

        let handle = std::thread::Builder::new()
            .name("ndi-input".into())
            .spawn(move || {
                if let Err(error) = run_receiver(
                    rt,
                    thread_source,
                    thread_stop,
                    latest,
                    tx,
                    status.clone(),
                ) {
                    if let Ok(mut guard) = status.lock() {
                        guard.error = Some(error);
                        guard.running = false;
                    }
                }
            })
            .map_err(|e| e.to_string())?;

        if let Ok(mut guard) = self.session.lock() {
            *guard = Some(Session {
                stop,
                handle: Some(handle),
            });
        }
        if let Ok(mut guard) = self.status.lock() {
            guard.running = true;
            guard.source = Some(source);
            guard.width = 0;
            guard.height = 0;
            guard.error = None;
        }
        Ok(())
    }

    pub fn stop(&self) {
        let session = self.session.lock().ok().and_then(|mut guard| guard.take());
        if let Some(session) = session {
            session.stop.store(true, Ordering::Relaxed);
            if let Some(handle) = session.handle {
                let _ = handle.join();
            }
        }
        if let Ok(mut latest) = self.latest.write() {
            *latest = None;
        }
        if let Ok(mut status) = self.status.lock() {
            status.running = false;
            status.source = None;
            status.width = 0;
            status.height = 0;
        }
    }
}

pub fn list_sources(timeout: Duration) -> Result<Vec<String>, String> {
    let rt = runtime().ok_or_else(|| "Runtime NDI não encontrado".to_string())?;
    let api = rt.api();

    let create = api.find_create_v2.ok_or("find_create_v2 indisponível")?;
    let destroy = api.find_destroy.ok_or("find_destroy indisponível")?;
    let wait = api
        .find_wait_for_sources
        .ok_or("find_wait_for_sources indisponível")?;
    let current = api
        .find_get_current_sources
        .ok_or("find_get_current_sources indisponível")?;

    let settings = NDIlib_find_create_t {
        show_local_sources: true,
        p_groups: std::ptr::null(),
        p_extra_ips: std::ptr::null(),
    };

    let finder = unsafe { create(&settings) };
    if finder.is_null() {
        return Err("Não foi possível iniciar a busca NDI".to_string());
    }

    let timeout_ms = timeout.as_millis().min(u32::MAX as u128) as u32;
    let _ = unsafe { wait(finder, timeout_ms) };

    let mut count: u32 = 0;
    let sources = unsafe { current(finder, &mut count) };
    let mut names = Vec::new();
    if !sources.is_null() {
        for index in 0..count as usize {
            let source = unsafe { &*sources.add(index) };
            if source.p_ndi_name.is_null() {
                continue;
            }
            if let Ok(name) = unsafe { CStr::from_ptr(source.p_ndi_name) }.to_str() {
                names.push(name.to_string());
            }
        }
    }
    unsafe { destroy(finder) };

    names.sort();
    names.dedup();
    Ok(names)
}

fn run_receiver(
    rt: Arc<NdiRuntime>,
    source: String,
    stop: Arc<AtomicBool>,
    latest: Arc<RwLock<Option<Arc<Vec<u8>>>>>,
    tx: broadcast::Sender<Arc<Vec<u8>>>,
    status: Arc<Mutex<StatusInner>>,
) -> Result<(), String> {
    let api = rt.api();
    let create = api.recv_create_v3.ok_or("recv_create_v3 indisponível")?;
    let capture = api.recv_capture_v2.ok_or("recv_capture_v2 indisponível")?;
    let free_video = api
        .recv_free_video_v2
        .ok_or("recv_free_video_v2 indisponível")?;
    let destroy = api.recv_destroy.ok_or("recv_destroy indisponível")?;

    let source_name = CString::new(source).map_err(|_| "Nome de fonte inválido".to_string())?;
    let settings = NDIlib_recv_create_v3_t {
        source_to_connect_to: NDIlib_source_t {
            p_ndi_name: source_name.as_ptr(),
            __bindgen_anon_1: NDIlib_source_t__bindgen_ty_1 {
                p_url_address: std::ptr::null(),
            },
        },
        color_format: NDIlib_recv_color_format_e::NDIlib_recv_color_format_RGBX_RGBA,
        bandwidth: NDIlib_recv_bandwidth_e::NDIlib_recv_bandwidth_highest,
        allow_video_fields: false,
        p_ndi_recv_name: std::ptr::null(),
    };

    let receiver = unsafe { create(&settings) };
    if receiver.is_null() {
        return Err("Não foi possível conectar à fonte NDI".to_string());
    }

    let mut last_encode = Instant::now() - ENCODE_INTERVAL;
    while !stop.load(Ordering::Relaxed) {
        let mut video: NDIlib_video_frame_v2_t = unsafe { std::mem::zeroed() };
        let frame_type = unsafe {
            capture(
                receiver,
                &mut video,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                CAPTURE_TIMEOUT_MS,
            )
        };

        if frame_type == NDIlib_frame_type_e::NDIlib_frame_type_video {
            let now = Instant::now();
            if now.duration_since(last_encode) >= ENCODE_INTERVAL {
                if let Some(jpeg) = encode_frame(&video) {
                    last_encode = now;
                    let frame = Arc::new(jpeg);
                    if let Ok(mut slot) = latest.write() {
                        *slot = Some(frame.clone());
                    }
                    let _ = tx.send(frame);
                    if let Ok(mut guard) = status.lock() {
                        guard.width = video.xres.max(0) as u32;
                        guard.height = video.yres.max(0) as u32;
                    }
                }
            }
            unsafe { free_video(receiver, &video) };
        }
    }

    unsafe { destroy(receiver) };
    Ok(())
}

fn encode_frame(video: &NDIlib_video_frame_v2_t) -> Option<Vec<u8>> {
    let width = video.xres.max(0) as usize;
    let height = video.yres.max(0) as usize;
    if width == 0 || height == 0 || video.p_data.is_null() {
        return None;
    }

    let stride = unsafe { video.__bindgen_anon_1.line_stride_in_bytes } as usize;
    let stride = if stride == 0 { width * 4 } else { stride };
    if stride < width * 4 {
        return None;
    }
    let data_len = stride.checked_mul(height)?;
    let source = unsafe { std::slice::from_raw_parts(video.p_data, data_len) };

    let mut rgba = Vec::with_capacity(width * height * 4);
    for row in 0..height {
        let start = row * stride;
        rgba.extend_from_slice(&source[start..start + width * 4]);
    }

    let mut output = Vec::new();
    let encoder = jpeg_encoder::Encoder::new(&mut output, JPEG_QUALITY);
    encoder
        .encode(
            &rgba,
            width as u16,
            height as u16,
            jpeg_encoder::ColorType::Rgba,
        )
        .ok()?;
    Some(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requer o runtime NDI instalado na máquina"]
    fn lista_fontes_ndi_local() {
        let sources = list_sources(Duration::from_millis(500)).expect("runtime NDI");
        println!("fontes NDI: {sources:?}");
    }
}
