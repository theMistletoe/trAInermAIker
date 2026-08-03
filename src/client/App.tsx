import { Route, Routes } from 'react-router';
import { AppHeader } from './components/AppHeader';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import MyNotesPage from './pages/MyNotesPage';
import NotFoundPage from './pages/NotFoundPage';
import SignupPage from './pages/SignupPage';

export default function App() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl px-4 pb-16">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/mine" element={<MyNotesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
