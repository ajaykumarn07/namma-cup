import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useCart } from '../cart.jsx';
import { useCartLines, useFetch } from '../hooks.js';
import { money, SIZE_LABEL } from '../money.js';

export default function Checkout() {
  const { clear } = useCart();
  const nav = useNavigate();
  const { items, subtotalCents, loading } = useCartLines();
  const cfg = useFetch('/config');
  const [type, setType] = useState('delivery');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading || cfg.loading) return <p className="muted" role="status">Loading…</p>;
  if (items.length === 0) return <div className="center"><p>Your cart is empty.</p><Link className="btn" to="/">Browse the menu</Link></div>;

  const fee = type === 'delivery' && subtotalCents < cfg.data.freeDeliveryOverCents ? cfg.data.deliveryFeeCents : 0;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (type === 'delivery' && address.trim().length < 5) return setError('Please enter a delivery address.');
    setBusy(true);
    try {
      const { order } = await api('/orders', {
        method: 'POST',
        body: {
          items: items.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty })),
          deliveryType: type,
          address,
          note,
          paymentMethod: 'cash',
        },
      });
      clear();
      nav(`/orders/${order.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="h-page">Checkout</h1>

      <div className="seg" role="radiogroup" aria-label="Order type">
        {[['delivery', 'Deliver'], ['pickup', 'Pick up']].map(([v, label]) => (
          <label key={v} className={type === v ? 'on' : ''}>
            <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} />
            {label}
          </label>
        ))}
      </div>

      {type === 'delivery' ? (
        <div className="field">
          <label htmlFor="addr">Delivery address</label>
          <textarea id="addr" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} autoComplete="street-address" required />
        </div>
      ) : (
        <p className="notice">Collect your order at the counter. We will have it ready in about 10 minutes.</p>
      )}

      <div className="field">
        <label htmlFor="note">Note for the barista <span className="muted">(optional)</span></label>
        <input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </div>

      <fieldset className="field">
        <legend>Payment</legend>
        <label className="pay"><input type="radio" checked readOnly /> Cash on {type === 'delivery' ? 'delivery' : 'pickup'}</label>
        <p className="muted small">Online payment is not enabled yet.</p>
      </fieldset>

      <h2 className="h-sec">Summary</h2>
      <ul className="summary">
        {items.map((i) => (
          <li key={`${i.productId}-${i.size}`}><span>{i.qty} × {i.product.name} <span className="muted">({SIZE_LABEL[i.size]})</span></span><span>{money(i.totalCents)}</span></li>
        ))}
      </ul>
      <dl className="totals">
        <div><dt>Subtotal</dt><dd>{money(subtotalCents)}</dd></div>
        <div><dt>Delivery fee</dt><dd>{fee === 0 ? 'Free' : money(fee)}</dd></div>
        <div className="grand"><dt>Total</dt><dd>{money(subtotalCents + fee)}</dd></div>
      </dl>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-block" disabled={busy}>{busy ? 'Placing order…' : `Place order · ${money(subtotalCents + fee)}`}</button>
    </form>
  );
}
