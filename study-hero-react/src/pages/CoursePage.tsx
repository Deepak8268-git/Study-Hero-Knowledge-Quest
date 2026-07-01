import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { apiRequest, getAuthToken } from '../services/api';

interface CourseDetail {
  id: number;
  title: string;
  description?: string;
  teacher_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface AssignmentItem {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  course_title?: string;
}

const CoursePage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/login');
      return;
    }

    const loadCourse = async () => {
      try {
        setLoading(true);
        const [courseData, assignmentData] = await Promise.all([
          apiRequest<CourseDetail>(`/api/courses/${courseId}`),
          apiRequest<AssignmentItem[]>(`/api/assignments/course/${courseId}`)
        ]);
        setCourse(courseData);
        setAssignments(assignmentData);
        setError('');
      } catch (err: any) {
        setError(err.message || 'Unable to load course.');
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [courseId, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {loading ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-600">Loading course...</div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded">{error}</div>
          ) : course && (
            <>
              <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{course.title}</h1>
                <p className="text-gray-600 mt-2">{course.description || 'No description provided'}</p>
                {course.teacher_name && <p className="text-sm text-gray-500 mt-4">Teacher: {course.teacher_name}</p>}
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Assignments</h2>
                {assignments.length === 0 ? (
                  <p className="text-gray-500">No assignments for this course.</p>
                ) : (
                  <div className="space-y-4">
                    {assignments.map((assignment) => (
                      <div key={assignment.id} className="border-b border-gray-100 pb-4 last:border-0">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h3 className="font-medium text-gray-800">{assignment.title}</h3>
                            <p className="text-sm text-gray-500 mt-1">{assignment.description || 'No description provided'}</p>
                            {assignment.due_date && (
                              <p className="text-xs text-gray-500 mt-2">Due: {new Date(assignment.due_date).toLocaleDateString()}</p>
                            )}
                          </div>
                          <Link to={`/assignment/${assignment.id}`} className="text-sm text-primary hover:text-secondary font-medium">
                            View
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CoursePage;