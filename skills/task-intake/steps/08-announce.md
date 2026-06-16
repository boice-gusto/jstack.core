# Step 8: Announcement

Notify stakeholders about the newly intake'd task via Slack. Supports draft mode for review before posting.

## Announcement Flow

1. Load announcement template from `templates/announcement.md`
2. Populate template with data from all previous steps
3. Resolve announce channels (see Channel Resolution below)
4. If `config.preferences.slack.draftMode` is true:
   - Use `slack_send_message_draft` to create a draft
   - Present draft link to user for review
   - Ask if they want to send now or leave as draft
5. If draft mode is false or user confirms:
   - Use `slack_send_message` to post to each announce channel
   - Cross-post to additional channels from `config.preferences.slack.crossPostChannels`

## Channel Resolution

Channels are resolved dynamically — never hardcode channel IDs.

1. **Config has channel names** — if `config.preferences.slack.announceChannels` lists channel names, use `slack_search_channels` to resolve each name to its channel ID.
2. **Config is blank** — use `slack_search_channels` to search for relevant channels based on:
   - The team/domain from intake (e.g., requestor's team name)
   - Keywords from the intake title
   - Common patterns like `eng-`, `team-`, `project-`
3. **Present matches** to the user via `AskQuestion` for confirmation before posting.
4. **Cross-post channels** follow the same resolution pattern.

## Message Formatting

Slack messages use mrkdwn (not standard Markdown):

- `*bold*` (single asterisks)
- `_italic_` (underscores)
- `` `code` `` (backticks)
- `>` quote (angle bracket)
- No `##` headers or `**double asterisks**`

## Cross-Posting

When cross-posting to multiple channels:

- Post the full message to the primary announce channel
- Post a shorter summary with a link to the primary message in cross-post channels
- Track all message links for the summary

## Requestor Mention

If `config.preferences.slack.mentionRequestor` is true and a Slack handle was captured in intake:

- Use `slack_search_users` to resolve the user ID
- Include an `@mention` in the announcement

## Output Schema

```json
{
  "announce": {
    "primaryChannel": { "channelId": "", "channelName": "", "messageLink": "" },
    "crossPosts": [{ "channelId": "", "channelName": "", "messageLink": "" }],
    "draftMode": false,
    "messageContent": ""
  }
}
```
