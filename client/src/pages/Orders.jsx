import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useFetch } from '../hooks.js';
import { money, when, SIZE_LABEL } from '../money.js';

export const STATUS_LABEL = { placed: 'Order placed', preparing: 'Being prepared', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled' };
const STEPS = ['placed', 'preparing', 'ready', 'completed'];

export function StatusPill({ status }) {
  return <span className={`pill s-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function Orders() {
  const { data, loading, error } = useFetch('/orders');
  if (loading) return <p className="muted" role="status">Loading…</p>;
  if (error) return <p className="error" role="alert">{error}</p>;
  return (
    <>
      <h1 className="h-page">Your orders</h1>
      {data.orders.length === 0 ? (
        <div className="empty"><p>No orders yet.</p><Link className="btn" to="/">Order something</Link></div>
      ) : (
        <ul className="orders">
          {data.orders.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="order-row">
                <div>
                  <strong>Order #{o.id}</strong>
                  <div className="muted small">{when(o.createdAt)} · {o.items.reduce((n, i) => n + i.qty, 0)} items</div>
                </div>
                <div className="right"><strong>{money(o.totalCents)}</strong><StatusPill status={o.status} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => api(`/orders/${encodeURIComponent(id)}`).then((d) => { setOrder(d.order); setError(''); }).catch((e) => setError(e.message)), [id]);

  useEffect(() => {
    refresh();
    // Poll while the order is still in progress.
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  async function cancel() {
    if (!window.confirm('Cancel this order?')) return;
    setBusy(true);
    try { const d = await api(`/orders/${order.id}/cancel`, { method: 'POST' }); setOrder(d.order); }
    catch (e) { setError(e.message); refresh(); }
    finally { setBusy(false); }
  }

  if (error && !order) return <div className="center"><p className="error" role="alert">{error}</p><Link className="btn" to="/orders">All orders</Link></div>;
  if (!order) return <p className="muted" role="status">Loading…</p>;

  const idx = STEPS.indexOf(order.status);
  return (
    <>
      <h1 className="h-page">Order #{order.id}</h1>
      <p className="muted">{when(order.createdAt)}</p>

      {order.status === 'cancelled' ? (
        <p className="notice">This order was cancelled.</p>
      ) : (
        <ol className="track" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''} aria-current={i === idx ? 'step' : undefined}>
              <span className="dot" aria-hidden="true" />{STATUS_LABEL[s]}
            </li>
          ))}
        </ol>
      )}

      <h2 className="h-sec">Items</h2>
      <ul className="summary">
        {order.items.map((i) => <li key={i.id}><span>{i.qty} × {i.name} <span className="muted">({SIZE_LABEL[i.size]})</span></span><span>{money(i.unitPriceCents * i.qty)}</span></li>)}
      </ul>
      <dl className="totals">
        <div><dt>Subtotal</dt><dd>{money(order.subtotalCents)}</dd></div>
        <div><dt>Delivery fee</dt><dd>{order.deliveryFeeCents ? money(order.deliveryFeeCents) : 'Free'}</dd></div>
        <div className="grand"><dt>Total (cash)</dt><dd>{money(order.totalCents)}</dd></div>
      </dl>
      <p><strong>{order.deliveryType === 'delivery' ? 'Deliver to' : 'Pickup at the counter'}</strong>{order.address && <><br />{order.address}</>}</p>
      {order.note && <p className="muted">Note: {order.note}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {order.status === 'placed' && <button className="btn btn-ghost" onClick={cancel} disabled={busy}>Cancel order</button>}
    </>
  );
}
