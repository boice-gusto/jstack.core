# jstack telemetry — draft for Notion

Paste into Notion as an internal doc. Aligns with repo sources: [`docs/TELEMETRY.md`](TELEMETRY.md) (eval JSONL), [`telemetry/README.md`](../telemetry/README.md) (plugin buffer + optional endpoint).

---

## Purpose

Explain **defaults**, **how to set up / test / enable**, and **what we never collect** so teams can mirror this page in Notion without guessing.

---

## Defaults (JSONL-first)

| Surface | Default sink | Remote upload |
|--------|----------------|---------------|
| **Eval runs** (`JSTACK_TELEMETRY`) | Append-only **JSONL** at `~/.jstack/telemetry.jsonl` (override with `JSTACK_TELEMETRY_PATH`) | Not used unless you build your own pipeline reading that file |
| **Plugin / CLI buffer** | In-memory batch; flush optional | Only if `telemetry.enabled` **and** `telemetry.endpoint` are set in `jstack.config.json` |

**Telemetry stays off until you opt in:** evals require `JSTACK_TELEMETRY=1` (or `true`). Plugin telemetry uses `telemetry.enabled` and/or `jstack setup`.

---

## Anonymous identity (machine-local ID)

- **`~/.jstack/telemetry-instance-id`** holds a random UUID — **only on your machine**.
- Anything sent to a receiver uses **`telemetry_instance_hash`**: a short SHA-256 prefix of that UUID — **not** username, hostname, repo path, or email.
- Servers see **opaque cohort-style keys** suitable for coarse aggregation, not identification of a person.

---

## What lands in your DB (abstract aggregates)

Designed so backend tables can store:

- Event timestamps, anonymized gate/skill identifiers (e.g. `jstack:<path>`), status, latency, token/cost **totals** where applicable.
- Optional hashed eval prompt (`prompt_sha256` of the eval case prompt only — **never** the full wrapped prompt or model response text).
- **`telemetry_instance_hash`** for deduplicated volume per install, without PII.

Adjust your schema to reject any field that looks like free-form user text beyond the allowed contract in `telemetry/schema.ts`.

---

## Not collected (no PII, no PHI)

- **No** names, emails, employee IDs, MRNs, diagnoses, or clinical notes.
- **No** raw prompts, model responses, clipboard, file contents, or stack traces with user paths as a default.
- **No** silent third-party endpoints: HTTP send **no-ops** without an explicit `telemetry.endpoint` you configure.

If a workflow could touch regulated health data, **leave telemetry off** for that environment unless legal/privacy has signed off.

---

## Set up, test, and enable

1. **Configure (optional plugin path)**  
   Run `jstack setup` and answer the anonymous telemetry prompt, or edit `jstack.config.json` → `telemetry.enabled` / `telemetry.endpoint`.

2. **Test (local JSONL, no PII)**  
   ```bash
   jstack telemetry test
   ```  
   This appends one line to `~/.jstack/jstack.telemetry.selftest.jsonl` and prints paths. It also ensures `~/.jstack/telemetry-instance-id` exists.

3. **Eval JSONL (separate opt-in)**  
   ```bash
   JSTACK_TELEMETRY=1 bun run evals/run-evals.ts
   ```  
   Lines go to `~/.jstack/telemetry.jsonl` by default.

4. **Inspect buffer**  
   ```bash
   jstack telemetry status
   ```

5. **Enable remote (only when you own the endpoint)**  
   Set `telemetry.endpoint` to your HTTPS receiver; validate payloads against `telemetry/schema.ts`; then `jstack telemetry flush` when batches are ready.

---

## Review cadence

Re-read this page when changing `telemetry/schema.ts`, eval logging, or sender behavior; keep Notion in sync with repo docs.
