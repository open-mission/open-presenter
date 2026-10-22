use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, Window};

use crate::error::AppError;
use crate::services::database::Db;
use crate::services::settings;

pub const WINDOW_RECT_KEY: &str = "app.window_rect";
const FALLBACK_WIDTH: u32 = 1400;
const FALLBACK_HEIGHT: u32 = 900;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct WindowRect {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MonitorRect {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
}

pub fn rects_intersect(a: &WindowRect, b: &MonitorRect) -> bool {
    let ax1 = a.x as i64;
    let ay1 = a.y as i64;
    let ax2 = ax1 + a.w as i64;
    let ay2 = ay1 + a.h as i64;
    let bx1 = b.x as i64;
    let by1 = b.y as i64;
    let bx2 = bx1 + b.w as i64;
    let by2 = by1 + b.h as i64;
    ax1 < bx2 && bx1 < ax2 && ay1 < by2 && by1 < ay2
}

pub fn fallback_rect(monitor: MonitorRect) -> WindowRect {
    let w = FALLBACK_WIDTH.min(monitor.w);
    let h = FALLBACK_HEIGHT.min(monitor.h);
    WindowRect {
        x: monitor.x + (monitor.w.saturating_sub(w) / 2) as i32,
        y: monitor.y + (monitor.h.saturating_sub(h) / 2) as i32,
        w,
        h,
    }
}

fn monitor_rects(window: &WebviewWindow) -> Vec<MonitorRect> {
    window
        .available_monitors()
        .map(|monitors| {
            monitors
                .iter()
                .map(|monitor| MonitorRect {
                    x: monitor.position().x,
                    y: monitor.position().y,
                    w: monitor.size().width,
                    h: monitor.size().height,
                })
                .collect()
        })
        .unwrap_or_default()
}

fn is_rect_usable(window: &WebviewWindow, rect: &WindowRect) -> bool {
    let monitors = monitor_rects(window);
    monitors.is_empty() || monitors.iter().any(|m| rects_intersect(rect, m))
}

fn primary_fallback(window: &WebviewWindow) -> Option<WindowRect> {
    window
        .primary_monitor()
        .ok()
        .flatten()
        .map(|monitor| MonitorRect {
            x: monitor.position().x,
            y: monitor.position().y,
            w: monitor.size().width,
            h: monitor.size().height,
        })
        .map(fallback_rect)
}

pub fn read_rect(app: &AppHandle) -> Option<WindowRect> {
    let db = app.try_state::<Db>()?;
    let raw = db
        .with_conn(|conn| settings::get_setting(conn, WINDOW_RECT_KEY))
        .ok()
        .flatten()?;
    serde_json::from_str(&raw).ok()
}

pub fn write_rect(app: &AppHandle, rect: &WindowRect) -> Result<(), AppError> {
    let Some(db) = app.try_state::<Db>() else {
        return Ok(());
    };
    let raw = serde_json::to_string(rect).map_err(|err| AppError::Storage(err.to_string()))?;
    db.with_conn(|conn| settings::set_setting(conn, WINDOW_RECT_KEY, &raw))
}

pub fn current_rect(window: &WebviewWindow) -> Option<WindowRect> {
    let position = window.outer_position().ok()?;
    let size = window.inner_size().ok()?;
    Some(WindowRect {
        x: position.x,
        y: position.y,
        w: size.width,
        h: size.height,
    })
}

pub fn save_geometry(window: &Window) {
    if window.label() != "main" {
        return;
    }
    let Some(main) = window.app_handle().get_webview_window("main") else {
        return;
    };
    if main.is_maximized().unwrap_or(false) {
        return;
    }
    if let Some(rect) = current_rect(&main) {
        let _ = write_rect(&main.app_handle(), &rect);
    }
}

pub fn apply_startup_geometry(window: &WebviewWindow) {
    if crate::commands::preferences::start_maximized(window.app_handle()) {
        let _ = window.maximize();
        let _ = window.set_focus();
        return;
    }

    let restored = read_rect(window.app_handle())
        .filter(|rect| is_rect_usable(window, rect))
        .or_else(|| primary_fallback(window));

    match restored {
        Some(rect) => {
            let _ = window.unmaximize();
            let _ = window.set_size(PhysicalSize::new(rect.w, rect.h));
            let _ = window.set_position(PhysicalPosition::new(rect.x, rect.y));
            let _ = write_rect(window.app_handle(), &rect);
        }
        None => {
            let _ = window.center();
            let _ = window.set_focus();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rects_intersect_detecta_sobreposicao() {
        let a = WindowRect {
            x: 0,
            y: 0,
            w: 100,
            h: 100,
        };
        let b = MonitorRect {
            x: 50,
            y: 50,
            w: 100,
            h: 100,
        };
        assert!(rects_intersect(&a, &b));
    }

    #[test]
    fn rects_intersect_falso_para_retangulos_disjuntos() {
        let a = WindowRect {
            x: 0,
            y: 0,
            w: 100,
            h: 100,
        };
        let c = MonitorRect {
            x: 500,
            y: 500,
            w: 100,
            h: 100,
        };
        assert!(!rects_intersect(&a, &c));
    }

    #[test]
    fn fallback_rect_centraliza_e_limita_ao_monitor() {
        let monitor = MonitorRect {
            x: 0,
            y: 0,
            w: 1024,
            h: 640,
        };
        let rect = fallback_rect(monitor);
        assert_eq!(rect.w, 1024);
        assert_eq!(rect.h, 640);
        assert_eq!(rect.x, 0);
        assert_eq!(rect.y, 0);

        let big = fallback_rect(MonitorRect {
            x: 100,
            y: 50,
            w: 1920,
            h: 1080,
        });
        assert_eq!(big.w, 1400);
        assert_eq!(big.h, 900);
        assert_eq!(big.x, 100 + 260);
        assert_eq!(big.y, 50 + 90);
    }
}
