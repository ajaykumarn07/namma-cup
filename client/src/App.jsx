import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { useCart } from './cart.jsx';
import Icon from './Icon.jsx';
import Welcome from './pages/Welcome.jsx';
import Home from './pages/Home.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import { Orders, OrderDetail } from './pages/Orders.jsx';
import { Login, Register, Account } from './pages/Auth.jsx';
import Admin from './pages/Admin.jsx';

export function RequireAuth({ children, admin = false }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <p className="center muted" role="status">Loading…</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function Layout({ children }) {
  const { user } = useAuth();
  const { count, toast } = useCart();
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <Link to="/" className="brand">{'\u0CA8amma Cup'}</Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end><Icon name="home" /><span>Menu</span></NavLink>
          <NavLink to="/cart" className="cartlink">
            <Icon name="cart" /><span>Cart</span>
            {count > 0 && <b className="badge" aria-label={`${count} items`}>{count}</b>}
          </NavLink>
          <NavLink to="/orders"><Icon name="orders" /><span>Orders</span></NavLink>
          {user?.role === 'admin' && <NavLink to="/admin"><Icon name="admin" /><span>Admin</span></NavLink>}
          <NavLink to="/account"><Icon name="user" /><span>{user ? 'Account' : 'Sign in'}</span></NavLink>
        </nav>
      </header>
      <main id="main" className="page">{children}</main>
      <div className="toast" role="status" aria-live="polite">{toast}</div>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/product/:id" element={<Product />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
              <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
              <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/account" element={<Account />} />
              <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
              <Route path="*" element={<div className="center"><h1>Page not found</h1><Link className="btn" to="/">Back to menu</Link></div>} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
