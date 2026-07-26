# Root Cause Analysis: Authentication Bug

## Problem Statement

The user registers, successfully logs in immediately, and uses the application. However, after some time (e.g., when the Render free tier sleeps and spins down), attempting to log in again with the EXACT same credentials returns:

```json
{
  "detail": {
    "success": false,
    "error": {
      "code": "INVALID_CREDENTIALS",
      "message": "Incorrect email or password."
    }
  }
}
```

## Trace of the Authentication Flow

I have completely traced the authentication flow and performed tests simulating all stages:
1. **Register**: `app/api/v1/auth.py:register()` lowercases the email and uses `bcrypt.hashpw` to generate a valid hash. It commits the `User` to the SQLite database (`storage/reforge.db`).
2. **Database Persistence**: The SQLite connection successfully persists the user to the `.db` file.
3. **Login (Immediately)**: `app/api/v1/auth.py:login()` queries the database, retrieves the user, and `bcrypt.checkpw()` correctly validates the hash.
4. **Login (After some time)**: It fails.

## Root Cause

The root cause is an **Infrastructure / Ephemeral Storage Bug**, not a logical bug in the `auth.py` code.

Because the Render deployment is configured as a **single-service deployment using SQLite** (`storage/reforge.db`), the database file is stored on Render's ephemeral filesystem. 

When the Render instance scales down due to inactivity ("after some time"), the container is destroyed. When the next request arrives, a fresh container is spun up with a brand new, empty ephemeral filesystem. The SQLite database is wiped. 

When the user attempts to log in again:
1. `login` queries `select(User).where(User.email == email_lower)`
2. Because the database is brand new, the user no longer exists, so `result.scalar_one_or_none()` returns `None`.
3. The exact line of code that raises the error is in `app/api/v1/auth.py` (lines ~100-101):
   ```python
   if not user:
       logger.warning(f"[Auth] Login failed: User not found for email {email_lower}")
       raise HTTPException(
           status_code=status.HTTP_401_UNAUTHORIZED,
           detail={
               "success": False,
               "error": {
                   "code": "INVALID_CREDENTIALS",
                   "message": "Incorrect email or password."
               }
           },
           ...
   ```

## Proposed Changes

To fix this issue permanently in the Render environment, we have two options:

### Option 1: Use Postgres on Render (Recommended)
Revert the environment variable `DATABASE_URL` in the Render dashboard to point to the persistent PostgreSQL instance (`postgresql+asyncpg://...`) instead of forcing SQLite. This ensures the data persists across container restarts.

### Option 2: Add a Persistent Disk (Render Disks)
If we must use SQLite, we need to attach a Render Persistent Disk to the web service and mount it to the `/app/storage` directory so that `reforge.db` survives container restarts.

## Open Questions

Which deployment strategy would you prefer to fix the ephemeral storage issue? If you'd like, I can write a `render.yaml` blueprint to provision the persistent disk automatically, or we can instruct the environment to switch back to PostgreSQL.
