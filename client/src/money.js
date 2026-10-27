const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
export const money = (paise) => inr.format(paise / 100);
export const SIZE_LABEL = { S: 'Small', M: 'Medium', L: 'Large' };
export function when(sqliteUtc) {
  // SQLite datetime('now') is UTC without a zone marker.
  const d = new Date(sqliteUtc.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
