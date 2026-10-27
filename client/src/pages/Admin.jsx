import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { money, when, SIZE_LABEL } from '../money.js';
import { StatusPill, STATUS_LABEL } from './Orders.jsx';

const EMPTY = { name: '', subtitle: '', description: '', category: 'Hot Coffee', art: 'latte', price: '3.00', available: true };

function OrdersTab() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api('/admin/orders').then((d) => setOrders(d.orders)).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function setStatus(id, status) {
    try { await api(`/admin/orders/${id}/status`, { method: 'PATCH', body: { status } }); await load(); }
    catch (e) { setError(e.message); }
  }
  if (!orders) return <p className="muted" role="status">{error || 'Loading…'}</p>;
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {orders.length === 0 && <p className="muted">No orders yet.</p>}
      <ul className="admin-orders">
        {orders.map((o) => (
          <li key={o.id} className="admin-order">
            <div className="between"><strong>#{o.id} · {o.customer}</strong><StatusPill status={o.status} /></div>
            <div className="muted small">{when(o.createdAt)} · {o.deliveryType === 'delivery' ? `Deliver: ${o.address}` : 'Pickup'} · {money(o.totalCents)}</div>
            <ul className="plain">{o.items.map((i) => <li key={i.id}>{i.qty} × {i.name} ({SIZE_LABEL[i.size]})</li>)}</ul>
            {o.note && <div className="muted small">Note: {o.note}</div>}
            <label className="inline">Status
              <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

function MenuTab() {
  const [products, setProducts] = useState(null);
  const [arts, setArts] = useState([]);
  const [editing, setEditing] = useState(null); // {id?, ...form}
  const [error, setError] = useState('');
  const load = useCallback(() => api('/admin/products').then((d) => { setProducts(d.products); setArts(d.arts); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    setError('');
    const cents = Math.round(parseFloat(editing.price) * 100);
    if (!Number.isFinite(cents) || cents < 0) return setError('Enter a valid price.');
    const body = { name: editing.name, subtitle: editing.subtitle, description: editing.description, category: editing.category, art: editing.art, priceCents: cents, available: editing.available };
    try {
      if (editing.id) await api(`/admin/products/${editing.id}`, { method: 'PUT', body });
      else await api('/admin/products', { method: 'POST', body });
      setEditing(null);
      await load();
    } catch (err) { setError(err.message); }
  }
  async function del(p) {
    if (!window.confirm(`Delete “${p.name}”? Past orders keep their line items. Consider marking it unavailable instead.`)) return;
    try { await api(`/admin/products/${p.id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(e.message); }
  }
  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  if (!products) return <p className="muted" role="status">{error || 'Loading…'}</p>;
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {editing ? (
        <form onSubmit={save} className="admin-form">
          <h2 className="h-sec">{editing.id ? 'Edit item' : 'New item'}</h2>
          <div className="field"><label htmlFor="pn">Name</label><input id="pn" value={editing.name} onChange={set('name')} required maxLength={80} /></div>
          <div className="field"><label htmlFor="ps">Short subtitle</label><input id="ps" value={editing.subtitle} onChange={set('subtitle')} maxLength={120} /></div>
          <div className="field"><label htmlFor="pd">Description</label><textarea id="pd" rows={3} value={editing.description} onChange={set('description')} maxLength={600} /></div>
          <div className="row2">
            <div className="field"><label htmlFor="pc">Category</label><input id="pc" value={editing.category} onChange={set('category')} required maxLength={40} /></div>
            <div className="field"><label htmlFor="pa">Illustration</label><select id="pa" value={editing.art} onChange={set('art')}>{arts.map((a) => <option key={a}>{a}</option>)}</select></div>
          </div>
          <div className="field"><label htmlFor="pp">Base price (small, INR)</label><input id="pp" inputMode="decimal" value={editing.price} onChange={set('price')} required /></div>
          <label className="inline"><input type="checkbox" checked={editing.available} onChange={set('available')} /> Available on the menu</label>
          <div className="row2"><button className="btn">Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button></div>
        </form>
      ) : (
        <>
          <button className="btn" onClick={() => setEditing({ ...EMPTY })}>Add menu item</button>
          <ul className="admin-menu">
            {products.map((p) => (
              <li key={p.id}>
                <div><strong>{p.name}</strong> {!p.available && <span className="pill s-cancelled">Hidden</span>}<div className="muted small">{p.category} · {money(p.priceCents)}</div></div>
                <div className="row2 shrink">
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditing({ ...p, price: (p.priceCents / 100).toFixed(2) })}>Edit</button>
                  <button className="btn btn-sm btn-ghost danger" onClick={() => del(p)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('orders');
  return (
    <>
      <h1 className="h-page">Admin</h1>
      <div className="seg" role="tablist" aria-label="Admin sections">
        {[['orders', 'Orders'], ['menu', 'Menu']].map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>
      {tab === 'orders' ? <OrdersTab /> : <MenuTab />}
    </>
  );
}
