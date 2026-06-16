# Incident templates

Predefined incident escalation configurations. The config wizard presents these when `policies.incidents.escalation` is empty.

## Startup

Minimal structure. One escalation path, fast acknowledgment.

```json
{
  "policies": {
    "incidents": {
      "severity_levels": ["sev3", "sev2", "sev1"],
      "escalation": {
        "sev1": { "ack_minutes": 15, "update_cadence_minutes": 30, "retro_required": true },
        "sev2": { "ack_minutes": 60, "update_cadence_minutes": 120, "retro_required": false },
        "sev3": { "ack_minutes": 1440, "update_cadence_minutes": null, "retro_required": false }
      }
    }
  }
}
```

## Standard

Four severity levels, retros for SEV1/SEV2, clear update cadence.

```json
{
  "policies": {
    "incidents": {
      "severity_levels": ["sev4", "sev3", "sev2", "sev1"],
      "escalation": {
        "sev1": { "ack_minutes": 15, "update_cadence_minutes": 30, "retro_required": true, "exec_notify": true },
        "sev2": { "ack_minutes": 60, "update_cadence_minutes": 120, "retro_required": true, "exec_notify": false },
        "sev3": { "ack_minutes": 240, "update_cadence_minutes": null, "retro_required": false, "exec_notify": false },
        "sev4": { "ack_minutes": 1440, "update_cadence_minutes": null, "retro_required": false, "exec_notify": false }
      }
    }
  }
}
```

## Enterprise

Tighter SLAs, exec notification on SEV1, four severity levels with distinct cadences.

```json
{
  "policies": {
    "incidents": {
      "severity_levels": ["sev4", "sev3", "sev2", "sev1"],
      "escalation": {
        "sev1": { "ack_minutes": 5, "update_cadence_minutes": 15, "retro_required": true, "exec_notify": true, "status_page_update": true },
        "sev2": { "ack_minutes": 30, "update_cadence_minutes": 60, "retro_required": true, "exec_notify": false, "status_page_update": true },
        "sev3": { "ack_minutes": 240, "update_cadence_minutes": 480, "retro_required": false, "exec_notify": false, "status_page_update": false },
        "sev4": { "ack_minutes": 1440, "update_cadence_minutes": null, "retro_required": false, "exec_notify": false, "status_page_update": false }
      }
    }
  }
}
```
