import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './styles/App.css';
import { clearAuthToken, getAuthRole, getAuthToken, isTokenExpired } from './services/api';

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

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const token = getAuthToken();
  const userRole = getAuthRole();

  if (!token || isTokenExpired()) {
    clearAuthToken();
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
    <div className="content-wrapper">
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
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