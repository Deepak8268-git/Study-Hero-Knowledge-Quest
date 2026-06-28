import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const FeaturesPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold text-center mb-12 text-gray-800">Our Features</h1>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <div className="bg-white rounded-xl shadow-md overflow-hidden transition-transform hover:scale-105">
              <div className="h-48 bg-primary/90 flex items-center justify-center">
                <i className="ri-book-open-line text-6xl text-white"></i>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Interactive Learning</h3>
                <p className="text-gray-600">
                  Engage with dynamic content that makes learning fun and effective. Our interactive modules adapt to your learning style and pace.
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md overflow-hidden transition-transform hover:scale-105">
              <div className="h-48 bg-secondary/90 flex items-center justify-center">
                <i className="ri-question-answer-line text-6xl text-white"></i>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Smart Quizzes</h3>
                <p className="text-gray-600">
                  Test your knowledge with customized quizzes that identify your strengths and areas for improvement, helping you focus your study efforts.
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md overflow-hidden transition-transform hover:scale-105">
              <div className="h-48 bg-primary/90 flex items-center justify-center">
                <i className="ri-team-line text-6xl text-white"></i>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Collaborative Spaces</h3>
                <p className="text-gray-600">
                  Connect with peers and teachers in virtual study groups where you can share resources, ask questions, and learn together.
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md overflow-hidden transition-transform hover:scale-105">
              <div className="h-48 bg-secondary/90 flex items-center justify-center">
                <i className="ri-calendar-check-line text-6xl text-white"></i>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Progress Tracking</h3>
                <p className="text-gray-600">
                  Monitor your learning journey with detailed analytics that show your progress over time and help you set meaningful goals.
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md overflow-hidden transition-transform hover:scale-105">
              <div className="h-48 bg-primary/90 flex items-center justify-center">
                <i className="ri-flashcard-line text-6xl text-white"></i>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Flashcards & Notes</h3>
                <p className="text-gray-600">
                  Create customized flashcards and organized notes to reinforce learning and prepare for exams with our user-friendly tools.
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md overflow-hidden transition-transform hover:scale-105">
              <div className="h-48 bg-secondary/90 flex items-center justify-center">
                <i className="ri-trophy-line text-6xl text-white"></i>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Gamified Experience</h3>
                <p className="text-gray-600">
                  Earn points, badges, and rewards as you complete learning objectives, making education engaging and motivating.
                </p>
              </div>
            </div>
          </div>
          
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden mb-12">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Why Choose Study Hero?</h2>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 bg-primary rounded-full flex items-center justify-center mr-3 mt-1">
                    <i className="ri-check-line text-white text-sm"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Personalized Learning Paths</h3>
                    <p className="text-gray-600">Our adaptive technology creates customized study plans based on your goals and learning style.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 bg-primary rounded-full flex items-center justify-center mr-3 mt-1">
                    <i className="ri-check-line text-white text-sm"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Expert-Created Content</h3>
                    <p className="text-gray-600">All our learning materials are developed by subject matter experts and experienced educators.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 bg-primary rounded-full flex items-center justify-center mr-3 mt-1">
                    <i className="ri-check-line text-white text-sm"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Cross-Platform Access</h3>
                    <p className="text-gray-600">Study seamlessly across devices with our web and mobile applications, syncing your progress everywhere.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 bg-primary rounded-full flex items-center justify-center mr-3 mt-1">
                    <i className="ri-check-line text-white text-sm"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Continuous Improvement</h3>
                    <p className="text-gray-600">We regularly update our platform based on user feedback and advancements in educational research.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-primary font-semibold mb-2">Ready to experience all these features?</p>
            <a href="/signup" className="btn btn-primary">Get Started Now</a>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default FeaturesPage; 