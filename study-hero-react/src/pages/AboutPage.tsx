import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold text-center mb-12 text-gray-800">About Study Hero</h1>
          
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden mb-12">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Mission</h2>
              <p className="text-gray-600 mb-6">
                At Study Hero, we believe that learning should be engaging, accessible, and effective. Our mission is to transform the educational experience by providing innovative tools that make studying fun and meaningful. We are committed to helping students of all ages discover the joy of learning and achieve academic success.
              </p>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Who We Are</h2>
              <p className="text-gray-600 mb-6">
                Study Hero was founded by a team of dedicated educators and technology enthusiasts who recognized the need for more dynamic learning solutions. Our diverse team brings together expertise in pedagogy, cognitive science, and software development to create a platform that addresses the challenges of modern education.
              </p>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-4">What We Offer</h2>
              <p className="text-gray-600 mb-6">
                Our platform offers a wide range of interactive learning tools, from customized quizzes and flashcards to comprehensive study guides and collaborative projects. We employ adaptive learning technologies that adjust to each student's unique needs and learning style, ensuring that everyone gets the support they need to succeed.
              </p>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Values</h2>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-center mb-2">
                    <i className="ri-lightbulb-flash-line text-2xl text-primary mr-2"></i>
                    <h3 className="text-xl font-semibold text-gray-800">Innovation</h3>
                  </div>
                  <p className="text-gray-600">We continuously explore new ways to enhance the learning experience through technology.</p>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-center mb-2">
                    <i className="ri-user-star-line text-2xl text-primary mr-2"></i>
                    <h3 className="text-xl font-semibold text-gray-800">Student-Centered</h3>
                  </div>
                  <p className="text-gray-600">We place students at the heart of everything we do, designing with their needs in mind.</p>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-center mb-2">
                    <i className="ri-shield-check-line text-2xl text-primary mr-2"></i>
                    <h3 className="text-xl font-semibold text-gray-800">Integrity</h3>
                  </div>
                  <p className="text-gray-600">We are committed to honesty, respect, and ethical practices in all our interactions.</p>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-center mb-2">
                    <i className="ri-global-line text-2xl text-primary mr-2"></i>
                    <h3 className="text-xl font-semibold text-gray-800">Accessibility</h3>
                  </div>
                  <p className="text-gray-600">We strive to make quality education resources available to learners from all backgrounds.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-primary font-semibold mb-2">Ready to transform your learning experience?</p>
            <a href="/signup" className="btn btn-primary">Join Study Hero Today</a>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default AboutPage; 