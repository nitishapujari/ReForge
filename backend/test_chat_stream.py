import httpx
import time

def run():
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    
    # 1. Register
    email = f"test_{int(time.time())}@example.com"
    res = client.post("/api/v1/auth/register", json={
        "first_name": "Test",
        "last_name": "User",
        "email": email,
        "password": "Password123"
    })
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Check history
    res = client.get("/api/v1/history", headers=headers)
    print("History before chat:", res.json())
    
    # 3. Post stream chat WITH session_id = ""
    res = client.post("/api/v1/chat/stream", headers=headers, json={
        "question": "Hello stream?",
        "session_id": ""
    })
    print("Stream response code:", res.status_code)
    try:
        print("Stream response:", res.text)
    except:
        pass
    
    # 4. Check history again
    res = client.get("/api/v1/history", headers=headers)
    print("History after chat:", res.json())

if __name__ == "__main__":
    run()
