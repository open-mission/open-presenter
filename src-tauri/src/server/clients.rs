use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::http::{header, HeaderMap};

use crate::error::AppError;
use crate::state::types::{ClientKind, ConnectedClient, OutputTarget};

/// Navegadores conectados ao servidor local, por id de conexão.
pub type Clients = Arc<Mutex<HashMap<String, ConnectedClient>>>;

static CLIENT_SEQ: AtomicU64 = AtomicU64::new(1);

pub fn new_clients() -> Clients {
    Arc::new(Mutex::new(HashMap::new()))
}

pub fn next_id(prefix: &str) -> String {
    format!("{prefix}-{}", CLIENT_SEQ.fetch_add(1, Ordering::Relaxed))
}

pub fn connected_at_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

pub fn user_agent(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.chars().take(48).collect::<String>())
        .filter(|value| !value.is_empty())
}

pub fn register(clients: &Clients, client: ConnectedClient) {
    if let Ok(mut clients) = clients.lock() {
        clients.insert(client.id.clone(), client);
    }
}

pub fn set_output(clients: &Clients, id: &str, output: Option<OutputTarget>) {
    if let Ok(mut clients) = clients.lock() {
        if let Some(client) = clients.get_mut(id) {
            client.output = output;
        }
    }
}

pub fn list(clients: &Clients, kind: ClientKind) -> Result<Vec<ConnectedClient>, AppError> {
    let mut list = clients
        .lock()
        .map_err(|_| AppError::Storage("clientes indisponíveis".into()))?
        .values()
        .filter(|client| client.kind == kind)
        .cloned()
        .collect::<Vec<_>>();
    list.sort_by_key(|client| client.connected_at);
    Ok(list)
}

/// Garante que o cliente saia da lista quando a conexão terminar,
/// inclusive em saídas antecipadas do handler.
pub struct ClientGuard {
    clients: Clients,
    id: String,
}

impl ClientGuard {
    pub fn new(clients: &Clients, id: impl Into<String>) -> Self {
        Self {
            clients: clients.clone(),
            id: id.into(),
        }
    }
}

impl Drop for ClientGuard {
    fn drop(&mut self) {
        if let Ok(mut clients) = self.clients.lock() {
            clients.remove(&self.id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::types::{ClientKind, ConnectedClient};

    fn client(id: &str, kind: ClientKind, connected_at: u64) -> ConnectedClient {
        ConnectedClient {
            id: id.into(),
            ip: "192.168.0.10".into(),
            output: None,
            user_agent: None,
            connected_at,
            kind,
        }
    }

    #[test]
    fn lista_filtra_clientes_por_tipo_e_ordena_por_conexao() {
        let clients = new_clients();
        register(&clients, client("remote-2", ClientKind::Remote, 200));
        register(&clients, client("ws-1", ClientKind::Output, 300));
        register(&clients, client("remote-1", ClientKind::Remote, 100));

        let remotes = list(&clients, ClientKind::Remote).expect("lista de remotos");
        assert_eq!(
            remotes.iter().map(|c| c.id.as_str()).collect::<Vec<_>>(),
            vec!["remote-1", "remote-2"]
        );

        let outputs = list(&clients, ClientKind::Output).expect("lista de saídas");
        assert_eq!(
            outputs.iter().map(|c| c.id.as_str()).collect::<Vec<_>>(),
            vec!["ws-1"]
        );
    }

    #[test]
    fn guard_remove_cliente_ao_encerrar_conexao() {
        let clients = new_clients();
        register(&clients, client("remote-9", ClientKind::Remote, 1));

        {
            let _guard = ClientGuard::new(&clients, "remote-9");
        }

        assert!(list(&clients, ClientKind::Remote)
            .expect("lista de remotos")
            .is_empty());
    }
}
