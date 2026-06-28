import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/main.css';
import App from './App';

// Initialize AOS here to ensure it's available globally
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.AOS !== 'undefined') {
    window.AOS.init({
      duration: 800,
      easing: 'ease-in-out',
      once: true,
    });
  }
});

// Add global AOS type to Window interface
declare global {
  interface Window {
    AOS: any;
    particlesJS: any;
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
); 