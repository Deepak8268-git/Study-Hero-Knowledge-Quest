import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './styles/App.css';
import { clearAuthToken, getAuthRole, getAuthToken, isTokenExpired, refreshAccessToken } from './services/api';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { ConnectivityProvider } from './context/ConnectivityContext';
import { PresenceProvider } from './context/PresenceContext';
import ConnectionStatusBanner from './components/ConnectionStatusBanner';
import ErrorBoundary from './components/ErrorBoundary';

import HomePage from './pages/HomePage';
import FeaturesPage from './pages/FeaturesPage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import QuizPage from './pages/QuizPage';
import QuizResultsPage from './pages/QuizResultsPage';
import CoursePage from './pages/CoursePage';
import AssignmentPage from './pages/AssignmentPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import SettingsPage from './pages/SettingsPage';
import AiLearningPage from './pages/AiLearningPage';
import LmsPage from './pages/LmsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import PerformanceDashboardPage from './pages/PerformanceDashboardPage';
import ExamPredictionPage from './pages/ExamPredictionPage';
import StudyPlannerPage from './pages/StudyPlannerPage';
import LearningInsightsPage from './pages/LearningInsightsPage';
import WeakTopicsPage from './pages/WeakTopicsPage';
import RecommendationsPage from './pages/RecommendationsPage';
import PerformanceHistoryPage from './pages/PerformanceHistoryPage';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      let token = getAuthToken();

      if (!token) {
        if (active) {
          setIsAuthenticated(false);
          setIsChecking(false);
        }
        return;
      }

      if (isTokenExpired()) {
        token = await refreshAccessToken();
      }

      if (!active) return;

      if (!token) {
        clearAuthToken();
        setIsAuthenticated(false);
      } else {
        setUserRole(getAuthRole());
        setIsAuthenticated(true);
      }
      setIsChecking(false);
    };

    verifySession();
    return () => {
      active = false;
    };
  }, []);

  if (isChecking) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(userRole || '')) {
    return <Navigate to={userRole === 'teacher' ? '/teacher-dashboard' : '/student-dashboard'} replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/features" element={<FeaturesPage />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/student-dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboardPage /></ProtectedRoute>} />
    <Route path="/teacher-dashboard" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboardPage /></ProtectedRoute>} />
    <Route path="/course/:courseId" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><CoursePage /></ProtectedRoute>} />
    <Route path="/assignment/:assignmentId" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><AssignmentPage /></ProtectedRoute>} />
    <Route path="/assignment/:assignmentId/review" element={<ProtectedRoute allowedRoles={['teacher']}><AssignmentPage /></ProtectedRoute>} />
    <Route path="/ai-learning" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><AiLearningPage /></ProtectedRoute>} />
    <Route path="/lms" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><LmsPage /></ProtectedRoute>} />
    <Route path="/analytics" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><AnalyticsPage /></ProtectedRoute>} />
    <Route path="/performance" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><PerformanceDashboardPage /></ProtectedRoute>} />
    <Route path="/exam-prediction" element={<ProtectedRoute allowedRoles={['student']}><ExamPredictionPage /></ProtectedRoute>} />
    <Route path="/study-planner" element={<ProtectedRoute allowedRoles={['student']}><StudyPlannerPage /></ProtectedRoute>} />
    <Route path="/learning-insights" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><LearningInsightsPage /></ProtectedRoute>} />
    <Route path="/weak-topics" element={<ProtectedRoute allowedRoles={['student']}><WeakTopicsPage /></ProtectedRoute>} />
    <Route path="/recommendations" element={<ProtectedRoute allowedRoles={['student']}><RecommendationsPage /></ProtectedRoute>} />
    <Route path="/performance-history" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><PerformanceHistoryPage /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><SettingsPage /></ProtectedRoute>} />
    <Route path="/change-password" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><ChangePasswordPage /></ProtectedRoute>} />
    <Route path="/quiz" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><QuizPage /></ProtectedRoute>} />
    <Route path="/quiz/:quizId/results" element={<ProtectedRoute allowedRoles={['teacher']}><QuizResultsPage /></ProtectedRoute>} />
    <Route path="/quiz/:quizId" element={<ProtectedRoute allowedRoles={['student', 'teacher']}><QuizPage /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window.AOS !== 'undefined') {
      window.AOS.refresh();
    }
  }, [location]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ConnectivityProvider authKey={location.pathname}>
          <PresenceProvider authKey={location.pathname}>
            <NotificationProvider authKey={location.pathname}>
              <ConnectionStatusBanner />
              <div className="content-wrapper">
                <AppRoutes />
              </div>
            </NotificationProvider>
          </PresenceProvider>
        </ConnectivityProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

declare global {
  interface Window {
    AOS: any;
    particlesJS: any;
  }
}

export default App;




