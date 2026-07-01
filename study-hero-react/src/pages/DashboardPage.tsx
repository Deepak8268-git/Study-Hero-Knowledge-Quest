import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuthToken, getAuthRole, getAuthToken, isTokenExpired } from '../services/api';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = getAuthToken();
    const userRole = getAuthRole();

    if (!token || isTokenExpired()) {
      clearAuthToken();
      navigate('/login');
      return;
    }

    if (userRole === 'teacher') {
      navigate('/teacher-dashboard');
    } else if (userRole === 'student') {
      navigate('/student-dashboard');
    } else {
      clearAuthToken();
      navigate('/login');
    }
  }, [navigate]);
  
  return null;
};

export default DashboardPage;