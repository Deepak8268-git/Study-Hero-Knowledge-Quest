import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { apiRequest, getAuthToken } from '../services/api';

interface QuizAttempt {
  id: number;
  studentName: string;
  studentEmail: string;
  score: number;
  total_questions: number;
  percentage: number;
  submitted_at: string;
  violations?: string;
}

const QuizResultsPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/login');
      return;
    }

    apiRequest<QuizAttempt[]>(`/api/quiz/${quizId}/results`)
      .then(setAttempts)
      .catch((err: any) => setError(err.message || 'Unable to load quiz results.'))
      .finally(() => setLoading(false));
  }, [quizId, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="mb-4"><Link to="/teacher-dashboard" className="text-sm text-primary hover:text-secondary font-medium">Back to dashboard</Link></div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Quiz Results</h1>
            {loading ? <p className="text-gray-500">Loading results...</p> : error ? <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded">{error}</div> : attempts.length === 0 ? <p className="text-gray-500">No submitted attempts yet.</p> : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Violations</th></tr></thead>
                  <tbody className="bg-white divide-y divide-gray-200">{attempts.map((attempt) => <tr key={attempt.id}><td className="px-4 py-3"><div className="font-medium text-gray-800">{attempt.studentName}</div><div className="text-xs text-gray-500">{attempt.studentEmail}</div></td><td className="px-4 py-3 text-sm text-gray-700">{attempt.score}/{attempt.total_questions} ({attempt.percentage}%)</td><td className="px-4 py-3 text-sm text-gray-500">{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : 'Not submitted'}</td><td className="px-4 py-3 text-sm text-gray-500">{attempt.violations || 'None'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default QuizResultsPage;
