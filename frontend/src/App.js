import { useState, useEffect } from "react";
import "./App.css";

const API = "http://localhost:8000";

function BookCard({ book, onUpdate, onDelete, onLogPages, onAiReview }) {
  const [pagesInput, setPagesInput] = useState("");
  const [notes, setNotes] = useState(book.notes || "");
  const [rating, setRating] = useState(book.rating || "");

  const pct = book.total_pages ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100)) : 0;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3>{book.title}</h3>
          <p className="meta">{book.author || "Unknown author"} · {book.genre || "N/A"}</p>
        </div>
        <button className="icon-btn danger" onClick={() => onDelete(book.id)}>✕</button>
      </div>

      {book.total_pages ? (
        <>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          <p className="meta">{book.current_page} / {book.total_pages} pages ({pct}%)</p>
        </>
      ) : (
        <p className="meta">Page count unavailable</p>
      )}

      {book.status !== "completed" && (
        <div className="log-row">
          <input type="number" placeholder="Pages read today" value={pagesInput} onChange={e => setPagesInput(e.target.value)} />
          <button onClick={() => {
            if (pagesInput && Number(pagesInput) > 0) {
              onLogPages(book.id, Number(pagesInput));
              setPagesInput("");
            }
          }}>Log</button>
        </div>
      )}

      <select className="status-select" value={book.status} onChange={e => onUpdate(book.id, { status: e.target.value })}>
        <option value="wishlist">Wishlist</option>
        <option value="reading">Reading</option>
        <option value="completed">Completed</option>
      </select>

      {book.status === "completed" && (
        <div className="notes-block">
          <textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => onUpdate(book.id, { notes })} />
          <input type="number" min="1" max="5" placeholder="Rating (1-5)" value={rating} onChange={e => setRating(e.target.value)} onBlur={() => onUpdate(book.id, { rating: Number(rating) })} />
          <button className="ai-btn" onClick={() => onAiReview(book.id, notes, rating)}>✨ Generate AI Review</button>
        </div>
      )}
    </div>
  );
}

function App() {
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(0);
  const [badges, setBadges] = useState(null);
  const [tab, setTab] = useState("reading");
  const [form, setForm] = useState({ title: "", author: "", genre: "", status: "wishlist" });
  const [recommendations, setRecommendations] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchAll = () => {
    fetch(`${API}/books`).then(r => r.json()).then(setBooks);
    fetch(`${API}/stats`).then(r => r.json()).then(setStats);
    fetch(`${API}/streak`).then(r => r.json()).then(d => setStreak(d.streak));
    fetch(`${API}/badges`).then(r => r.json()).then(setBadges);
  };

  useEffect(() => { fetchAll(); }, []);

  const addBook = async (e) => {
    e.preventDefault();
    setAdding(true);
    await fetch(`${API}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ title: "", author: "", genre: "", status: "wishlist" });
    setAdding(false);
    fetchAll();
  };

  const updateBook = async (id, updates) => {
    await fetch(`${API}/books/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    fetchAll();
  };

  const deleteBook = async (id) => {
    await fetch(`${API}/books/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const logPages = async (id, pages_read) => {
    await fetch(`${API}/books/${id}/log-pages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pages_read }) });
    fetchAll();
  };

  const getAiReview = async (id, notes, rating) => {
    const res = await fetch(`${API}/books/${id}/ai-review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes, rating: Number(rating) || null }) });
    const data = await res.json();
    updateBook(id, { notes: `${notes}\n\nAI Review: ${data.review}` });
  };

  const getRecommendations = async () => {
    setRecommendations("Loading...");
    const res = await fetch(`${API}/recommend`);
    const data = await res.json();
    setRecommendations(data.recommendations);
  };

  const filtered = {
    reading: books.filter(b => b.status === "reading"),
    wishlist: books.filter(b => b.status === "wishlist"),
    completed: books.filter(b => b.status === "completed"),
  };

  return (
    <div className="app">
      <header className="hero">
        <h1>📚 Book Buddy</h1>
        <div className="hero-stats">
          <div className="stat-pill">🔥 {streak} day streak</div>
          <div className="stat-pill">🏅 {badges?.books_finished_this_year ?? 0} finished in {badges?.year ?? ""}</div>
          {stats && <div className="stat-pill">{stats.percent_completed}% completed overall</div>}
        </div>
      </header>

      <form className="add-form" onSubmit={addBook}>
        <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
        <input placeholder="Author" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
        <input placeholder="Genre" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} />
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
          <option value="wishlist">Wishlist</option>
          <option value="reading">Reading</option>
        </select>
        <button type="submit" disabled={adding}>{adding ? "Adding..." : "Add Book"}</button>
      </form>
      <p className="hint">Leave author, genre, or page count blank — AI fills them in automatically.</p>

      <nav className="tabs">
        <button className={tab === "reading" ? "active" : ""} onClick={() => setTab("reading")}>Currently Reading</button>
        <button className={tab === "wishlist" ? "active" : ""} onClick={() => setTab("wishlist")}>Wishlist</button>
        <button className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>Completed</button>
        <button className={tab === "recommend" ? "active" : ""} onClick={() => setTab("recommend")}>Recommendations</button>
      </nav>

      <main>
        {tab === "recommend" ? (
          <div className="recommend-panel">
            <button className="ai-btn" onClick={getRecommendations}>✨ Get AI Recommendations</button>
            {recommendations && <div className="recommend-text">{recommendations}</div>}
          </div>
        ) : (
          <div className="grid">
            {filtered[tab].length === 0 && <p className="empty">No books here yet.</p>}
            {filtered[tab].map(b => (
              <BookCard key={b.id} book={b} onUpdate={updateBook} onDelete={deleteBook} onLogPages={logPages} onAiReview={getAiReview} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;