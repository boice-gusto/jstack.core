pub mod agent_client;

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::image::Image;
use tauri::menu::{AboutMetadata, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{Emitter, Manager};

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
async fn session_history(id: String) -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "session/history", json!({ "id": id })).await
}

#[tauri::command]
async fn session_prompt(
    id: String,
    message: String,
    mode: Option<String>,
    thinking_level: Option<String>,
) -> Result<Value, String> {
    agent_client::call(
        &resolve_socket()?,
        "session/prompt",
        json!({
            "id": id,
            "message": message,
            "mode": mode,
            "thinkingLevel": thinking_level,
        }),
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
async fn agent_list() -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "agent/list", json!({})).await
}

#[tauri::command]
async fn agent_create(
    id: String,
    name: String,
    persona: Option<String>,
    model: Option<String>,
    tools: Option<Vec<String>>,
    mcp: Option<String>,
) -> Result<Value, String> {
    agent_client::call(
        &resolve_socket()?,
        "agent/create",
        json!({
            "id": id,
            "name": name,
            "persona": persona,
            "model": model,
            "tools": tools,
            "mcp": mcp,
        }),
    )
    .await
}

#[tauri::command]
async fn agent_update(
    id: String,
    model: Option<String>,
    tools: Option<Vec<String>>,
    mcp: Option<String>,
    enabled: Option<bool>,
) -> Result<Value, String> {
    agent_client::call(
        &resolve_socket()?,
        "agent/update",
        json!({ "id": id, "model": model, "tools": tools, "mcp": mcp, "enabled": enabled }),
    )
    .await
}

#[tauri::command]
async fn skills_index() -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "skills/index", json!({})).await
}

#[tauri::command]
async fn daemon_status() -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "status", json!({})).await
}

#[tauri::command]
async fn recent_logs(limit: Option<u32>) -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "logs/recent", json!({ "limit": limit })).await
}

#[tauri::command]
async fn schedule_create(
    agent_id: String,
    prompt: String,
    cron: String,
    notify_channel: Option<String>,
) -> Result<Value, String> {
    agent_client::call(
        &resolve_socket()?,
        "schedule/create",
        json!({
            "agentId": agent_id,
            "prompt": prompt,
            "cron": cron,
            "notifyChannel": notify_channel,
        }),
    )
    .await
}

#[tauri::command]
async fn schedule_list() -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "schedule/list", json!({})).await
}

#[tauri::command]
async fn schedule_update(id: String, enabled: bool) -> Result<Value, String> {
    agent_client::call(
        &resolve_socket()?,
        "schedule/update",
        json!({ "id": id, "enabled": enabled }),
    )
    .await
}

#[tauri::command]
async fn schedule_delete(id: String) -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "schedule/delete", json!({ "id": id })).await
}

#[tauri::command]
async fn run_diagnostics() -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "diagnostics/run", json!({})).await
}

#[tauri::command]
async fn integrations_list() -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "integrations/list", json!({})).await
}

#[tauri::command]
async fn mcp_list() -> Result<Value, String> {
    agent_client::call(&resolve_socket()?, "mcp/list", json!({})).await
}

#[derive(Deserialize)]
struct TrayAgentPayload {
    id: String,
    name: String,
}

#[derive(Deserialize)]
struct TraySessionPayload {
    id: String,
    #[serde(rename = "agentId")]
    agent_id: String,
    label: String,
}

/// Rebuilds the tray's whole menu from scratch every call rather than diffing -- the frontend
/// already recomputes `agents`/top-5-sessions on every relevant state change and calls
/// `update_tray_menu` wholesale (see App.tsx), so there's no separate "menu already matches this
/// data" tracking to get out of sync. Dynamic item ids (`tray-agent:<id>`, `tray-session:<id>:
/// <agentId>`) are parsed back apart in `on_menu_event` below to route a click to the right
/// frontend action via an emitted event -- the menu itself has no other way to carry that data.
fn build_tray_menu(
    app: &tauri::AppHandle,
    agents: &[TrayAgentPayload],
    sessions: &[TraySessionPayload],
) -> tauri::Result<Menu<tauri::Wry>> {
    let show = MenuItem::with_id(app, "show", "Show jstack", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "tray-settings", "Settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit jstack", true, None::<&str>)?;

    let mut items: Vec<Box<dyn IsMenuItem<tauri::Wry>>> = vec![Box::new(show)];
    items.push(Box::new(PredefinedMenuItem::separator(app)?));

    if !agents.is_empty() {
        let agent_items = agents
            .iter()
            .map(|a| {
                MenuItem::with_id(app, format!("tray-agent:{}", a.id), &a.name, true, None::<&str>)
            })
            .collect::<tauri::Result<Vec<_>>>()?;
        let agent_refs: Vec<&dyn IsMenuItem<tauri::Wry>> =
            agent_items.iter().map(|i| i as &dyn IsMenuItem<tauri::Wry>).collect();
        items.push(Box::new(Submenu::with_items(app, "Agents", true, &agent_refs)?));
    }

    if !sessions.is_empty() {
        let session_items = sessions
            .iter()
            .map(|s| {
                MenuItem::with_id(
                    app,
                    format!("tray-session:{}:{}", s.id, s.agent_id),
                    &s.label,
                    true,
                    None::<&str>,
                )
            })
            .collect::<tauri::Result<Vec<_>>>()?;
        let session_refs: Vec<&dyn IsMenuItem<tauri::Wry>> =
            session_items.iter().map(|i| i as &dyn IsMenuItem<tauri::Wry>).collect();
        items.push(Box::new(Submenu::with_items(app, "Sessions", true, &session_refs)?));
    }

    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    items.push(Box::new(settings));
    items.push(Box::new(quit));

    let item_refs: Vec<&dyn IsMenuItem<tauri::Wry>> = items.iter().map(|i| i.as_ref()).collect();
    Menu::with_items(app, &item_refs)
}

#[tauri::command]
fn update_tray_menu(
    app: tauri::AppHandle,
    tray: tauri::State<'_, TrayIcon<tauri::Wry>>,
    agents: Vec<TrayAgentPayload>,
    sessions: Vec<TraySessionPayload>,
) -> Result<(), String> {
    let menu = build_tray_menu(&app, &agents, &sessions).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

/// Every status (including "none") is a full-color, non-template icon -- the logo composited
/// onto a solid status-color circle (see icons/tray-icon-<color>.png) -- never the flat
/// monochrome template. "none" uses a white circle + black logo instead of a color, since white
/// still needs to read clearly against both light and dark menu bars without macOS's
/// auto-invert (which only applies to template icons, and would fight a deliberately-white
/// circle). "green-dim" is the alternate frame the frontend flips to every ~600ms to fake a
/// pulse for "a chat is actively thinking" -- Tauri/macOS have no native animated tray icon, so
/// this is a two-frame flipbook rather than a real animation.
#[tauri::command]
fn set_tray_status(tray: tauri::State<'_, TrayIcon<tauri::Wry>>, status: String) -> Result<(), String> {
    let bytes: &[u8] = match status.as_str() {
        "red" => include_bytes!("../icons/tray-icon-red@2x.png"),
        "yellow" => include_bytes!("../icons/tray-icon-yellow@2x.png"),
        "green" => include_bytes!("../icons/tray-icon-green@2x.png"),
        "green-dim" => include_bytes!("../icons/tray-icon-green-dim@2x.png"),
        _ => include_bytes!("../icons/tray-icon-none@2x.png"),
    };
    let icon = Image::from_bytes(bytes).map_err(|e| e.to_string())?;
    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    tray.set_icon_as_template(false).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // A quit item is required: Tauri's default window-close behavior on macOS hides
            // rather than terminates, so without an explicit way out the app can only be killed
            // from Activity Monitor -- exactly the kind of thing a menu-bar tool must not do.
            // "Show jstack" is the way back in after that hide, since the tray icon itself has
            // no title/text on macOS (only left-click-to-open-menu), so there'd otherwise be no
            // discoverable way to reopen a hidden window short of relaunching the app.
            // Empty at startup -- the frontend populates the real agent/session submenus via
            // `update_tray_menu` once it has loaded them (see App.tsx), same "app pushes its own
            // state to the tray" pattern as `set_tray_status`.
            let menu = build_tray_menu(app.handle(), &[], &[])?;
            // The logo on a white circle (see set_tray_status's doc comment) -- the same "none"
            // icon the frontend sets once it's loaded, so there's no flash of a different icon
            // between window creation and the first real status push.
            let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-icon-none@2x.png"))?;
            let tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .icon(tray_icon)
                .icon_as_template(false)
                .on_menu_event(|app, event| {
                    let id = event.id.as_ref();
                    let focus_main = |app: &tauri::AppHandle| {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    };
                    if id == "quit" {
                        app.exit(0);
                    } else if id == "show" {
                        focus_main(app);
                    } else if id == "tray-settings" {
                        focus_main(app);
                        let _ = app.emit("tray-open-settings", ());
                    } else if let Some(agent_id) = id.strip_prefix("tray-agent:") {
                        focus_main(app);
                        let _ = app.emit("tray-agent-selected", agent_id);
                    } else if let Some(rest) = id.strip_prefix("tray-session:") {
                        if let Some((session_id, agent_id)) = rest.split_once(':') {
                            focus_main(app);
                            let _ = app.emit(
                                "tray-session-selected",
                                json!({ "id": session_id, "agentId": agent_id }),
                            );
                        }
                    }
                })
                .build(app)?;
            app.manage(tray);

            // Tauri's auto-generated default macOS app menu shows a generic "About jstack" with
            // no icon/credits -- this rebuilds that same default structure (see tauri's own
            // `Menu::default`) but with our own icon and a `credits` line, since macOS's native
            // About panel ignores AboutMetadata's `authors`/`comments`/`website` fields entirely
            // (platform limitation, not a bug here) and `credits` is the one free-text field it
            // actually renders.
            #[cfg(target_os = "macos")]
            {
                let about_metadata = AboutMetadata {
                    name: Some("jstack".into()),
                    version: Some(app.package_info().version.to_string()),
                    icon: Image::from_bytes(include_bytes!("../icons/about-logo.png")).ok(),
                    credits: Some(
                        "by @skinnnyJay\nhttps://github.com/boice-gusto/jstack.core".into(),
                    ),
                    ..Default::default()
                };
                let app_menu = Submenu::with_items(
                    app,
                    "jstack",
                    true,
                    &[
                        &PredefinedMenuItem::about(app, Some("About jstack"), Some(about_metadata))?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::services(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::hide(app, None)?,
                        &PredefinedMenuItem::hide_others(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::quit(app, None)?,
                    ],
                )?;
                let edit_menu = Submenu::with_items(
                    app,
                    "Edit",
                    true,
                    &[
                        &PredefinedMenuItem::undo(app, None)?,
                        &PredefinedMenuItem::redo(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::cut(app, None)?,
                        &PredefinedMenuItem::copy(app, None)?,
                        &PredefinedMenuItem::paste(app, None)?,
                        &PredefinedMenuItem::select_all(app, None)?,
                    ],
                )?;
                let window_menu = Submenu::with_items(
                    app,
                    "Window",
                    true,
                    &[
                        &PredefinedMenuItem::minimize(app, None)?,
                        &PredefinedMenuItem::maximize(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::close_window(app, None)?,
                    ],
                )?;
                let native_menu = Menu::with_items(app, &[&app_menu, &edit_menu, &window_menu])?;
                app.set_menu(native_menu)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            session_new,
            session_list,
            session_history,
            session_prompt,
            session_cancel,
            session_remember,
            agent_list,
            agent_create,
            agent_update,
            daemon_status,
            recent_logs,
            skills_index,
            schedule_create,
            schedule_list,
            schedule_update,
            schedule_delete,
            run_diagnostics,
            integrations_list,
            mcp_list,
            update_tray_menu,
            set_tray_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
