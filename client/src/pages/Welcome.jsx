import { useNavigate } from 'react-router-dom';
import Art from '../Art.jsx';

export default function Welcome() {
  const nav = useNavigate();
  const go = () => {
    try { localStorage.setItem('embercup.welcomed', '1'); } catch { /* ignore */ }
    nav('/');
  };
  return (
    <div className="welcome">
      <div className="welcome-art" aria-hidden="true"><Art kind="mocha" size={190} /></div>
      <h1>Fall in love with coffee in blissful delight.</h1>
      <p>Order ahead for delivery or pickup. Fresh beans, baked every morning.</p>
      <button className="btn btn-block" onClick={go}>Get started</button>
    </div>
  );
}
