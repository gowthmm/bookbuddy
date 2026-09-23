import os
from datetime import date, timedelta
from dotenv import load_dotenv
import google.generativeai as genai

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Date, ForeignKey
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
    total_pages = Column(Integer, nullable=True)
    current_page = Column(Integer, default=0)
    notes = Column(String, nullable=True)
    rating = Column(Integer, nullable=True)
    added_date = Column(Date, default=date.today)
    completed_date = Column(Date, nullable=True)


class ReadingLog(Base):
    __tablename__ = "reading_logs"
    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id"))
    pages_read = Column(Integer)
    log_date = Column(Date, default=date.today)


Base.metadata.create_all(bind=engine)


class BookCreate(BaseModel):
    title: str
    author: Optional[str] = None
    genre: Optional[str] = None
    status: Optional[str] = "wishlist"
    total_pages: Optional[int] = None


class BookUpdate(BaseModel):
    status: Optional[str] = None
    current_page: Optional[int] = None
    notes: Optional[str] = None
    rating: Optional[int] = None
    total_pages: Optional[int] = None


class PagesLog(BaseModel):
    pages_read: int


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


def estimate_total_pages(title: str, author: Optional[str]) -> Optional[int]:
    prompt = (
        f"What is the approximate total page count of the book '{title}'"
        f"{f' by {author}' if author else ''}? "
        "Respond with ONLY a single integer number, nothing else."
    )
    try:
        response = model.generate_content(prompt)
        digits = "".join(c for c in response.text.strip() if c.isdigit())
        return int(digits) if digits else None
    except Exception:
        return None


@app.post("/books")
def add_book(book: BookCreate):
    db = SessionLocal()
    data = book.dict()
    if not data.get("total_pages"):
        data["total_pages"] = estimate_total_pages(data["title"], data.get("author"))
    new_book = Book(**data)
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
    if update.status == "completed" and not book.completed_date:
        book.completed_date = date.today()
    db.commit()
    db.refresh(book)
    db.close()
    return book


@app.post("/books/{book_id}/log-pages")
def log_pages(book_id: int, entry: PagesLog):
    db = SessionLocal()
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        db.close()
        raise HTTPException(status_code=404, detail="Book not found")

    db.add(ReadingLog(book_id=book_id, pages_read=entry.pages_read, log_date=date.today()))

    book.current_page = (book.current_page or 0) + entry.pages_read
    if book.status == "wishlist":
        book.status = "reading"
    if book.total_pages and book.current_page >= book.total_pages:
        book.current_page = book.total_pages
        book.status = "completed"
        book.completed_date = date.today()

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


@app.get("/streak")
def get_streak():
    db = SessionLocal()
    logs = db.query(ReadingLog).all()
    db.close()
    dates = sorted(set(l.log_date for l in logs), reverse=True)
    if not dates:
        return {"streak": 0}

    streak = 0
    expected = date.today()
    for d in dates:
        if d == expected:
            streak += 1
            expected -= timedelta(days=1)
        elif d == expected + timedelta(days=1):
            continue
        else:
            break
    return {"streak": streak}


@app.get("/badges")
def get_badges():
    db = SessionLocal()
    books = db.query(Book).all()
    db.close()
    year = date.today().year
    finished = len([b for b in books if b.status == "completed" and b.completed_date and b.completed_date.year == year])
    return {"books_finished_this_year": finished, "year": year}


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