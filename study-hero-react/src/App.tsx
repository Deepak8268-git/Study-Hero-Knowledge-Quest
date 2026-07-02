import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './styles/App.css';
import { clearAuthToken, getAuthRole, getAuthToken, isTokenExpired, refreshAccessToken } from './services/api';
import { NotificationProvider } from './context/NotificationContext';

// Pages
import HomePage from './pages/HomePage';
import FeaturesPage from './pages/FeaturesPage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import QuizPage from './pages/QuizPage';
import CoursePage from './pages/CoursePage';
import AssignmentPage from './pages/AssignmentPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ChangePasswordPage from './pages/ChangePasswordPage';

// Protected Route Component
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

const App: React.FC = () => {
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  
  // Initialize AOS on each route change
  useEffect(() => {
    if (typeof window.AOS !== 'undefined') {
      // Refresh animations when the route changes
      window.AOS.refresh();
    }
  }, [location]);

  return (
    <NotificationProvider authKey={location.pathname}>
      <div className="content-wrapper">
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/features" element={<FeaturesPage />} />

        {/* Dashboard Routes */}
        <Route path="/dashboard" element={<DashboardPage />} />
        
        {/* Protected Student Routes */}
        <Route 
          path="/student-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentDashboardPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Protected Teacher Routes */}
        <Route 
          path="/teacher-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <TeacherDashboardPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/course/:courseId" 
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher']}>
              <CoursePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/assignment/:assignmentId" 
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher']}>
              <AssignmentPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/assignment/:assignmentId/review" 
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <AssignmentPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/change-password" 
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher']}>
              <ChangePasswordPage />
            </ProtectedRoute>
          } 
        />

        {/* Quiz Routes */}
        <Route 
          path="/quiz" 
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher']}>
              <QuizPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/quiz/:quizId" 
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher']}>
              <QuizPage />
            </ProtectedRoute>
          } 
        />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </NotificationProvider>
  );
};

// Add global window interface
declare global {
  interface Window {
    AOS: any;
    particlesJS: any;
  }
}

export default App;