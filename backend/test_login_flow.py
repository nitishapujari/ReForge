import httpx
import time

def run():
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    email = f"test_{int(time.time())}@example.com"
    pwd = "Password123"
    
    # 1. Register
    res = client.post("/api/v1/auth/register", json={
        "first_name": "Test",
        "last_name": "User",
        "email": email,
        "password": pwd
    })
    token = res.json()["access_token"]
    print("Register:", res.status_code)
    
    # 2. Login immediately
    res = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    print("Login 1:", res.status_code)
    
    # 3. Use the JWT on /me
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    print("Get /me:", res.status_code)
    
    # 4. Login again
    res = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    print("Login 2:", res.status_code)

if __name__ == "__main__":
    run()
