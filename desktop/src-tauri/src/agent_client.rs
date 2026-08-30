//! Client for crew's local RPC socket (see `cli/src/lib/crew/rpc-server.ts`): a Unix domain
//! socket, newline-delimited JSON-RPC-shaped requests/responses. One request per connection,
//! matching the server's own model -- it doesn't multiplex multiple in-flight requests over one
//! connection, so neither does this client.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;

#[derive(Serialize)]
struct RpcRequest<'a> {
    id: u32,
    method: &'a str,
    params: Value,
}

#[derive(Deserialize)]
struct RpcResponse {
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<RpcError>,
}

#[derive(Deserialize)]
struct RpcError {
    message: String,
}

/// Default socket path, matching `rpc-server.ts`'s `socketPath()` for crew's default
/// `state_dir` (`~/.jstack/crew`). Overridable via `JSTACK_AGENT_SOCK` for a non-default
/// `state_dir`, and (in tests) for pointing at an isolated instance without touching a real
/// user's daemon.
pub fn default_socket_path() -> Result<String, String> {
    if let Ok(p) = std::env::var("JSTACK_AGENT_SOCK") {
        return Ok(p);
    }
    let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_string())?;
    Ok(format!("{home}/.jstack/crew/agent.sock"))
}

/// Sends one request, reads one newline-terminated response line, and returns `result` -- or
/// `Err` for either a transport failure (can't connect, write, or read) or an RPC-level `error`
/// the server sent back. Callers can't tell the two apart from the return type alone, which is
/// fine here: both surface to the UI as "that didn't work," not as cases needing different
/// handling.
pub async fn call(sock_path: &str, method: &str, params: Value) -> Result<Value, String> {
    let stream = UnixStream::connect(sock_path)
        .await
        .map_err(|e| format!("could not connect to {sock_path}: {e}"))?;
    let (read_half, mut write_half) = stream.into_split();

    let req = RpcRequest {
        id: 1,
        method,
        params,
    };
    let mut line = serde_json::to_string(&req).map_err(|e| e.to_string())?;
    line.push('\n');
    write_half
        .write_all(line.as_bytes())
        .await
        .map_err(|e| format!("write failed: {e}"))?;

    let mut reader = BufReader::new(read_half);
    let mut resp_line = String::new();
    reader
        .read_line(&mut resp_line)
        .await
        .map_err(|e| format!("read failed: {e}"))?;
    if resp_line.is_empty() {
        return Err("connection closed with no response".to_string());
    }

    let resp: RpcResponse = serde_json::from_str(resp_line.trim())
        .map_err(|e| format!("malformed response ({e}): {resp_line}"))?;
    if let Some(err) = resp.error {
        return Err(err.message);
    }
    Ok(resp.result.unwrap_or(Value::Null))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::UnixListener;

    /// A tiny fake server standing in for rpc-server.ts, so this module's framing/error-handling
    /// is tested without needing a real crew daemon. Real end-to-end coverage against the actual
    /// Bun server lives in `tests/agent_client_integration.rs`.
    async fn fake_server(sock_path: &str, response_line: &'static str) {
        let listener = UnixListener::bind(sock_path).unwrap();
        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let (read_half, mut write_half) = stream.into_split();
            let mut reader = BufReader::new(read_half);
            let mut line = String::new();
            reader.read_line(&mut line).await.unwrap();
            write_half
                .write_all(response_line.as_bytes())
                .await
                .unwrap();
        });
        // Give the listener a moment to actually be accepting before the client connects.
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }

    fn temp_sock_path(name: &str) -> String {
        let dir =
            std::env::temp_dir().join(format!("agent-client-test-{}-{}", name, std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join("test.sock").to_string_lossy().to_string()
    }

    #[tokio::test]
    async fn returns_the_result_field_on_success() {
        let sock = temp_sock_path("success");
        fake_server(&sock, "{\"id\":1,\"result\":{\"ok\":true}}\n").await;
        let result = call(&sock, "status", serde_json::json!({})).await.unwrap();
        assert_eq!(result, serde_json::json!({"ok": true}));
    }

    #[tokio::test]
    async fn surfaces_an_rpc_error_as_err() {
        let sock = temp_sock_path("error");
        fake_server(
            &sock,
            "{\"id\":1,\"error\":{\"message\":\"unknown method: bogus\"}}\n",
        )
        .await;
        let err = call(&sock, "bogus", serde_json::json!({}))
            .await
            .unwrap_err();
        assert!(err.contains("unknown method"));
    }

    #[tokio::test]
    async fn a_missing_socket_fails_with_a_clear_message_instead_of_panicking() {
        let err = call("/nonexistent/path.sock", "status", serde_json::json!({}))
            .await
            .unwrap_err();
        assert!(err.contains("could not connect"));
    }

    #[test]
    fn default_socket_path_honors_the_env_override() {
        std::env::set_var("JSTACK_AGENT_SOCK", "/tmp/custom.sock");
        assert_eq!(default_socket_path().unwrap(), "/tmp/custom.sock");
        std::env::remove_var("JSTACK_AGENT_SOCK");
    }
}
