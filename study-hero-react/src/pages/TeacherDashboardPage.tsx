import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FileUploader from '../components/FileUploader';
import QuizManager from '../components/QuizManager';
import { apiRequest, getAuthToken } from '../services/api';

interface Course {
  id: number;
  title: string;
  students: number;
  imageUrl: string;
  lastUpdated: string;
}

interface Student {
  id: number;
  name: string;
  email: string;
  progress: number;
  avatar: string;
}

interface Assignment {
  id: number;
  title: string;
  dueDate: string;
  course: string;
  submissions: number;
  totalStudents: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  isActive?: boolean;
  scheduledDate?: string;
  duration?: number;
  preventTabSwitch?: boolean;
  randomizeQuestions?: boolean;
  showOneQuestionAtATime?: boolean;
  requireWebcam?: boolean;
  passingScore?: number;
  quizCode?: string;
}

interface StoredQuiz {
  id: string;
  title: string;
  description: string;
  questionCount: number;
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
  settings: {
    timeLimit: number;
    preventTabSwitch: boolean;
    randomizeQuestions: boolean;
    showOneQuestionAtATime: boolean;
    requireWebcam: boolean;
  };
  createdAt: string;
  source: string;
}

interface QuizManagerProps {
  quizzes: StoredQuiz[];
  onDelete: (quizId: string) => void;
}

const TeacherDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'generate-quiz' | 'manage-quizzes'>('dashboard');
  const [createdQuizzes, setCreatedQuizzes] = useState<StoredQuiz[]>([]);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [activeView, setActiveView] = useState<'quizCreated' | 'quizPreview'>('quizCreated');
  const [generatedQuiz, setGeneratedQuiz] = useState<StoredQuiz | null>(null);
  
  const loadDashboard = async () => {
    const data = await apiRequest<any>('/api/dashboard/teacher');
    const mappedCourses: Course[] = (data.courses || []).map((course: any) => ({
      id: Number(course.id),
      title: course.title,
      students: Number(course.students || 0),
      imageUrl: 'https://public.readdy.ai/ai/img_res/c2b6a1c2a0a2f01b3cebf7bc4b28df92.jpg',
      lastUpdated: course.updated_at || course.created_at || new Date().toISOString()
    }));

    const mappedAssignments: Assignment[] = (data.assignments || []).map((assignment: any) => ({
      id: Number(assignment.id),
      title: assignment.title,
      dueDate: assignment.due_date || assignment.dueDate || new Date().toISOString(),
      course: assignment.course,
      submissions: Number(assignment.submissions || 0),
      totalStudents: Number(assignment.totalStudents || 0)
    }));

    const mappedQuizzes: StoredQuiz[] = (data.quizzes || []).map((quiz: any) => ({
      id: String(quiz.id),
      title: quiz.title,
      description: quiz.description || '',
      questionCount: Number(quiz.questionCount || 0),
      isActive: quiz.status === 'active',
      scheduledDate: quiz.scheduledDate || undefined,
      duration: Number(quiz.duration || 20),
      preventTabSwitch: true,
      randomizeQuestions: true,
      showOneQuestionAtATime: true,
      requireWebcam: false,
      passingScore: Number(quiz.passingScore || 60),
      quizCode: quiz.code || undefined,
      code: quiz.code || '',
      settings: {
        timeLimit: Number(quiz.duration || 20),
        preventTabSwitch: true,
        randomizeQuestions: true,
        showOneQuestionAtATime: true,
        requireWebcam: false
      },
      createdAt: quiz.createdAt || new Date().toISOString(),
      source: quiz.source || 'manual'
    }));

    setCourses(mappedCourses);
    setStudents(data.students || []);
    setPendingAssignments(mappedAssignments);
    setCreatedQuizzes(mappedQuizzes);
    setQuizzes(mappedQuizzes as unknown as Quiz[]);
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate('/login');
      return;
    }

    loadDashboard()
      .catch((error) => {
        console.error('Failed to load teacher dashboard:', error);
      })
      .finally(() => setLoading(false));

    const handleDashboardRefresh = () => {
      loadDashboard().catch((error) => console.error('Failed to refresh teacher dashboard:', error));
    };

    window.addEventListener('studyhero:dashboard-refresh', handleDashboardRefresh);
    return () => window.removeEventListener('studyhero:dashboard-refresh', handleDashboardRefresh);
  }, [navigate]);

  const handleQuizGenerated = async () => {
    await loadDashboard();
    setCreatingQuiz(false);
    setActiveView('quizCreated');
  };

  const handleActivateQuiz = async (quizId: string, settings: Partial<Quiz>) => {
    const response = await apiRequest<{ quizCode: string }>(`/api/quiz/${quizId}/activate`, {
      method: 'POST',
      body: JSON.stringify({
        scheduledDate: settings.scheduledDate,
        settings: {
          timeLimit: settings.duration || 20,
          preventTabSwitch: settings.preventTabSwitch,
          randomizeQuestions: settings.randomizeQuestions,
          showOneQuestionAtATime: settings.showOneQuestionAtATime,
          requireWebcam: settings.requireWebcam,
          passingScore: settings.passingScore || 60
        }
      })
    });

    await loadDashboard();
    alert(`Quiz activated successfully! Quiz Code: ${response.quizCode}\n\nShare this code with your students.`);
  };

  const handleEditQuiz = async (quizId: string) => {
    const quiz = quizzes.find((item) => String(item.id) === String(quizId));
    if (!quiz) return;

    const title = window.prompt('Quiz title', quiz.title);
    if (title === null) return;

    const description = window.prompt('Quiz description', quiz.description || '');
    if (description === null) return;

    await apiRequest(`/api/quiz/${quizId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        description,
        settings: {
          timeLimit: quiz.duration || 20,
          preventTabSwitch: quiz.preventTabSwitch,
          randomizeQuestions: quiz.randomizeQuestions,
          showOneQuestionAtATime: quiz.showOneQuestionAtATime,
          requireWebcam: quiz.requireWebcam,
          passingScore: quiz.passingScore || 60
        }
      })
    });

    await loadDashboard();
  };

  const handleDeleteQuiz = async (quizId: string) => {
    await apiRequest(`/api/quiz/${quizId}`, { method: 'DELETE' });
    await loadDashboard();
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
          {/* Welcome Section */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Welcome back, Professor!</h1>
                <p className="text-gray-600 mt-2">Manage your courses and monitor student progress.</p>
              </div>
              <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${
                    activeTab === 'dashboard' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-dashboard-line mr-2"></i>
                  Dashboard
                </button>
                <button 
                  onClick={() => setActiveTab('generate-quiz')}
                  className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${
                    activeTab === 'generate-quiz' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-file-upload-line mr-2"></i>
                  Generate Quiz
                </button>
                <button 
                  onClick={() => setActiveTab('manage-quizzes')}
                  className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${
                    activeTab === 'manage-quizzes' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-file-list-3-line mr-2"></i>
                  Manage Quizzes
                </button>
              </div>
            </div>
            
            {activeTab === 'dashboard' && (
              <div>
                {/* Stats Overview */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="bg-primary/10 rounded-full p-3 mr-4">
                        <i className="ri-book-open-line text-xl text-primary"></i>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">Active Courses</p>
                        <p className="text-2xl font-semibold text-gray-800">{courses.length}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-accent/5 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="bg-accent/10 rounded-full p-3 mr-4">
                        <i className="ri-user-line text-xl text-accent"></i>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">Total Students</p>
                        <p className="text-2xl font-semibold text-gray-800">
                          {courses.reduce((acc, course) => acc + course.students, 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-warning/5 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="bg-warning/10 rounded-full p-3 mr-4">
                        <i className="ri-task-line text-xl text-warning"></i>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">Active Assignments</p>
                        <p className="text-2xl font-semibold text-gray-800">{pendingAssignments.length}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-success/5 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="bg-success/10 rounded-full p-3 mr-4">
                        <i className="ri-file-list-3-line text-xl text-success"></i>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">Active Quizzes</p>
                        <p className="text-2xl font-semibold text-gray-800">
                          {quizzes.filter(q => q.isActive).length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Your Courses Section */}
              <div className="lg:col-span-2">
                <div className="mb-10">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Your Courses</h2>
                    <Link to="#" className="text-primary hover:text-secondary text-sm font-medium">
                      View All Courses
                    </Link>
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
                          <h3 className="font-bold text-gray-800 mb-2">{course.title}</h3>
                          <div className="flex justify-between text-sm text-gray-600 mb-3">
                            <span>{course.students} students</span>
                            <span>Last updated: {new Date(course.lastUpdated).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-end">
                            <Link 
                              to={`/course/${course.id}`}
                              className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-md hover:bg-primary/20 transition-colors"
                            >
                              Manage Course
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Student Progress */}
                <div className="mb-10">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Student Progress</h2>
                    <Link to="#" className="text-primary hover:text-secondary text-sm font-medium">
                      View All Students
                    </Link>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Student
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Progress
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {students.map(student => (
                            <tr key={student.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                                    {student.avatar}
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{student.name}</div>
                                    <div className="text-sm text-gray-500">{student.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                                    <div 
                                      className={`h-2.5 rounded-full ${
                                        student.progress >= 70 ? 'bg-green-500' : 
                                        student.progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`} 
                                      style={{ width: `${student.progress}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm text-gray-600">{student.progress}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <Link to={`/student/${student.id}`} className="text-primary hover:text-secondary">
                                  View Details
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sidebar - Assignments */}
              <div>
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Pending Assignments</h2>
                  
                  {pendingAssignments.map(assignment => (
                    <div key={assignment.id} className="border-b border-gray-100 py-4 last:border-0">
                      <div className="flex justify-between">
                        <h3 className="font-medium text-gray-800">{assignment.title}</h3>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Course: {assignment.course}</p>
                      
                      <div className="mt-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Submissions: {assignment.submissions}/{assignment.totalStudents}</span>
                          <span>{Math.round((assignment.submissions / assignment.totalStudents) * 100)}% Complete</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 rounded-full h-2" 
                            style={{ width: `${(assignment.submissions / assignment.totalStudents) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center mt-4">
                        <p className="text-xs text-gray-500">
                          Due: {new Date(assignment.dueDate).toLocaleDateString()}
                        </p>
                        <Link 
                          to={`/assignment/${assignment.id}/review`}
                          className="text-sm text-primary hover:text-secondary font-medium"
                        >
                          Review Submissions
                        </Link>
                      </div>
                    </div>
                  ))}
                  
                  <div className="mt-6 text-center">
                    <Link 
                      to="#"
                      className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                    >
                      <i className="ri-add-line mr-2"></i>
                      Create New Assignment
                    </Link>
                  </div>
                </div>
                
                {/* Active Quizzes Overview */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Active Quizzes</h2>
                  
                  {quizzes.filter(q => q.isActive).length === 0 ? (
                    <div className="text-center py-6">
                      <i className="ri-questionnaire-line text-4xl text-gray-300 mb-2"></i>
                      <p className="text-gray-500">No active quizzes</p>
                      <button 
                        onClick={() => setActiveTab('generate-quiz')}
                        className="mt-4 text-primary hover:text-primary/80"
                      >
                        Generate a quiz
                      </button>
                    </div>
                  ) : (
                    quizzes.filter(q => q.isActive).map(quiz => (
                      <div key={quiz.id} className="border-b border-gray-100 py-4 last:border-0">
                        <div className="flex justify-between">
                          <h3 className="font-medium text-gray-800">{quiz.title}</h3>
                        </div>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">{quiz.description || 'No description'}</p>
                        
                        <div className="flex justify-between items-center mt-4">
                          <p className="text-xs text-gray-500">
                            Scheduled: {new Date(quiz.scheduledDate || '').toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            Duration: {quiz.duration} min
                          </p>
                        </div>
                        
                        <div className="flex justify-between mt-3">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Active
                          </span>
                          <Link 
                            to={`/quiz/${quiz.id}/results`}
                            className="text-sm text-primary hover:text-secondary font-medium"
                          >
                            View Results
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'generate-quiz' && (
            <div className="max-w-3xl mx-auto">
              <FileUploader courses={courses} onQuizGenerated={handleQuizGenerated} />
            </div>
          )}
          
          {activeTab === 'manage-quizzes' && (
            <div className="max-w-4xl mx-auto">
              <QuizManager 
                quizzes={createdQuizzes}
                onDelete={handleDeleteQuiz}
                onDeleteQuiz={handleDeleteQuiz}
                onEditQuiz={handleEditQuiz}
                onActivateQuiz={handleActivateQuiz}
              />
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default TeacherDashboardPage; 