import { Route, Routes } from 'react-router';
import { AppHeader } from './components/AppHeader';
import AttemptWorkspacePage from './pages/AttemptWorkspacePage';
import ChallengeDetailPage from './pages/ChallengeDetailPage';
import ChallengeListPage from './pages/ChallengeListPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import SignupPage from './pages/SignupPage';

export default function App() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full px-4 pb-16">
        <Routes>
          <Route path="/" element={<ChallengeListPage />} />
          <Route path="/challenges/:challengeId" element={<ChallengeDetailPage />} />
          <Route path="/attempts/:attemptId" element={<AttemptWorkspacePage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
