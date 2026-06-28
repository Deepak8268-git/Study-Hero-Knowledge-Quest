import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-100 text-gray-800">
      <div className="container mx-auto px-6 pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <i className="ri-sword-fill text-2xl text-primary"></i>
              <span className="text-2xl font-pacifico text-primary">Study Hero</span>
            </div>
            <p className="text-gray-600 mb-4">
              Empowering students to achieve academic excellence through personalized learning experiences.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-gray-600 hover:text-primary transition-colors">
                <i className="ri-facebook-fill text-xl"></i>
              </a>
              <a href="#" className="text-gray-600 hover:text-primary transition-colors">
                <i className="ri-twitter-fill text-xl"></i>
              </a>
              <a href="#" className="text-gray-600 hover:text-primary transition-colors">
                <i className="ri-instagram-fill text-xl"></i>
              </a>
              <a href="#" className="text-gray-600 hover:text-primary transition-colors">
                <i className="ri-linkedin-fill text-xl"></i>
              </a>
            </div>
          </div>
          
          <div className="col-span-1">
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-600 hover:text-primary transition-colors">Home</Link>
              </li>
              <li>
                <Link to="/features" className="text-gray-600 hover:text-primary transition-colors">Features</Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-600 hover:text-primary transition-colors">About Us</Link>
              </li>
              <li>
                <Link to="#" className="text-gray-600 hover:text-primary transition-colors">Blog</Link>
              </li>
            </ul>
          </div>
          
          <div className="col-span-1">
            <h3 className="text-lg font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link to="#" className="text-gray-600 hover:text-primary transition-colors">Help Center</Link>
              </li>
              <li>
                <Link to="#" className="text-gray-600 hover:text-primary transition-colors">Contact Us</Link>
              </li>
              <li>
                <Link to="#" className="text-gray-600 hover:text-primary transition-colors">FAQ</Link>
              </li>
              <li>
                <Link to="#" className="text-gray-600 hover:text-primary transition-colors">Community</Link>
              </li>
            </ul>
          </div>
          
          <div className="col-span-1">
            <h3 className="text-lg font-semibold mb-4">Subscribe</h3>
            <p className="text-gray-600 mb-4">
              Subscribe to our newsletter to receive updates and educational tips.
            </p>
            <form className="flex flex-col sm:flex-row gap-2">
              <input 
                type="email" 
                placeholder="Your email" 
                className="px-4 py-2 border border-gray-300 rounded-button focus:outline-none focus:border-primary" 
              />
              <button 
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-button hover:bg-primary/80 transition-colors"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
        
        <div className="border-t border-gray-200 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-600 text-sm">
            &copy; {currentYear} Study Hero. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 flex gap-4">
            <Link to="#" className="text-gray-600 text-sm hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link to="#" className="text-gray-600 text-sm hover:text-primary transition-colors">
              Terms of Service
            </Link>
            <Link to="#" className="text-gray-600 text-sm hover:text-primary transition-colors">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 