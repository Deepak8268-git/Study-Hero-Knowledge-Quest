import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { apiRequest } from '../services/api';

interface CourseOption {
  id: number;
  title: string;
}

interface FileUploaderProps {
  courses?: CourseOption[];
  onQuizGenerated: () => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ courses = [], onQuizGenerated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [quizTitle, setQuizTitle] = useState<string>("");
  const [quizDescription, setQuizDescription] = useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [mlStatus, setMlStatus] = useState<string>("");
  const [processingStage, setProcessingStage] = useState<string>("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(String(courses[0].id));
    }
  }, [courses, selectedCourseId]);

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
      
      const nameWithoutExtension = selectedFile.name.replace(/\.pdf$/i, '');
      setQuizTitle(`Quiz on ${nameWithoutExtension}`);
    }
  };
  
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }
    
    if (!quizTitle) {
      setError('Please provide a quiz title');
      return;
    }

    if (!selectedCourseId) {
      setError('Please select a course for this quiz');
      return;
    }
    
    setUploading(true);
    setGenerating(true);
    setFileUploaded(true);
    setUploadProgress(20);
    setMlStatus('Uploading PDF to backend...');
    setProcessingStage('text_extraction');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('course_id', selectedCourseId);
      formData.append('title', quizTitle);
      formData.append('description', quizDescription);
      formData.append('settings', JSON.stringify({
        timeLimit: 20,
        preventTabSwitch: true,
        randomizeQuestions: true,
        showOneQuestionAtATime: true,
        requireWebcam: false,
        passingScore: 60
      }));

      setUploadProgress(50);
      setMlStatus('Extracting PDF text and generating quiz...');
      setProcessingStage('question_generation');

      await apiRequest('/api/quiz/generate-from-file', {
        method: 'POST',
        body: formData
      });

      setUploadProgress(100);
      setMlStatus('Quiz saved successfully');
      setProcessingStage('finalizing');
      onQuizGenerated();
      resetForm();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to generate quiz');
      setFileUploaded(false);
    } finally {
      setUploading(false);
      setGenerating(false);
    }
  };
  
  const resetForm = () => {
    setFile(null);
    setFileName("");
    setFileUploaded(false);
    setQuizTitle("");
    setQuizDescription("");
    setUploadProgress(0);
    setMlStatus("");
    setProcessingStage("");
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Upload Course Materials</h2>
      
      {!fileUploaded ? (
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload PDF Notes</label>
            <div className="mt-1 flex items-center">
              <input
                type="file"
                className="hidden"
                onChange={handleFileChange}
                ref={fileInputRef}
                accept=".pdf"
              />
              <button
                type="button"
                onClick={handleBrowseClick}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Browse Files
              </button>
              <span className="ml-3 text-sm text-gray-500">
                {fileName ? fileName : 'No file selected'}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Upload a PDF file (max 10MB)
            </p>
          </div>
          
          {file && (
            <>
              <div className="mb-4">
                <label htmlFor="courseId" className="block text-sm font-medium text-gray-700 mb-1">
                  Course
                </label>
                <select
                  id="courseId"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="quizTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Quiz Title
                </label>
                <input
                  type="text"
                  id="quizTitle"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Enter quiz title"
                />
              </div>
              
              <div className="mb-6">
                <label htmlFor="quizDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="quizDescription"
                  value={quizDescription}
                  onChange={(e) => setQuizDescription(e.target.value)}
                  rows={3}
                  className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Enter a brief description for this quiz"
                />
              </div>
            </>
          )}
          
          {error && (
            <div className="text-sm text-red-600 mb-4">
              {error}
            </div>
          )}
          
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading || courses.length === 0}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
              !file || uploading || courses.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? 'Uploading...' : 'Upload and Generate Quiz'}
          </button>
          
          {uploading && (
            <div className="mt-4">
              <div className="bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div 
                  className="bg-primary h-2.5 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 text-right mt-1">
                {uploadProgress}%
              </p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {generating ? (
            <div className="py-8">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  {mlStatus}
                </h3>
                <p className="text-sm text-gray-500">
                  This may take a minute or two...
                </p>
                
                <div className="mt-6 w-full max-w-md">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">Processing Stage</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full" 
                      style={{ 
                        width: processingStage === 'text_extraction' ? '35%' :
                               processingStage === 'question_generation' ? '75%' :
                               processingStage === 'finalizing' ? '100%' : '10%'
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                <i className="ri-check-line text-3xl"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                Quiz Generated Successfully!
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Your quiz has been created and is ready to use.
              </p>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Generate Another Quiz
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
