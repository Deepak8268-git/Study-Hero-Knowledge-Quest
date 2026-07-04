import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { apiRequest, getAuthRole, getAuthToken } from '../services/api';

interface AssignmentDetail {
  id: number;
  course_id: number;
  title: string;
  description?: string;
  due_date?: string;
  course_title?: string;
}

interface Submission {
  id: number;
  student_name?: string;
  student_email?: string;
  submission_text?: string;
  submission_file?: string;
  grade?: number | null;
  feedback?: string | null;
  status: string;
  submitted_at?: string;
}

const AssignmentPage: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const role = getAuthRole();
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFile, setSubmissionFile] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAssignment = async () => {
    const data = await apiRequest<AssignmentDetail>(`/api/assignments/${assignmentId}`);
    setAssignment(data);
    if (role === 'teacher') {
      setSubmissions(await apiRequest<Submission[]>(`/api/assignments/${assignmentId}/submissions`));
    }
    if (role === 'student') {
      const submission = await apiRequest<Submission | null>(`/api/assignments/${assignmentId}/my-submission`);
      setMySubmission(submission);
      setSubmissionText(submission?.submission_text || '');
      setSubmissionFile(submission?.submission_file || '');
    }
  };

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/login');
      return;
    }

    loadAssignment()
      .catch((err: any) => setError(err.message || 'Unable to load assignment.'))
      .finally(() => setLoading(false));
  }, [assignmentId, navigate, role]);

  const submitAssignment = async () => {
    if (!submissionText.trim() && !submissionFile.trim()) {
      setError('Add submission text or a file link before submitting.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await apiRequest(`/api/assignments/${assignmentId}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ submission_text: submissionText, submission_file: submissionFile })
      });
      await loadAssignment();
      setSuccess('Assignment submitted successfully.');
    } catch (err: any) {
      setError(err.message || 'Unable to submit assignment.');
    } finally {
      setSaving(false);
    }
  };

  const gradeSubmission = async (submission: Submission) => {
    const grade = window.prompt('Grade', submission.grade === null || submission.grade === undefined ? '' : String(submission.grade));
    if (grade === null) return;
    const feedback = window.prompt('Feedback', submission.feedback || '') || '';
    try {
      setSaving(true);
      setError('');
      await apiRequest(`/api/assignments/submissions/${submission.id}/grade`, {
        method: 'PATCH',
        body: JSON.stringify({ grade: Number(grade), feedback })
      });
      await loadAssignment();
      setSuccess('Submission graded successfully.');
    } catch (err: any) {
      setError(err.message || 'Unable to grade submission.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {loading ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-600">Loading assignment...</div>
          ) : error && !assignment ? (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded">{error}</div>
          ) : assignment && (
            <div className="space-y-6">
              {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded">{error}</div>}
              {success && <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded">{success}</div>}

              <section className="bg-white rounded-xl shadow-md p-6">
                <div className="mb-4"><Link to={`/course/${assignment.course_id}`} className="text-sm text-primary hover:text-secondary font-medium">Back to course</Link></div>
                <h1 className="text-2xl font-bold text-gray-800">{assignment.title}</h1>
                {assignment.course_title && <p className="text-sm text-gray-500 mt-1">Course: {assignment.course_title}</p>}
                <p className="text-gray-600 mt-4 whitespace-pre-wrap">{assignment.description || 'No description provided'}</p>
                {assignment.due_date && <p className="text-sm text-gray-500 mt-6">Due: {new Date(assignment.due_date).toLocaleDateString()}</p>}
              </section>

              {role === 'student' && (
                <section className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Your Submission</h2>
                  {mySubmission && <div className="mb-4 bg-gray-50 border border-gray-100 rounded-md p-3 text-sm text-gray-600">Status: {mySubmission.status} {mySubmission.grade !== null && mySubmission.grade !== undefined ? `- Grade: ${mySubmission.grade}` : ''}{mySubmission.feedback ? ` - Feedback: ${mySubmission.feedback}` : ''}</div>}
                  <textarea value={submissionText} onChange={(e) => setSubmissionText(e.target.value)} rows={6} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Write your submission..." />
                  <input value={submissionFile} onChange={(e) => setSubmissionFile(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 mt-3" placeholder="Optional file URL" />
                  <button onClick={submitAssignment} disabled={saving} className="mt-4 px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">{saving ? 'Submitting...' : mySubmission ? 'Resubmit Assignment' : 'Submit Assignment'}</button>
                </section>
              )}

              {role === 'teacher' && (
                <section className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Student Submissions</h2>
                  {submissions.length === 0 ? <p className="text-gray-500">No submissions yet.</p> : <div className="space-y-4">{submissions.map((submission) => <article key={submission.id} className="border border-gray-100 rounded-md p-4"><div className="flex justify-between gap-3"><div><h3 className="font-medium text-gray-800">{submission.student_name}</h3><p className="text-xs text-gray-500">{submission.student_email}</p></div><span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded h-fit">{submission.status}</span></div><p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{submission.submission_text || submission.submission_file || 'No submission text provided.'}</p><p className="text-sm text-gray-500 mt-2">Grade: {submission.grade ?? 'Not graded'}</p>{submission.feedback && <p className="text-sm text-gray-500 mt-1">Feedback: {submission.feedback}</p>}<button onClick={() => gradeSubmission(submission)} disabled={saving} className="mt-3 px-3 py-1 bg-primary text-white text-sm rounded-md disabled:opacity-60">Grade / Feedback</button></article>)}</div>}
                </section>
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
