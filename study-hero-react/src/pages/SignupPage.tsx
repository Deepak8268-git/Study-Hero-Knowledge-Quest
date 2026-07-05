import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { API_BASE_URL, getAuthToken, register } from '../services/api';

const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState('student');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  // Check if already authenticated
  useEffect(() => {
    if (getAuthToken()) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const oauthUrl = (provider: 'google' | 'facebook') => `${API_BASE_URL || ''}/api/auth/oauth/${provider}/start?role=${userType}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName || !email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const passwordIssues = [];
    if (password.length < 8) passwordIssues.push('at least 8 characters');
    if (!/[a-z]/.test(password)) passwordIssues.push('a lowercase letter');
    if (!/[A-Z]/.test(password)) passwordIssues.push('an uppercase letter');
    if (!/\d/.test(password)) passwordIssues.push('a number');
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/;']/.test(password)) passwordIssues.push('a special character');

    if (passwordIssues.length > 0) {
      setError(`Password must include ${passwordIssues.join(', ')}.`);
      return;
    }

    if (!agreeTerms) {
      setError('You must agree to the terms and conditions.');
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        username: fullName,
        email,
        password,
        role: userType
      });
      navigate('/login', { state: { message: 'Account created. Please check your email to verify your address.' } });
    } catch (error) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
          <div>
            <div className="flex justify-center">
              <div className="flex items-center gap-2">
                <i className="ri-sword-fill text-2xl text-primary"></i>
                <span className="text-2xl font-pacifico text-primary">Study Hero</span>
              </div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">Create your account</h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Or{' '}
              <Link to="/login" className="font-medium text-primary hover:text-secondary">
                sign in if you already have an account
              </Link>
            </p>
          </div>
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <i className="ri-error-warning-fill text-red-500"></i>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="full-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  id="full-name"
                  name="full-name"
                  type="text"
                  required
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="user-type" className="block text-sm font-medium text-gray-700 mb-1">
                  I am a:
                </label>
                <div className="flex space-x-4">
                  <div className="flex items-center">
                    <input
                      id="user-type-student"
                      name="user-type"
                      type="radio"
                      value="student"
                      checked={userType === 'student'}
                      onChange={() => setUserType('student')}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                    />
                    <label htmlFor="user-type-student" className="ml-2 block text-sm text-gray-900">
                      Student
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="user-type-teacher"
                      name="user-type"
                      type="radio"
                      value="teacher"
                      checked={userType === 'teacher'}
                      onChange={() => setUserType('teacher')}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                    />
                    <label htmlFor="user-type-teacher" className="ml-2 block text-sm text-gray-900">
                      Teacher
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="agree-terms"
                name="agree-terms"
                type="checkbox"
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              <label htmlFor="agree-terms" className="ml-2 block text-sm text-gray-900">
                I agree to the{' '}
                <Link to="/about" className="text-primary hover:text-secondary">
                  Terms and Conditions
                </Link>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or sign up with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div>
                <a
                  href={oauthUrl('google')}
                  aria-label="Sign up with Google"
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <i className="ri-google-fill text-lg"></i>
                </a>
              </div>
              <div>
                <a
                  href={oauthUrl('facebook')}
                  aria-label="Sign up with Facebook"
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <i className="ri-facebook-fill text-lg"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default SignupPage; 





