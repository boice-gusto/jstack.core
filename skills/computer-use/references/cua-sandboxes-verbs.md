# Cua sandboxes (SDK / cloud / local images) — verb detail

Docs: [Set up a sandbox](https://cua.ai/docs/cua/guide/get-started/set-up-sandbox), [Computer SDK](https://cua.ai/docs/cua/guide/get-started/using-computer-sdk), [README](https://github.com/trycua/cua).

Summary table lives in `skills/computer-use/cua/SKILL.md`. This file holds the terminal/SDK copy-paste examples per verb.

<details>
<summary><strong>setup</strong> — Cua sandboxes (Python SDK + cloud CLI)</summary>

**Refs:** [Set up a sandbox](https://cua.ai/docs/cua/guide/get-started/set-up-sandbox) · [trycua/cua README](https://github.com/trycua/cua)

```bash
# Python SDK (3.11+)
pip install cua
```

```bash
# Cloud CLI installer (from sandbox doc)
curl -LsSf https://cua.ai/cli/install.sh | sh
cua auth login
```

```bash
# Example create (from sandbox doc — adjust flags per current docs)
cua sb create --os linux --size small --region north-america
```

Local Docker images, Lume, and Windows Sandbox paths: follow the same sandbox guide; do not guess image names or Lume CLI beyond upstream.

</details>

<details>
<summary><strong>test</strong> — Cua sandboxes (minimal SDK smoke)</summary>

**Refs:** [README — Cua sandboxes](https://github.com/trycua/cua) · [Computer SDK](https://cua.ai/docs/cua/guide/get-started/using-computer-sdk)

```python
# Requires Python 3.11+
import asyncio
from cua import Sandbox, Image

async def main() -> None:
    async with Sandbox.ephemeral(Image.linux()) as sb:
        result = await sb.shell.run("echo hello")
        _ = result
        screenshot = await sb.screenshot()
        _ = screenshot

asyncio.run(main())
```

Cloud: after `cua sb create`, use the dashboard / doc “next steps” to confirm the instance is reachable.

</details>

<details>
<summary><strong>execute</strong> — Cua sandboxes (SDK actions)</summary>

**Ref:** [README — Cua sandboxes](https://github.com/trycua/cua)

```python
# Inside async with Sandbox.ephemeral(...) as sb:
await sb.mouse.click(100, 200)
await sb.keyboard.type("Hello from Cua!")
await sb.mobile.gesture((100, 500), (100, 200))
```

Full connection patterns and limits: [Computer SDK](https://cua.ai/docs/cua/guide/get-started/using-computer-sdk).

</details>

<details>
<summary><strong>status</strong> — Cua sandboxes</summary>

**Refs:** [Set up a sandbox](https://cua.ai/docs/cua/guide/get-started/set-up-sandbox)

- **SDK:** use client connection errors / logs from your `Sandbox` session.
- **Cloud:** browser dashboard and API after `cua auth login` (see doc).

```bash
# After CLI install — discover current subcommands (do not assume output)
cua --help
cua sb --help
```

</details>

<details>
<summary><strong>restart</strong> — Cua sandboxes</summary>

**Ref:** [Set up a sandbox](https://cua.ai/docs/cua/guide/get-started/set-up-sandbox)

Typical pattern: tear down the old sandbox (CLI/dashboard/SDK) and create a new one, or reconnect the SDK client per Computer SDK doc. No universal one-liner without verifying your provider’s CLI.

</details>

<details>
<summary><strong>destroy</strong> — Cua sandboxes</summary>

**Refs:** [README](https://github.com/trycua/cua) · [Set up a sandbox](https://cua.ai/docs/cua/guide/get-started/set-up-sandbox)

```python
# Ephemeral SDK: exiting the context manager ends the sandbox session
async with Sandbox.ephemeral(Image.linux()) as sb:
    await sb.shell.run("echo bye")
# ... context exit = teardown for ephemeral pattern
```

**Cloud / local CLI:** the public sandbox guide documents **`cua sb create`**. For **delete / stop / list**, run `cua sb --help` after install (or use the cloud dashboard) and copy only **verified** commands into runbooks — do not invent `sb delete` syntax here.

</details>
