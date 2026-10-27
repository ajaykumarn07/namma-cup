import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart.jsx';
import { useCartLines } from '../hooks.js';
import { money, SIZE_LABEL } from '../money.js';
import Art from '../Art.jsx';
import Icon from '../Icon.jsx';

export default function Cart() {
  const { setQty, remove } = useCart();
  const { items, subtotalCents, loading, error, removed } = useCartLines();
  const nav = useNavigate();

  if (loading) return <p className="muted" role="status">Loading…</p>;
  if (error) return <p className="error" role="alert">{error}</p>;

  return (
    <>
      <h1 className="h-page">Your cart</h1>
      {removed > 0 && <p className="notice" role="status">{removed} item(s) are no longer on the menu and were left out.</p>}
      {items.length === 0 ? (
        <div className="empty">
          <Art kind="espresso" size={120} />
          <p>Your cart is empty.</p>
          <Link className="btn" to="/">Browse the menu</Link>
        </div>
      ) : (
        <>
          <ul className="lines">
            {items.map((i) => (
              <li key={`${i.productId}-${i.size}`} className="line">
                <Art kind={i.product.art} size={64} />
                <div className="line-main">
                  <strong>{i.product.name}</strong>
                  <span className="muted small">{SIZE_LABEL[i.size]} · {money(i.unitCents)} each</span>
                  <div className="stepper sm" role="group" aria-label={`Quantity for ${i.product.name}`}>
                    <button onClick={() => setQty(i.productId, i.size, i.qty - 1)} aria-label={i.qty === 1 ? `Remove ${i.product.name}` : 'Decrease quantity'}>
                      <Icon name={i.qty === 1 ? 'trash' : 'minus'} size={16} />
                    </button>
                    <output>{i.qty}</output>
                    <button onClick={() => setQty(i.productId, i.size, i.qty + 1)} aria-label="Increase quantity" disabled={i.qty >= 20}><Icon name="plus" size={16} /></button>
                  </div>
                </div>
                <div className="line-side">
                  <strong>{money(i.totalCents)}</strong>
                  <button className="link" onClick={() => remove(i.productId, i.size)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{money(subtotalCents)}</dd></div>
            <div className="muted small"><dt>Delivery</dt><dd>Calculated at checkout</dd></div>
          </dl>
          <button className="btn btn-block" onClick={() => nav('/checkout')}>Checkout</button>
        </>
      )}
    </>
  );
}
