import os
os.environ["CHROMA_MODE"] = "persistent"

from fastapi.testclient import TestClient
from app.main import app
import time

def run_tests():
    # TestClient automatically triggers lifespan (startup/shutdown) events
    with TestClient(app) as client:
        print("Starting E2E Tests...")
        
        # --- 1. HEALTH ---
        res = client.get("/api/v1/health")
        assert res.status_code == 200, f"Health check failed: {res.status_code}"
        print("[OK] Health check passed")
        
        # --- 2. AUTH ---
        email = f"test_{int(time.time())}@example.com"
        pwd = "StrongPassword123!"
        
        res = client.post("/api/v1/auth/register", json={
            "email": email, "password": pwd, "first_name": "Test", "last_name": "User"
        })
        assert res.status_code == 200, f"Registration failed: {res.json()}"
        assert "access_token" in res.json()
        
        res = client.post("/api/v1/auth/register", json={
            "email": email, "password": pwd, "first_name": "Test", "last_name": "User"
        })
        assert res.status_code == 400, f"Duplicate registration didn't return 400: {res.status_code} {res.json()}"
        
        res = client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPassword!"})
        assert res.status_code == 401, "Invalid login didn't return 401"
        
        res = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
        assert res.status_code == 200, "Valid login failed"
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        res = client.get("/api/v1/auth/me", headers=headers)
        assert res.status_code == 200, "/me failed"
        assert res.json()["user"]["email"] == email
        
        res = client.get("/api/v1/auth/me")
        assert res.status_code == 401, "Unauthorized didn't return 401"
        print("[OK] Auth tests passed")

        # --- 3. DOCUMENTS ---
        res = client.post("/api/v1/documents/upload", headers=headers)
        assert res.status_code == 422, "Empty upload didn't return 422"

        res = client.post("/api/v1/documents/upload", files={"file": ("test.exe", b"fake exe data", "application/x-msdownload")}, headers=headers)
        assert res.status_code == 400, f"Unsupported file didn't return 400, got: {res.status_code} {res.json()}"
        
        res = client.post("/api/v1/documents/upload", files={"file": ("test.txt", b"This is a test document about AI and stuff.", "text/plain")}, headers=headers)
        assert res.status_code == 202, f"Upload failed: {res.status_code} - {res.json()}"
        doc_id = res.json()["document_id"]

        res = client.get("/api/v1/documents", headers=headers)
        assert res.status_code == 200
        docs = res.json()
        assert len(docs) > 0
        
        # Test replace document
        res = client.put(f"/api/v1/documents/{doc_id}", files={"file": ("test2.txt", b"Replaced document about AI.", "text/plain")}, headers=headers)
        assert res.status_code == 202, f"Replace failed: {res.status_code} {res.json()}"

        # Test rename document
        res = client.patch(f"/api/v1/documents/{doc_id}/rename", json={"filename": "new_name.txt"}, headers=headers)
        assert res.status_code == 200, f"Rename failed: {res.status_code} {res.json()}"
        assert res.json()["filename"] == "new_name.txt"
        
        res = client.patch(f"/api/v1/documents/fake-id/rename", json={"filename": "new_name.txt"}, headers=headers)
        assert res.status_code == 404, "Rename with invalid ID didn't return 404"
        
        res = client.delete(f"/api/v1/documents/fake-id", headers=headers)
        assert res.status_code == 404, "Delete with invalid ID didn't return 404"
        
        res = client.delete(f"/api/v1/documents/{doc_id}", headers=headers)
        assert res.status_code == 200, "Delete failed"
        print("[OK] Documents tests passed")
        
        # --- 4. CHAT ---
        res = client.get("/api/v1/chat/suggestions", headers=headers)
        assert res.status_code == 200
        
        res = client.post("/api/v1/chat", json={"question": "What is AI?", "session_id": None}, headers=headers)
        assert res.status_code == 200, f"Chat failed: {res.status_code} - {res.json()}"
        session_id = res.json()["session_id"]
        
        res = client.post("/api/v1/chat", json={"question": "Tell me more.", "session_id": session_id}, headers=headers)
        assert res.status_code == 200
        
        res = client.get("/api/v1/history", headers=headers)
        assert res.status_code == 200
        history = res.json()
        assert len(history) > 0
        
        res = client.put(f"/api/v1/history/{session_id}", json={"title": "AI Chat"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["title"] == "AI Chat"
        
        res = client.delete(f"/api/v1/history/{session_id}", headers=headers)
        assert res.status_code == 200
        
        res = client.put("/api/v1/history/fake-id", json={"title": "AI Chat"}, headers=headers)
        assert res.status_code == 404
        
        res = client.post("/api/v1/chat/stream", json={"question": "Hello stream", "session_id": None}, headers=headers)
        assert res.status_code == 200
        
        print("[OK] Chat tests passed")
        print("[OK] All E2E tests passed successfully")

if __name__ == "__main__":
    run_tests()
