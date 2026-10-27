const P = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  cart: 'M3 4h2l2.4 11h10.2L20 7H6.2M9 20a1 1 0 1 0 0 .01M17 20a1 1 0 1 0 0 .01',
  orders: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21c1-4 4-6 8-6s7 2 8 6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  back: 'M15 5l-7 7 7 7',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  check: 'M5 12l5 5 9-10',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  admin: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
};
export default function Icon({ name, size = 22, fill = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name]} />
    </svg>
  );
}
