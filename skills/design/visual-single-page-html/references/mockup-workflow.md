# Mockup previews (`/tmp`) — voting lifecycle

Portable **design ballots** written as **`/tmp/jstack-mockup-*.html`**. Humans vote in chat or review tools; filesystem cleanup is intentional time-bounded.

## Filename convention

```
/tmp/jstack-mockup-<slug>-YYYYMMDD.html
```

- **slug**: kebab-case idea id (`landing-a`, `dash-kpi-dark`).
- **YYYYMMDD**: authoring date for sortability.

Optional alternative when multiple variants same day:

```
/tmp/jstack-mockup-<slug>-YYYYMMDD-<n>.html
```

## Machine-readable header (comments)

Agents may embed voting metadata HTML comments at top of `<head>`:

```html
<!--
  jstack-mockup-meta:
  slug=landing-a
  theme=solar-flare
  deliverable_style=landing
  reviewers=slack:#design-async
  ttl_days=14
-->
```

Parsing is informal (human/process); TTL drives cleanup scripts.

## Voting (process)

1. Agent or author generates mockup HTML and saves to **`/tmp/...`**.
2. Share **path** (`open "/tmp/jstack-mockup-....html"` on macOS) or screenshot + link thread.
3. Team records decision in Slack/PR — **winner path** optionally copied into **`library/samples/`** or product repo (`docs/mockups/`). Do **not** rely on `/tmp` for long archives.

No automated ballot counter in-scope for this skill; keep human gate.

## Cleanup over time

**`/tmp` may clear on reboot** on macOS/Linux; TTL scripts target **mtime** since write.

Recommended weekly or post-sprint prune (POSIX):

```sh
find /tmp -maxdepth 1 -name 'jstack-mockup-*.html' -mtime +14 -delete
```

Adjust **`+14`** to match **`ttl_days`**. Cron example (launchd plist or user crontab):

```cron
0 9 * * 1 find /tmp -maxdepth 1 -name 'jstack-mockup-*.html' -mtime +14 -delete 2>/dev/null
```

**Dry-run** first:

```sh
find /tmp -maxdepth 1 -name 'jstack-mockup-*.html' -mtime +14 -print
```

## Template starter

Blank shell for copy-paste lives at **`library/templates/mockup-blank.html`**.

For an in-repo **library** that lists themes and primitives (single source for designers), browse **`library/gallery.html`**.
