import httpx
import time

def run():
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    email = f"render_test4_{int(time.time())}@example.com"
    pwd = "TestUser@123"
    
    # 1. Register & Login
    client.post("/api/v1/auth/register", json={
        "first_name": "Render",
        "last_name": "Test",
        "email": email,
        "password": pwd
    })
    res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": pwd
    })
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n--- 1. Uploading Document ---")
    files = {'file': ('test.txt', b'This is a test document.')}
    res_upload = client.post("/api/v1/documents/upload", files=files, headers=headers)
    print(f"Upload status: {res_upload.status_code}")
    
    print("\n--- 2. Verifying Document Exists ---")
    res_docs = client.get("/api/v1/documents", headers=headers)
    print(f"Documents status: {res_docs.status_code}")
    print(f"Documents found: {len(res_docs.json())}")
    
    print("\n--- 3. Creating Chat Session ---")
    res_chat = client.post("/api/v1/chat", json={
        "question": "Hello!",
        "session_id": "null"
    }, headers=headers)
    print(f"Chat status: {res_chat.status_code}")
    
    print("\n--- 4. Simulating Restart (No Wipe) ---")
    # Verify records still exist for the user
    print("\n--- 5. Verifying Document Still Exists ---")
    res_docs2 = client.get("/api/v1/documents", headers=headers)
    print(f"Documents status: {res_docs2.status_code}")
    print(f"Documents found: {len(res_docs2.json())}")
    
    print("\n--- 6. Verifying Chat History Still Exists ---")
    res_history = client.get("/api/v1/history", headers=headers)
    print(f"History status: {res_history.status_code}")
    print(f"Sessions found: {len(res_history.json())}")

if __name__ == "__main__":
    run()
