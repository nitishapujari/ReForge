import httpx

def run():
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    
    res = client.post("/api/v1/auth/login", json={
        "email": "test_1784965737@example.com",
        "password": "Password123"
    })
    print("Login response:", res.status_code)
    try:
        print("Json:", res.json())
    except:
        print("Text:", res.text)

if __name__ == "__main__":
    run()
