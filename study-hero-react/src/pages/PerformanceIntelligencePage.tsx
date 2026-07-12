import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SkeletonBlock from '../components/LoadingStates';
import EmptyState from '../components/EmptyState';
import { API_BASE_URL, apiRequest, getAuthRole, getAuthToken } from '../services/api';

type ViewMode = 'dashboard' | 'prediction' | 'planner' | 'insights' | 'weak-topics' | 'recommendations' | 'history';
const titles: Record<ViewMode, string> = { dashboard: 'Performance Dashboard', prediction: 'Exam Prediction', planner: 'AI Study Planner', insights: 'Learning Insights', 'weak-topics': 'Weak Topics', recommendations: 'Recommendations', history: 'Performance History' };

const PerformanceIntelligencePage: React.FC<{ mode: ViewMode }> = ({ mode }) => {
  const role = getAuthRole();
  const isTeacher = role === 'teacher';
  const [data, setData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!getAuthToken()) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'prediction') setData(await apiRequest('/api/performance/prediction'));
      else if (mode === 'weak-topics') setData({ weakTopics: await apiRequest('/api/performance/weak-topics') });
      else if (mode === 'recommendations') setData({ recommendations: await apiRequest('/api/performance/recommendations') });
      else if (mode === 'history') { const rows = await apiRequest<any[]>('/api/performance/history'); setHistory(rows); setData({ history: rows }); }
      else if (mode === 'planner') { const [payload, rows] = await Promise.all([apiRequest('/api/performance/student'), apiRequest<any[]>('/api/performance/study-plans')]); setData(payload); setPlans(rows); }
      else setData(await apiRequest(isTeacher ? '/api/performance/teacher' : '/api/performance/student'));
    } catch (err: any) { setError(err.message || 'Unable to load AI performance intelligence.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [mode, role]);
  useEffect(() => { const refresh = () => load(); window.addEventListener('studyhero:dashboard-refresh', refresh); return () => window.removeEventListener('studyhero:dashboard-refresh', refresh); }, [mode, role]);

  const generatePlan = async () => {
    setWorking(true);
    setError('');
    try { await apiRequest('/api/performance/study-plans', { method: 'POST', body: JSON.stringify({ planType: 'weekly' }) }); await load(); }
    catch (err: any) { setError(err.message || 'Unable to generate study plan.'); }
    finally { setWorking(false); }
  };

  const exportReport = async (format: string) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/performance/reports/export?format=${format}`, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) { setError(await response.text()); return; }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `study-hero-ai-performance.${format === 'excel' ? 'xls' : format}`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const summary = data?.profile?.summary || {};
  const metrics = isTeacher ? [
    ['Class Average', `${data?.classAverage || 0}%`, 'ri-bar-chart-box-line'],
    ['At Risk', data?.atRiskStudents?.length || 0, 'ri-alarm-warning-line'],
    ['Top Performers', data?.topPerformers?.length || 0, 'ri-trophy-line'],
    ['Weak Topics', data?.weakTopics?.length || 0, 'ri-focus-3-line']
  ] : [
    ['Overall Score', `${summary.overallScore || 0}%`, 'ri-pulse-line'],
    ['Quiz Accuracy', `${summary.quizAccuracy || 0}%`, 'ri-questionnaire-line'],
    ['Consistency', `${summary.learningConsistency || 0}%`, 'ri-calendar-check-line'],
    ['Daily Streak', data?.streak?.dailyStreak || 0, 'ri-fire-line']
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 enterprise-page">
      <Header />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-800">{titles[mode]}</h1><p className="text-gray-600 mt-2">AI-powered learning intelligence generated from real Study Hero activity, grades, attendance, analytics, and LMS data.</p></div>
            <div className="flex flex-wrap gap-2">{['json', 'csv', 'pdf', 'excel'].map((format) => <button key={format} onClick={() => exportReport(format)} className="px-3 py-2 bg-primary/10 text-primary rounded-md text-sm">{format.toUpperCase()}</button>)}<button onClick={load} disabled={loading} className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">Refresh</button></div>
          </div>
          {error && <div className="mb-4 bg-red-50 border-l-4 border-danger text-danger p-3 rounded text-sm">{error}</div>}
          {loading ? <SkeletonBlock rows={10} /> : <div className="space-y-6"><section className="grid grid-cols-1 md:grid-cols-4 gap-4">{metrics.map(([label, value, icon]) => <MetricCard key={String(label)} label={String(label)} value={value as any} icon={String(icon)} />)}</section>{isTeacher ? <TeacherView data={data} /> : <StudentView mode={mode} data={data} plans={plans} history={history} onGeneratePlan={generatePlan} working={working} />}</div>}
        </div>
      </main>
      <Footer />
    </div>
  );
};

const TeacherView: React.FC<{ data: any }> = ({ data }) => <section className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Panel title="At-Risk Students"><DataTable rows={data?.atRiskStudents || []} columns={['username','quizAverage','assignmentAverage','performanceScore','riskLevel']} empty="No at-risk students" /></Panel><Panel title="Top Performers"><DataTable rows={data?.topPerformers || []} columns={['username','quizAverage','assignmentAverage','performanceScore']} empty="No top performers yet" /></Panel><Panel title="Class Weak Topics"><DataTable rows={data?.weakTopics || []} columns={['topic','affectedStudents','averageWeakness']} empty="No weak topics detected" /></Panel><Panel title="Suggested Remedial Quizzes"><DataTable rows={data?.suggestedRemedialQuizzes || []} columns={['topic','reason','suggestedQuestions']} empty="No remedial quiz suggestions" /></Panel><Panel title="Class AI Insights"><InsightList items={data?.insights || []} /></Panel><Panel title="Learning Trends"><DataTable rows={(data?.learningTrends || []).slice(0, 10)} columns={['username','activityEvents','lastActivity','riskLevel']} empty="No learning trends" /></Panel></section>;

const StudentView: React.FC<any> = ({ mode, data, plans, history, onGeneratePlan, working }) => {
  const profile = data?.profile || {};
  const prediction = data?.prediction || (mode === 'prediction' ? data : null);
  const weakRows = data?.weakTopics || [];
  const recommendationRows = data?.recommendations || [];
  return <section className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Panel title="AI Performance Coach"><p className="text-gray-700 leading-relaxed">{profile?.performanceSummary || 'Performance summary will appear after activity is available.'}</p><InsightList items={[`Strengths: ${(profile?.strengths || []).join(', ') || 'Building'}`, `Focus: ${(profile?.weaknesses || []).join(', ') || 'Maintain momentum'}`]} /></Panel><Panel title="Exam Readiness"><DataTable rows={prediction ? [prediction] : []} columns={['probabilityOfPassing','estimatedMarks','confidenceScore','riskLevel','recommendedStudyHours']} empty="No prediction yet" /></Panel><Panel title="Weak Topics"><DataTable rows={weakRows} columns={['topic','source_type','weakness_score','evidence_count','status']} empty="No weak topics detected" /></Panel><Panel title="Recommendations"><DataTable rows={recommendationRows} columns={['title','type','priority','status','created_at']} empty="No recommendations yet" /></Panel><Panel title="Study Planner"><button onClick={onGeneratePlan} disabled={working} className="mb-4 px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">{working ? 'Generating...' : 'Generate Weekly Plan'}</button><DataTable rows={plans} columns={['title','plan_type','recommended_hours','status','created_at']} empty="No study plans yet" /></Panel><Panel title="Performance History"><DataTable rows={history} columns={['period_type','period_start','overall_score','quiz_accuracy','assignment_quality']} empty="No performance history yet" /></Panel></section>;
};

const MetricCard: React.FC<{ label: string; value: string | number; icon: string }> = ({ label, value, icon }) => <div className="bg-white rounded-xl shadow-md p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-800 mt-1">{value}</p></div><i className={`${icon} text-3xl text-primary`}></i></div></div>;
const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <div className="bg-white rounded-xl shadow-md p-6"><h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>{children}</div>;
const InsightList: React.FC<{ items: string[] }> = ({ items }) => items.length ? <div className="space-y-2 mt-4">{items.map((item) => <p key={item} className="text-sm text-gray-700 border border-gray-100 rounded-md p-3">{item}</p>)}</div> : <EmptyState title="No insights yet" />;
const DataTable: React.FC<{ rows: any[]; columns: string[]; empty: string }> = ({ rows, columns, empty }) => rows.length === 0 ? <EmptyState title={empty} /> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-gray-50"><tr>{columns.map((column) => <th key={column} className="px-3 py-2 text-left font-medium text-gray-500 capitalize">{column.replace(/_/g, ' ')}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.map((row, index) => <tr key={row.id || row.student_id || row.title || index}>{columns.map((column) => <td key={column} className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatCell(row[column])}</td>)}</tr>)}</tbody></table></div>;
const formatCell = (value: any) => { if (value === null || value === undefined || value === '') return '-'; if (typeof value === 'number') return Number.isInteger(value) ? value : value.toFixed(2); if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString(); if (typeof value === 'object') return JSON.stringify(value).slice(0, 80); return String(value).length > 72 ? `${String(value).slice(0, 72)}...` : String(value); };
export default PerformanceIntelligencePage;
