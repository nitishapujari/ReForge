import bcrypt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception as e:
        print(f"Error: {e}")
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

pw = "Alice@123"
h = get_password_hash(pw)
print("Hash:", h)
print("Verify:", verify_password(pw, h))
print("Verify wrong:", verify_password("wrong", h))
