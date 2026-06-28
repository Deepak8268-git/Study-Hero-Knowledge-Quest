import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useParticles } from '../hooks/useParticles';

declare global {
  interface Window {
    particlesJS: any;
  }
}

const HomePage: React.FC = () => {
  const isAuthenticated = localStorage.getItem('authToken');

  // Use our custom particles hook
  useParticles({
    selector: 'particles-js',
    color: '#ffffff',
    density: 80,
    speed: 2
  });

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/dashboard';
    }
    
    // Initialize AOS manually for this page
    if (typeof window.AOS !== 'undefined') {
      window.AOS.refresh();
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden">
      <Header />
      
      {/* Hero Section */}
      <section className="hero-bg relative text-white flex items-center">
        <div id="particles-js"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary/40"></div>
        
        <div className="container mx-auto px-6 py-32 mt-16 relative z-10 flex flex-col items-center text-center">
          <h1 
            className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            data-aos="fade-up"
          >
            Unlock Your Academic Potential with <span className="text-accent">Study Hero</span>
          </h1>
          <p 
            className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto"
            data-aos="fade-up" 
            data-aos-delay="100"
          >
            The intelligent learning platform that adapts to your needs and helps you master any subject through personalized quizzes, flashcards, and more.
          </p>
          <div 
            className="flex flex-col sm:flex-row gap-4 mt-4"
            data-aos="fade-up" 
            data-aos-delay="200"
          >
            <Link 
              to="/signup" 
              className="px-8 py-4 bg-accent text-primary font-semibold rounded-button hover:bg-white hover:text-accent transition-all duration-300 transform hover:scale-105 pulse-btn"
            >
              Get Started — It's Free
            </Link>
            <Link 
              to="/features" 
              className="px-8 py-4 bg-transparent text-white font-semibold rounded-button border border-white hover:bg-white/10 transition-all duration-300"
            >
              Explore Features
            </Link>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 
              className="text-3xl md:text-4xl font-bold text-primary mb-4"
              data-aos="fade-up"
            >
              Why Choose Study Hero?
            </h2>
            <p 
              className="text-xl text-gray-600 max-w-3xl mx-auto"
              data-aos="fade-up" 
              data-aos-delay="100"
            >
              Our platform is designed to help you study smarter, not harder, with features that adapt to your learning style.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div 
              className="feature-card bg-white p-8 rounded-xl shadow-lg text-center"
              data-aos="fade-up"
              data-aos-delay="150"
            >
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-brain-line text-3xl text-primary"></i>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Personalized Learning</h3>
              <p className="text-gray-600">
                Our AI-driven platform adapts to your learning style and pace, focusing on areas where you need more practice.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div 
              className="feature-card bg-white p-8 rounded-xl shadow-lg text-center"
              data-aos="fade-up"
              data-aos-delay="300"
            >
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-file-list-3-line text-3xl text-primary"></i>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Interactive Quizzes</h3>
              <p className="text-gray-600">
                Engage with dynamic quizzes that make learning enjoyable and effective, with instant feedback to reinforce concepts.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div 
              className="feature-card bg-white p-8 rounded-xl shadow-lg text-center"
              data-aos="fade-up"
              data-aos-delay="450"
            >
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-group-line text-3xl text-primary"></i>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Collaborative Learning</h3>
              <p className="text-gray-600">
                Connect with peers and teachers to share resources, discuss concepts, and solve problems together.
              </p>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Link 
              to="/features" 
              className="inline-flex items-center text-primary font-medium hover:text-accent transition-colors"
              data-aos="fade-up"
              data-aos-delay="600"
            >
              <span>Explore all features</span>
              <i className="ri-arrow-right-line ml-2"></i>
            </Link>
          </div>
        </div>
      </section>
      
      {/* How It Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 
              className="text-3xl md:text-4xl font-bold text-primary mb-4"
              data-aos="fade-up"
            >
              How Study Hero Works
            </h2>
            <p 
              className="text-xl text-gray-600 max-w-3xl mx-auto"
              data-aos="fade-up" 
              data-aos-delay="100"
            >
              Start your learning journey in three simple steps
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div 
              className="text-center"
              data-aos="fade-right"
              data-aos-delay="150"
            >
              <div className="relative">
                <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6">
                  1
                </div>
                <div className="hidden md:block absolute top-12 left-full w-full h-1 bg-primary"></div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Create Your Account</h3>
              <p className="text-gray-600">
                Sign up for free and set up your profile with your educational goals and subjects of interest.
              </p>
            </div>
            
            {/* Step 2 */}
            <div 
              className="text-center"
              data-aos="fade-up"
              data-aos-delay="300"
            >
              <div className="relative">
                <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6">
                  2
                </div>
                <div className="hidden md:block absolute top-12 left-full w-full h-1 bg-primary"></div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Choose Your Study Material</h3>
              <p className="text-gray-600">
                Select from our vast library of subjects or upload your own notes to create personalized study content.
              </p>
            </div>
            
            {/* Step 3 */}
            <div 
              className="text-center"
              data-aos="fade-left"
              data-aos-delay="450"
            >
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-xl font-semibold text-primary mb-4">Start Learning</h3>
              <p className="text-gray-600">
                Begin your learning journey with quizzes, flashcards, and interactive exercises tailored to your needs.
              </p>
            </div>
          </div>
          
          <div className="mt-16 text-center">
            <Link 
              to="/signup" 
              className="px-8 py-4 bg-primary text-white font-semibold rounded-button hover:bg-primary/80 transition-all duration-300"
              data-aos="fade-up"
              data-aos-delay="600"
            >
              Begin Your Journey
            </Link>
          </div>
        </div>
      </section>
      
      {/* Stats Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div 
              className="p-8 bg-gray-50 rounded-xl"
              data-aos="zoom-in"
              data-aos-delay="150"
            >
              <div className="stats-counter mb-2">20K+</div>
              <p className="text-gray-600 text-lg">Active Students</p>
            </div>
            
            <div 
              className="p-8 bg-gray-50 rounded-xl"
              data-aos="zoom-in"
              data-aos-delay="300"
            >
              <div className="stats-counter mb-2">500+</div>
              <p className="text-gray-600 text-lg">Subjects Covered</p>
            </div>
            
            <div 
              className="p-8 bg-gray-50 rounded-xl"
              data-aos="zoom-in"
              data-aos-delay="450"
            >
              <div className="stats-counter mb-2">95%</div>
              <p className="text-gray-600 text-lg">Success Rate</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 
              className="text-3xl md:text-4xl font-bold text-primary mb-4"
              data-aos="fade-up"
            >
              What Our Users Say
            </h2>
            <p 
              className="text-xl text-gray-600 max-w-3xl mx-auto"
              data-aos="fade-up" 
              data-aos-delay="100"
            >
              Hear from students who have transformed their learning experience with Study Hero
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div 
              className="testimonial-card bg-white p-8 rounded-xl shadow-lg"
              data-aos="fade-up"
              data-aos-delay="150"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold mr-4">
                  JD
                </div>
                <div>
                  <h4 className="font-semibold">John Doe</h4>
                  <p className="text-sm text-gray-500">Computer Science Student</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "Study Hero completely changed how I approach studying. The personalized quizzes helped me identify weak areas and focus my efforts. My grades improved dramatically!"
              </p>
              <div className="flex text-accent mt-4">
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
              </div>
            </div>
            
            {/* Testimonial 2 */}
            <div 
              className="testimonial-card bg-white p-8 rounded-xl shadow-lg"
              data-aos="fade-up"
              data-aos-delay="300"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold mr-4">
                  ES
                </div>
                <div>
                  <h4 className="font-semibold">Emily Smith</h4>
                  <p className="text-sm text-gray-500">Medical Student</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "As a medical student, I need to memorize vast amounts of information. The flashcard system in Study Hero makes this process so much more efficient. I couldn't be happier!"
              </p>
              <div className="flex text-accent mt-4">
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
              </div>
            </div>
            
            {/* Testimonial 3 */}
            <div 
              className="testimonial-card bg-white p-8 rounded-xl shadow-lg"
              data-aos="fade-up"
              data-aos-delay="450"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold mr-4">
                  MJ
                </div>
                <div>
                  <h4 className="font-semibold">Michael Johnson</h4>
                  <p className="text-sm text-gray-500">High School Teacher</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "I recommend Study Hero to all my students. The platform makes learning engaging and allows me to track their progress. It's transformed my classroom!"
              </p>
              <div className="flex text-accent mt-4">
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-half-fill"></i>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 bg-primary text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 
            className="text-3xl md:text-4xl font-bold mb-6"
            data-aos="fade-up"
          >
            Ready to Transform Your Learning Experience?
          </h2>
          <p 
            className="text-xl max-w-3xl mx-auto mb-8"
            data-aos="fade-up" 
            data-aos-delay="100"
          >
            Join thousands of students who are achieving their academic goals with Study Hero.
          </p>
          <Link 
            to="/signup" 
            className="px-8 py-4 bg-accent text-primary font-semibold rounded-button hover:bg-white hover:text-accent transition-all duration-300 inline-block"
            data-aos="fade-up"
            data-aos-delay="200"
          >
            Sign Up For Free
          </Link>
          <p 
            className="mt-4 text-white/80"
            data-aos="fade-up"
            data-aos-delay="300"
          >
            No credit card required. Start learning today.
          </p>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default HomePage; 