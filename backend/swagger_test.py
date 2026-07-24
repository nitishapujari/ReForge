import httpx

def run():
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    
    print("\nLogging in via exact Swagger payload...")
    res = client.post("/api/v1/auth/swagger-login", data={
        "grant_type": "password",
        "username": "Alice@example.com",
        "password": "Alice@123",
        "scope": "",
        "client_id": "",
        "client_secret": ""
    })
    print(res.status_code, res.text)

if __name__ == "__main__":
    run()
