import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SkeletonBlock from '../components/LoadingStates';
import EmptyState from '../components/EmptyState';
import { API_BASE_URL, apiRequest, getAuthRole, getAuthToken } from '../services/api';

interface AnalyticsPayload {
  role: 'teacher' | 'student';
  summary: Record<string, any>;
  studentPerformance?: any[];
  quizAnalytics?: any[];
  assignmentAnalytics?: any[];
  courseAnalytics?: any[];
  charts?: { weekly?: any[]; monthly?: any[] };
  atRiskStudents?: any[];
  aiAnalytics?: any;
  topics?: { weak?: any[]; strong?: any[] };
  recentAttempts?: any[];
  recentAssignments?: any[];
  leaderboard?: any;
  generatedAt?: string;
}

const reportTypes = ['student', 'course', 'quiz', 'assignment', 'attendance', 'performance'];
const formats = ['csv', 'pdf', 'excel'];

const AnalyticsPage: React.FC = () => {
  const role = getAuthRole();
  const isTeacher = role === 'teacher';
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardScope, setLeaderboardScope] = useState('weekly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const endpoint = isTeacher ? '/api/analytics/teacher' : '/api/analytics/student';

  const loadAnalytics = async () => {
    if (!getAuthToken()) return;
    setLoading(true);
    setError('');
    try {
      const [analyticsData, leaderboardData] = await Promise.all([
        apiRequest<AnalyticsPayload>(endpoint),
        apiRequest<any[]>(`/api/analytics/leaderboards?scope=${leaderboardScope}`)
      ]);
      setPayload(analyticsData);
      setLeaderboard(leaderboardData);
    } catch (err: any) {
      setError(err.message || 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAnalytics(); }, [leaderboardScope, role]);

  useEffect(() => {
    const refresh = () => loadAnalytics();
    window.addEventListener('studyhero:dashboard-refresh', refresh);
    return () => window.removeEventListener('studyhero:dashboard-refresh', refresh);
  }, [leaderboardScope, role]);

  const summary = payload?.summary || {};
  const weekly = payload?.charts?.weekly || [];
  const monthly = payload?.charts?.monthly || [];

  const metricCards = useMemo(() => isTeacher ? [
    ['Students', summary.students || 0, 'ri-user-line'],
    ['Courses', summary.courses || 0, 'ri-book-open-line'],
    ['Quiz Avg', `${Number(summary.averageQuizScore || 0)}%`, 'ri-questionnaire-line'],
    ['Assignment Avg', Number(summary.averageAssignmentGrade || 0), 'ri-task-line']
  ] : [
    ['Learning Streak', summary.learningStreak || 0, 'ri-fire-line'],
    ['Quiz Accuracy', `${Number(summary.quizAccuracy || 0)}%`, 'ri-focus-3-line'],
    ['Assignments', `${summary.submittedAssignments || 0}/${summary.availableAssignments || 0}`, 'ri-task-line'],
    ['AI Readiness', `${summary.readinessScore || 0}%`, 'ri-brain-line']
  ], [isTeacher, summary]);

  const exportReport = async (type: string, format: string) => {
    const token = getAuthToken();
    if (!token) return;
    const response = await fetch(`${API_BASE_URL}/api/analytics/reports/${type}/export?format=${format}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include'
    });
    if (!response.ok) {
      const body = await response.text();
      setError(body || 'Export failed.');
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `study-hero-${type}-report.${format === 'excel' ? 'xls' : format}`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 enterprise-page">
      <Header />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Enterprise Analytics</h1>
              <p className="text-gray-600 mt-2">Learning intelligence, performance reporting, leaderboards, and exports from live Study Hero data.</p>
            </div>
            <button onClick={loadAnalytics} disabled={loading} className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">Refresh</button>
          </div>

          {error && <div className="mb-4 bg-red-50 border-l-4 border-danger text-danger p-3 rounded text-sm">{error}</div>}
          {loading ? <SkeletonBlock rows={10} /> : payload && (
            <div className="space-y-6">
              <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {metricCards.map(([label, value, icon]) => <MetricCard key={label as string} label={label as string} value={value as string | number} icon={icon as string} />)}
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartPanel title="Weekly Progress" rows={weekly} />
                <ChartPanel title="Monthly Progress" rows={monthly} />
              </section>

              {isTeacher ? <TeacherAnalytics payload={payload} /> : <StudentAnalytics payload={payload} />}

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Leaderboard</h2>
                    <select value={leaderboardScope} onChange={(event) => setLeaderboardScope(event.target.value)} className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="all-time">All-time</option>
                    </select>
                  </div>
                  <DataTable rows={leaderboard.slice(0, 8)} columns={['rank', 'username', 'xp', 'level', 'badges']} empty="No leaderboard records" />
                </div>
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Reports</h2>
                  <div className="space-y-3">
                    {reportTypes.map((type) => <div key={type} className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 rounded-md p-3"><span className="capitalize font-medium text-gray-700">{type}</span><div className="flex gap-2">{formats.map((format) => <button key={format} onClick={() => exportReport(type, format)} className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-md hover:bg-primary/20">{format.toUpperCase()}</button>)}</div></div>)}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};
const TeacherAnalytics: React.FC<{ payload: AnalyticsPayload }> = ({ payload }) => (
  <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Panel title="At-Risk Students"><DataTable rows={(payload.atRiskStudents || []).slice(0, 8)} columns={['username', 'quizAverage', 'assignmentCompletion', 'quizCompletion', 'riskLevel']} empty="No at-risk students detected" /></Panel>
    <Panel title="Course Analytics"><DataTable rows={(payload.courseAnalytics || []).slice(0, 8)} columns={['title', 'students', 'quizzes', 'assignments', 'averageQuizScore']} empty="No course analytics" /></Panel>
    <Panel title="Quiz Analytics"><DataTable rows={(payload.quizAnalytics || []).slice(0, 8)} columns={['title', 'courseTitle', 'attempts', 'averageScore', 'completionRate']} empty="No quiz analytics" /></Panel>
    <Panel title="Assignment Analytics"><DataTable rows={(payload.assignmentAnalytics || []).slice(0, 8)} columns={['title', 'courseTitle', 'submissions', 'averageGrade', 'submissionRate']} empty="No assignment analytics" /></Panel>
    <Panel title="AI Usage"><DataTable rows={(payload.aiAnalytics?.usage || []).slice(0, 8)} columns={['feature', 'provider', 'requests', 'tokens', 'averageLatency']} empty="No AI usage yet" /></Panel>
    <Panel title="Student Performance"><DataTable rows={(payload.studentPerformance || []).slice(0, 8)} columns={['username', 'quizAverage', 'assignmentAverage', 'assignmentCompletion', 'lastActivity']} empty="No student performance" /></Panel>
  </section>
);

const StudentAnalytics: React.FC<{ payload: AnalyticsPayload }> = ({ payload }) => (
  <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Panel title="Weak Topics"><DataTable rows={(payload.topics?.weak || []).slice(0, 8)} columns={['topic', 'incorrect', 'attempts']} empty="No weak topics detected" /></Panel>
    <Panel title="Strong Topics"><DataTable rows={(payload.topics?.strong || []).slice(0, 8)} columns={['topic', 'correct', 'attempts']} empty="No strong topics detected" /></Panel>
    <Panel title="AI Learning Insights">
      <div className="space-y-3">
        <div className="text-sm text-gray-600">Exam readiness: <span className="font-semibold text-primary">{payload.aiAnalytics?.examReadiness || 'not_enough_data'}</span></div>
        {(payload.aiAnalytics?.insights || []).map((item: string) => <p key={item} className="text-sm text-gray-700 border border-gray-100 rounded-md p-3">{item}</p>)}
        {(payload.aiAnalytics?.suggestions || []).map((item: string) => <p key={item} className="text-sm text-gray-700 bg-primary/5 rounded-md p-3">{item}</p>)}
      </div>
    </Panel>
    <Panel title="AI Recommendations"><DataTable rows={(payload.aiAnalytics?.recommendations || []).slice(0, 6)} columns={['title', 'priority', 'status', 'created_at']} empty="No AI recommendations yet" /></Panel>
    <Panel title="Recent Quizzes"><DataTable rows={(payload.recentAttempts || []).slice(0, 8)} columns={['title', 'courseTitle', 'percentage', 'submitted_at']} empty="No quiz attempts yet" /></Panel>
    <Panel title="Recent Assignments"><DataTable rows={(payload.recentAssignments || []).slice(0, 8)} columns={['title', 'courseTitle', 'grade', 'status']} empty="No assignment submissions yet" /></Panel>
  </section>
);

const MetricCard: React.FC<{ label: string; value: string | number; icon: string }> = ({ label, value, icon }) => (
  <div className="bg-white rounded-xl shadow-md p-5">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-800 mt-1">{value}</p></div>
      <i className={`${icon} text-3xl text-primary`}></i>
    </div>
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-xl shadow-md p-6">
    <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
    {children}
  </div>
);

const ChartPanel: React.FC<{ title: string; rows: any[] }> = ({ title, rows }) => {
  const max = Math.max(1, ...rows.map((row) => Number(row.points || row.quizSubmissions || row.activityEvents || 0)));
  return (
    <Panel title={title}>
      {rows.length === 0 ? <EmptyState title="No chart data yet" /> : <div className="space-y-3">{rows.map((row) => {
        const value = Number(row.points || row.quizSubmissions || row.activityEvents || 0);
        return <div key={row.label}><div className="flex justify-between text-xs text-gray-500 mb-1"><span>{row.label}</span><span>{value}</span></div><div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-primary rounded-full" style={{ width: `${Math.max(4, (value / max) * 100)}%` }}></div></div></div>;
      })}</div>}
    </Panel>
  );
};

const DataTable: React.FC<{ rows: any[]; columns: string[]; empty: string }> = ({ rows, columns, empty }) => {
  if (rows.length === 0) return <EmptyState title={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50"><tr>{columns.map((column) => <th key={column} className="px-3 py-2 text-left font-medium text-gray-500 capitalize">{column.replace(/_/g, ' ')}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">{rows.map((row, index) => <tr key={row.id || row.user_id || row.title || index}>{columns.map((column) => <td key={column} className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatCell(row[column])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
};

const formatCell = (value: any) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return Number.isInteger(value) ? value : value.toFixed(2);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  return String(value).length > 64 ? `${String(value).slice(0, 64)}...` : String(value);
};

export default AnalyticsPage;
