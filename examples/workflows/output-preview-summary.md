# Workflow preview (example output)

**Flow:** `smoke-staging-auth`  
**Mode:** dry / preview (synthetic)

| Step | Action | Expect |
|------|--------|--------|
| 1 | goto `/login` | 200 |
| 2 | fill creds (masked) | no error |
| 3 | expect URL `/app` or `/dashboard` | 200 |
| 4 | logout; cookie cleared | session empty |

**Notes:** if **2FA** env enabled, this flow must be skipped or extended — not covered here.
