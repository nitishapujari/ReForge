import httpx
import time

def run():
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    email = f"test_{int(time.time())}@example.com"
    pwd = "Alice@123"
    
    # 1. Register
    res = client.post("/api/v1/auth/register", json={
        "first_name": "Test",
        "last_name": "User",
        "email": email,
        "password": pwd
    })
    print("Register:", res.status_code)
    
    # 2. Login via swagger-login
    res = client.post("/api/v1/auth/swagger-login", data={
        "username": email,
        "password": pwd,
        "grant_type": "password"
    })
    print("Swagger Login 1:", res.status_code)
    
    # 3. Login again
    res = client.post("/api/v1/auth/swagger-login", data={
        "username": email,
        "password": pwd,
        "grant_type": "password"
    })
    print("Swagger Login 2:", res.status_code)

if __name__ == "__main__":
    run()
