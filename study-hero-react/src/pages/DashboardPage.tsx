import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');

    if (!token) {
      navigate('/login');
      return;
    }

    // Redirect based on role
    if (userRole === 'teacher') {
      navigate('/teacher-dashboard');
    } else if (userRole === 'student') {
      navigate('/student-dashboard');
    } else {
      // If role is not set, clear auth and redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      navigate('/login');
    }
  }, [navigate]);
  
  return null; // This component only handles routing
};

export default DashboardPage; 