# Workflow definition (example input)

**Name:** `smoke-staging-auth`  
**Env:** `STAGING_BASE_URL=https://staging.app.example`  
**Steps (conceptual):**

1. Open `/login`  
2. Fill test user (from `STAGING_TEST_USER`)  
3. Assert dashboard loads  
4. Log out; assert session cleared
