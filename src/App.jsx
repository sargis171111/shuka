import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import Header from './components/Header.jsx';
import HomePage from './pages/HomePage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import ProductDetailPage from './pages/ProductDetailPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SellerActivatePage from './pages/seller/SellerActivatePage.jsx';
import SellerOverviewPage from './pages/seller/SellerOverviewPage.jsx';
import SellerProductsPage from './pages/seller/SellerProductsPage.jsx';
import SellerProductFormPage from './pages/seller/SellerProductFormPage.jsx';
import SellerOrdersPage from './pages/seller/SellerOrdersPage.jsx';
import SellerOrderDetailPage from './pages/seller/SellerOrderDetailPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/profile" element={<ProfilePage />} />

                <Route path="/seller/activate" element={<SellerActivatePage />} />
                <Route path="/seller" element={<SellerOverviewPage />} />
                <Route path="/seller/products" element={<SellerProductsPage />} />
                <Route path="/seller/products/new" element={<SellerProductFormPage />} />
                <Route path="/seller/products/:id/edit" element={<SellerProductFormPage />} />
                <Route path="/seller/orders" element={<SellerOrdersPage />} />
                <Route path="/seller/orders/:id" element={<SellerOrderDetailPage />} />
              </Routes>
            </main>
            <footer className="mt-12 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
              Shuka Marketplace • Armenia Local Commerce • Cash on Delivery
            </footer>
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
