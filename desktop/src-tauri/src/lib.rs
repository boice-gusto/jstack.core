pub mod agent_client;

use serde_json::{json, Value};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;

/// Every command resolves the socket path fresh per call rather than caching it once at
/// startup, so changing `JSTACK_AGENT_SOCK` (or the daemon coming up after the app started)
/// doesn't need an app restart to take effect.
fn resolve_socket() -> Result<String, String> {
    agent_client::default_socket_path()
}

#[tauri::command]
async fn session_new(agent_id: String) -> Result<Value, String> {
    agent_client::call(
        &resolve_socket()?,
        "session/new",
        json!({ "agentId": agent_id }),
    )
    .await
}

#[tauri::command]
async fn session_list() -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "session/list", json!({})).await
}

#[tauri::command]
async fn session_prompt(id: String, message: String) -> Result<Value, String> {
    agent_client::call(
        &resolve_socket()?,
        "session/prompt",
        json!({ "id": id, "message": message }),
    )
    .await
}

#[tauri::command]
async fn session_cancel(id: String) -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "session/cancel", json!({ "id": id })).await
}

#[tauri::command]
async fn session_remember(
    id: String,
    content: String,
    kind: Option<String>,
    source: Option<String>,
) -> Result<Value, String> {
    agent_client::call(
        &resolve_socket()?,
        "session/remember",
        json!({
            "id": id,
            "content": content,
            "kind": kind.unwrap_or_else(|| "fact".to_string()),
            "source": source.unwrap_or_else(|| "user-stated".to_string()),
        }),
    )
    .await
}

#[tauri::command]
async fn daemon_status() -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "status", json!({})).await
}

#[tauri::command]
async fn recent_logs(limit: Option<u32>) -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "logs/recent", json!({ "limit": limit })).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // A quit item is required: Tauri's default window-close behavior on macOS hides
            // rather than terminates, so without an explicit way out the app can only be killed
            // from Activity Monitor -- exactly the kind of thing a menu-bar tool must not do.
            let quit = MenuItem::with_id(app, "quit", "Quit jstack", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit])?;
            // PLACEHOLDER: default_window_icon() is Tauri's stock color icon, not real jstack
            // branding (pending an asset from the user) and not yet the flat, monochrome
            // "template" image macOS menu-bar icons are supposed to be. Once a real monochrome
            // tray asset exists, load it here AND call `.icon_as_template(true)` so macOS can
            // auto-invert it for light/dark menu bars -- turning that on now, against a full-
            // color placeholder, would just look broken.
            TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| {
                    if event.id.as_ref() == "quit" {
                        app.exit(0);
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            session_new,
            session_list,
            session_prompt,
            session_cancel,
            session_remember,
            daemon_status,
            recent_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
