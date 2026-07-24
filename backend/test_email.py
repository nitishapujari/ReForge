from pydantic import BaseModel, EmailStr
class M(BaseModel):
    e: EmailStr
print(repr(M(e='Alice@example.com ').e))
