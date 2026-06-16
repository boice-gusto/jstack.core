# SDLC gate templates

Predefined SDLC gate configurations. The config wizard presents these when `policies.sdlc.gates` is empty.

## Minimal

Ship fast. Build → test → release. Gates are lightweight.

```json
{
  "policies": {
    "sdlc": {
      "stages": ["build", "test", "release"],
      "gates": {
        "build": { "requires": ["ticket_exists"] },
        "test": { "requires": ["pr_approved"] },
        "release": { "requires": ["ci_green"] }
      }
    }
  }
}
```

## Standard

Balanced process. Four stages with meaningful gates.

```json
{
  "policies": {
    "sdlc": {
      "stages": ["plan", "build", "test", "release"],
      "gates": {
        "build": { "requires": ["ticket_with_ac"] },
        "test": { "requires": ["pr_approved", "unit_tests_pass"] },
        "release": { "requires": ["qa_signoff", "feature_flag_ready", "monitoring_configured"] }
      }
    }
  }
}
```

## Strict

Full ceremony. Five stages including staging. Change board for prod deploys.

```json
{
  "policies": {
    "sdlc": {
      "stages": ["plan", "build", "test", "stage", "release"],
      "gates": {
        "build": { "requires": ["ticket_with_ac", "design_doc_approved"] },
        "test": { "requires": ["pr_approved", "unit_tests_pass", "lint_clean"] },
        "stage": { "requires": ["integration_tests_pass", "qa_signoff", "load_test"] },
        "release": { "requires": ["feature_flag_ready", "monitoring_configured", "runbook_updated", "rollback_tested", "change_board_approval"] }
      }
    }
  }
}
```
