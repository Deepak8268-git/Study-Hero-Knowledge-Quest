import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { apiRequest } from '../services/api';

interface CourseOption {
  id: number;
  title: string;
}

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

interface FileUploaderProps {
  courses?: CourseOption[];
  onQuizGenerated: () => void;
}

const defaultSettings = {
  timeLimit: 20,
  preventTabSwitch: true,
  randomizeQuestions: true,
  showOneQuestionAtATime: true,
  requireWebcam: false,
  passingScore: 60
};

const FileUploader: React.FC<FileUploaderProps> = ({ courses = [], onQuizGenerated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [quizDescription, setQuizDescription] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [mlStatus, setMlStatus] = useState<string>('');
  const [processingStage, setProcessingStage] = useState<string>('');
  const [generatedQuizId, setGeneratedQuizId] = useState<number | null>(null);
  const [generatedQuizCode, setGeneratedQuizCode] = useState<string>('');
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [questionPreset, setQuestionPreset] = useState<string>('5');
  const [customQuestionCount, setCustomQuestionCount] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('Medium');
  const [questionTypes, setQuestionTypes] = useState<string[]>(['MCQ']);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(1);
  const [bloomLevel, setBloomLevel] = useState<string>('Understand');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(String(courses[0].id));
    }
  }, [courses, selectedCourseId]);

  const getGenerationOptions = () => {
    const selectedCount = questionPreset === 'Custom' ? Number(customQuestionCount) : Number(questionPreset);
    return {
      questionCount: Number.isFinite(selectedCount) && selectedCount > 0 ? Math.min(Math.round(selectedCount), 50) : 5,
      difficulty,
      questionTypes: questionTypes.length > 0 ? questionTypes : ['MCQ'],
      marksPerQuestion: Math.max(Number(marksPerQuestion) || 1, 1),
      bloomLevel
    };
  };

  const toggleQuestionType = (type: string) => {
    setQuestionTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  };

  const mergedSettings = () => ({ ...defaultSettings, generationOptions: getGenerationOptions() });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size exceeds 10MB');
        return;
      }
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError(null);
      setSuccess(null);
      const nameWithoutExtension = selectedFile.name.replace(/\.pdf$/i, '');
      setQuizTitle(`Quiz on ${nameWithoutExtension}`);
    }
  };

  const handleUpload = async () => {
    if (!file) return setError('Please select a file first');
    if (!quizTitle.trim()) return setError('Please provide a quiz title');
    if (!selectedCourseId) return setError('Create a course before generating quizzes.');

    setUploading(true);
    setFileUploaded(true);
    setUploadProgress(20);
    setMlStatus('Uploading PDF to backend...');
    setProcessingStage('text_extraction');
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('course_id', selectedCourseId);
      formData.append('title', quizTitle);
      formData.append('description', quizDescription);
      const generationOptions = getGenerationOptions();
      formData.append('settings', JSON.stringify(mergedSettings()));
      formData.append('questionCount', String(generationOptions.questionCount));
      formData.append('difficulty', generationOptions.difficulty);
      formData.append('questionTypes', JSON.stringify(generationOptions.questionTypes));
      formData.append('marksPerQuestion', String(generationOptions.marksPerQuestion));
      formData.append('bloomLevel', generationOptions.bloomLevel);

      setUploadProgress(50);
      setMlStatus('Extracting PDF text and generating quiz...');
      setProcessingStage('question_generation');

      const response = await apiRequest<{ quiz_id: number; quizCode: string; questions: GeneratedQuestion[] }>('/api/quiz/generate-from-file', {
        method: 'POST',
        body: formData
      });

      setGeneratedQuizId(response.quiz_id);
      setGeneratedQuizCode(response.quizCode || '');
      setQuestions(response.questions || []);
      setUploadProgress(100);
      setMlStatus('Quiz generated. Review questions before publishing.');
      setProcessingStage('finalizing');
      setSuccess('Quiz generated successfully. Review, edit, save, then publish when ready.');
      await onQuizGenerated();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to generate quiz');
      setFileUploaded(false);
    } finally {
      setUploading(false);
    }
  };

  const updateQuestion = (index: number, patch: Partial<GeneratedQuestion>) => {
    setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question));
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex) return question;
      const options = [...question.options];
      const previous = options[optionIndex];
      options[optionIndex] = value;
      return { ...question, options, correctAnswer: question.correctAnswer === previous ? value : question.correctAnswer };
    }));
  };

  const saveQuestionEdits = async () => {
    if (!generatedQuizId) return;
    try {
      setSavingQuestions(true);
      setError(null);
      await apiRequest(`/api/quiz/${generatedQuizId}/questions`, {
        method: 'PUT',
        body: JSON.stringify({ title: quizTitle, description: quizDescription, questions, settings: mergedSettings() })
      });
      setSuccess('Quiz questions saved.');
      await onQuizGenerated();
    } catch (err: any) {
      setError(err.message || 'Failed to save quiz questions');
    } finally {
      setSavingQuestions(false);
    }
  };

  const publishQuiz = async () => {
    if (!generatedQuizId) return;
    try {
      setPublishing(true);
      setError(null);
      const response = await apiRequest<{ quizCode: string }>(`/api/quiz/${generatedQuizId}/activate`, {
        method: 'POST',
        body: JSON.stringify({ settings: mergedSettings() })
      });
      setGeneratedQuizCode(response.quizCode || generatedQuizCode);
      setSuccess(`Quiz published successfully. Quiz Code: ${response.quizCode || generatedQuizCode}`);
      await onQuizGenerated();
    } catch (err: any) {
      setError(err.message || 'Failed to publish quiz');
    } finally {
      setPublishing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setFileName('');
    setFileUploaded(false);
    setQuizTitle('');
    setQuizDescription('');
    setUploadProgress(0);
    setMlStatus('');
    setProcessingStage('');
    setQuestions([]);
    setGeneratedQuizId(null);
    setGeneratedQuizCode('');
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (courses.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 text-center">
        <i className="ri-book-open-line text-4xl text-gray-300 block mb-3"></i>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Create a course before generating quizzes.</h2>
        <p className="text-gray-600">PDF quiz generation needs a real course so the quiz can be saved, published, and delivered to enrolled students.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Upload Course Materials</h2>
      {error && <div className="text-sm text-red-600 bg-red-50 border-l-4 border-red-500 p-3 rounded mb-4">{error}</div>}
      {success && <div className="text-sm text-green-700 bg-green-50 border-l-4 border-green-500 p-3 rounded mb-4">{success}</div>}

      {!fileUploaded ? (
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload PDF Notes</label>
            <div className="mt-1 flex items-center">
              <input type="file" className="hidden" onChange={handleFileChange} ref={fileInputRef} accept=".pdf" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Browse Files
              </button>
              <span className="ml-3 text-sm text-gray-500">{fileName || 'No file selected'}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">Upload a PDF file (max 10MB)</p>
          </div>

          {file && (
            <>
              <div className="mb-4">
                <label htmlFor="courseId" className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select id="courseId" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md">
                  {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="quizTitle" className="block text-sm font-medium text-gray-700 mb-1">Quiz Title</label>
                <input id="quizTitle" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md" placeholder="Enter quiz title" />
              </div>
              <div className="mb-4">
                <label htmlFor="quizDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea id="quizDescription" value={quizDescription} onChange={(e) => setQuizDescription(e.target.value)} rows={3} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md" placeholder="Enter a brief description for this quiz" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="questionCount" className="block text-sm font-medium text-gray-700 mb-1">Number of Questions</label>
                  <select id="questionCount" value={questionPreset} onChange={(e) => setQuestionPreset(e.target.value)} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md">
                    {['5', '10', '15', '20', '25', 'Custom'].map((count) => <option key={count} value={count}>{count}</option>)}
                  </select>
                </div>
                {questionPreset === 'Custom' && (
                  <div>
                    <label htmlFor="customQuestionCount" className="block text-sm font-medium text-gray-700 mb-1">Custom Count</label>
                    <input id="customQuestionCount" type="number" min="1" max="50" value={customQuestionCount} onChange={(e) => setCustomQuestionCount(e.target.value)} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md" />
                  </div>
                )}
                <div>
                  <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md">
                    {['Easy', 'Medium', 'Hard'].map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="marksPerQuestion" className="block text-sm font-medium text-gray-700 mb-1">Marks Per Question</label>
                  <input id="marksPerQuestion" type="number" min="1" value={marksPerQuestion} onChange={(e) => setMarksPerQuestion(Number(e.target.value))} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md" />
                </div>
                <div>
                  <label htmlFor="bloomLevel" className="block text-sm font-medium text-gray-700 mb-1">Bloom Level</label>
                  <select id="bloomLevel" value={bloomLevel} onChange={(e) => setBloomLevel(e.target.value)} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md">
                    {['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'].map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <span className="block text-sm font-medium text-gray-700 mb-2">Question Types</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {['MCQ', 'True/False', 'Fill in blanks', 'Short Answer'].map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-md px-3 py-2">
                      <input type="checkbox" checked={questionTypes.includes(type)} onChange={() => toggleQuestionType(type)} />
                      {type}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <button type="button" onClick={handleUpload} disabled={!file || uploading || !selectedCourseId} className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/80 ${!file || uploading || !selectedCourseId ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {uploading ? 'Uploading...' : 'Upload and Generate Quiz'}
          </button>
        </div>
      ) : (
        <div>
          {uploading ? (
            <div className="py-8">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">{mlStatus}</h3>
                <p className="text-sm text-gray-500">This may take a minute or two...</p>
                <div className="mt-6 w-full max-w-md">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <p className="text-xs text-gray-500 text-right mt-1">{processingStage.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Preview Generated Questions</h3>
                  {generatedQuizCode && <p className="text-sm text-gray-500">Draft code: {generatedQuizCode}</p>}
                </div>
                <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Generate Another</button>
              </div>

              {questions.map((question, questionIndex) => (
                <div key={questionIndex} className="border border-gray-100 rounded-lg p-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Question {questionIndex + 1}</label>
                  <textarea value={question.question} onChange={(e) => updateQuestion(questionIndex, { question: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <input type="radio" checked={question.correctAnswer === option} onChange={() => updateQuestion(questionIndex, { correctAnswer: option })} aria-label={`Correct answer ${optionIndex + 1}`} />
                        <input value={option} onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={saveQuestionEdits} disabled={savingQuestions || questions.length === 0} className="flex-1 px-4 py-2 bg-primary text-white rounded-md disabled:opacity-60">
                  {savingQuestions ? 'Saving...' : 'Save Quiz'}
                </button>
                <button type="button" onClick={publishQuiz} disabled={publishing || !generatedQuizId} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60">
                  {publishing ? 'Publishing...' : 'Publish Quiz'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUploader;


