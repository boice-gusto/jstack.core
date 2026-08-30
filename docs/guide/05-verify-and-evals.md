# 5. Verify and evals

Two different verification questions come up once you start editing jstack itself (a skill, an
agent, a policy file), not just using it: "did I break anything mechanical" and "does the actual
behavior still hold, on the model(s) I care about."

## The mechanical gate

```
bun run check
```

This is the full CI chain: config/schema validation, chain and router integrity, name-collision
and write-gate checks, description-reference resolution, agent/matrix drift, the full CLI/lib
test suite, dashboard tests, typecheck, format. It's deterministic and free (no model calls) —
run it before anything else, every time you touch a skill, agent, or policy file.

## The behavioral gate

Mechanical checks can't tell you whether a persona's wording actually changes what a model does.
For that:

```
bun run single-eval-suite-regression-test          # Claude only
bun run multi-model-eval-suite-regression-test     # Claude AND Codex, same case files
bun run eval:compare                               # categorize: accepted / wrong / difference_detected
bun run eval:report                                # local HTML slide deck of the results
```

The multi-model run is the one that catches something the single-model run structurally cannot:
a persona or skill that reads clearly to Claude but leaves Codex enough room to hedge, fabricate,
or pick a side it shouldn't. `wrong` (every model failed identically) is a real, reproducible bug
— fix the content. `difference_detected` (models disagree) is worth a look but isn't automatically
a bug on one pass; re-run before concluding anything, since live model output has real run-to-run
variance and a single disagreeing sample can be noise, not signal.

`bun run eval:cleanup` removes the local `.tmp/a2a/` scratch output (it asks for confirmation
first) once you're done looking at a run's results.

## Pitfall

Don't treat a single `difference_detected` case as proof of a bug on the first sample. Re-run it
(or the whole suite) before spending an editing pass chasing something that might just be model
sampling variance — the same simple, previously-100%-reliable cases can flip on a fresh run for
reasons that have nothing to do with the content you just changed.

**Next:** [Recipes and pitfalls](./06-recipes-and-pitfalls.md)
