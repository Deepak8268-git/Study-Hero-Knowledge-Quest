import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { apiRequest, getAuthToken } from '../services/api';
import { useNotifications } from '../context/NotificationContext';

interface Course {
  id: number;
  title: string;
  instructor: string;
  progress: number;
  imageUrl: string;
}

interface Assignment {
  id: number;
  title: string;
  course: string;
  dueDate: string;
  completed: boolean;
}

interface ScheduledQuiz {
  id: string;
  title: string;
  description: string;
  scheduledDate?: string;
  dueDate?: string;
  duration?: number;
  quizCode: string;
  courseId?: string;
  courseName?: string;
  source?: string;
}

interface QuizHistoryItem {
  id: number;
  title: string;
  percentage: number;
  submittedAt: string;
  courseName: string;
}

interface StudentPerformance {
  averageQuizScore: number;
  completedAssignments: number;
  pendingAssignments: number;
  completedQuizzes: number;
}

interface StudentDashboardResponse {
  courses: Array<{ id: number; title: string; instructor: string; progress: number }>;
  assignments: Array<{ id: number; title: string; course: string; dueDate: string; completed: boolean | number }>;
  quizHistory?: QuizHistoryItem[];
  performance?: StudentPerformance;
  scheduledQuizzes: Array<{
    id: number | string;
    title: string;
    description?: string;
    scheduledDate?: string;
    duration?: number;
    quizCode?: string;
    courseId?: number | string;
    courseName?: string;
    source?: string;
  }>;
}

interface QuizLookupResponse {
  id: string;
  title: string;
  description?: string;
  scheduledDate?: string;
  duration?: number;
  code?: string;
  courseId?: number | string;
  courseName?: string;
  source?: string;
}

const courseImages = [
  'https://public.readdy.ai/ai/img_res/c2b6a1c2a0a2f01b3cebf7bc4b28df92.jpg',
  'https://public.readdy.ai/ai/img_res/1e8954d5adaed647d599a83d143e7fe8.jpg',
  'https://public.readdy.ai/ai/img_res/82c3d797823dc44d0fcf84c4b9a1c8da.jpg'
];

// Define the QuizCard component before the StudentDashboardPage component
const QuizCard: React.FC<{ quiz: ScheduledQuiz }> = ({ quiz }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-gray-800">{quiz.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{quiz.description || 'No description provided'}</p>
          
          <div className="flex items-center mt-3 text-xs">
            {quiz.scheduledDate && (
              <span className="flex items-center text-gray-500 mr-3">
                <i className="ri-calendar-line mr-1"></i>
                {new Date(quiz.scheduledDate).toLocaleDateString()}
              </span>
            )}
            
            {quiz.duration && (
              <span className="flex items-center text-gray-500 mr-3">
                <i className="ri-time-line mr-1"></i>
                {quiz.duration} min
              </span>
            )}
            
            <span className="flex items-center text-blue-600 font-medium">
              <i className="ri-key-line mr-1"></i>
              {quiz.quizCode}
            </span>
            
            {quiz.source === 'pdf-content' && (
              <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                PDF Generated
              </span>
            )}
          </div>
        </div>
        
        <Link
          to={`/quiz/${quiz.id}`}
          className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
        >
          Take Quiz
        </Link>
      </div>
    </div>
  );
};

const StudentDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scheduledQuizzes, setScheduledQuizzes] = useState<ScheduledQuiz[]>([]);
  const [quizCode, setQuizCode] = useState('');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [quizCodeSuccess, setQuizCodeSuccess] = useState('');
  const [quizCodeError, setQuizCodeError] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [performance, setPerformance] = useState<StudentPerformance | null>(null);
  const { notifications, unreadCount, refreshNotifications, markRead } = useNotifications();
  
  const mapQuiz = (quiz: StudentDashboardResponse['scheduledQuizzes'][number] | QuizLookupResponse): ScheduledQuiz => {
    const code = 'quizCode' in quiz && quiz.quizCode
      ? quiz.quizCode
      : 'code' in quiz && quiz.code
        ? quiz.code
        : '';

    return {
      id: String(quiz.id),
      title: quiz.title,
      description: quiz.description || '',
      scheduledDate: quiz.scheduledDate,
      duration: quiz.duration,
      quizCode: code,
      courseId: quiz.courseId ? String(quiz.courseId) : undefined,
      courseName: quiz.courseName,
      source: quiz.source || 'manual'
    };
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<StudentDashboardResponse>('/api/dashboard/student');

      setCourses(data.courses.map((course, index) => ({
        id: course.id,
        title: course.title,
        instructor: course.instructor,
        progress: Number(course.progress || 0),
        imageUrl: courseImages[index % courseImages.length]
      })));

      setAssignments(data.assignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        course: assignment.course,
        dueDate: assignment.dueDate,
        completed: Boolean(assignment.completed)
      })));

      setScheduledQuizzes(data.scheduledQuizzes.map(mapQuiz));
      setQuizHistory(data.quizHistory || []);
      setPerformance(data.performance || null);
      await refreshNotifications();
      setDashboardError('');
    } catch (error: any) {
      console.error('Student dashboard load error:', error);
      setDashboardError(error.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate('/login');
      return;
    }

    loadDashboard();

    const handleDashboardRefresh = () => {
      loadDashboard();
    };

    window.addEventListener('studyhero:dashboard-refresh', handleDashboardRefresh);
    return () => window.removeEventListener('studyhero:dashboard-refresh', handleDashboardRefresh);
  }, [navigate, refreshNotifications]);
  
  const handleSubmitQuizCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = quizCode.trim().toUpperCase();
    
    if (!normalizedCode) {
      setQuizCodeError('Please enter a quiz code');
      return;
    }

    try {
      setSubmittingCode(true);
      const quiz = await apiRequest<QuizLookupResponse>(`/api/quiz/code/${normalizedCode}`);
      const mappedQuiz = mapQuiz({ ...quiz, code: quiz.code || normalizedCode });

      setScheduledQuizzes((current) => {
        const exists = current.some((item) => String(item.id) === String(mappedQuiz.id));
        return exists ? current : [mappedQuiz, ...current];
      });

      setQuizCode('');
      setQuizCodeSuccess('Quiz added to your schedule!');
      setQuizCodeError('');
      setShowCodeModal(false);
      window.setTimeout(() => setQuizCodeSuccess(''), 3000);
    } catch (error: any) {
      setQuizCodeError(error.message || 'Invalid quiz code. Please check and try again.');
    } finally {
      setSubmittingCode(false);
    }
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
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
        
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {dashboardError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
              <p className="text-sm text-red-700">{dashboardError}</p>
            </div>
          )}

          {/* Success Notification */}
          {quizCodeSuccess && (
            <div className="fixed top-24 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-md z-50 animate-fadeIn">
              <div className="flex">
                <div className="flex-shrink-0">
                  <i className="ri-checkbox-circle-line text-green-500"></i>
                </div>
                <div className="ml-3">
                  <p className="text-sm">{quizCodeSuccess}</p>
                </div>
                <div className="ml-auto">
                  <button 
                    onClick={() => setQuizCodeSuccess('')}
                    className="text-green-500 hover:text-green-700"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Welcome Section */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h1 className="text-2xl font-bold text-gray-800">Welcome back, Student!</h1>
            <p className="text-gray-600 mt-2">Track your progress and upcoming assignments.</p>
            
            {/* Stats Overview */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-primary/5 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="bg-primary/10 rounded-full p-3 mr-4">
                    <i className="ri-book-open-line text-xl text-primary"></i>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Enrolled Courses</p>
                    <p className="text-2xl font-semibold text-gray-800">{courses.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-accent/5 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="bg-accent/10 rounded-full p-3 mr-4">
                    <i className="ri-task-line text-xl text-accent"></i>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Pending Assignments</p>
                    <p className="text-2xl font-semibold text-gray-800">
                      {assignments.filter(a => !a.completed).length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-warning/5 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="bg-warning/10 rounded-full p-3 mr-4">
                    <i className="ri-calendar-event-line text-xl text-warning"></i>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Upcoming Quizzes</p>
                    <p className="text-2xl font-semibold text-gray-800">{scheduledQuizzes.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-success/5 rounded-lg p-4 cursor-pointer hover:bg-success/10 transition-all" onClick={() => setShowCodeModal(true)}>
                <div className="flex items-center">
                  <div className="bg-success/10 rounded-full p-3 mr-4">
                    <i className="ri-questionnaire-line text-xl text-success"></i>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Enter Quiz Code</p>
                    <p className="text-sm font-medium text-success flex items-center">
                      Access Quiz <i className="ri-arrow-right-line ml-1"></i>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-100 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Learning Progress</h3>
                <div className="space-y-3">
                  {courses.slice(0, 5).map((course) => (
                    <div key={course.id}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{course.title}</span><span>{course.progress}%</span></div>
                      <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-primary rounded-full" style={{ width: `${course.progress}%` }}></div></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Performance</h3>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-success/10 rounded-lg p-3"><p className="text-2xl font-bold text-success">{performance?.averageQuizScore || 0}%</p><p className="text-xs text-gray-500">Avg Quiz</p></div>
                  <div className="bg-primary/10 rounded-lg p-3"><p className="text-2xl font-bold text-primary">{performance?.completedQuizzes || quizHistory.length}</p><p className="text-xs text-gray-500">Quizzes</p></div>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Recent Scores</h3>
                {quizHistory.length === 0 ? <p className="text-sm text-gray-500">No quiz history yet.</p> : (
                  <div className="space-y-2">
                    {quizHistory.slice(0, 4).map((attempt) => (
                      <div key={attempt.id} className="flex items-center justify-between text-sm">
                        <span className="truncate text-gray-700">{attempt.title}</span>
                        <span className="font-semibold text-primary">{Number(attempt.percentage || 0)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Your Courses Section */}
            <div className="lg:col-span-2">
              <div className="mb-10">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Your Courses</h2>
                  <button type="button" onClick={loadDashboard} className="text-primary hover:text-secondary text-sm font-medium">
                    Refresh Courses
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {courses.map(course => (
                    <div key={course.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div 
                        className="h-32 bg-center bg-cover" 
                        style={{ backgroundImage: `url(${course.imageUrl})` }}
                      >
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-gray-800 mb-1">{course.title}</h3>
                        <p className="text-sm text-gray-600 mb-3">Instructor: {course.instructor}</p>
                        
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{course.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`rounded-full h-2 ${
                                course.progress >= 70 ? 'bg-green-500' : 
                                course.progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`} 
                              style={{ width: `${course.progress}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
                          <Link 
                            to={`/course/${course.id}`}
                            className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-md hover:bg-primary/20 transition-colors"
                          >
                            Go to Course
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Upcoming Quizzes */}
              <div className="mb-10">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Upcoming Quizzes</h2>
                  <button type="button" onClick={loadDashboard} className="text-primary hover:text-secondary text-sm font-medium">
                    Refresh Quizzes
                  </button>
                </div>
                
                {scheduledQuizzes.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm p-6 text-center border-2 border-dashed border-gray-200">
                    <i className="ri-calendar-line text-4xl text-gray-300 mb-2"></i>
                    <p className="text-gray-500">No upcoming quizzes.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {scheduledQuizzes.map(quiz => (
                      <QuizCard key={quiz.id} quiz={quiz} />
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Sidebar - Assignments */}
            <div>
              <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Notifications</h2>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{unreadCount} unread</span>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500">No notifications yet.</p>
                ) : (
                  <div className="space-y-3">
                    {notifications.slice(0, 4).map((notification) => (
                      <button key={notification.id} type="button" onClick={() => markRead(notification.id)} className={`w-full text-left border rounded-md p-3 ${notification.readAt ? 'border-gray-100 bg-white' : 'border-primary/20 bg-primary/5'}`}>
                        <p className="text-sm font-medium text-gray-800">{notification.title}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notification.message}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Upcoming Assignments</h2>
                
                {assignments.filter(a => !a.completed).length === 0 ? (
                  <div className="text-center py-8">
                    <i className="ri-task-line text-4xl text-gray-300 mb-2"></i>
                    <p className="text-gray-500">No pending assignments</p>
                    <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignments
                      .filter(a => !a.completed)
                      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                      .map(assignment => (
                        <div key={assignment.id} className="border-b border-gray-100 pb-4 last:border-0">
                          <div className="flex justify-between">
                            <h3 className="font-medium text-gray-800">{assignment.title}</h3>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">Course: {assignment.course}</p>
                          
                          <div className="flex justify-between items-center mt-3">
                            <p className={`text-xs ${
                              new Date(assignment.dueDate) < new Date() 
                                ? 'text-red-500 font-medium' 
                                : 'text-gray-500'
                            }`}>
                              Due: {new Date(assignment.dueDate).toLocaleDateString()}
                            </p>
                            <Link 
                              to={`/assignment/${assignment.id}`}
                              className="text-sm text-primary hover:text-secondary font-medium"
                            >
                              View Details
                            </Link>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
                
                <div className="mt-8 border-t border-gray-100 pt-4">
                  <h3 className="font-medium text-gray-700 mb-3">Completed Assignments</h3>
                  
                  {assignments.filter(a => a.completed).length === 0 ? (
                    <p className="text-sm text-gray-500">No completed assignments yet</p>
                  ) : (
                    <div className="space-y-3">
                      {assignments
                        .filter(a => a.completed)
                        .map(assignment => (
                          <div key={assignment.id} className="flex justify-between items-center">
                            <div className="flex items-center">
                              <i className="ri-checkbox-circle-fill text-green-500 mr-2"></i>
                              <span className="text-sm text-gray-700">{assignment.title}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {assignment.course}
                            </span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Quiz Code Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Enter Quiz Code</h3>
              <button 
                onClick={() => {
                  setShowCodeModal(false);
                  setQuizCode('');
                  setQuizCodeError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            
            <p className="text-gray-600 mb-4">
              Enter the 6-character code provided by your teacher to access the quiz.
            </p>
            
            {quizCodeError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <i className="ri-error-warning-fill text-red-500"></i>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{quizCodeError}</p>
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmitQuizCode}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quiz Code
                </label>
                <input
                  type="text"
                  value={quizCode}
                  onChange={(e) => {
                    const sanitizedInput = e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 6);
                    setQuizCode(sanitizedInput);
                    setQuizCodeError('');
                  }}
                  autoFocus
                  placeholder="XXXXXX"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-center font-mono text-xl tracking-wider uppercase"
                  style={{ letterSpacing: '0.5em' }}
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCodeModal(false);
                    setQuizCode('');
                    setQuizCodeError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 mr-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCode}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-70"
                >
                  {submittingCode ? 'Checking...' : 'Access Quiz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
};

export default StudentDashboardPage;
