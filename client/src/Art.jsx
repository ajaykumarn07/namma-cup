// Original, self-contained illustrations (no external images to license or host).
const TONES = {
  latte: { bg: '#EBD9C4', liquid: '#B98354', foam: '#F3E6D3' },
  mocha: { bg: '#E3CDB8', liquid: '#6B3F26', foam: '#D9B38C' },
  espresso: { bg: '#DCC7B2', liquid: '#3A2114', foam: '#B8814F' },
  cappuccino: { bg: '#EBD9C4', liquid: '#A8703F', foam: '#F7EEE0' },
  iced: { bg: '#D9E3E0', liquid: '#6B4429', foam: '#9A6A45' },
  frappe: { bg: '#EBD9D0', liquid: '#C9955E', foam: '#FBF3E8' },
  tea: { bg: '#EAD7C0', liquid: '#B5702E', foam: '#D8A56A' },
  matcha: { bg: '#DDE5CC', liquid: '#8BA05A', foam: '#C8D69B' },
  croissant: { bg: '#F0DEC2', liquid: '#D9993F', foam: '#B87420' },
  muffin: { bg: '#E8D6D3', liquid: '#C48A4A', foam: '#5E5B8C' },
};

function Cup({ t, tea }) {
  return (
    <g>
      <ellipse cx="60" cy="98" rx="38" ry="6" fill="#00000015" />
      <path d="M86 52h6a10 10 0 0 1 0 20h-9" fill="none" stroke="#FFF" strokeWidth="6" strokeLinecap="round" />
      <path d="M28 46h60v14a28 28 0 0 1-28 28h-4a28 28 0 0 1-28-28z" fill="#FFFFFF" />
      <ellipse cx="58" cy="46" rx="30" ry="7" fill={t.liquid} />
      <ellipse cx="58" cy="46" rx="21" ry="4.5" fill={t.foam} />
      {!tea && <path d="M50 46c4-3 9-3 13 0-4 2-9 2-13 0z" fill={t.liquid} opacity=".7" />}
      <path d="M48 30c-4 5 4 6 0 12M60 28c-4 5 4 7 0 13M72 30c-4 5 4 6 0 12" fill="none" stroke="#FFFFFFAA" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}
function Glass({ t, whip }) {
  return (
    <g>
      <ellipse cx="60" cy="100" rx="26" ry="5" fill="#00000015" />
      <path d="M40 38h40l-5 58a5 5 0 0 1-5 4H50a5 5 0 0 1-5-4z" fill="#FFFFFFCC" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M42.5 52h35l-3.8 44a4 4 0 0 1-4 3.5H50.3a4 4 0 0 1-4-3.5z" fill={t.liquid} />
      <rect x="50" y="62" width="11" height="11" rx="2" fill="#FFFFFF55" transform="rotate(-12 55 67)" />
      <rect x="62" y="76" width="10" height="10" rx="2" fill="#FFFFFF44" transform="rotate(14 67 81)" />
      {whip && <path d="M44 38c0-10 10-14 16-14s16 4 16 14z" fill={t.foam} />}
      <path d="M66 16l8 34" stroke="#A85F36" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}
function Croissant() {
  return (
    <g>
      <ellipse cx="60" cy="96" rx="40" ry="6" fill="#00000015" />
      <path d="M14 78c0-22 20-38 46-38s46 16 46 38c-8 4-14 0-18-6-6 6-16 6-22 0-6 6-16 6-22 0-4 6-10 10-30 6z" fill="#D9993F" />
      <path d="M36 52c4 8 4 16 0 24M52 46c4 10 4 20 0 30M68 46c-4 10-4 20 0 30M84 52c-4 8-4 16 0 24" fill="none" stroke="#B87420" strokeWidth="3.5" strokeLinecap="round" />
    </g>
  );
}
function Muffin() {
  return (
    <g>
      <ellipse cx="60" cy="98" rx="34" ry="5" fill="#00000015" />
      <path d="M34 62h52l-6 34H40z" fill="#F4E9DA" />
      <path d="M40 62l3 34M50 62l1 34M60 62v34M70 62l-1 34M80 62l-3 34" stroke="#D9C7AE" strokeWidth="2" />
      <path d="M28 62c-2-22 14-34 32-34s34 12 32 34z" fill="#C48A4A" />
      <circle cx="46" cy="48" r="4" fill="#5E5B8C" /><circle cx="64" cy="40" r="4.5" fill="#5E5B8C" /><circle cx="76" cy="54" r="4" fill="#5E5B8C" /><circle cx="56" cy="56" r="3.5" fill="#5E5B8C" />
    </g>
  );
}

export default function Art({ kind = 'latte', size = 120, label }) {
  const t = TONES[kind] || TONES.latte;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ display: 'block' }}>
      <rect width="120" height="120" rx="22" fill={t.bg} />
      {kind === 'iced' && <Glass t={t} />}
      {kind === 'frappe' && <Glass t={t} whip />}
      {kind === 'croissant' && <Croissant />}
      {kind === 'muffin' && <Muffin />}
      {['latte', 'mocha', 'espresso', 'cappuccino', 'matcha'].includes(kind) && <Cup t={t} />}
      {kind === 'tea' && <Cup t={t} tea />}
    </svg>
  );
}
