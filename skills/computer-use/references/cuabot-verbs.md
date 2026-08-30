# CuaBot — verb detail

Docs: [Introduction](https://docs.trycua.com/cuabot/guide/getting-started/introduction), [Installation](https://cua.ai/docs/cuabot/guide/getting-started/installation).

Summary table lives in `skills/computer-use/cua/SKILL.md`. This file holds the terminal copy-paste examples per verb.

<details>
<summary><strong>setup</strong> — CuaBot</summary>

**Refs:** [Introduction — Quick Start](https://docs.trycua.com/cuabot/guide/getting-started/introduction#quick-start) · [Installation](https://cua.ai/docs/cuabot/guide/getting-started/installation)

```bash
# Onboarding (downloads / configures per docs)
npx cuabot
```

```bash
# Global install (alternative)
npm install -g cuabot
```

Follow the installation doc for Docker, Xpra, and any macOS quarantine steps for Xpra.

</details>

<details>
<summary><strong>test</strong> — CuaBot</summary>

**Ref:** [Introduction — Commands](https://docs.trycua.com/cuabot/guide/getting-started/introduction#commands)

```bash
cuabot --screenshot
```

```bash
cuabot chromium
```

</details>

<details>
<summary><strong>execute</strong> — CuaBot</summary>

**Ref:** [Introduction](https://docs.trycua.com/cuabot/guide/getting-started/introduction)

```bash
cuabot claude
cuabot codex
cuabot bash
```

```bash
# Named session (separate container / port / window chrome)
cuabot -n work claude
cuabot --name dev bash
```

```bash
# Input automation (coordinates and keys per introduction)
cuabot --bash "echo hello"
cuabot --type "hello"
cuabot --click 100 200
cuabot --help
```

</details>

<details>
<summary><strong>status</strong> — CuaBot</summary>

**Ref:** [Introduction — Commands](https://docs.trycua.com/cuabot/guide/getting-started/introduction#commands)

```bash
cuabot --status
```

</details>

<details>
<summary><strong>restart</strong> — CuaBot</summary>

**Ref:** [Introduction — Commands](https://docs.trycua.com/cuabot/guide/getting-started/introduction#commands)

```bash
cuabot --stop
cuabot --serve
# Optional explicit port:
# cuabot --serve 8765
```

```bash
# Or re-enter via npx after stop
npx cuabot
```

</details>

<details>
<summary><strong>destroy</strong> — CuaBot</summary>

**Ref:** [Introduction — Configuration](https://docs.trycua.com/cuabot/guide/getting-started/introduction#configuration)

```bash
cuabot --stop
```

```bash
# Optional: reset local config / session files (user must agree)
rm -rf ~/.cuabot
```

```bash
# If Docker containers remain, inspect and stop manually (no invented flags)
docker ps
# docker stop <container>
```

</details>
