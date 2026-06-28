import React, { useState, useEffect, useRef } from 'react';

interface WebcamProctoringProps {
  isActive: boolean;
  onViolation: (type: string) => void;
}

const WebcamProctoring: React.FC<WebcamProctoringProps> = ({ isActive, onViolation }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [facesDetected, setFacesDetected] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Request webcam access
  useEffect(() => {
    if (isActive) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          setHasPermission(true);
          streamRef.current = stream;
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setIsStreamActive(true);
          }
        })
        .catch(err => {
          console.error('Error accessing webcam:', err);
          setHasPermission(false);
          onViolation('webcam_access_denied');
        });
      
      return () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          setIsStreamActive(false);
        }
      };
    }
  }, [isActive, onViolation]);
  
  // Simulate face detection (in a real app, would use a face detection library)
  useEffect(() => {
    if (!isActive || !isStreamActive) return;
    
    const checkInterval = setInterval(() => {
      // Simulate face detection
      const detected = Math.floor(Math.random() * 2) + 1; // Either 1 or 2 faces
      setFacesDetected(detected);
      
      if (detected === 0) {
        onViolation('no_face_detected');
      } else if (detected > 1) {
        onViolation('multiple_faces_detected');
      }
    }, 5000);
    
    return () => clearInterval(checkInterval);
  }, [isActive, isStreamActive, onViolation]);
  
  if (!isActive) return null;
  
  if (hasPermission === false) {
    return (
      <div className="fixed bottom-4 right-4 p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg max-w-xs">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <i className="ri-error-warning-fill text-red-500 text-xl"></i>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Webcam Access Required</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>Webcam access is required for this quiz. Please enable your camera and refresh the page.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 p-2 bg-white border border-gray-200 rounded-lg shadow-lg">
      <div className="flex flex-col">
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-40 h-30 rounded-md object-cover"
          />
          
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/50 text-white text-xs rounded">
            <span className={facesDetected === 1 ? 'text-green-400' : 'text-red-400'}>
              {facesDetected === 0 ? 'No face detected' : 
               facesDetected === 1 ? 'Proctoring active' : 
               'Multiple faces detected'}
            </span>
          </div>
        </div>
        
        <div className="mt-1 text-center">
          <p className="text-xs text-gray-500">Webcam proctoring enabled</p>
        </div>
      </div>
    </div>
  );
};

export default WebcamProctoring; 