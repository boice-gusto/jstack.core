# Tone: Formal

> **Owner:** PM, legal liaison, or comms lead. Edit this file for external-facing documents, compliance artifacts, and customer communications.

## Audience

<!-- [CUSTOMIZE] Who sees formal output from your team? -->
External stakeholders, customers, compliance auditors, partners, board documentation.

## Voice

<!-- [CUSTOMIZE] Paste a paragraph from a real external doc your org approved. -->
```
Example: "Acme Platform experienced elevated error rates between 14:02 and 
14:47 UTC on March 12, affecting approximately 3% of API requests in the 
US-East region. The root cause was identified as a configuration change in 
the load balancer. Service was fully restored at 14:47 UTC with no data loss."
```

## Structure

1. **Complete sentences** — no bullet shorthand in body text. Bullets are for lists of items, not narrative.
2. **Third person** — "The team completed..." not "We shipped..."
3. **Precise language** — state facts. If uncertain, say "under investigation" not "probably fine."
4. **Product name consistency:**
   <!-- [CUSTOMIZE] Your product names as they appear externally -->
   | Internal name | External name |
   |--------------|---------------|
   | the platform | Acme Platform |
   | auth service | Sign-in |
   | admin panel | Management Console |
5. **Legal/compliance language:**
   <!-- [CUSTOMIZE] Any required disclaimers or phrasing your legal team mandates -->
   - Data handling references must use approved privacy language
   - Pricing/terms changes require legal sign-off before publish

## What to avoid

<!-- [CUSTOMIZE] Phrases your comms team has flagged -->
- Internal codenames or project names
- Casual phrasing, contractions, emoji
- Committing to timelines without engineering sign-off
- Mentioning competitors by name in incident comms

## Config hook

```json
{
  "tones": {
    "formal": {
      "product_name": "Acme Platform",
      "legal_review_required": true,
      "name_map": { "auth service": "Sign-in" }
    }
  }
}
```
