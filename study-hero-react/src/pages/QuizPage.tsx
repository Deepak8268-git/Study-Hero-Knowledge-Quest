import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import WebcamProctoring from '../components/WebcamProctoring';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

interface QuizSettings {
  preventTabSwitch: boolean;
  randomizeQuestions: boolean;
  showOneQuestionAtATime: boolean;
  requireWebcam: boolean;
  duration: number; // in minutes
  passingScore: number; // percentage needed to pass
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  settings: QuizSettings;
  source?: string;
}

// Add the missing utility functions
/**
 * Shuffles an array randomly
 * @param array The array to shuffle
 * @returns A new shuffled array
 */
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

/**
 * Gets a sample quiz for demonstration purposes
 * @param quizId The ID of the quiz to generate
 * @returns A sample quiz object
 */
const getSampleQuiz = (quizId: string | undefined): Quiz => {
  return {
    id: quizId || 'sample-quiz',
    title: 'Sample Quiz',
    description: 'This is a sample quiz for demonstration purposes.',
    questions: [
      {
        id: 1,
        question: 'What is the capital of France?',
        options: ['London', 'Berlin', 'Paris', 'Madrid'],
        correctAnswer: 'Paris'
      },
      {
        id: 2,
        question: 'What is 2 + 2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4'
      },
      {
        id: 3,
        question: 'Who painted the Mona Lisa?',
        options: ['Van Gogh', 'Da Vinci', 'Picasso', 'Monet'],
        correctAnswer: 'Da Vinci'
      },
      {
        id: 4,
        question: 'Which planet is closest to the sun?',
        options: ['Earth', 'Mars', 'Venus', 'Mercury'],
        correctAnswer: 'Mercury'
      },
      {
        id: 5,
        question: 'What is the largest mammal?',
        options: ['Elephant', 'Blue Whale', 'Giraffe', 'Hippopotamus'],
        correctAnswer: 'Blue Whale'
      }
    ],
    settings: {
      preventTabSwitch: true,
      randomizeQuestions: true,
      showOneQuestionAtATime: true,
      requireWebcam: false,
      duration: 5, // 5 minutes
      passingScore: 60
    },
    source: 'sample'
  };
};

const QuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const webcamRef = useRef<HTMLVideoElement>(null);
  
  // Define states with proper types
  const [loading, setLoading] = useState<boolean>(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizStarted, setQuizStarted] = useState<boolean>(false);
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [webcamReady, setWebcamReady] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [violations, setViolations] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [showScore, setShowScore] = useState(false);
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    preventTabSwitch: true,
    randomizeQuestions: true,
    showOneQuestionAtATime: true,
    requireWebcam: false,
    duration: 5, // 5 minutes
    passingScore: 60
  });
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [quizCode, setQuizCode] = useState<string | null>(null);
  const [invalidAccess, setInvalidAccess] = useState(false);
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [quizDescription, setQuizDescription] = useState<string>('');
  const userRole = localStorage.getItem('userRole');

  useEffect(() => {
    // Check if the user is logged in
    const user = localStorage.getItem('authToken');
    if (!user) {
      navigate('/login');
      return;
    }
    
    setLoading(true);
    
    // Attempt to find the quiz in localStorage first
    const generatedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
    const foundQuiz = generatedQuizzes.find((q: any) => q.id === quizId);
    
    // Also check student scheduled quizzes
    const studentQuizzes = JSON.parse(localStorage.getItem('studentScheduledQuizzes') || '[]');
    const foundStudentQuiz = studentQuizzes.find((q: any) => q.id === quizId);
    
    if (foundQuiz || foundStudentQuiz) {
      const quiz = foundQuiz || foundStudentQuiz;
      setTimeout(() => {
        // Set up the quiz with settings
        const quizData: Quiz = {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description || '',
          questions: quiz.questions.map((q: any) => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer
          })),
          settings: {
            duration: Number(quiz.settings?.timeLimit || quiz.duration || 20),
            preventTabSwitch: !!quiz.settings?.preventTabSwitch || false,
            randomizeQuestions: !!quiz.settings?.randomizeQuestions || false,
            showOneQuestionAtATime: !!quiz.settings?.showOneQuestionAtATime || false,
            requireWebcam: !!quiz.settings?.requireWebcam || false,
            passingScore: quiz.settings?.passingScore || 60
          },
          source: quiz.source || 'manual'
        };
        
        setQuiz(quizData);
        
        // Initialize questions
        let questionsToUse = [...quizData.questions];
        if (quizData.settings.randomizeQuestions) {
          questionsToUse = shuffleArray([...questionsToUse]);
        }
        
        setQuestions(questionsToUse);
        setCurrentQuestion(questionsToUse[0] || null);
        setSelectedAnswers({});
        setLoading(false);
        setQuizStarted(false);
      }, 1500);
    } else {
      // For demo purposes, load a sample quiz if not found
      setTimeout(() => {
        const sampleQuiz = getSampleQuiz(quizId);
        setQuiz(sampleQuiz);
        
        // Initialize questions
        let questionsToUse = [...sampleQuiz.questions];
        if (sampleQuiz.settings.randomizeQuestions) {
          questionsToUse = shuffleArray([...questionsToUse]);
        }
        
        setQuestions(questionsToUse);
        setCurrentQuestion(questionsToUse[0] || null);
        setSelectedAnswers({});
        setLoading(false);
        setQuizStarted(false);
      }, 1500);
    }
  }, [quizId, navigate]);
  
  // Add tab visibility change detection
  useEffect(() => {
    if (quizSettings.preventTabSwitch && !loading && !showScore) {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          handleViolation('tab_switch');
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [loading, showScore, quizSettings.preventTabSwitch]);
  
  // Timer effect
  useEffect(() => {
    if (!loading && !showScore && timeLeft > 0) {
      const timerId = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      
      return () => clearTimeout(timerId);
    } else if (timeLeft === 0 && !showScore) {
      handleSubmitQuiz();
    }
  }, [timeLeft, loading, showScore]);
  
  const handleViolation = (type: string) => {
    setViolations(prev => [...prev, type]);
    setShowViolationWarning(true);
    
    // Hide the warning after 5 seconds
    setTimeout(() => {
      setShowViolationWarning(false);
    }, 5000);
    
    // In a real app, we would also log this to the server
    console.warn(`Violation detected: ${type}`);
  };
  
  const handleAnswerSelection = (option: string) => {
    setSelectedAnswer(option);
    setShowExplanation(false);
  };
  
  const handleNextQuestion = () => {
    // Record the answer
    setSelectedAnswers({
      ...selectedAnswers,
      [questions[currentQuestionIndex].id]: selectedAnswer
    });
    
    // Check if the answer is correct
    if (selectedAnswer === questions[currentQuestionIndex].correctAnswer) {
      setScore(score + 1);
    }
    
    // Clear selection
    setSelectedAnswer('');
    setShowExplanation(false);
    
    // Move to next question or end quiz
    const nextQuestionIndex = currentQuestionIndex + 1;
    if (nextQuestionIndex < questions.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
      setCurrentQuestion(questions[nextQuestionIndex]);
    } else {
      handleSubmitQuiz();
    }
  };
  
  const handleSubmitQuiz = () => {
    // Calculate final score if we're on the last question
    if (!showScore && currentQuestionIndex === questions.length - 1 && selectedAnswer) {
      if (selectedAnswer === questions[currentQuestionIndex].correctAnswer) {
        setScore(score + 1);
      }
      setSelectedAnswers({
        ...selectedAnswers,
        [questions[currentQuestionIndex].id]: selectedAnswer
      });
    }
    
    // Save violations to be shown in the results
    // In a real app, we would also submit these to the server
    
    setShowScore(true);
    setQuizCompleted(true);
  };
  
  // Format time remaining
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  const handleWebcamToggle = () => {
    setWebcamReady(!webcamReady);
  };
  
  const handleStartQuiz = () => {
    if (!quiz) return;
    
    setQuizStarted(true);
    setQuizCompleted(false);
    setTimeLeft(quiz.settings.duration * 60 || 300);
    setScore(0);
    setSelectedAnswers({});
    setSelectedAnswer('');
    setCurrentQuestionIndex(0);
    setCurrentQuestion(questions[0] || null);
    setShowExplanation(false);
    setViolations([]);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        
        <div className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="animate-spin mb-4">
              <i className="ri-loader-4-line text-4xl text-primary"></i>
            </div>
            <p className="text-gray-600">Loading quiz...</p>
          </div>
        </div>
        
        <Footer />
      </div>
    );
  }
  
  if (invalidAccess) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        
        <div className="flex-grow flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <i className="ri-lock-line text-3xl text-red-600"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
              <p className="text-gray-600">
                This quiz requires a valid access code. Please obtain the correct code from your teacher.
              </p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => navigate('/student-dashboard')}
                className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
        
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow py-8 px-4">
        {loading ? (
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-8 flex flex-col items-center justify-center">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
            <h2 className="text-xl font-bold text-gray-800">Loading Quiz...</h2>
            <p className="text-gray-600 mt-2">Please wait while we prepare your quiz</p>
          </div>
        ) : !quizStarted ? (
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">{quiz?.title}</h1>
            <p className="text-gray-600 mb-6">{quiz?.description}</p>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-medium text-blue-800 mb-2">Quiz Information</h2>
              <ul className="text-blue-700 space-y-2">
                <li className="flex items-center">
                  <i className="ri-question-line mr-2"></i>
                  Questions: {quiz?.questions.length}
                </li>
                <li className="flex items-center">
                  <i className="ri-time-line mr-2"></i>
                  Time Limit: {quiz?.settings.duration} minutes
                </li>
                <li className="flex items-center">
                  <i className="ri-trophy-line mr-2"></i>
                  Passing Score: {quiz?.settings.passingScore}%
                </li>
                {quiz?.source === 'pdf-content' && (
                  <li className="flex items-center">
                    <i className="ri-file-pdf-line mr-2"></i>
                    Source: Generated from PDF Content
                  </li>
                )}
              </ul>
            </div>
            
            {quiz?.settings.requireWebcam && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 mb-6">
                <h2 className="text-lg font-medium text-yellow-800 mb-2">Webcam Required</h2>
                <p className="text-yellow-700">
                  This quiz requires webcam access for proctoring. Please ensure your camera is working and allow access when prompted.
                </p>
                
                <div className="mt-4 flex justify-center">
                  <div className="w-64 h-48 bg-gray-200 border border-gray-300 rounded-lg flex items-center justify-center">
                    {webcamReady ? (
                      <video 
                        ref={webcamRef}
                        width="256"
                        height="192"
                        autoPlay
                        muted
                        className="rounded-lg"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <i className="ri-camera-off-line text-3xl text-gray-400 mb-2"></i>
                        <p className="text-gray-500 text-sm">Camera not activated</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleWebcamToggle}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {webcamReady ? 'Camera Ready' : 'Enable Camera'}
                  </button>
                </div>
              </div>
            )}
            
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h2 className="text-lg font-medium text-gray-800 mb-4">Quiz Rules</h2>
              <ul className="text-gray-600 space-y-2 list-disc pl-5">
                <li>Once you start the quiz, the timer will begin and cannot be paused.</li>
                <li>Answer all questions before submitting your quiz.</li>
                {quiz?.settings.preventTabSwitch && (
                  <li className="text-red-600">
                    <strong>Warning:</strong> Switching tabs or windows during the quiz will be recorded as a violation.
                  </li>
                )}
                {quiz?.settings.showOneQuestionAtATime && (
                  <li>Questions will be presented one at a time. You can navigate between them.</li>
                )}
                {quiz?.settings.randomizeQuestions && (
                  <li>Questions are presented in random order for each student.</li>
                )}
              </ul>
            </div>
            
            <div className="flex justify-center mt-8">
              <button
                onClick={handleStartQuiz}
                disabled={quiz?.settings.requireWebcam && !webcamReady}
                className={`px-6 py-3 text-lg font-medium rounded-lg ${
                  quiz?.settings.requireWebcam && !webcamReady 
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
                    : 'bg-primary text-white hover:bg-primary/90'
                } transition-colors`}
              >
                Start Quiz
              </button>
            </div>
          </div>
        ) : quizCompleted ? (
          // Quiz Results
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-green-100 text-green-600 text-4xl mb-4">
                <i className="ri-check-line"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Quiz Completed!</h1>
              <p className="text-gray-600 mt-2">
                You've completed the quiz: {quiz?.title}
              </p>
            </div>
            
            <div className="mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-medium text-gray-800">Your Score</h2>
                <span className="text-2xl font-bold text-primary">
                  {score}/{questions.length} ({Math.round((score / questions.length) * 100)}%)
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                <div 
                  className={`h-4 rounded-full ${
                    (score / questions.length) >= (quiz?.settings.passingScore || 60) / 100 
                      ? 'bg-green-500' 
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${(score / questions.length) * 100}%` }}
                ></div>
              </div>
              
              <p className={`text-right font-medium ${
                (score / questions.length) >= (quiz?.settings.passingScore || 60) / 100 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {(score / questions.length) >= (quiz?.settings.passingScore || 60) / 100 
                  ? 'Passed!' 
                  : 'Failed'}
              </p>
            </div>
            
            {violations.length > 0 && (
              <div className="mb-8 bg-red-50 border border-red-100 rounded-lg p-4">
                <h2 className="text-lg font-medium text-red-800 mb-2">Potential Violations Detected</h2>
                <ul className="text-red-700 space-y-2">
                  {violations.map((violation, index) => (
                    <li key={index} className="flex items-start">
                      <i className="ri-error-warning-line mr-2 mt-0.5"></i>
                      <span>{violation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="space-y-6">
              <h2 className="text-xl font-medium text-gray-800 mb-4">Question Summary</h2>
              
              {questions.map((question, index) => (
                <div 
                  key={question.id} 
                  className={`border rounded-lg p-4 ${
                    selectedAnswers[question.id] === question.correctAnswer
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <h3 className="font-medium text-gray-800 mb-2">
                    {index + 1}. {question.question}
                  </h3>
                  
                  <ul className="space-y-2 mb-3">
                    {question.options.map((option) => (
                      <li
                        key={option}
                        className={`px-3 py-2 rounded ${
                          option === question.correctAnswer
                            ? 'bg-green-200 text-green-800'
                            : option === selectedAnswers[question.id] && option !== question.correctAnswer
                              ? 'bg-red-200 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {option}
                        {option === question.correctAnswer && (
                          <span className="float-right">
                            <i className="ri-check-line"></i>
                          </span>
                        )}
                        {option === selectedAnswers[question.id] && option !== question.correctAnswer && (
                          <span className="float-right">
                            <i className="ri-close-line"></i>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  
                  <div className={`text-sm font-medium ${
                    selectedAnswers[question.id] === question.correctAnswer
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {selectedAnswers[question.id] === question.correctAnswer
                      ? 'Correct'
                      : 'Incorrect - Correct answer: ' + question.correctAnswer
                    }
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-center mt-8">
              <Link
                to="/student-dashboard"
                className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          // Quiz Questions
          <div className="bg-white rounded-xl shadow-md p-6">
            {/* Quiz Code Indicator */}
            {quizCode && (
              <div className="flex justify-end mb-4">
                <div className="bg-primary/10 text-primary font-mono px-3 py-1 rounded-md text-sm">
                  Quiz Code: {quizCode}
                </div>
              </div>
            )}
            
            {/* Quiz Header */}
            <div className="mb-6 pb-4 border-b">
              <h1 className="text-2xl font-bold text-gray-800">{quizTitle || 'Quiz'}</h1>
              {quizDescription && <p className="text-gray-600 mt-1">{quizDescription}</p>}
              
              <div className="mt-4 flex flex-wrap gap-4">
                <div className="flex items-center bg-primary/10 px-4 py-2 rounded-full">
                  <i className="ri-time-line text-primary mr-2"></i>
                  <span className={`font-medium ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-primary'}`}>
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                
                <div className="flex items-center bg-gray-100 px-4 py-2 rounded-full">
                  <span className="text-gray-700 font-medium">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-primary rounded-full h-2.5 transition-all duration-300" 
                  style={{ width: `${((currentQuestionIndex) / questions.length) * 100}%` }}
                ></div>
              </div>
            </div>
            
            {/* Question */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">
                <span className="text-primary font-bold">Q{currentQuestionIndex + 1}:</span> {currentQuestion?.question}
              </h2>
              
              <div className="space-y-3">
                {currentQuestion?.options.map((option, index) => (
                  <div 
                    key={index}
                    onClick={() => handleAnswerSelection(option)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedAnswer === option 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-5 h-5 rounded-full border flex-shrink-0 mr-3 flex items-center justify-center ${
                        selectedAnswer === option ? 'border-primary' : 'border-gray-300'
                      }`}>
                        {selectedAnswer === option && (
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                        )}
                      </div>
                      <span className={selectedAnswer === option ? 'font-medium' : ''}>{option}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Show explanation button */}
            {selectedAnswer && (
              <div className="mb-6">
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-primary hover:text-primary/80 text-sm flex items-center"
                >
                  <i className={`ri-${showExplanation ? 'arrow-up' : 'arrow-down'}-s-line mr-1`}></i>
                  {showExplanation ? 'Hide hint' : 'Show hint'}
                </button>
                
                {showExplanation && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-md text-sm text-blue-800">
                    <p className="font-medium mb-1">Hint:</p>
                    <p>Think about the fundamental properties of this data structure/algorithm and its common applications.</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <button
                onClick={() => {
                  if (currentQuestionIndex > 0) {
                    setCurrentQuestionIndex(currentQuestionIndex - 1);
                    setSelectedAnswer(selectedAnswers[questions[currentQuestionIndex - 1].id] || '');
                    setShowExplanation(false);
                  }
                }}
                className={`px-4 py-2 rounded-md flex items-center ${
                  currentQuestionIndex === 0 || !quizSettings.showOneQuestionAtATime
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                disabled={currentQuestionIndex === 0 || !quizSettings.showOneQuestionAtATime}
              >
                <i className="ri-arrow-left-s-line mr-1"></i>
                Previous
              </button>
              
              <button
                onClick={handleNextQuestion}
                disabled={!selectedAnswer}
                className={`px-6 py-2 rounded-md ${
                  !selectedAnswer
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                {currentQuestionIndex < questions.length - 1 ? 'Next' : 'Finish Quiz'}
              </button>
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default QuizPage; 
