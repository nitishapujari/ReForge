from pydantic import BaseModel, EmailStr

class Test(BaseModel):
    email: EmailStr

t = Test(email=" Alice@Example.com ")
print(repr(t.email))
