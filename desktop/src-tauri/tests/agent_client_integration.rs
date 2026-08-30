//! Real end-to-end coverage: launches an ACTUAL `crewd` resident process (not a fake stand-in)
//! and drives it through `agent_client::call`, the same function the Tauri commands use.
//!
//! Isolation is the whole point of this file's setup. `loadConfig()` in crewd.ts checks the
//! real, hardcoded `~/.jstack/crew/config.snapshot.json` before anything else, with no
//! override hook -- and a real one exists on this development machine. `expandHome("~")`
//! resolves via `os.homedir()`, which reads `$HOME`, so overriding `HOME` to a fresh temp
//! directory for the spawned crewd process is what keeps this test from ever touching real
//! user state, without needing to change crewd.ts itself.
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::time::Duration;

struct CrewdProcess {
    child: Child,
    _fake_home: PathBuf,
}

impl Drop for CrewdProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn jstack_core_root() -> PathBuf {
    // desktop/src-tauri -> desktop -> jstack.core
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

/// Short on purpose: macOS's `sockaddr_un.sun_path` caps a Unix socket path at ~104 bytes.
/// `std::env::temp_dir()` alone (`/var/folders/.../T/`) already eats ~50 of those, so this
/// helper also roots every temp dir under plain `/tmp` rather than that longer per-user path --
/// a PID+nanos id was long enough on its own to push `<tmp>/.jstack/crew/agent.sock` over the
/// limit and make `Bun.listen` fail with no more specific error than "Failed to listen".
fn unique_id() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{:x}", (std::process::id() as u128) ^ nanos)
        .chars()
        .take(8)
        .collect()
}

fn short_tmp_dir(prefix: &str) -> PathBuf {
    PathBuf::from("/tmp").join(format!("{prefix}-{}", unique_id()))
}

fn write_fake_claude(dir: &Path) {
    let script = dir.join("claude");
    fs::write(
        &script,
        "#!/bin/sh\necho '{\"is_error\":false,\"result\":\"integration reply\",\"total_cost_usd\":0.001}'\n",
    )
    .unwrap();
    let mut perms = fs::metadata(&script).unwrap().permissions();
    std::os::unix::fs::PermissionsExt::set_mode(&mut perms, 0o755);
    fs::set_permissions(&script, perms).unwrap();
}

/// Spawns a real, isolated `crewd --resident` process rooted at `fake_home` (its `HOME`, so
/// `~/.jstack/crew` resolves under a throwaway temp dir instead of the real one) and blocks
/// until its RPC socket exists at `sock_path` (`<fake_home>/.jstack/crew/agent.sock`).
fn spawn_isolated_crewd(fake_home: &Path, sock_path: &Path) -> CrewdProcess {
    let project_root = short_tmp_dir("jd-e2e-proj");
    let fake_bin_dir = short_tmp_dir("jd-e2e-bin");
    fs::create_dir_all(fake_home).unwrap();
    fs::create_dir_all(&project_root).unwrap();
    fs::create_dir_all(&fake_bin_dir).unwrap();
    write_fake_claude(&fake_bin_dir);

    let config = json!({
        "crew": {
            "enabled": true,
            "mode": "dry_run",
            "state_dir": "~/.jstack/crew",
            "slack": { "self_user_id": "U0TESTUSER1" },
            "agents": {
                "ralph": { "name": "Ralph", "sigils": ["!ralph"], "workspace": project_root.to_string_lossy() }
            },
            "policy": {
                "ingress": { "channels": ["D0TESTDM001"], "authors": ["U0TESTUSER1"] },
                "egress": { "channels": ["D0TESTDM001"] }
            }
        }
    });
    fs::write(
        project_root.join("jstack.config.json"),
        serde_json::to_string_pretty(&config).unwrap(),
    )
    .unwrap();

    let existing_path = std::env::var("PATH").unwrap_or_default();
    let child = Command::new("bun")
        .arg("run")
        .arg(jstack_core_root().join("cli/src/crewd.ts"))
        .env("HOME", fake_home)
        .env("JSTACK_PROJECT_ROOT", &project_root)
        .env("JSTACK_CREW_RESIDENT", "1")
        .env("JSTACK_CREW_TICK_INTERVAL_MS", "500")
        // crewd's preflight re-spawns `process.execPath` with a probe env var, relying on that
        // being the compiled crewd binary (so re-spawning it re-runs crewd.ts in probe mode).
        // Under `bun run crewd.ts` (uncompiled, as this test runs it), execPath is bare `bun`,
        // so the "re-spawn" just prints bun's own --help and preflight reports failure. Skipping
        // it is safe here: preflight only guards a TCC-protected-path hang, and this test's
        // fake_home/project_root are plain temp dirs, never under ~/Documents.
        .env("JSTACK_CREW_SKIP_PREFLIGHT", "1")
        .env(
            "PATH",
            format!("{}:{}", fake_bin_dir.display(), existing_path),
        )
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .expect("failed to spawn crewd - is `bun` on PATH?");

    let proc = CrewdProcess {
        child,
        _fake_home: fake_home.to_path_buf(),
    };

    // Poll for the socket rather than a fixed sleep: the daemon has to run its first cycle
    // (config load, health write, tick) before the RPC server binds.
    for _ in 0..100 {
        if sock_path.exists() {
            return proc;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    panic!(
        "crewd never created its RPC socket at {} within 5s",
        sock_path.display()
    );
}

#[tokio::test]
async fn real_crewd_session_new_prompt_and_status_round_trip() {
    let fake_home = short_tmp_dir("jd-e2e-home");
    let sock_path = fake_home.join(".jstack/crew/agent.sock");
    let _proc = spawn_isolated_crewd(&fake_home, &sock_path);
    let sock = sock_path.to_string_lossy().to_string();

    let created =
        desktop_lib::agent_client::call(&sock, "session/new", json!({ "agentId": "ralph" }))
            .await
            .expect("session/new failed");
    let id = created["id"].as_str().expect("id in response").to_string();

    let prompted = desktop_lib::agent_client::call(
        &sock,
        "session/prompt",
        json!({ "id": id, "message": "hello from the integration test" }),
    )
    .await
    .expect("session/prompt failed");
    assert_eq!(prompted["ok"], json!(true));
    assert_eq!(prompted["text"], json!("integration reply"));

    let status = desktop_lib::agent_client::call(&sock, "status", json!({}))
        .await
        .expect("status failed");
    assert!(status["tasks"].as_i64().unwrap_or(0) >= 1);
}
