# Extending the Task Intake Wizard

Guide for adding new steps, modifying the workflow, creating templates, and customizing the config.

## Adding a New Step

1. Create a new markdown file in `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/steps/` following the naming convention:

   ```
   steps/09-your-step-name.md
   ```

2. Follow this structure in the step file:

   ```markdown
   # Step N: Your Step Name

   Description of what this step does and when it runs.

   ## Process

   Numbered list of actions to perform.

   ## Output Schema

   JSON schema for the data this step produces.
   ```

3. Register the step in `config.json`:

   ```json
   "steps": {
     "your_step": {
       "enabled": true,
       "required": false,
       "order": 9,
       "file": "steps/09-your-step-name.md"
     }
   }
   ```

4. Update `skills/task-intake/SKILL.md` to reference the new step in the wizard flow section.

## Step File Conventions

- **One concern per step** — each step should do one thing well
- **Schema first** — define the output schema before writing the process
- **MCP tools** — reference the exact MCP server and tool name when calling external services
- **User gates** — always ask for confirmation before making external writes (Jira, Slack, Notion)
- **Graceful skipping** — steps should handle missing data from skipped earlier steps

## Modifying Step Order

Change the `order` value in `config.json`. Steps execute in ascending order. Gaps are fine (1, 2, 5, 10).

## Creating Custom Templates

Add templates under `${CLAUDE_PLUGIN_ROOT}/skills/task-intake/templates/`. Templates use Handlebars-style placeholders:

- `{{field}}` — simple value substitution
- `{{#if field}}...{{/if}}` — conditional sections
- `{{#each list}}...{{/each}}` — iteration over arrays
- `{{#unless @last}}, {{/unless}}` — separator logic

Reference the template in `config.json`:

```json
"templates": {
  "your_template": "templates/your-template.md"
}
```

## Per-Team Config Overrides

For team-specific configurations, create a separate config file:

```
config-teamname.json
```

At wizard start, ask which config to load or detect from branch name / directory context. Override only the fields that differ — merge team config with the base config.

## Adding a New MCP Integration

1. Check available MCP servers in the workspace
2. Read tool schemas to understand parameters
3. Add behavioral preferences (not auth) to the `preferences` section of `config.json`
4. Use MCP discovery tools to resolve IDs, projects, spaces dynamically — never hardcode them
5. Reference the MCP server and tool in the step file
6. Add a user confirmation gate before any write operation
