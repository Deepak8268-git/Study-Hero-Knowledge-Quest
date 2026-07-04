import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getAuthRole, getAuthToken, logout } from '../services/api';
import NotificationBell from './NotificationBell';
import ConnectionIndicator from './ConnectionIndicator';
import GlobalSearch from './GlobalSearch';
import { useTheme } from '../context/ThemeContext';

const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = getAuthToken();
  const userRole = getAuthRole();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getDashboardLink = () => {
    if (!isAuthenticated) return '/login';
    return userRole === 'teacher' ? '/teacher-dashboard' : '/student-dashboard';
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`bg-primary text-white fixed top-0 left-0 w-full z-50 shadow-md transition-all duration-300 ${
        isScrolled ? 'py-2 bg-opacity-95' : 'py-4 bg-opacity-90'
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <i className="ri-sword-fill text-2xl text-accent transition-transform duration-300 group-hover:rotate-12"></i>
          <span className="text-3xl font-pacifico group-hover:text-accent transition-colors duration-300">Study Hero</span>
        </Link>

        <nav className="hidden md:flex items-center gap-5">
          <Link to="/" className={`nav-link hover:text-accent transition-colors duration-300 ${location.pathname === '/' ? 'text-accent' : ''}`}>Home</Link>
          <Link to="/features" className={`nav-link hover:text-accent transition-colors duration-300 ${location.pathname === '/features' ? 'text-accent' : ''}`}>Features</Link>
          <Link to="/about" className={`nav-link hover:text-accent transition-colors duration-300 ${location.pathname === '/about' ? 'text-accent' : ''}`}>About Us</Link>
        </nav>

        <div className="hidden md:flex items-center gap-3 ml-auto">
          {isAuthenticated ? (
            <>
              <GlobalSearch />
              <ConnectionIndicator />
              <button type="button" onClick={toggleTheme} className="h-10 w-10 rounded-full border border-white/30 flex items-center justify-center hover:border-accent hover:text-accent transition-colors" aria-label="Toggle theme" title="Toggle theme">
                <i className={`${theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'} text-xl`}></i>
              </button>
              <NotificationBell />
              <Link to="/ai-learning" className="px-3 py-2 hover:text-accent transition-colors duration-300">AI</Link>
              <Link to="/lms" className="px-3 py-2 hover:text-accent transition-colors duration-300">LMS</Link>
              <Link to={getDashboardLink()} className="px-4 py-2 hover:text-accent transition-colors duration-300 border border-transparent hover:border-accent rounded-button">
                {userRole === 'teacher' ? 'Teacher Dashboard' : 'Student Dashboard'}
              </Link>
              <Link to="/settings" className="h-10 w-10 rounded-full border border-white/30 flex items-center justify-center hover:border-accent hover:text-accent transition-colors" aria-label="Settings" title="Settings">
                <i className="ri-settings-3-line text-xl"></i>
              </Link>
              <button onClick={handleLogout} className="px-5 py-2 bg-accent text-primary font-medium rounded-button hover:bg-white hover:text-accent transition-all duration-300">
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-4 py-2 hover:text-accent transition-colors duration-300 border border-transparent hover:border-accent rounded-button">Log In</Link>
              <Link to="/signup" className="px-5 py-2 bg-accent text-primary font-medium rounded-button hover:bg-white transition-all duration-300">Sign Up</Link>
            </>
          )}
        </div>

        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-white z-50 relative" aria-label="Toggle navigation" aria-expanded={mobileMenuOpen}>
          <i className={`${mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'} text-2xl`}></i>
        </button>

        <div className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileMenuOpen(false)}></div>

        <div className={`fixed top-0 right-0 w-4/5 h-full bg-primary z-50 p-8 pt-24 transform transition-transform ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex flex-col gap-6 text-center">
            <Link to="/" className={`text-xl py-2 hover:text-accent transition-colors duration-300 ${location.pathname === '/' ? 'text-accent' : ''}`}>Home</Link>
            <Link to="/features" className={`text-xl py-2 hover:text-accent transition-colors duration-300 ${location.pathname === '/features' ? 'text-accent' : ''}`}>Features</Link>
            <Link to="/about" className={`text-xl py-2 hover:text-accent transition-colors duration-300 ${location.pathname === '/about' ? 'text-accent' : ''}`}>About Us</Link>

            <div className="mt-6 flex flex-col gap-4">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center justify-center gap-4"><ConnectionIndicator /><NotificationBell /></div>
                  <button type="button" onClick={toggleTheme} className="py-3 border border-white rounded-button hover:bg-white hover:text-primary transition-all duration-300">
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  <Link to="/ai-learning" className="py-3 border border-white rounded-button hover:bg-white hover:text-primary transition-all duration-300">AI Learning</Link>
                  <Link to="/lms" className="py-3 border border-white rounded-button hover:bg-white hover:text-primary transition-all duration-300">Learning Hub</Link>
                  <Link to={getDashboardLink()} className="py-3 border border-white rounded-button hover:bg-white hover:text-primary transition-all duration-300">
                    {userRole === 'teacher' ? 'Teacher Dashboard' : 'Student Dashboard'}
                  </Link>
                  <Link to="/settings" className="py-3 border border-white rounded-button hover:bg-white hover:text-primary transition-all duration-300">Settings</Link>
                  <button onClick={handleLogout} className="py-3 bg-accent text-primary font-medium rounded-button hover:bg-white transition-all duration-300">Log Out</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="py-3 border border-white rounded-button hover:bg-white hover:text-primary transition-all duration-300">Log In</Link>
                  <Link to="/signup" className="py-3 bg-accent text-primary font-medium rounded-button hover:bg-white transition-all duration-300">Sign Up</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

