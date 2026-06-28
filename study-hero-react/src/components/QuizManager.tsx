import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: {
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
  isActive?: boolean;
  scheduledDate?: string;
  duration?: number;
  preventTabSwitch?: boolean;
  randomizeQuestions?: boolean;
  showOneQuestionAtATime?: boolean;
  requireWebcam?: boolean;
  passingScore?: number;
  quizCode?: string;
  code: string;
  source?: string;
  createdAt: string;
}

interface QuizManagerProps {
  quizzes: Quiz[];
  onActivateQuiz: (quizId: string, settings: Partial<Quiz>) => void;
  onEditQuiz: (quizId: string) => void;
  onDeleteQuiz: (quizId: string) => void;
  onDelete: (quizId: string) => void;
}

const QuizManager: React.FC<QuizManagerProps> = ({ 
  quizzes, 
  onActivateQuiz, 
  onEditQuiz, 
  onDeleteQuiz,
  onDelete
}) => {
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [quizSettings, setQuizSettings] = useState<Partial<Quiz>>({
    scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    duration: 30,
    preventTabSwitch: true,
    randomizeQuestions: true,
    showOneQuestionAtATime: true,
    requireWebcam: false,
    passingScore: 70
  });

  const handleScheduleQuiz = (quizId: string) => {
    setActiveQuizId(quizId);
  };

  const handleSettingsChange = (field: keyof Quiz, value: any) => {
    setQuizSettings({
      ...quizSettings,
      [field]: value
    });
  };

  const handleActivate = () => {
    if (activeQuizId) {
      onActivateQuiz(activeQuizId, quizSettings);
      setActiveQuizId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Your Created Quizzes</h2>
      
      {quizzes.length === 0 ? (
        <div className="text-center py-6">
          <i className="ri-file-list-3-line text-4xl text-gray-300 mb-2"></i>
          <p className="text-gray-500">You haven't created any quizzes yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-800">{quiz.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{quiz.description || 'No description'}</p>
                  <div className="flex items-center mt-2">
                    <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2 py-1 rounded mr-2">
                      Code: {quiz.code}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-800 font-medium px-2 py-1 rounded mr-2">
                      {quiz.questions.length} questions
                    </span>
                    {quiz.source === 'pdf-content' && (
                      <span className="text-xs bg-green-100 text-green-800 font-medium px-2 py-1 rounded">
                        PDF Generated
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(quiz.id)}
                  className="text-red-500 hover:text-red-600"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
              
              <div className="flex mt-4 space-x-2">
                <button 
                  onClick={() => window.open(`/quiz/${quiz.id}?preview=true`, '_blank')}
                  className="px-3 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                >
                  <i className="ri-eye-line mr-1"></i> Preview
                </button>
                <button 
                  onClick={() => onEditQuiz(quiz.id)}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors"
                >
                  <i className="ri-edit-line mr-1"></i> Edit
                </button>
                <button 
                  onClick={() => handleScheduleQuiz(quiz.id)}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                >
                  <i className="ri-calendar-line mr-1"></i> Schedule
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + `/quiz/${quiz.id}`);
                    alert(`Quiz link copied to clipboard!`);
                  }}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors"
                >
                  <i className="ri-share-line mr-1"></i> Share
                </button>
                <Link 
                  to={`/quiz/${quiz.id}`} 
                  className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
                >
                  <i className="ri-play-line mr-1"></i> Take Quiz
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Quiz Activation Modal */}
      {activeQuizId && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6 mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Quiz Settings</h3>
              <button 
                onClick={() => setActiveQuizId(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Date
                </label>
                <input
                  type="date"
                  value={quizSettings.scheduledDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleSettingsChange('scheduledDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={quizSettings.duration}
                  min={5}
                  max={180}
                  onChange={(e) => handleSettingsChange('duration', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passing Score (%)
                </label>
                <input
                  type="number"
                  value={quizSettings.passingScore}
                  min={0}
                  max={100}
                  onChange={(e) => handleSettingsChange('passingScore', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-700 mb-2">Anti-Cheating Measures</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      id="prevent-tab-switch"
                      type="checkbox"
                      checked={quizSettings.preventTabSwitch}
                      onChange={(e) => handleSettingsChange('preventTabSwitch', e.target.checked)}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="prevent-tab-switch" className="ml-2 block text-sm text-gray-700">
                      Prevent tab switching
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="randomize-questions"
                      type="checkbox"
                      checked={quizSettings.randomizeQuestions}
                      onChange={(e) => handleSettingsChange('randomizeQuestions', e.target.checked)}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="randomize-questions" className="ml-2 block text-sm text-gray-700">
                      Randomize question order
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="one-question-at-a-time"
                      type="checkbox"
                      checked={quizSettings.showOneQuestionAtATime}
                      onChange={(e) => handleSettingsChange('showOneQuestionAtATime', e.target.checked)}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="one-question-at-a-time" className="ml-2 block text-sm text-gray-700">
                      Show one question at a time
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="require-webcam"
                      type="checkbox"
                      checked={quizSettings.requireWebcam}
                      onChange={(e) => handleSettingsChange('requireWebcam', e.target.checked)}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="require-webcam" className="ml-2 block text-sm text-gray-700">
                      Enable webcam proctoring
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setActiveQuizId(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleActivate}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                Activate Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizManager; 