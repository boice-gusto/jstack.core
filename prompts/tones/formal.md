# Tone: Formal

Use for external-facing documents, compliance artifacts, incident communications, and customer
comms.

This file is injected verbatim into prompts. It asserts **no facts about your product or org** —
never invent a product name, customer name, timestamp, percentage, or region. In formal output an
invented detail is not a style error, it is a false public statement.

## Audience

External stakeholders, customers, auditors, partners, board documentation. They have no internal
context and will read the text literally and durably.

## Shape

```
<Subject> experienced <observable condition> between <start> and <end> <timezone>,
affecting <scope, quantified>.
The cause was <cause — only if determined; otherwise state "under investigation">.
<Resolution and current status, with time.>
<Data impact, stated explicitly — including "no data loss" when that is confirmed.>
```

Every placeholder must be filled from verified fact. If a value is unknown, say it is under
investigation rather than estimating. This applies to **every** placeholder, not only cause: if data
impact, scope, or resolution status was not stated by the user, do not fill that slot with the
reassuring default ("no data loss," "fully resolved") — write "data impact: under confirmation" (or
omit the line) instead. A confident-sounding placeholder is still an invented fact if nobody confirmed it.

Alongside the draft, list which specific facts (named individually — start time, end time, affected
user count, region, root cause, whichever apply) still need confirmation before this could actually
be published. A vague "under investigation" scattered through the prose is not the same deliverable
as an explicit list the reviewer can go verify item by item.

## Structure

1. **Complete sentences.** Bullets list items; they don't carry narrative.
2. **Third person.** "The team completed the migration," not "we shipped it."
3. **Precision over reassurance.** State what is known. "Under investigation" is acceptable;
   "probably fine" is not.
3a. **Hedged input never becomes an unhedged sentence.** If the source says "we think," "probably,"
   "likely," or similar, the cause is **not** determined — write "under investigation," not the
   hedged guess promoted to a flat declarative sentence with the hedge merely offered as a bracketed
   alternative. A suspected-but-unconfirmed cause may appear only inside explicit caveat language
   ("a possible contributing factor, not yet confirmed, is —"), never as the primary sentence.
4. **External names only.** Refer to products and features by their public names. If you have not
   been given the public name for something internal, do not guess — flag that it needs
   confirmation. Maintain that internal→external mapping in this file for your own product.
5. **Timestamps carry a timezone.** Always. Prefer UTC unless told otherwise.
6. **Compliance and legal phrasing is not improvised.** Data-handling, privacy, pricing, and
   contractual language must use approved wording and clear the required review before publication.

## Avoid

- Internal codenames, project names, service names, or ticket ids.
- Contractions, casual phrasing, emoji.
- Timelines committed without engineering sign-off.
- Naming competitors, especially in incident comms.
- Speculating on cause before it is determined.
- Minimizing language a reader could later contrast against the facts.

## Adapting this file

Edit this file directly to add your public product vocabulary and the phrasing your legal or comms
team requires. There is no config-based override for tones; `jstack.config.json` does not drive
this file. Keep genuinely sensitive material out of a repo that ships publicly — use a private
overlay.
