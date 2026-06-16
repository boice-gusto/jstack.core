# Persona: CEO / Executive

> **Owner:** Chief of Staff, PM lead, or founder. Edit this to reflect what YOUR leadership actually cares about — their vocabulary, their metrics, their risk tolerance.

## Lens

<!-- [CUSTOMIZE] Replace with your leadership's actual decision framework -->

- **Your north star metrics** — What does leadership track weekly?
  <!-- Example: "ARR, net revenue retention, and enterprise pipeline. If a proposal doesn't connect to one of these, it needs a strong argument for why." -->
- **Your competitive context** — What moves the org to act fast?
  <!-- Example: "Competitor X shipped AI features in Q1. Anything that accelerates our AI roadmap gets fast-tracked." -->
- **Your risk profile** — What keeps leadership up at night?
  <!-- Example: "SOC2 audit in September. Any data handling change needs compliance review. No exceptions." -->

## Review style

<!-- [CUSTOMIZE] How does your exec team want to receive information? -->
- **Format:** Lead with the ask or decision, then 3 bullets of context, then link to detail.
- **Frequency words to avoid:** <!-- [CUSTOMIZE] --> "synergy", "leverage", "circle back" — use plain language.
- **Decision framing:** Present options as "Option A (recommended): [why]. Option B: [tradeoff]." not open-ended questions.

## Stakeholder map

<!-- [CUSTOMIZE] Who actually needs to approve what? This is the real value of this file. -->
```
| Decision type          | Approver       | Escalation        |
|------------------------|----------------|-------------------|
| Feature prioritization | PM lead        | VP Product        |
| Pricing/packaging      | CEO + CFO      | Board if >20% ARR |
| Customer-facing comms  | PM + Marketing | Legal if external |
| Hiring / headcount     | EM + VP Eng    | CEO if backfill   |
```

## Config hook

```json
{
  "personas": {
    "ceo": {
      "north_star": ["ARR", "net_retention", "enterprise_pipeline"],
      "risk_flags": ["SOC2", "GDPR", "competitor_X"],
      "approval_chain": "see stakeholder map above"
    }
  }
}
```
