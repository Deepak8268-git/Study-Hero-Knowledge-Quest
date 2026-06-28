import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const isAuthenticated = localStorage.getItem('authToken');
  const userRole = localStorage.getItem('userRole');
  const userName = localStorage.getItem('userName');

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    window.location.href = '/';
  };

  const getDashboardLink = () => {
    if (!isAuthenticated) return '/login';
    return userRole === 'teacher' ? '/teacher-dashboard' : '/student-dashboard';
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Add background on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`bg-primary text-white fixed top-0 left-0 w-full z-50 shadow-md transition-all duration-300 ${
        isScrolled ? 'py-2' : 'py-4'
      } ${isScrolled ? 'bg-opacity-95' : 'bg-opacity-90'}`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <i className="ri-sword-fill text-2xl text-accent transition-transform duration-300 group-hover:rotate-12"></i>
          <span className="text-3xl font-pacifico group-hover:text-accent transition-colors duration-300">Study Hero</span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link 
            to="/" 
            className={`nav-link hover:text-accent transition-colors duration-300 ${
              location.pathname === '/' ? 'text-accent' : ''
            }`}
          >
            Home
          </Link>
          <Link 
            to="/features" 
            className={`nav-link hover:text-accent transition-colors duration-300 ${
              location.pathname === '/features' ? 'text-accent' : ''
            }`}
          >
            Features
          </Link>
          <Link 
            to="/about" 
            className={`nav-link hover:text-accent transition-colors duration-300 ${
              location.pathname === '/about' ? 'text-accent' : ''
            }`}
          >
            About Us
          </Link>
          
          <div className="ml-4 flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link 
                  to={getDashboardLink()} 
                  className="px-4 py-2 hover:text-accent transition-colors duration-300 border border-transparent hover:border-accent rounded-button"
                >
                  {userRole === 'teacher' ? 'Teacher Dashboard' : 'Student Dashboard'}
                </Link>
                <button 
                  onClick={handleLogout}
                  className="px-5 py-2 bg-accent text-primary font-medium rounded-button hover:bg-white hover:text-accent transition-all duration-300 transform hover:scale-105"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="px-4 py-2 hover:text-accent transition-colors duration-300 border border-transparent hover:border-accent rounded-button"
                >
                  Log In
                </Link>
                <Link 
                  to="/signup" 
                  className="px-5 py-2 bg-accent text-primary font-medium rounded-button hover:bg-white hover:text-accent transition-all duration-300 transform hover:scale-105"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </nav>
        
        {/* Mobile Menu Button */}
        <button 
          onClick={toggleMobileMenu}
          className="md:hidden text-white z-50 relative"
        >
          <i className={`${mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'} text-2xl`}></i>
        </button>
        
        {/* Mobile Overlay */}
        <div 
          className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setMobileMenuOpen(false)}
        ></div>
        
        {/* Mobile Navigation */}
        <div 
          className={`fixed top-0 right-0 w-4/5 h-full bg-primary z-50 p-8 pt-24 transform transition-transform ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex flex-col gap-6 text-center">
            <Link 
              to="/"
              className={`text-xl py-2 hover:text-accent transition-colors duration-300 ${
                location.pathname === '/' ? 'text-accent' : ''
              }`}
            >
              Home
            </Link>
            <Link 
              to="/features"
              className={`text-xl py-2 hover:text-accent transition-colors duration-300 ${
                location.pathname === '/features' ? 'text-accent' : ''
              }`}
            >
              Features
            </Link>
            <Link 
              to="/about"
              className={`text-xl py-2 hover:text-accent transition-colors duration-300 ${
                location.pathname === '/about' ? 'text-accent' : ''
              }`}
            >
              About Us
            </Link>
            
            <div className="mt-6 flex flex-col gap-4">
              {isAuthenticated ? (
                <>
                  <Link 
                    to={getDashboardLink()}
                    className="py-3 border border-white rounded-button hover:bg-white hover:text-primary transition-all duration-300"
                  >
                    {userRole === 'teacher' ? 'Teacher Dashboard' : 'Student Dashboard'}
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="py-3 bg-accent text-primary font-medium rounded-button hover:bg-white transition-all duration-300"
                  >
                    Log Out
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    to="/login"
                    className="py-3 border border-white rounded-button hover:bg-white hover:text-primary transition-all duration-300"
                  >
                    Log In
                  </Link>
                  <Link 
                    to="/signup"
                    className="py-3 bg-accent text-primary font-medium rounded-button hover:bg-white transition-all duration-300"
                  >
                    Sign Up
                  </Link>
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