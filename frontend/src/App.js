import { useState, useEffect } from "react";

const API = "http://localhost:8000";

function App() {
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({ title: "", author: "", genre: "", status: "wishlist" });
  const [recommendations, setRecommendations] = useState("");

  const fetchBooks = () => fetch(`${API}/books`).then(r => r.json()).then(setBooks);
  const fetchStats = () => fetch(`${API}/stats`).then(r => r.json()).then(setStats);

  useEffect(() => { fetchBooks(); fetchStats(); }, []);

  const addBook = async (e) => {
    e.preventDefault();
    await fetch(`${API}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ title: "", author: "", genre: "", status: "wishlist" });
    fetchBooks();
    fetchStats();
  };

  const updateBook = async (id, updates) => {
    await fetch(`${API}/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    fetchBooks();
    fetchStats();
  };

  const deleteBook = async (id) => {
    await fetch(`${API}/books/${id}`, { method: "DELETE" });
    fetchBooks();
    fetchStats();
  };

  const getRecommendations = async () => {
    setRecommendations("Loading...");
    const res = await fetch(`${API}/recommend`);
    const data = await res.json();
    setRecommendations(data.recommendations);
  };

  const getAiReview = async (id, notes, rating) => {
    const res = await fetch(`${API}/books/${id}/ai-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, rating }),
    });
    const data = await res.json();
    updateBook(id, { notes: `${notes}\n\nAI Review: ${data.review}` });
  };

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1>📚 Book Buddy</h1>

      <form onSubmit={addBook} style={{ marginBottom: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
        <input placeholder="Author" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
        <input placeholder="Genre" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} />
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
          <option value="wishlist">Wishlist</option>
          <option value="reading">Reading</option>
          <option value="completed">Completed</option>
        </select>
        <button type="submit">Add Book</button>
      </form>

      {stats && (
        <div style={{ marginBottom: 24, padding: 12, background: "#f4f4f4", borderRadius: 6 }}>
          <strong>Stats:</strong> {stats.total_books} books, {stats.percent_completed}% completed
          <div>By genre: {JSON.stringify(stats.by_genre)}</div>
        </div>
      )}

      <button onClick={getRecommendations} style={{ marginBottom: 16 }}>✨ Get AI Recommendations</button>
      {recommendations && (
        <div style={{ whiteSpace: "pre-line", marginBottom: 24, padding: 12, background: "#eef6ff", borderRadius: 6 }}>
          {recommendations}
        </div>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {books.map(b => (
          <li key={b.id} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8, borderRadius: 6 }}>
            <strong>{b.title}</strong> by {b.author || "Unknown"} — {b.genre || "N/A"} — [{b.status}]
            <button onClick={() => deleteBook(b.id)} style={{ float: "right", color: "red" }}>Delete</button>
            <div style={{ marginTop: 8 }}>
              Progress: {b.progress}%
              <input
                type="range" min="0" max="100" value={b.progress}
                onChange={e => updateBook(b.id, { progress: Number(e.target.value) })}
                style={{ marginLeft: 8 }}
              />
            </div>
            <select value={b.status} onChange={e => updateBook(b.id, { status: e.target.value })} style={{ marginTop: 8 }}>
              <option value="wishlist">Wishlist</option>
              <option value="reading">Reading</option>
              <option value="completed">Completed</option>
            </select>
            {b.status === "completed" && (
              <div style={{ marginTop: 8 }}>
                <textarea
                  placeholder="Notes"
                  defaultValue={b.notes || ""}
                  onBlur={e => updateBook(b.id, { notes: e.target.value })}
                  style={{ width: "100%", minHeight: 50 }}
                />
                <input
                  type="number" min="1" max="5" placeholder="Rating (1-5)"
                  defaultValue={b.rating || ""}
                  onBlur={e => updateBook(b.id, { rating: Number(e.target.value) })}
                  style={{ marginTop: 4 }}
                />
                <button onClick={() => getAiReview(b.id, b.notes || "", b.rating)} style={{ marginTop: 8, display: "block" }}>
                  ✨ Generate AI Review
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;