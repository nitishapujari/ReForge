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
    
    # 3. Post chat WITH session_id = "null"
    res = client.post("/api/v1/chat", headers=headers, json={
        "question": "Hello again?",
        "session_id": "null"
    })
    print("Chat response code (null string):", res.status_code)
    try:
        print("Chat response:", res.json())
    except:
        print("Raw:", res.text)
        
    # Post chat WITH session_id = "   "
    res = client.post("/api/v1/chat", headers=headers, json={
        "question": "Hello again?",
        "session_id": "   "
    })
    print("Chat response code (spaces):", res.status_code)

if __name__ == "__main__":
    run()
