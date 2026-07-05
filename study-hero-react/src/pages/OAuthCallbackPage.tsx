import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { setAuthToken } from '../services/api';

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Completing sign in...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search.replace(/^\?/, ''));
    const token = params.get('token');
    const role = params.get('role');
    const error = params.get('error');

    if (error || !token || !role) {
      setMessage(error || 'Social sign in could not be completed.');
      window.setTimeout(() => navigate('/login', { replace: true }), 2500);
      return;
    }

    setAuthToken(token);
    navigate(role === 'teacher' ? '/teacher-dashboard' : '/student-dashboard', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-md p-8 text-center max-w-md w-full">
          <div className="animate-spin mx-auto mb-4 h-10 w-10 border-b-2 border-primary rounded-full"></div>
          <p className="text-gray-700">{message}</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OAuthCallbackPage;
