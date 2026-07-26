import os
import shutil
import time
import httpx

def run():
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    
    email = "render_test@example.com"
    pwd = "TestUser@123"
    
    print("--- 1. Registering User ---")
    res = client.post("/api/v1/auth/register", json={
        "first_name": "Render",
        "last_name": "Test",
        "email": email,
        "password": pwd
    })
    print(f"Register status: {res.status_code}")
    
    print("\n--- 2. Logging in immediately ---")
    res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": pwd
    })
    print(f"Login 1 status: {res.status_code}")
    if res.status_code == 200:
        print("JWT retrieved successfully.")
        
    # Simulate Render Sleep / Spin down
    print("\n--- 3. Simulating Render Instance Restart & Ephemeral Wipe ---")
    print("Deleting storage/reforge.db ...")
    if os.path.exists("storage/reforge.db"):
        # We can't delete it while uvicorn has it open on Windows easily, 
        # so let's hit a special endpoint or just restart uvicorn if it was running.
        # But wait, we can just rename it or delete it if aiosqlite closed the file.
        try:
            os.remove("storage/reforge.db")
            print("Successfully deleted SQLite database.")
        except Exception as e:
            print(f"Could not delete DB: {e}")
            
    print("\n--- 4. Logging in after restart (simulated) ---")
    res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": pwd
    })
    print(f"Login 2 status: {res.status_code}")
    print(f"Response: {res.json()}")

if __name__ == "__main__":
    run()
