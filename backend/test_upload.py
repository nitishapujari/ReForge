import httpx
import time

def run():
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    
    # 1. Register a new user
    email = f"test_{int(time.time())}@example.com"
    print(f"Registering {email}...")
    res = client.post("/api/v1/auth/register", json={
        "first_name": "Test",
        "last_name": "User",
        "email": email,
        "password": "Password123"
    })
    
    if res.status_code != 200:
        print(f"Failed to register: {res.text}")
        return
        
    token = res.json()["access_token"]
    print("Registration successful.")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Upload a document
    print("\nUploading document...")
    file_content = b"This is a test document. It contains some text that should be embedded and stored in ChromaDB."
    files = {"file": ("test_doc.txt", file_content, "text/plain")}
    
    res = client.post("/api/v1/documents/upload", headers=headers, files=files)
    print(f"{res.status_code} {res.text}")
    
    if res.status_code == 202 or res.status_code == 200:
        doc_id = res.json().get("document_id")
        
        # 3. List documents
        print("\nListing documents...")
        res = client.get("/api/v1/documents", headers=headers)
        print(f"{res.status_code} {res.text}")
        
    client.close()

if __name__ == "__main__":
    run()
