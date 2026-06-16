# Question-first pattern

## Principle

Ask the **fewest** questions possible. Most answers are already in `jstack.config.json`, the preamble, or the user's message. Only ask when the answer **blocks progress** and cannot be assumed.

## Protocol

1. **Read config first.** Check `jstack.config.json` for team ids, project keys, channel ids, integrations, and `skill_defaults`. If a value exists in config, use it — do not re-ask.

2. **Classify the gap.**

   | Gap type | Action |
   |----------|--------|
   | **Must-ask** — irreversible action, missing required id, ambiguous target | Ask **one** focused question. |
   | **Navigational** — user exploring, no commitment yet | Offer options, then proceed with their pick. |
   | **Assumable** — safe default exists in config or convention | Use the default; label it `[assumption]` in output. |

3. **One question at a time.** Never batch 3+ questions. If you need two answers, ask the most blocking one first, proceed with the answer, then ask the second only if still needed.

4. **Format questions clearly.** Use a short sentence with the specific options when applicable:
   - Good: "Which Jira project? I see `PROJ` and `INFRA` in config."
   - Bad: "Can you tell me more about what you need?"

5. **Cite best practices.** When recommending an approach, point to `_core/best-practices/<platform>/...` for platform-specific guidance.

## Anti-patterns

- Asking for information that is in `jstack.config.json`.
- Asking multiple unrelated questions in one message.
- Asking "are you sure?" for read-only operations.
- Open-ended questions when a binary or short-list suffices.
