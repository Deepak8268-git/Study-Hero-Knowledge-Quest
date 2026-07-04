import React, { useState } from 'react';
import { Link } from 'react-router-dom';

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
  code: string;
  source?: string;
  createdAt: string;
}

interface QuizManagerProps {
  quizzes: Quiz[];
  onActivateQuiz: (quizId: string, settings: Partial<Quiz>) => Promise<void> | void;
  onDeactivateQuiz: (quizId: string) => Promise<void> | void;
  onEditQuiz: (quizId: string) => Promise<void> | void;
  onDeleteQuiz: (quizId: string) => Promise<void> | void;
  onDuplicateQuiz: (quizId: string) => Promise<void> | void;
  onGenerateCode: (quizId: string) => Promise<void> | void;
}

const QuizManager: React.FC<QuizManagerProps> = ({
  quizzes,
  onActivateQuiz,
  onDeactivateQuiz,
  onEditQuiz,
  onDeleteQuiz,
  onDuplicateQuiz,
  onGenerateCode
}) => {
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [quizSettings, setQuizSettings] = useState<Partial<Quiz>>({
    scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    duration: 30,
    preventTabSwitch: true,
    randomizeQuestions: true,
    showOneQuestionAtATime: true,
    requireWebcam: false,
    passingScore: 70
  });

  const runAction = async (quizId: string, action: () => Promise<void> | void) => {
    try {
      setProcessingId(quizId);
      await action();
    } finally {
      setProcessingId(null);
    }
  };

  const handleSettingsChange = (field: keyof Quiz, value: any) => {
    setQuizSettings({ ...quizSettings, [field]: value });
  };

  const handleActivate = async () => {
    if (!activeQuizId) return;
    await runAction(activeQuizId, () => onActivateQuiz(activeQuizId, quizSettings));
    setActiveQuizId(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Your Created Quizzes</h2>
      {quizzes.length === 0 ? (
        <div className="text-center py-6">
          <i className="ri-file-list-3-line text-4xl text-gray-300 mb-2"></i>
          <p className="text-gray-500">You haven't created any quizzes yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-medium text-gray-800">{quiz.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{quiz.description || 'No description'}</p>
                  <div className="flex flex-wrap items-center mt-2 gap-2">
                    <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2 py-1 rounded">Code: {quiz.code || quiz.quizCode || 'Not generated'}</span>
                    <span className="text-xs bg-gray-100 text-gray-800 font-medium px-2 py-1 rounded">{quiz.questionCount} questions</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${quiz.isActive ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{quiz.isActive ? 'Active' : 'Draft'}</span>
                    {quiz.source === 'pdf-content' && <span className="text-xs bg-green-100 text-green-800 font-medium px-2 py-1 rounded">PDF Generated</span>}
                  </div>
                </div>
                <button
                  onClick={() => window.confirm('Archive this quiz?') && runAction(quiz.id, () => onDeleteQuiz(quiz.id))}
                  disabled={processingId === quiz.id}
                  className="text-red-500 hover:text-red-600 disabled:opacity-60"
                  title="Archive quiz"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>

              <div className="flex flex-wrap mt-4 gap-2">
                <button onClick={() => window.open(`/quiz/${quiz.id}?preview=true`, '_blank')} className="px-3 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors">
                  <i className="ri-eye-line mr-1"></i> Preview
                </button>
                <button onClick={() => runAction(quiz.id, () => onEditQuiz(quiz.id))} disabled={processingId === quiz.id} className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors disabled:opacity-60">
                  <i className="ri-edit-line mr-1"></i> Edit
                </button>
                <button onClick={() => setActiveQuizId(quiz.id)} className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors">
                  <i className="ri-calendar-line mr-1"></i> Publish
                </button>
                {quiz.isActive && (
                  <button onClick={() => runAction(quiz.id, () => onDeactivateQuiz(quiz.id))} disabled={processingId === quiz.id} className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors disabled:opacity-60">
                    <i className="ri-pause-line mr-1"></i> Deactivate
                  </button>
                )}
                <button onClick={() => runAction(quiz.id, () => onDuplicateQuiz(quiz.id))} disabled={processingId === quiz.id} className="px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200 transition-colors disabled:opacity-60">
                  <i className="ri-file-copy-line mr-1"></i> Duplicate
                </button>
                <button onClick={() => runAction(quiz.id, () => onGenerateCode(quiz.id))} disabled={processingId === quiz.id} className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors disabled:opacity-60">
                  <i className="ri-key-2-line mr-1"></i> Generate Code
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + `/quiz/${quiz.id}`);
                    alert('Quiz link copied to clipboard.');
                  }}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors"
                >
                  <i className="ri-share-line mr-1"></i> Share
                </button>
                <Link to={`/quiz/${quiz.id}`} className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors">
                  <i className="ri-play-line mr-1"></i> Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeQuizId && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6 mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Publish Quiz</h3>
              <button onClick={() => setActiveQuizId(null)} className="text-gray-400 hover:text-gray-600"><i className="ri-close-line text-xl"></i></button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Date</label>
                <input type="date" value={quizSettings.scheduledDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => handleSettingsChange('scheduledDate', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                <input type="number" value={quizSettings.duration} min={5} max={180} onChange={(e) => handleSettingsChange('duration', parseInt(e.target.value, 10))} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score (%)</label>
                <input type="number" value={quizSettings.passingScore} min={0} max={100} onChange={(e) => handleSettingsChange('passingScore', parseInt(e.target.value, 10))} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              {(['preventTabSwitch', 'randomizeQuestions', 'showOneQuestionAtATime', 'requireWebcam'] as Array<keyof Quiz>).map((field) => (
                <label key={field} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={!!quizSettings[field]} onChange={(e) => handleSettingsChange(field, e.target.checked)} />
                  {String(field).replace(/([A-Z])/g, ' $1')}
                </label>
              ))}
            </div>
            <div className="flex space-x-3">
              <button onClick={() => setActiveQuizId(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Cancel</button>
              <button onClick={handleActivate} disabled={processingId === activeQuizId} className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-60">
                {processingId === activeQuizId ? 'Publishing...' : 'Publish Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizManager;
