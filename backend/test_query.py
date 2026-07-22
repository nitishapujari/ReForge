import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://127.0.0.1:8000/api/v1/chat",
            json={"message": "Features of R programming language?"},
            timeout=30.0
        )
        print(f"Status: {response.status_code}")
        print(f"Body: {response.text}")

if __name__ == "__main__":
    asyncio.run(main())
