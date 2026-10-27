import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';

const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);
const KEY = 'embercup.cart.v1';

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v.filter((l) => l && Number.isInteger(l.productId) && ['S', 'M', 'L'].includes(l.size) && l.qty > 0) : [];
  } catch {
    return [];
  }
}

// The cart stores only ids, size and quantity. Prices are looked up live
// (see useCartLines) and recomputed on the server when the order is placed.
export function CartProvider({ children }) {
  const [lines, setLines] = useState(load);
  const [toast, setToast] = useState('');
  const timer = useRef();

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable: cart just won't persist */
    }
  }, [lines]);

  const announce = useCallback((msg) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 2500);
  }, []);

  const add = useCallback((product, size = 'M', qty = 1) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === product.id && l.size === size);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: Math.min(20, l.qty + qty) } : l));
      return [...ls, { productId: product.id, size, qty }];
    });
    announce(`Added ${product.name} to your cart`);
  }, [announce]);
  const setQty = useCallback((productId, size, qty) => {
    setLines((ls) => (qty <= 0 ? ls.filter((l) => !(l.productId === productId && l.size === size)) : ls.map((l) => (l.productId === productId && l.size === size ? { ...l, qty: Math.min(20, qty) } : l))));
  }, []);
  const remove = useCallback((productId, size) => setQty(productId, size, 0), [setQty]);
  const clear = useCallback(() => setLines([]), []);
  const count = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);

  return <Ctx.Provider value={{ lines, count, add, setQty, remove, clear, toast }}>{children}</Ctx.Provider>;
}
