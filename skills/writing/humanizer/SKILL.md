---
name: jstack-writing-humanizer
description: Rewrites AI-sounding text into natural human professional prose by stripping a concrete, categorized list of banned patterns, including em-dashes used as comma/period substitutes, triadic "X, Y, and Z" rhythm, "It's not just X, it's Y" and "Whether you're X or Y" constructions, hedge/filler words ("leverage", "delve into", "seamless", "cutting-edge", "at the end of the day"), empty transitions ("Let's dive in"), and hollow closers ("Let me know if you have any questions!"), while preserving the source's exact meaning and facts. Use when asked to "make this sound less like AI," "remove AI writing patterns," "humanize this text," "this sounds robotic," or to edit the tone/style of an email, doc, Slack message, comment, or post. Do NOT use on source code, code comments, or config files; never touch those. Do NOT use on legal, medical, compliance, or other precision-critical text where an exact technical or legal term matters more than sounding conversational; flag that instead of rewriting it (see Out of scope).
category: writing
effort: medium
---

<!-- Chain Contract -->
<!-- inputs: source_text (the passage to rewrite) -->
<!-- outputs: rewritten_text (same meaning and facts, human-sounding style) -->
<!-- Note: leaf utility skill. No chains-to. In an org overlay (e.g. jstack.gusto), skills like
     gusto-professional-writer and gusto-executive-review layer tone grade and platform-specific
     formatting on top of plain output from this skill — this skill only strips AI tells, it does
     not choose a tone, audience, or channel. -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

- **In scope:** Rewriting a paragraph, email, doc section, Slack message, comment, or post so a
  careful reader would not flag it as AI-generated, without changing what it says.
- **Out of scope:** Source code, code comments, or config files — never touch these; return them
  unmodified and say why. Legal contracts, compliance language, medical/clinical text, or any
  passage whose value depends on an exact regulatory or technical term — decline to rewrite and
  explain the risk instead (see Failure modes). This skill does not fact-check, expand, shorten
  substantively, or add examples; it changes style only.

## Absolute rules (banned-pattern list)

Apply every rule below. A rewrite that still contains any of these has not done the job.

### Punctuation

1. **No em-dash (—) used as a substitute for a comma, period, or parentheses.** Split into two
   sentences, use a comma, or restructure. An em-dash inside a genuinely parenthetical aside is
   the only tolerated case, and even then prefer parentheses or a comma first.
2. **No semicolon used to artificially stitch two short, unrelated-feeling sentences together**
   just to look more sophisticated. If two independent clauses belong together, use "and," "but,"
   or a period. A semicolon is fine only when it joins two clauses a person would naturally say in
   one breath.

### Structure tells

3. **No triadic "X, Y, and Z" rhythm repeated more than once in a short passage** (a paragraph or
   a short email). One triad can be natural; two or more in the same passage is a tell. Break the
   second instance into a plain sentence or a two-item pairing instead.
4. **No "It's not just X — it's Y" construction**, with or without the dash (also: "This isn't
   about X, it's about Y"). State the point directly: "X matters less here than Y."
5. **No "Whether you're X or Y" framing** to introduce a point that applies broadly. State the
   point once and let it apply to everyone, or name the actual audience directly.
6. **No rule-of-three headers or bullet lists everywhere** ("Fast. Reliable. Secure.") when the
   content doesn't actually have three co-equal points. Use as many bullets as there are real
   points — two or four are both fine.

### Filler and hedge words: strip or replace

7. Replace or cut on sight: "leverage" → "use"; "delve into" → "look at" / "cover" / "get into";
   "utilize" → "use"; "robust" (cut unless it is load-bearing technical language, e.g. "a robust
   error-handling path" in an engineering doc — even then prefer a concrete detail); "seamless" →
   name what actually happens instead ("no manual step between X and Y"); "cutting-edge" → cut or
   name the specific capability; "in today's fast-paced world" → cut entirely, it adds no
   information; "it's worth noting that" → cut, just state the thing; "at the end of the day" →
   cut; "when it comes to X" → rephrase as "for X" or restructure the sentence; "navigate the
   complexities of X" → "deal with X" or name the specific complexity.

### Empty transitions and throat-clearing

8. Cut on sight: "Let's dive in," "In this article/response/email, we will...," "To summarize" or
   "In conclusion" when the whole piece is short enough that a summary adds nothing new. If a
   closing recap genuinely adds information (a long doc, a decision with multiple parts), keep it
   but make it earn its place — no bare "In conclusion" restating the opening.

### Hollow closers

9. Cut forced-positivity closers: "I hope this helps!," "Let me know if you have any questions!,"
   "Happy to help further!" A real closer, if one is needed at all, is specific ("Ping me if the
   Tuesday date doesn't work") or is simply omitted.

### Empty intensifiers

10. **Don't stack "very," "really," "truly," "genuinely" for emphasis.** One concrete detail
    ("cut latency by 40%") does more work than three intensifiers ("this really, truly matters a
    lot"). If you can't name the concrete detail, cut the intensifier rather than keeping it.

### Sentence rhythm

11. **Actively vary sentence length. Don't just "vary length" as a platitude.** AI text tends to
    run a string of same-length sentences (usually medium-long, one clause plus a qualifier). When
    rewriting, deliberately mix in at least one short, punchy sentence (under 8 words) alongside
    longer ones, and don't let three consecutive sentences land within the same 5-word range of
    each other.

### Puffery, promotional language, and vague attribution

12. Cut on sight: "pivotal moment," "testament to," "evolving landscape," "setting the stage for,"
    "indelible mark," "deeply rooted," "renowned," "groundbreaking," "must-visit." State what
    actually happened instead of the abstraction. Same for name-dropping without context ("covered
    by major outlets") — name the one source and what it actually said, or cut the line.
13. Cut vague attribution: "experts believe," "industry reports suggest," "some critics argue."
    Name the actual source, or delete the claim — an unnamed authority is not evidence.
14. **Broader AI-vocabulary list** beyond rule 7: additionally, crucial, enduring, enhance,
    fostering, garner, interplay, intricate, landscape (used abstractly, not literally), showcase,
    tapestry (used abstractly), testament, underscore, vibrant. Replace with the plain word a
    person would actually say.
15. **Fancy ways to say "is."** "serves as," "stands as," "boasts," "features" → "is" or "has."

### Say what it does, not how it feels

16. **Name the mechanism or the number, not the feeling.** "The database stays close at hand,"
    "SQL you can read," "seamless integration" (see rule 7) all describe a feeling instead of a
    fact. Ask what the sentence tells the reader to *do* or *know*, then write that: "`.toSQL()`
    returns the exact string sent to the database," "a column rename fails the build." If a
    sentence could appear unchanged in another project's docs with the noun swapped, it says
    nothing about this one — cut it or make it specific.
17. **Abstract metaphor nouns read as technical but usually have a plainer word.** Substrate,
    wedge, vector, locus, vantage, nexus, primitive (as a noun), harness (as a metaphor), surface
    (as in "API surface"), bedrock, scaffolding (as a metaphor), modality, paradigm, gold-plating,
    ratchet (as a metaphor), evacuate (for moving code), endgame, north star, flywheel. "Substrate"
    → "base." "Vector" → "way" or "method." "Gold-plating" → "more than the job needs." Name the
    concrete thing instead.

### Formatting tells

18. **No decorative emoji** in headings or bullets. No curly/smart quotes — straight quotes only.
    Sentence case for headings, not Title Case. Don't bold every proper noun or acronym — bolding
    should mark the one thing in a paragraph worth scanning for, not everything.
19. **No colon as a mid-sentence connector.** A colon before a list or a concrete example is fine.
    "If you're coming from X: instead of Y, you do Z" adds nothing the words alone don't say —
    rewrite so the point stands without the colon doing comparison work for you.
20. **No inline-header-list pattern** — a bold label ending in a colon that just restates the
    line ("**Performance:** Performance improved by 20%."). A bold lead-in that ends in a period
    and is followed by genuinely new detail ("**Schema in TypeScript.** Tables live in one file.")
    is fine; a colon that restates the bolded word is not.

### Sycophancy and disclaimers

21. Cut sycophantic openers: "Great question!," "You're absolutely right!," "Of course!,"
    "Certainly!" Answer directly instead of complimenting the question first.
22. Cut cutoff disclaimers used as filler ("While specific details are limited...") — either find
    the specific detail or state plainly what's unknown, once, without the hedge-shaped preamble.

### Voice

23. **Prefer active voice.** Catch "is/are/was/were + past participle" and name the actor:
    "queries are validated" → "the compiler validates queries." Passive is fine only when the
    actor is genuinely unknown or doesn't matter.
24. **Cut an adverb propping up a weak verb, or use a stronger verb.** "Runs quickly" → "is fast"
    or the actual number. "Significantly improves" → the measured delta. An adverb rescuing a weak
    verb usually means the verb is wrong, not that the adverb is needed.

## Domain rule: preserve meaning exactly

This is a **style and tone rewrite only.** The rewritten text must say exactly what the source
said: same facts, same numbers, same claims, same scope, same level of certainty. Never invent a
new example, statistic, name, date, or claim that wasn't in the source, and never soften or
strengthen a claim while "smoothing" the prose (e.g. don't turn "may reduce" into "will reduce").
If a sentence is ambiguous in the source, keep the same ambiguity in the rewrite rather than
resolving it in either direction.

## Named anti-patterns

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| Swapping one AI-sounding word for another (e.g. "leverage" → "utilize") | Both words are on the same banned list; the sentence still reads as AI-generated because the shape didn't change | Restructure the sentence around a plain verb ("use," "run," "build") instead of hunting for a fancier synonym |
| Removing every em-dash but leaving the same three-beat sentence rhythm | Punctuation isn't what makes text sound AI-generated by itself — the clause-clause-clause cadence is. Deleting dashes and inserting commas in the same spots keeps the tell | Break the sentence into two independent sentences with different lengths, not just re-punctuate the same shape |
| Over-correcting into casual slang that doesn't match a professional context | Reads as try-hard in the other direction and can misfire badly in a formal or external-facing doc | Match the register of the surrounding text — plain and direct, not necessarily casual |

## Worked example

**Weak (AI-sounding, 5+ tells):**

> In today's fast-paced world, it's not just about writing code — it's about leveraging the right
> tools to delve into complex problems. Whether you're a junior engineer or a senior architect,
> this approach is fast, reliable, and effective. Let's dive in: robust testing, seamless
> integration, and continuous delivery are the pillars of modern engineering. At the end of the
> day, when it comes to shipping quality software, teams that navigate the complexities of CI/CD
> tend to move faster. I hope this helps — let me know if you have any questions!

**Sharp (humanized, same meaning):**

> Writing code is one part of the job. Using the right tools to solve hard problems is the other.
> That applies at any experience level, from someone two years in to the person who designed the
> system architecture. Good tests catch regressions before users do, and a CI/CD pipeline that
> actually works removes the manual steps that used to slow releases down. Teams that get this
> right ship faster because the friction is gone, not because of some vague commitment to process.
> Questions on any of this, just ask.

**Which rule fixed which sentence:**

| Weak sentence | Tell(s) | Rule applied | Sharp replacement |
|---|---|---|---|
| "In today's fast-paced world, it's not just about writing code — it's about leveraging the right tools to delve into complex problems." | Cliché opener; "it's not just X — it's Y"; em-dash; "leveraging"/"delve into" | Rules 8, 4, 1, 7 | "Writing code is one part of the job. Using the right tools to solve hard problems is the other." |
| "Whether you're a junior engineer or a senior architect, this approach is fast, reliable, and effective." | "Whether you're X or Y" framing; triadic list | Rules 5, 3 | "That applies at any experience level, from someone two years in to the person who designed the system architecture." |
| "Let's dive in: robust testing, seamless integration, and continuous delivery are the pillars of modern engineering." | Empty transition; "robust"/"seamless"; second triad in the same passage | Rules 8, 7, 3 | "Good tests catch regressions before users do, and a CI/CD pipeline that actually works removes the manual steps that used to slow releases down." |
| "At the end of the day, when it comes to shipping quality software, teams that navigate the complexities of CI/CD tend to move faster." | Stacked filler transitions | Rule 7 | "Teams that get this right ship faster because the friction is gone, not because of some vague commitment to process." |
| "I hope this helps — let me know if you have any questions!" | Hollow closer; forced positivity; em-dash | Rules 9, 1 | "Questions on any of this, just ask." |

## Output shape

- **Default:** return only the rewritten text. No preamble like "Here's the humanized version:",
  no trailing explanation, unless the user asked a question alongside the rewrite.
- **If asked to explain:** name the **2–3 rules that changed the most** in one short line each
  (e.g. "Cut the triadic adjective list in sentence 2; removed the em-dash construction in
  sentence 1."). Do not produce a long annotated report by default — a paragraph-by-paragraph
  breakdown for a routine rewrite is itself the kind of over-explained, AI-shaped output this
  skill exists to remove.

## Failure modes and recovery

| Situation | What to do |
|---|---|
| Input is source code, a code comment, or a config file | Decline to rewrite it for style. State plainly that this skill does not apply to code and return the input unchanged. |
| Input is a legal clause, compliance text, medical/clinical language, or otherwise depends on an exact regulatory or technical term | Do not rewrite it. Name which term(s) look precision-critical and ask whether the user wants a plain-language *summary alongside* the original (not a replacement of it), or route to legal/compliance review. |
| Input already reads like a person wrote it | Say so, make only the changes that remove any specific tells present (there may be none), and don't manufacture edits just to have done something. |
| User wants tone or platform-specific formatting (executive brief, LinkedIn post, etc.), not just de-AI-ing | This skill only strips AI tells; it doesn't choose tone or audience. In the Gusto org overlay, hand off to `gusto-professional-writer` or `gusto-executive-review` for that layer. |
| User pushes back that a specific banned word is "fine here" | If it's genuinely load-bearing technical language (rule 7's "robust error-handling path" exception), keep it once and say why; don't apply the ban mechanically to jargon that has a precise meaning in context. |

## User request

$ARGUMENTS
