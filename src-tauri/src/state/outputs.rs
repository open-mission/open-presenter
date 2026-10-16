use std::collections::HashMap;
use std::sync::Mutex;

use super::types::{OutputConfig, OutputRuntime, OutputTarget};

#[derive(Debug, Default)]
pub struct OutputsState {
    configs: Mutex<HashMap<OutputTarget, OutputConfig>>,
    open: Mutex<HashMap<OutputTarget, (bool, Option<String>)>>,
}

impl OutputsState {
    pub fn set_config(&self, target: OutputTarget, cfg: OutputConfig) {
        if let Ok(mut guard) = self.configs.lock() {
            guard.insert(target, cfg);
        }
    }

    pub fn get_config(&self, target: OutputTarget) -> OutputConfig {
        self.configs
            .lock()
            .ok()
            .and_then(|guard| guard.get(&target).cloned())
            .unwrap_or_else(|| OutputConfig::off(target))
    }

    pub fn set_open(&self, target: OutputTarget, open: bool, monitor_id: Option<String>) -> bool {
        if let Ok(mut guard) = self.open.lock() {
            let next = (open, monitor_id);
            if guard.get(&target) == Some(&next) {
                return false;
            }
            guard.insert(target, next);
            return true;
        }
        false
    }

    pub fn snapshot(&self) -> Vec<OutputRuntime> {
        let guard = self.open.lock().ok();
        [OutputTarget::Public, OutputTarget::Stage]
            .iter()
            .map(|target| {
                let (open, monitor_id) = guard
                    .as_ref()
                    .and_then(|g| g.get(target))
                    .cloned()
                    .unwrap_or((false, None));
                OutputRuntime {
                    target: *target,
                    open,
                    monitor_id,
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_close_transitions() {
        let state = OutputsState::default();
        state.set_open(OutputTarget::Public, true, Some("monitor-1".to_string()));
        let snapshot = state.snapshot();
        let public = snapshot
            .iter()
            .find(|r| r.target == OutputTarget::Public)
            .expect("public no snapshot");
        assert!(public.open);
        assert_eq!(public.monitor_id.as_deref(), Some("monitor-1"));
        let stage = snapshot
            .iter()
            .find(|r| r.target == OutputTarget::Stage)
            .expect("stage no snapshot");
        assert!(!stage.open);

        state.set_open(OutputTarget::Public, false, None);
        let snapshot = state.snapshot();
        let public = snapshot
            .iter()
            .find(|r| r.target == OutputTarget::Public)
            .expect("public no snapshot");
        assert!(!public.open);
        assert_eq!(public.monitor_id, None);
    }

    #[test]
    fn set_open_retorna_changed_so_em_transicao() {
        let state = OutputsState::default();
        assert!(state.set_open(OutputTarget::Public, true, Some("monitor-1".to_string())));
        assert!(!state.set_open(OutputTarget::Public, true, Some("monitor-1".to_string())));
        assert!(state.set_open(OutputTarget::Public, true, Some("monitor-2".to_string())));
        assert!(state.set_open(OutputTarget::Public, false, None));
        assert!(!state.set_open(OutputTarget::Public, false, None));
    }
}
