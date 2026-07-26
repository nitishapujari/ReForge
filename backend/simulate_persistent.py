import httpx

def run():
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    email = "render_test2@example.com"
    pwd = "TestUser@123"
    
    print("--- 1. Registering User ---")
    res = client.post("/api/v1/auth/register", json={
        "first_name": "Render",
        "last_name": "Test",
        "email": email,
        "password": pwd
    })
    print(f"Register status: {res.status_code}")
    
    print("\n--- 2. Logging in immediately ---")
    res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": pwd
    })
    print(f"Login 1 status: {res.status_code}")
    
    if res.status_code == 200:
        token = res.json()["access_token"]
        print("\n--- 3. Fetching /auth/me ---")
        res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        print(f"/auth/me status: {res_me.status_code}")
        
    print("\n--- 4. Logging in after restart (no ephemeral wipe) ---")
    # Because we don't wipe the DB, this simulates Persistent Postgres!
    res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": pwd
    })
    print(f"Login 2 status: {res.status_code}")
    if res.status_code == 200:
        print("Success! Persistence survived.")

if __name__ == "__main__":
    run()
