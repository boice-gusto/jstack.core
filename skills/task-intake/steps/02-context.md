# Step 2: Context Gathering

Gather technical and domain context using codebase tools and MCPs. This step runs automatically after intake to enrich the request with relevant background.

## Automated Discovery

Based on the intake title and description, perform these searches:

### Codebase Search

1. **Keyword search** — Grep for key terms from the intake description in `force-app/main/default/`
2. **Class/trigger lookup** — Find related Apex classes, triggers, handlers, and services
3. **Object model** — Identify custom objects, fields, and relationships mentioned
4. **Flow search** — Check `flows/` for declarative automation on related objects
5. **Test coverage** — Find existing test classes for impacted code

Use the `codebase-researcher` skill pattern: search code, metadata, config, tests, docs in that order.

### MCP-Assisted Discovery

All MCP calls handle auth automatically. Use config preferences as defaults; resolve missing values via MCP discovery tools.

6. **Jira search** — Use `searchJiraIssuesUsingJql` to find related tickets.
   - Resolve `cloudId` via `getAccessibleAtlassianResources` (never hardcoded).
   - Use `config.preferences.jira.projectKey` if set, otherwise search across all projects.
   ```
   text ~ "{keywords}" ORDER BY updated DESC
   ```
7. **Confluence search** — Use `searchConfluenceUsingCql` for design docs.
   - If `config.preferences.confluence.enabled`, search with keywords. No space key needed for broad search.
   ```
   text ~ "{keywords}" ORDER BY lastModified DESC
   ```
8. **Slack search** — Use `slack_search_public` for recent discussions:
   ```
   {keywords}
   ```

### Scratchpad Cross-Reference

9. Check `scratchpad/` for relevant research docs, specs, or codebase inventory entries that overlap with the intake topic.

## Output Schema

```json
{
  "context": {
    "relatedFiles": [
      {
        "path": "",
        "type": "class|trigger|flow|test|metadata",
        "relevance": "high|medium|low"
      }
    ],
    "relatedTickets": [{ "key": "", "summary": "", "status": "", "url": "" }],
    "relatedDocs": [
      { "title": "", "source": "confluence|notion|scratchpad", "url": "" }
    ],
    "impactedObjects": [],
    "dependencies": [],
    "existingTestCoverage": [],
    "riskNotes": []
  }
}
```

## Presentation

After gathering context, present a concise summary:

- **Files**: list of related files grouped by type
- **Tickets**: table of related Jira issues
- **Docs**: links to relevant documentation
- **Risk**: any coupling concerns or high-risk areas identified

Ask the user if the context looks complete or if they want to add anything before proceeding.
