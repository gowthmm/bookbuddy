import os
from dotenv import load_dotenv
import google.generativeai as genai

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker
from pydantic import BaseModel
from typing import Optional

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-3.6-flash")

DATABASE_URL = "sqlite:///./books.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Book(Base):
    __tablename__ = "books"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    author = Column(String)
    genre = Column(String)
    status = Column(String, default="wishlist")
    progress = Column(Float, default=0)
    notes = Column(String, nullable=True)
    rating = Column(Integer, nullable=True)


Base.metadata.create_all(bind=engine)


class BookCreate(BaseModel):
    title: str
    author: Optional[str] = None
    genre: Optional[str] = None
    status: Optional[str] = "wishlist"


class BookUpdate(BaseModel):
    status: Optional[str] = None
    progress: Optional[float] = None
    notes: Optional[str] = None
    rating: Optional[int] = None


class SummaryRequest(BaseModel):
    notes: str
    rating: Optional[int] = None


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/books")
def add_book(book: BookCreate):
    db = SessionLocal()
    new_book = Book(**book.dict())
    db.add(new_book)
    db.commit()
    db.refresh(new_book)
    db.close()
    return new_book


@app.get("/books")
def list_books(status: Optional[str] = None, genre: Optional[str] = None):
    db = SessionLocal()
    query = db.query(Book)
    if status:
        query = query.filter(Book.status == status)
    if genre:
        query = query.filter(Book.genre == genre)
    result = query.all()
    db.close()
    return result


@app.patch("/books/{book_id}")
def update_book(book_id: int, update: BookUpdate):
    db = SessionLocal()
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        db.close()
        raise HTTPException(status_code=404, detail="Book not found")
    for field, value in update.dict(exclude_unset=True).items():
        setattr(book, field, value)
    db.commit()
    db.refresh(book)
    db.close()
    return book


@app.delete("/books/{book_id}")
def delete_book(book_id: int):
    db = SessionLocal()
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        db.close()
        raise HTTPException(status_code=404, detail="Book not found")
    db.delete(book)
    db.commit()
    db.close()
    return {"deleted": book_id}


@app.get("/stats")
def get_stats():
    db = SessionLocal()
    books = db.query(Book).all()
    db.close()
    total = len(books)
    completed = len([b for b in books if b.status == "completed"])
    by_genre = {}
    for b in books:
        g = b.genre or "Unknown"
        by_genre[g] = by_genre.get(g, 0) + 1
    return {
        "total_books": total,
        "percent_completed": round((completed / total) * 100, 1) if total else 0,
        "by_genre": by_genre,
    }


@app.post("/books/{book_id}/ai-review")
def generate_review(book_id: int, req: SummaryRequest):
    prompt = (
        f"Based on these reading notes: '{req.notes}' and rating {req.rating}/5, "
        "write a short (2-3 sentence) book review in a natural, personal tone."
    )
    try:
        response = model.generate_content(prompt)
        return {"review": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/recommend")
def recommend_books():
    db = SessionLocal()
    books = db.query(Book).all()
    db.close()

    completed = [b for b in books if b.status == "completed"]

    if not completed:
        return {"recommendations": "Add and complete a few books first so I can recommend based on your taste."}

    titles = ", ".join(f"{b.title} ({b.genre})" for b in completed)
    prompt = (
        f"Based on someone who has read and enjoyed: {titles}, "
        "recommend 3 new book titles (with author) they might like. "
        "Keep it short, just a numbered list with one-line reasons."
    )
    try:
        response = model.generate_content(prompt)
        return {"recommendations": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))