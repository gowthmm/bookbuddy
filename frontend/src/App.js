import { useState, useEffect, useMemo } from "react";
import "./App.css";

const API = "http://localhost:8000";
const GRADIENTS = [
  "linear-gradient(135deg,#7c6ff2,#b48be0)",
  "linear-gradient(135deg,#4fb0a5,#8fd9c4)",
  "linear-gradient(135deg,#f2a154,#f2c94c)",
  "linear-gradient(135deg,#e05f8f,#f29ec4)",
  "linear-gradient(135deg,#5b8def,#7fc7f2)",
];

function Cover({ title, idx }) {
  return (
    <div className="cover" style={{ background: GRADIENTS[idx % GRADIENTS.length] }}>
      {title ? title.charAt(0).toUpperCase() : "?"}
    </div>
  );
}

function App() {
  const [books, setBooks] = useState([]);
  const [streak, setStreak] = useState(0);
  const [badges, setBadges] = useState(null);
  const [nav, setNav] = useState("home");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", author: "", genre: "", status: "wishlist" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [recommendations, setRecommendations] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchAll = () => {
    fetch(`${API}/books`).then(r => r.json()).then(setBooks);
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
    setShowAddForm(false);
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

  const readingBooks = books.filter(b => b.status === "reading");
  const wishlistBooks = books.filter(b => b.status === "wishlist");
  const completedBooks = books.filter(b => b.status === "completed");

  const genres = useMemo(() => {
    const set = new Set(books.map(b => b.genre).filter(Boolean));
    return Array.from(set).slice(0, 6);
  }, [books]);

  const searched = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return books.filter(b =>
      b.title?.toLowerCase().includes(q) ||
      b.author?.toLowerCase().includes(q) ||
      b.genre?.toLowerCase().includes(q)
    );
  }, [search, books]);

  const goalTarget = 20;
  const goalCurrent = completedBooks.length;
  const goalPct = Math.min(100, Math.round((goalCurrent / goalTarget) * 100));

  const renderBookCard = (b, idx) => (
    <div className="card" key={b.id}>
      <div className="card-header">
        <Cover title={b.title} idx={idx} />
        <button className="icon-btn danger" onClick={() => deleteBook(b.id)}>✕</button>
      </div>
      <h3>{b.title}</h3>
      <p className="meta">{b.author || "Unknown author"} · {b.genre || "N/A"}</p>

      {b.total_pages ? (
        <>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(100, Math.round((b.current_page / b.total_pages) * 100))}%` }} />
          </div>
          <p className="meta">{b.current_page} / {b.total_pages} pages</p>
        </>
      ) : <p className="meta">Page count unavailable</p>}

      {b.status !== "completed" && <LogRow onLog={pages => logPages(b.id, pages)} />}

      <select className="status-select" value={b.status} onChange={e => updateBook(b.id, { status: e.target.value })}>
        <option value="wishlist">Wishlist</option>
        <option value="reading">Reading</option>
        <option value="completed">Completed</option>
      </select>

      {b.status === "completed" && (
        <CompletedBlock book={b} onSave={updates => updateBook(b.id, updates)} onAiReview={(notes, rating) => getAiReview(b.id, notes, rating)} />
      )}
    </div>
  );

  return (
    <div className="dash">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">📖</span>
          <div>
            <div className="brand-name">BookBuddy</div>
            <div className="brand-tag">Read More. Live Better.</div>
          </div>
        </div>
        <nav className="side-nav">
          <button className={nav === "home" ? "active" : ""} onClick={() => setNav("home")}>🏠 Home</button>
          <button className={nav === "mybooks" ? "active" : ""} onClick={() => setNav("mybooks")}>📚 My Books</button>
          <button className={nav === "discover" ? "active" : ""} onClick={() => setNav("discover")}>🧭 Discover</button>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <input
            className="search-input"
            placeholder="Search books, authors, or genres..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </header>

        {searched ? (
          <section>
            <h2 className="section-title">Search results</h2>
            <div className="grid">
              {searched.length === 0 && <p className="empty">No matches.</p>}
              {searched.map((b, i) => renderBookCard(b, i))}
            </div>
          </section>
        ) : nav === "home" ? (
          <>
            <section>
              <div className="section-head">
                <h2 className="section-title">🔥 Currently Reading</h2>
                <button className="link-btn" onClick={() => setNav("mybooks")}>View All →</button>
              </div>
              <div className="grid">
                {readingBooks.length === 0 && <p className="empty">Nothing in progress — add a book to get started.</p>}
                {readingBooks.map((b, i) => renderBookCard(b, i))}
              </div>
            </section>

            {genres.length > 0 && (
              <section>
                <h2 className="section-title">🌿 Genres You're Reading</h2>
                <div className="genre-row">
                  {genres.map((g, i) => (
                    <div className="genre-pill" key={g} style={{ background: GRADIENTS[i % GRADIENTS.length] }}>{g}</div>
                  ))}
                </div>
              </section>
            )}

            <section className="hero-banner">
              <p className="hero-quote">"A room without books is a body without soul."</p>
              <span className="hero-author">— Marcus Tullius Cicero</span>
            </section>
          </>
        ) : nav === "mybooks" ? (
          <section>
            <div className="section-head">
              <h2 className="section-title">📚 Reading</h2>
              <button className="add-btn" onClick={() => setShowAddForm(s => !s)}>{showAddForm ? "Close" : "+ Add a Book"}</button>
            </div>
            {showAddForm && (
              <form className="add-form" onSubmit={addBook}>
                <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                <input placeholder="Author (optional)" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
                <input placeholder="Genre (optional)" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} />
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="wishlist">Wishlist</option>
                  <option value="reading">Reading</option>
                </select>
                <button type="submit" disabled={adding}>{adding ? "Adding..." : "Add"}</button>
              </form>
            )}
            <p className="hint">Leave author, genre, or page count blank — AI fills them in.</p>

            <div className="grid">{readingBooks.map((b, i) => renderBookCard(b, i))}</div>

            <h2 className="section-title" style={{ marginTop: 32 }}>🔖 Wishlist</h2>
            <div className="grid">
              {wishlistBooks.length === 0 && <p className="empty">Nothing on your wishlist.</p>}
              {wishlistBooks.map((b, i) => renderBookCard(b, i))}
            </div>

            <h2 className="section-title" style={{ marginTop: 32 }}>✅ Completed</h2>
            <div className="grid">
              {completedBooks.length === 0 && <p className="empty">No finished books yet.</p>}
              {completedBooks.map((b, i) => renderBookCard(b, i))}
            </div>
          </section>
        ) : (
          <section>
            <h2 className="section-title">🧭 Discover</h2>
            <div className="recommend-panel">
              <button className="ai-btn" onClick={getRecommendations}>✨ Get AI Recommendations</button>
              {recommendations && <div className="recommend-text">{recommendations}</div>}
            </div>
          </section>
        )}
      </main>

      <aside className="right-rail">
        <div className="rail-card">
          <div className="rail-title">🔥 Keep Going!</div>
          <p className="rail-sub">You're on a {streak} day reading streak!</p>
        </div>

        <div className="rail-card">
          <div className="rail-title">🎯 Reading Goal</div>
          <p className="rail-sub">{goalCurrent} of {goalTarget} books</p>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${goalPct}%` }} /></div>
        </div>

        {readingBooks[0] && (
          <div className="rail-card">
            <div className="rail-title">📘 Currently Reading</div>
            <div className="rail-book">
              <Cover title={readingBooks[0].title} idx={0} />
              <div>
                <strong>{readingBooks[0].title}</strong>
                <p className="meta">{readingBooks[0].author}</p>
              </div>
            </div>
            <button className="continue-btn" onClick={() => setNav("mybooks")}>Continue Reading →</button>
          </div>
        )}

        <div className="rail-card">
          <div className="rail-title">⚡ Quick Actions</div>
          <div className="quick-actions">
            <button onClick={() => { setNav("mybooks"); setShowAddForm(true); }}>➕ Add a Book</button>
            <button onClick={() => setNav("discover")}>🧭 Discover Books</button>
          </div>
        </div>

        {badges && (
          <div className="rail-card">
            <div className="rail-title">🏅 This Year</div>
            <p className="rail-sub">{badges.books_finished_this_year} books finished in {badges.year}</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function LogRow({ onLog }) {
  const [val, setVal] = useState("");
  return (
    <div className="log-row">
      <input type="number" placeholder="Pages read today" value={val} onChange={e => setVal(e.target.value)} />
      <button onClick={() => { if (val && Number(val) > 0) { onLog(Number(val)); setVal(""); } }}>Log</button>
    </div>
  );
}

function CompletedBlock({ book, onSave, onAiReview }) {
  const [notes, setNotes] = useState(book.notes || "");
  const [rating, setRating] = useState(book.rating || "");
  return (
    <div className="notes-block">
      <textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => onSave({ notes })} />
      <input type="number" min="1" max="5" placeholder="Rating (1-5)" value={rating} onChange={e => setRating(e.target.value)} onBlur={() => onSave({ rating: Number(rating) })} />
      <button className="ai-btn" onClick={() => onAiReview(notes, rating)}>✨ Generate AI Review</button>
    </div>
  );
}

export default App;