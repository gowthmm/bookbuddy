Book Buddy README

Reading tracker built for the Sayone Tech hiring task. React frontend, FastAPI backend, SQLite, with AI features via Gemini.

    Features

- Add books: title, author, genre, status (wishlist / reading / completed)
- Track progress by logging pages read, not a slider — percent calculated automatically
- Auto-completes a book once logged pages reach the total
- Notes and rating (1-5) for completed books
- Delete books

     AI (Gemini)
- Leave author, genre, or page count blank when adding a book — Gemini fills them in
- AI recommendations, works with 2+ books marked reading or completed
- AI-generated review from your notes + rating

     Engagement
- Reading streak, based on days you've logged pages
- Badge for books finished this calendar year
- Reading goal tracker (set to 20 books)

     Users
- Enter a name once, no password — just separates data between people testing it

### UI
- Dashboard layout — sidebar (Home / My Books / Discover), top search, right rail (streak, goal, current book)

## Stack

- React (Create React App)
- FastAPI
- SQLite via SQLAlchemy
- Gemini API (gemini-3.6-flash)
- Docker + docker-compose

## Setup

Needs Python 3.11+, Node 18+, a free Gemini key from aistudio.google.com/apikey.

### Backend
```bash
cd backend
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

Create `backend/.env`:

Run:
```bash
uvicorn main:app --reload
```
Docs at http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm start
```
Runs on http://localhost:3000