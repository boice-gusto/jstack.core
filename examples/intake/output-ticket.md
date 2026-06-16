# Intake → ticket (example output)

**Title:** Audit export to customer S3 (full + delta)

**Type:** Feature · **Component:** platform-audit

**User story**  
As a **Contoso** admin, I need **exports** to our **S3** so we can meet retention, without platform storing 7y of data in our project.

**Acceptance criteria**

- [ ] Daily full export + hourly delta, **idempotent** keys
- [ ] Customer provides **role ARN**; we document least-privilege policy
- [ ] Retention/encryption **customer-owned**; we store only **metadata** of last successful export

**Risks / notes**

- Egress + cost: link to **pricing** estimate section TBD
- Security review **required** before GA

**Suggested epic:** PLAT-EPIC-AUDIT-2026
