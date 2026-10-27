import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useFetch } from '../hooks.js';
import { useCart } from '../cart.jsx';
import { useAuth } from '../auth.jsx';
import { money } from '../money.js';
import Art from '../Art.jsx';
import Icon from '../Icon.jsx';

function seenWelcome() {
  try { return localStorage.getItem('embercup.welcomed') === '1'; } catch { return true; }
}

export default function Home() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cat, setCat] = useState('');
  const { user } = useAuth();
  const { add } = useCart();
  const cats = useFetch('/categories');
  const qs = new URLSearchParams();
  if (debounced) qs.set('q', debounced);
  if (cat) qs.set('category', cat);
  const { data, loading, error } = useFetch(`/products?${qs}`);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!seenWelcome()) return <Navigate to="/welcome" replace />;

  return (
    <>
      <p className="muted small">{user ? `Hi, ${user.name.split(' ')[0]}` : 'Welcome'}</p>
      <h1 className="h-page">What are you craving?</h1>

      <div className="search">
        <Icon name="search" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coffee" aria-label="Search the menu" />
      </div>

      <section className="promo" aria-label="Offer">
        <span className="tag">Free delivery</span>
        <strong>On orders of ₹200 or more</strong>
        <span>Pickup is always free.</span>
      </section>

      <div className="chips" role="group" aria-label="Categories">
        {['', ...(cats.data?.categories || [])].map((c) => (
          <button key={c || 'all'} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c || 'All'}
          </button>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {loading && !data && <p className="muted" role="status">Loading menu…</p>}
      {data && data.products.length === 0 && <p className="muted">Nothing matches “{debounced}”.</p>}

      <ul className="grid">
        {data?.products.map((p) => (
          <li key={p.id} className="card">
            <Link to={`/product/${p.id}`} className="card-link" aria-label={`${p.name}, ${money(p.priceCents + data.sizes.M)}`}>
              <Art kind={p.art} size={160} />
              <span className="rating"><Icon name="star" size={12} fill /> {p.rating.toFixed(1)}</span>
              <span className="card-name">{p.name}</span>
              <span className="muted small">{p.subtitle}</span>
            </Link>
            <div className="card-foot">
              <span className="price">{money(p.priceCents + data.sizes.M)}</span>
              <button className="icon-btn accent" onClick={() => add(p, 'M', 1)} aria-label={`Add ${p.name} (medium) to cart`}>
                <Icon name="plus" size={20} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
