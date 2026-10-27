import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useFetch } from '../hooks.js';
import { useCart } from '../cart.jsx';
import { money, SIZE_LABEL } from '../money.js';
import Art from '../Art.jsx';
import Icon from '../Icon.jsx';

export default function Product() {
  const { id } = useParams();
  const nav = useNavigate();
  const { add } = useCart();
  const { data, error, loading } = useFetch(`/products/${encodeURIComponent(id)}`);
  const [size, setSize] = useState('M');
  const [qty, setQty] = useState(1);

  if (loading) return <p className="muted" role="status">Loading…</p>;
  if (error) return <div className="center"><p className="error" role="alert">{error}</p><Link className="btn" to="/">Back to menu</Link></div>;
  const { product: p, sizes } = data;
  const unit = p.priceCents + sizes[size];

  return (
    <article className="product">
      <button className="back" onClick={() => nav(-1)}><Icon name="back" /> Back</button>
      <div className="product-hero"><Art kind={p.art} size={260} label={p.name} /></div>
      <div className="product-body">
        <h1 className="h-page">{p.name}</h1>
        <p className="muted">{p.subtitle} · <span className="rating-inline"><Icon name="star" size={13} fill /> {p.rating.toFixed(1)}</span></p>
        <h2 className="h-sec">Description</h2>
        <p>{p.description}</p>

        <fieldset className="sizes">
          <legend className="h-sec">Size</legend>
          {Object.keys(sizes).map((s) => (
            <label key={s} className={`size ${size === s ? 'on' : ''}`}>
              <input type="radio" name="size" value={s} checked={size === s} onChange={() => setSize(s)} />
              {SIZE_LABEL[s]}
            </label>
          ))}
        </fieldset>

        <div className="buyrow">
          <div className="stepper" role="group" aria-label="Quantity">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" disabled={qty <= 1}><Icon name="minus" size={18} /></button>
            <output aria-live="polite">{qty}</output>
            <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Increase quantity" disabled={qty >= 20}><Icon name="plus" size={18} /></button>
          </div>
          <button className="btn grow" onClick={() => { add(p, size, qty); nav('/cart'); }}>
            Add to cart · {money(unit * qty)}
          </button>
        </div>
      </div>
    </article>
  );
}
