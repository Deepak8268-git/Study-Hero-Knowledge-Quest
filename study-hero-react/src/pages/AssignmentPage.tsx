import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { apiRequest, getAuthToken } from '../services/api';

interface AssignmentDetail {
  id: number;
  course_id: number;
  title: string;
  description?: string;
  due_date?: string;
  course_title?: string;
}

const AssignmentPage: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/login');
      return;
    }

    const loadAssignment = async () => {
      try {
        setLoading(true);
        const data = await apiRequest<AssignmentDetail>(`/api/assignments/${assignmentId}`);
        setAssignment(data);
        setError('');
      } catch (err: any) {
        setError(err.message || 'Unable to load assignment.');
      } finally {
        setLoading(false);
      }
    };

    loadAssignment();
  }, [assignmentId, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          {loading ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-600">Loading assignment...</div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded">{error}</div>
          ) : assignment && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="mb-4">
                <Link to={`/course/${assignment.course_id}`} className="text-sm text-primary hover:text-secondary font-medium">
                  Back to course
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-gray-800">{assignment.title}</h1>
              {assignment.course_title && <p className="text-sm text-gray-500 mt-1">Course: {assignment.course_title}</p>}
              <p className="text-gray-600 mt-4">{assignment.description || 'No description provided'}</p>
              {assignment.due_date && (
                <p className="text-sm text-gray-500 mt-6">Due: {new Date(assignment.due_date).toLocaleDateString()}</p>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AssignmentPage;