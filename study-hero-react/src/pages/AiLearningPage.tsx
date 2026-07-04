import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SkeletonBlock from '../components/LoadingStates';
import EmptyState from '../components/EmptyState';
import { apiRequest, getAuthRole, getAuthToken } from '../services/api';

interface AiArtifact {
  id: number;
  type: string;
  title: string;
  content: string;
  created_at: string;
}

interface AiUsage {
  dailyTokens: number;
  monthlyTokens: number;
  dailyLimit: number;
  monthlyLimit: number;
}

const tabs = ['assistant', 'pdf', 'generate', 'planner', 'insights', 'history'] as const;
type Tab = typeof tabs[number];

const AiLearningPage: React.FC = () => {
  const role = getAuthRole();
  const [activeTab, setActiveTab] = useState<Tab>('assistant');
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [chatLog, setChatLog] = useState<Array<{ role: string; content: string }>>([]);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [pdfQuestion, setPdfQuestion] = useState('');
  const [context, setContext] = useState('');
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [bloomLevel, setBloomLevel] = useState('apply');
  const [questionTypes, setQuestionTypes] = useState('mcq,short_answer');
  const [goals, setGoals] = useState('');
  const [availability, setAvailability] = useState('');
  const [deadline, setDeadline] = useState('');
  const [result, setResult] = useState('');
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [artifacts, setArtifacts] = useState<AiArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsageAndArtifacts = async () => {
    const [usageData, artifactData] = await Promise.all([
      apiRequest<AiUsage>('/api/ai/usage'),
      apiRequest<AiArtifact[]>('/api/ai/artifacts')
    ]);
    setUsage(usageData);
    setArtifacts(artifactData);
  };

  useEffect(() => {
    if (getAuthToken()) {
      loadUsageAndArtifacts().catch((err) => setError(err.message || 'Unable to load AI workspace.'));
    }
  }, []);

  const runAction = async (action: () => Promise<any>, outputSelector: (data: any) => string = (data) => data.content || data.response || '') => {
    try {
      setLoading(true);
      setError('');
      const data = await action();
      setResult(outputSelector(data));
      await loadUsageAndArtifacts();
      return data;
    } catch (err: any) {
      setError(err.message || 'AI operation failed.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const sendAssistantMessage = async () => {
    if (!message.trim()) return;
    const userMessage = message;
    setChatLog((current) => [...current, { role: 'user', content: userMessage }]);
    setMessage('');
    const data = await runAction(() => apiRequest('/api/ai/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ conversationId, message: userMessage })
    }), (response) => response.response);
    if (data) {
      setConversationId(data.conversationId);
      setChatLog((current) => [...current, { role: 'assistant', content: data.response }]);
    }
  };

  const uploadPdf = async (file?: File) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    await runAction(() => apiRequest('/api/ai/documents/upload', { method: 'POST', body: formData }), (data) => {
      setDocumentId(data.documentId);
      return `PDF processed into ${data.chunks} retrieval-ready chunks.`;
    });
  };

  const askPdf = async () => {
    if (!documentId || !pdfQuestion.trim()) return;
    await runAction(() => apiRequest(`/api/ai/documents/${documentId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message: pdfQuestion })
    }), (data) => data.response);
  };

  const generate = async (type: string) => {
    const endpointMap: Record<string, string> = {
      quiz: '/api/ai/generate/quiz',
      assignment: '/api/ai/generate/assignment',
      flashcards: '/api/ai/generate/flashcards',
      summary: '/api/ai/generate/summary',
      doubt: '/api/ai/doubt-solver'
    };
    const payload: any = type === 'doubt'
      ? { question: context, title }
      : { context, title, difficulty, bloomLevel, questionTypes: questionTypes.split(',').map((item) => item.trim()).filter(Boolean), count: 8 };
    if (type === 'quiz' || type === 'assignment') payload.courseId = Number((document.getElementById('ai-course-id') as HTMLInputElement)?.value || 0);
    await runAction(() => apiRequest(endpointMap[type], { method: 'POST', body: JSON.stringify(payload) }));
  };

  const generatePlan = async () => {
    await runAction(() => apiRequest('/api/ai/planner', { method: 'POST', body: JSON.stringify({ goals, availability, deadline, title: 'Study Plan' }) }));
  };

  const runInsight = async (kind: 'weak-topics' | 'recommendations') => {
    await runAction(() => apiRequest(`/api/ai/${kind}`, { method: 'POST' }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 enterprise-page">
      <Header />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">AI Learning Intelligence</h1>
              <p className="text-gray-600 mt-2">Enterprise AI tools powered by your authenticated Study Hero data.</p>
            </div>
            {usage && (
              <div className="bg-white rounded-lg shadow-sm p-4 text-sm text-gray-600 min-w-64">
                <div className="flex justify-between"><span>Daily tokens</span><span>{usage.dailyTokens}/{usage.dailyLimit}</span></div>
                <div className="h-2 bg-gray-100 rounded-full mt-2"><div className="h-2 bg-primary rounded-full" style={{ width: `${Math.min(100, (usage.dailyTokens / usage.dailyLimit) * 100)}%` }}></div></div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="border-b border-gray-100 flex flex-wrap">
              {tabs.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-medium capitalize ${activeTab === tab ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-6">
              {error && <div className="mb-4 bg-red-50 border-l-4 border-danger text-danger p-3 rounded text-sm">{error}</div>}
              {loading && <div className="mb-4"><SkeletonBlock rows={3} /></div>}

              {activeTab === 'assistant' && (
                <section className="space-y-4">
                  <div className="h-80 overflow-y-auto border border-gray-100 rounded-lg p-4 bg-gray-50">
                    {chatLog.length === 0 ? <EmptyState title="Start a study conversation" message="Ask the AI tutor a course-related question." /> : chatLog.map((item, index) => (
                      <div key={index} className={`mb-3 ${item.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block max-w-3xl rounded-lg px-4 py-2 text-sm ${item.role === 'user' ? 'bg-primary text-white' : 'bg-white text-gray-700 border border-gray-100'}`}>{item.content}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendAssistantMessage()} className="flex-1 border border-gray-300 rounded-md px-3 py-2" placeholder="Ask the AI study assistant..." />
                    <button onClick={sendAssistantMessage} className="px-4 py-2 bg-primary text-white rounded-md">Send</button>
                  </div>
                </section>
              )}

              {activeTab === 'pdf' && (
                <section className="space-y-4">
                  <input type="file" accept="application/pdf" onChange={(e) => uploadPdf(e.target.files?.[0])} className="block w-full text-sm" />
                  <div className="flex gap-3">
                    <input value={pdfQuestion} onChange={(e) => setPdfQuestion(e.target.value)} className="flex-1 border border-gray-300 rounded-md px-3 py-2" placeholder="Ask about the uploaded PDF" />
                    <button onClick={askPdf} disabled={!documentId} className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-50">Ask PDF</button>
                  </div>
                </section>
              )}

              {activeTab === 'generate' && (
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-3">
                    <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Title" />
                    {role === 'teacher' && <input id="ai-course-id" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Course ID for teacher generators" />}
                    <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={8} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Paste real course material, topic, or doubt here" />
                  </div>
                  <div className="space-y-3">
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2"><option>beginner</option><option>intermediate</option><option>advanced</option></select>
                    <select value={bloomLevel} onChange={(e) => setBloomLevel(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2"><option>remember</option><option>understand</option><option>apply</option><option>analyze</option><option>evaluate</option><option>create</option></select>
                    <input value={questionTypes} onChange={(e) => setQuestionTypes(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                    {role === 'teacher' && <button onClick={() => generate('quiz')} className="w-full px-4 py-2 bg-primary text-white rounded-md">Generate Quiz</button>}
                    {role === 'teacher' && <button onClick={() => generate('assignment')} className="w-full px-4 py-2 bg-primary text-white rounded-md">Generate Assignment</button>}
                    <button onClick={() => generate('flashcards')} className="w-full px-4 py-2 bg-primary text-white rounded-md">Generate Flashcards</button>
                    <button onClick={() => generate('summary')} className="w-full px-4 py-2 bg-primary text-white rounded-md">Generate Notes/Summary</button>
                    <button onClick={() => generate('doubt')} className="w-full px-4 py-2 bg-primary text-white rounded-md">Solve Doubt</button>
                  </div>
                </section>
              )}

              {activeTab === 'planner' && (
                <section className="space-y-3 max-w-3xl">
                  <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={5} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Study goals" />
                  <input value={availability} onChange={(e) => setAvailability(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Availability, e.g. 1 hour daily" />
                  <input value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Deadline" />
                  <button onClick={generatePlan} className="px-4 py-2 bg-primary text-white rounded-md">Create Study Plan</button>
                </section>
              )}

              {activeTab === 'insights' && (
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={() => runInsight('weak-topics')} className="p-6 bg-primary/5 rounded-lg text-left hover:bg-primary/10"><h3 className="font-semibold text-gray-800">Detect Weak Topics</h3><p className="text-sm text-gray-500 mt-2">Uses your real submitted quiz performance.</p></button>
                  <button onClick={() => runInsight('recommendations')} className="p-6 bg-primary/5 rounded-lg text-left hover:bg-primary/10"><h3 className="font-semibold text-gray-800">Generate Recommendations</h3><p className="text-sm text-gray-500 mt-2">Creates personalized next actions from real learning data.</p></button>
                </section>
              )}

              {activeTab === 'history' && (
                <section className="space-y-3">
                  {artifacts.length === 0 ? <EmptyState title="No AI artifacts yet" message="Generated AI outputs will appear here." /> : artifacts.map((artifact) => (
                    <article key={artifact.id} className="border border-gray-100 rounded-lg p-4">
                      <div className="flex justify-between gap-3"><h3 className="font-semibold text-gray-800">{artifact.title}</h3><span className="text-xs text-gray-400">{artifact.type}</span></div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap mt-3 line-clamp-2">{artifact.content}</p>
                    </article>
                  ))}
                </section>
              )}

              {result && activeTab !== 'assistant' && activeTab !== 'history' && (
                <div className="mt-6 border border-gray-100 rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold text-gray-800 mb-2">AI Output</h3>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{result}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AiLearningPage;