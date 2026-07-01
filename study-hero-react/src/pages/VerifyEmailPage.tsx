import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { verifyEmail } from '../services/api';

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Verifying your email address...');
  const [error, setError] = useState('');
  const token = searchParams.get('token') || '';

  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!token) {
        setMessage('');
        setError('Verification token is missing.');
        return;
      }

      try {
        const response = await verifyEmail(token);
        if (active) setMessage(response.message);
      } catch (err) {
        if (active) {
          setMessage('');
          setError(err instanceof Error ? err.message : 'Unable to verify email');
        }
      }
    };

    verify();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg text-center">
          <h2 className="text-3xl font-bold text-gray-900">Email verification</h2>
          {message && <div className="bg-green-50 border-l-4 border-green-500 p-4 text-sm text-green-700 text-left">{message}</div>}
          {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700 text-left">{error}</div>}
          <Link to="/login" className="font-medium text-primary hover:text-secondary">Go to login</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default VerifyEmailPage;