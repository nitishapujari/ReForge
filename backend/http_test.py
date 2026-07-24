import httpx

def run():
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    
    # 1. Register Alice
    print("Registering Alice...")
    res = client.post("/api/v1/auth/register", json={
        "first_name": "Alice",
        "last_name": "Test",
        "email": "Alice@example.com",
        "password": "Alice@123"
    })
    print(res.status_code, res.text)
    
    # 2. Login via JSON
    print("\nLogging in via JSON...")
    res = client.post("/api/v1/auth/login", json={
        "email": "Alice@example.com",
        "password": "Alice@123"
    })
    print(res.status_code, res.text)
    
    # 3. Login via Swagger UI form
    print("\nLogging in via Swagger Form...")
    res = client.post("/api/v1/auth/swagger-login", data={
        "username": "Alice@example.com",
        "password": "Alice@123"
    })
    print(res.status_code, res.text)

if __name__ == "__main__":
    run()
