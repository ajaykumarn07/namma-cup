import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { useCart } from './cart.jsx';

export function useFetch(path, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api(path)
      .then((data) => live && setState({ data, error: '', loading: false }))
      .catch((e) => live && setState({ data: null, error: e.message, loading: false }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  return state;
}

// Joins cart lines with the live menu so prices shown are always current,
// and drops items that are no longer sold.
export function useCartLines() {
  const { lines } = useCart();
  const { data, loading, error } = useFetch('/products');
  return useMemo(() => {
    if (!data) return { loading, error, items: [], subtotalCents: 0, removed: 0 };
    const byId = new Map(data.products.map((p) => [p.id, p]));
    const items = [];
    let removed = 0;
    for (const l of lines) {
      const p = byId.get(l.productId);
      if (!p) { removed += 1; continue; }
      const unit = p.priceCents + data.sizes[l.size];
      items.push({ ...l, product: p, unitCents: unit, totalCents: unit * l.qty });
    }
    return { loading, error, items, subtotalCents: items.reduce((n, i) => n + i.totalCents, 0), removed };
  }, [lines, data, loading, error]);
}
