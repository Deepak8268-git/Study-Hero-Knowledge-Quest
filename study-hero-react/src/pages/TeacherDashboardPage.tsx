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
  description?: string;
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

interface EnrolledStudent {
  id: number;
  username: string;
  email: string;
  status: string;
  enrollment_date?: string;
}

interface Assignment {
  id: number;
  title: string;
  description?: string;
  dueDate: string;
  course: string;
  course_id?: number;
  submissions: number;
  totalStudents: number;
  status?: string;
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

interface Submission {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  submission_text?: string;
  submission_file?: string;
  grade?: number | null;
  feedback?: string | null;
  status: string;
  submitted_at?: string;
}

type Tab = 'dashboard' | 'generate-quiz' | 'manage-quizzes';
type CourseForm = { id?: number; title: string; description: string };
type AssignmentForm = { id?: number; course_id: string; title: string; description: string; due_date: string };

const emptyCourseForm: CourseForm = { title: '', description: '' };
const emptyAssignmentForm: AssignmentForm = { course_id: '', title: '', description: '', due_date: '' };

const TeacherDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [createdQuizzes, setCreatedQuizzes] = useState<StoredQuiz[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [courseForm, setCourseForm] = useState<CourseForm | null>(null);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [enrollmentCourse, setEnrollmentCourse] = useState<Course | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [enrollmentEmail, setEnrollmentEmail] = useState('');
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 4500);
  };

  const mapQuiz = (quiz: any): StoredQuiz => ({
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
  });

  const loadDashboard = async () => {
    const data = await apiRequest<any>('/api/dashboard/teacher');
    setCourses((data.courses || []).map((course: any) => ({
      id: Number(course.id),
      title: course.title,
      description: course.description || '',
      students: Number(course.students || 0),
      imageUrl: 'https://public.readdy.ai/ai/img_res/c2b6a1c2a0a2f01b3cebf7bc4b28df92.jpg',
      lastUpdated: course.updated_at || course.created_at || new Date().toISOString()
    })));
    setStudents(data.students || []);
    setPendingAssignments((data.assignments || []).map((assignment: any) => ({
      id: Number(assignment.id),
      title: assignment.title,
      description: assignment.description || '',
      dueDate: assignment.due_date || assignment.dueDate || new Date().toISOString(),
      course: assignment.course,
      course_id: Number(assignment.course_id || 0),
      submissions: Number(assignment.submissions || 0),
      totalStudents: Number(assignment.totalStudents || 0),
      status: assignment.status || 'published'
    })));
    setCreatedQuizzes((data.quizzes || []).map(mapQuiz));
  };

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/login');
      return;
    }

    loadDashboard()
      .catch((error) => {
        console.error('Failed to load teacher dashboard:', error);
        showToast('error', error.message || 'Failed to load teacher dashboard.');
      })
      .finally(() => setLoading(false));

    const handleDashboardRefresh = () => {
      loadDashboard().catch((error) => console.error('Failed to refresh teacher dashboard:', error));
    };

    window.addEventListener('studyhero:dashboard-refresh', handleDashboardRefresh);
    return () => window.removeEventListener('studyhero:dashboard-refresh', handleDashboardRefresh);
  }, [navigate]);

  const runMutation = async (action: () => Promise<void>, success: string) => {
    try {
      setSaving(true);
      await action();
      await loadDashboard();
      showToast('success', success);
    } catch (error: any) {
      showToast('error', error.message || 'Action failed.');
    } finally {
      setSaving(false);
    }
  };

  const saveCourse = async () => {
    if (!courseForm?.title.trim()) return showToast('error', 'Course title is required.');
    await runMutation(async () => {
      if (courseForm.id) {
        await apiRequest(`/api/courses/${courseForm.id}`, { method: 'PUT', body: JSON.stringify(courseForm) });
      } else {
        await apiRequest('/api/courses', { method: 'POST', body: JSON.stringify(courseForm) });
      }
      setCourseForm(null);
    }, courseForm.id ? 'Course updated.' : 'Course created.');
  };

  const deleteCourse = async (course: Course) => {
    if (!window.confirm(`Delete course "${course.title}"? This cannot be undone.`)) return;
    await runMutation(async () => {
      await apiRequest(`/api/courses/${course.id}`, { method: 'DELETE' });
    }, 'Course deleted.');
  };

  const openEnrollmentManager = async (course: Course) => {
    setEnrollmentCourse(course);
    setEnrollmentEmail('');
    setEnrollmentLoading(true);
    try {
      const students = await apiRequest<EnrolledStudent[]>(`/api/courses/${course.id}/enrollments`);
      setEnrolledStudents(students);
    } catch (error: any) {
      showToast('error', error.message || 'Failed to load enrolled students.');
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const enrollStudent = async () => {
    if (!enrollmentCourse || !enrollmentEmail.trim()) return showToast('error', 'Student email is required.');
    try {
      setEnrollmentLoading(true);
      await apiRequest(`/api/courses/${enrollmentCourse.id}/enrollments`, {
        method: 'POST',
        body: JSON.stringify({ email: enrollmentEmail.trim() })
      });
      const students = await apiRequest<EnrolledStudent[]>(`/api/courses/${enrollmentCourse.id}/enrollments`);
      setEnrolledStudents(students);
      setEnrollmentEmail('');
      await loadDashboard();
      showToast('success', 'Student enrolled.');
    } catch (error: any) {
      showToast('error', error.message || 'Failed to enroll student.');
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const removeEnrollment = async (student: EnrolledStudent) => {
    if (!enrollmentCourse || !window.confirm(`Remove ${student.email} from ${enrollmentCourse.title}?`)) return;
    try {
      setEnrollmentLoading(true);
      await apiRequest(`/api/courses/${enrollmentCourse.id}/enrollments/${student.id}`, { method: 'DELETE' });
      const students = await apiRequest<EnrolledStudent[]>(`/api/courses/${enrollmentCourse.id}/enrollments`);
      setEnrolledStudents(students);
      await loadDashboard();
      showToast('success', 'Student removed from course.');
    } catch (error: any) {
      showToast('error', error.message || 'Failed to remove student.');
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const saveAssignment = async () => {
    if (!assignmentForm?.course_id || !assignmentForm.title.trim()) return showToast('error', 'Course and assignment title are required.');
    await runMutation(async () => {
      const payload = {
        course_id: Number(assignmentForm.course_id),
        title: assignmentForm.title,
        description: assignmentForm.description,
        due_date: assignmentForm.due_date || null
      };
      if (assignmentForm.id) {
        await apiRequest(`/api/assignments/${assignmentForm.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/assignments', { method: 'POST', body: JSON.stringify(payload) });
      }
      setAssignmentForm(null);
    }, assignmentForm.id ? 'Assignment updated.' : 'Assignment created.');
  };

  const publishAssignment = async (assignment: Assignment) => {
    await runMutation(async () => {
      await apiRequest(`/api/lms/assignments/${assignment.id}/publish`, { method: 'PATCH' });
    }, 'Assignment published.');
  };

  const deleteAssignment = async (assignment: Assignment) => {
    if (!window.confirm(`Delete assignment "${assignment.title}"?`)) return;
    await runMutation(async () => {
      await apiRequest(`/api/assignments/${assignment.id}`, { method: 'DELETE' });
    }, 'Assignment deleted.');
  };

  const openSubmissions = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setSubmissionLoading(true);
    try {
      const data = await apiRequest<Submission[]>(`/api/assignments/${assignment.id}/submissions`);
      setSubmissions(data);
    } catch (error: any) {
      showToast('error', error.message || 'Failed to load submissions.');
    } finally {
      setSubmissionLoading(false);
    }
  };

  const gradeSubmission = async (submission: Submission) => {
    const grade = window.prompt('Grade', submission.grade === null || submission.grade === undefined ? '' : String(submission.grade));
    if (grade === null) return;
    const feedback = window.prompt('Feedback', submission.feedback || '') || '';
    await runMutation(async () => {
      await apiRequest(`/api/assignments/submissions/${submission.id}/grade`, {
        method: 'PATCH',
        body: JSON.stringify({ grade: Number(grade), feedback })
      });
      if (selectedAssignment) {
        const data = await apiRequest<Submission[]>(`/api/assignments/${selectedAssignment.id}/submissions`);
        setSubmissions(data);
      }
    }, 'Submission graded.');
  };

  const handleActivateQuiz = async (quizId: string, settings: Partial<StoredQuiz>) => {
    await runMutation(async () => {
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
      showToast('success', `Quiz published. Code: ${response.quizCode}`);
    }, 'Quiz published.');
  };

  const handleDeactivateQuiz = async (quizId: string) => {
    await runMutation(async () => {
      await apiRequest(`/api/quiz/${quizId}/deactivate`, { method: 'POST' });
    }, 'Quiz deactivated.');
  };

  const handleEditQuiz = async (quizId: string) => {
    const quiz = createdQuizzes.find((item) => item.id === quizId);
    if (!quiz) return;
    const title = window.prompt('Quiz title', quiz.title);
    if (title === null) return;
    const description = window.prompt('Quiz description', quiz.description || '');
    if (description === null) return;
    await runMutation(async () => {
      await apiRequest(`/api/quiz/${quizId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, description, settings: { timeLimit: quiz.duration || 20, passingScore: quiz.passingScore || 60 } })
      });
    }, 'Quiz updated.');
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!window.confirm('Archive this quiz?')) return;
    await runMutation(async () => {
      await apiRequest(`/api/quiz/${quizId}`, { method: 'DELETE' });
    }, 'Quiz archived.');
  };

  const handleDuplicateQuiz = async (quizId: string) => {
    await runMutation(async () => {
      await apiRequest(`/api/quiz/${quizId}/duplicate`, { method: 'POST' });
    }, 'Quiz duplicated.');
  };

  const handleGenerateCode = async (quizId: string) => {
    await runMutation(async () => {
      const response = await apiRequest<{ quizCode: string }>(`/api/quiz/${quizId}/code`, { method: 'POST' });
      showToast('success', `Quiz code generated: ${response.quizCode}`);
    }, 'Quiz code generated.');
  };

  const startAssignmentCreate = () => {
    if (courses.length === 0) return showToast('error', 'Create a course before creating assignments.');
    setAssignmentForm({ ...emptyAssignmentForm, course_id: String(courses[0].id) });
  };

  if (loading) {
    return <div className="min-h-screen flex flex-col bg-gray-50"><Header /><div className="flex-grow flex items-center justify-center"><div className="flex flex-col items-center"><div className="animate-spin mb-4"><i className="ri-loader-4-line text-4xl text-primary"></i></div><p className="text-gray-600">Loading your dashboard...</p></div></div><Footer /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {toast && <div className={`fixed top-24 right-4 z-50 px-4 py-3 rounded shadow-lg text-sm ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{toast.message}</div>}

          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Welcome back, Professor!</h1>
                <p className="text-gray-600 mt-2">Manage your courses and monitor student progress.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => setActiveTab('dashboard')} className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${activeTab === 'dashboard' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><i className="ri-dashboard-line mr-2"></i>Dashboard</button>
                <button onClick={() => setActiveTab('generate-quiz')} className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${activeTab === 'generate-quiz' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><i className="ri-file-upload-line mr-2"></i>Generate Quiz</button>
                <button onClick={() => setActiveTab('manage-quizzes')} className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${activeTab === 'manage-quizzes' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><i className="ri-file-list-3-line mr-2"></i>Manage Quizzes</button>
              </div>
            </div>

            {activeTab === 'dashboard' && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard icon="ri-book-open-line" label="Active Courses" value={courses.length} tone="primary" />
                <StatCard icon="ri-user-line" label="Total Students" value={courses.reduce((acc, course) => acc + course.students, 0)} tone="accent" />
                <StatCard icon="ri-task-line" label="Active Assignments" value={pendingAssignments.length} tone="warning" />
                <StatCard icon="ri-file-list-3-line" label="Active Quizzes" value={createdQuizzes.filter((quiz) => quiz.isActive).length} tone="success" />
              </div>
            )}
          </div>

          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <section className="mb-10">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Your Courses</h2>
                    <button onClick={() => setCourseForm(emptyCourseForm)} className="text-primary hover:text-secondary text-sm font-medium"><i className="ri-add-line mr-1"></i>Create Course</button>
                  </div>

                  {courses.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-md p-8 text-center">
                      <i className="ri-book-open-line text-5xl text-gray-300 block mb-3"></i>
                      <h3 className="text-lg font-semibold text-gray-800">No courses yet.</h3>
                      <p className="text-gray-600 mt-2">Create your first course to start generating quizzes and assignments.</p>
                      <button onClick={() => setCourseForm(emptyCourseForm)} className="mt-5 inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"><i className="ri-add-line mr-2"></i>Create Course</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {courses.map((course) => (
                        <article key={course.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                          <div className="h-32 bg-center bg-cover" style={{ backgroundImage: `url(${course.imageUrl})` }}></div>
                          <div className="p-4">
                            <h3 className="font-bold text-gray-800 mb-2">{course.title}</h3>
                            <p className="text-sm text-gray-500 line-clamp-2 mb-3">{course.description || 'No description provided'}</p>
                            <div className="flex justify-between text-sm text-gray-600 mb-3"><span>{course.students} students</span><span>{new Date(course.lastUpdated).toLocaleDateString()}</span></div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Link to={`/course/${course.id}`} className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-md hover:bg-primary/20">Open</Link>
                              <button onClick={() => openEnrollmentManager(course)} className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-md hover:bg-green-100">Enroll</button>
                              <button onClick={() => setCourseForm({ id: course.id, title: course.title, description: course.description || '' })} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200">Edit</button>
                              <button onClick={() => deleteCourse(course)} disabled={saving} className="px-3 py-1 bg-red-50 text-red-600 text-sm rounded-md hover:bg-red-100 disabled:opacity-60">Delete</button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="mb-10">
                  <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-gray-800">Student Progress</h2><button onClick={() => loadDashboard()} className="text-primary hover:text-secondary text-sm font-medium">Refresh</button></div>
                  <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    {students.length === 0 ? <div className="p-8 text-center text-gray-500">No enrolled students yet.</div> : (
                      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{students.map((student) => <tr key={student.id}><td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">{student.avatar}</div><div className="ml-4"><div className="text-sm font-medium text-gray-900">{student.name}</div><div className="text-sm text-gray-500">{student.email}</div></div></div></td><td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="w-full bg-gray-200 rounded-full h-2.5 mr-2"><div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${student.progress}%` }}></div></div><span className="text-sm text-gray-600">{student.progress}%</span></div></td></tr>)}</tbody></table></div>
                    )}
                  </div>
                </section>
              </div>

              <aside>
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                  <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-gray-800">Assignments</h2><button onClick={startAssignmentCreate} className="text-primary hover:text-secondary text-sm font-medium"><i className="ri-add-line mr-1"></i>Create</button></div>
                  {pendingAssignments.length === 0 ? <div className="text-center py-6 text-gray-500">No assignments yet.</div> : pendingAssignments.map((assignment) => (
                    <div key={assignment.id} className="border-b border-gray-100 py-4 last:border-0">
                      <h3 className="font-medium text-gray-800">{assignment.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">Course: {assignment.course}</p>
                      <div className="mt-4"><div className="flex justify-between text-xs text-gray-500 mb-1"><span>Submissions: {assignment.submissions}/{assignment.totalStudents}</span><span>{assignment.totalStudents ? Math.round((assignment.submissions / assignment.totalStudents) * 100) : 0}% Complete</span></div><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-500 rounded-full h-2" style={{ width: `${assignment.totalStudents ? (assignment.submissions / assignment.totalStudents) * 100 : 0}%` }}></div></div></div>
                      <p className="text-xs text-gray-500 mt-3">Due: {new Date(assignment.dueDate).toLocaleDateString()}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Link to={`/assignment/${assignment.id}/review`} className="text-sm text-primary hover:text-secondary font-medium">Open</Link>
                        <button onClick={() => setAssignmentForm({ id: assignment.id, course_id: String(assignment.course_id || courses[0]?.id || ''), title: assignment.title, description: assignment.description || '', due_date: assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 10) : '' })} className="text-sm text-gray-600 hover:text-gray-800">Edit</button>
                        <button onClick={() => publishAssignment(assignment)} className="text-sm text-green-600 hover:text-green-700">Publish</button>
                        <button onClick={() => openSubmissions(assignment)} className="text-sm text-blue-600 hover:text-blue-700">Submissions</button>
                        <button onClick={() => deleteAssignment(assignment)} className="text-sm text-red-600 hover:text-red-700">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Active Quizzes</h2>
                  {createdQuizzes.filter((quiz) => quiz.isActive).length === 0 ? <div className="text-center py-6"><i className="ri-questionnaire-line text-4xl text-gray-300 mb-2"></i><p className="text-gray-500">No active quizzes</p><button onClick={() => setActiveTab('generate-quiz')} className="mt-4 text-primary hover:text-primary/80">Generate a quiz</button></div> : createdQuizzes.filter((quiz) => quiz.isActive).map((quiz) => <div key={quiz.id} className="border-b border-gray-100 py-4 last:border-0"><h3 className="font-medium text-gray-800">{quiz.title}</h3><p className="text-sm text-gray-500 mt-1 line-clamp-1">{quiz.description || 'No description'}</p><div className="flex justify-between mt-3"><span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Active</span><Link to={`/quiz/${quiz.id}/results`} className="text-sm text-primary hover:text-secondary font-medium">Results</Link></div></div>)}
                </div>
              </aside>
            </div>
          )}

          {activeTab === 'generate-quiz' && <div className="max-w-3xl mx-auto"><FileUploader courses={courses} onQuizGenerated={loadDashboard} /></div>}
          {activeTab === 'manage-quizzes' && <div className="max-w-4xl mx-auto"><QuizManager quizzes={createdQuizzes} onActivateQuiz={handleActivateQuiz} onDeactivateQuiz={handleDeactivateQuiz} onEditQuiz={handleEditQuiz} onDeleteQuiz={handleDeleteQuiz} onDuplicateQuiz={handleDuplicateQuiz} onGenerateCode={handleGenerateCode} /></div>}
        </div>
      </main>
      <Footer />

      {courseForm && <Modal title={courseForm.id ? 'Edit Course' : 'Create Course'} onClose={() => setCourseForm(null)}><div className="space-y-4"><input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Course title" /><textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} rows={4} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Description" /><button onClick={saveCourse} disabled={saving} className="w-full px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">{saving ? 'Saving...' : 'Save Course'}</button></div></Modal>}

      {enrollmentCourse && <Modal title={`Enroll Students: ${enrollmentCourse.title}`} onClose={() => setEnrollmentCourse(null)}><div className="space-y-4"><div className="flex gap-2"><input value={enrollmentEmail} onChange={(e) => setEnrollmentEmail(e.target.value)} className="flex-1 border border-gray-300 rounded-md px-3 py-2" placeholder="Student email" /><button onClick={enrollStudent} disabled={enrollmentLoading} className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">{enrollmentLoading ? 'Saving...' : 'Enroll'}</button></div>{enrollmentLoading && enrolledStudents.length === 0 ? <p className="text-sm text-gray-500">Loading students...</p> : enrolledStudents.length === 0 ? <p className="text-sm text-gray-500">No students enrolled yet.</p> : <div className="space-y-2">{enrolledStudents.map((student) => <div key={student.id} className="flex items-center justify-between border border-gray-100 rounded-md p-3"><div><p className="font-medium text-gray-800">{student.username}</p><p className="text-xs text-gray-500">{student.email} - {student.status}</p></div><button onClick={() => removeEnrollment(student)} disabled={enrollmentLoading} className="text-sm text-red-600 hover:text-red-700 disabled:opacity-60">Remove</button></div>)}</div>}</div></Modal>}

      {assignmentForm && <Modal title={assignmentForm.id ? 'Edit Assignment' : 'Create Assignment'} onClose={() => setAssignmentForm(null)}><div className="space-y-4"><select value={assignmentForm.course_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, course_id: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2"><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select><input value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Assignment title" /><textarea value={assignmentForm.description} onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })} rows={4} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Description" /><input type="date" value={assignmentForm.due_date} onChange={(e) => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" /><button onClick={saveAssignment} disabled={saving} className="w-full px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">{saving ? 'Saving...' : 'Save Assignment'}</button></div></Modal>}

      {selectedAssignment && <Modal title={`Submissions: ${selectedAssignment.title}`} onClose={() => setSelectedAssignment(null)}><div className="space-y-4">{submissionLoading ? <p className="text-gray-500">Loading submissions...</p> : submissions.length === 0 ? <p className="text-gray-500">No submissions yet.</p> : submissions.map((submission) => <article key={submission.id} className="border border-gray-100 rounded-md p-3"><div className="flex justify-between gap-3"><div><h3 className="font-medium text-gray-800">{submission.student_name}</h3><p className="text-xs text-gray-500">{submission.student_email}</p></div><span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded h-fit">{submission.status}</span></div><p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{submission.submission_text || submission.submission_file || 'No submission text provided.'}</p><p className="text-sm text-gray-500 mt-2">Grade: {submission.grade ?? 'Not graded'}</p>{submission.feedback && <p className="text-sm text-gray-500 mt-1">Feedback: {submission.feedback}</p>}<button onClick={() => gradeSubmission(submission)} className="mt-3 px-3 py-1 bg-primary text-white text-sm rounded-md">Grade / Feedback</button></article>)}</div></Modal>}
    </div>
  );
};

const statToneClasses: Record<string, { card: string; bubble: string; icon: string }> = {
  primary: { card: 'bg-primary/5', bubble: 'bg-primary/10', icon: 'text-primary' },
  accent: { card: 'bg-accent/5', bubble: 'bg-accent/10', icon: 'text-accent' },
  warning: { card: 'bg-warning/5', bubble: 'bg-warning/10', icon: 'text-warning' },
  success: { card: 'bg-success/5', bubble: 'bg-success/10', icon: 'text-success' }
};

const StatCard: React.FC<{ icon: string; label: string; value: number; tone: string }> = ({ icon, label, value, tone }) => {
  const classes = statToneClasses[tone] || statToneClasses.primary;
  return (
    <div className={`${classes.card} rounded-lg p-4`}><div className="flex items-center"><div className={`${classes.bubble} rounded-full p-3 mr-4`}><i className={`${icon} text-xl ${classes.icon}`}></i></div><div><p className="text-gray-600 text-sm">{label}</p><p className="text-2xl font-semibold text-gray-800">{value}</p></div></div></div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-gray-800">{title}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ri-close-line text-2xl"></i></button></div>
      {children}
    </div>
  </div>
);

export default TeacherDashboardPage;


