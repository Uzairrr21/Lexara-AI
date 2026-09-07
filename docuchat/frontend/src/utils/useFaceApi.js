import { useState, useRef, useCallback } from 'react';

// We load face-api.js lazily
let faceapi = null;
let modelsLoaded = false;

async function loadFaceApi() {
  if (!faceapi) {
    faceapi = await import('face-api.js');
  }
  if (!modelsLoaded) {
    const MODEL_URL = '/models';
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  }
  return faceapi;
}

export function useFaceApi() {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const initCamera = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise(resolve => { videoRef.current.onloadedmetadata = resolve; });
        await videoRef.current.play();
      }

      // Show the live camera while the face models load.
      await loadFaceApi();
      setStatus('ready');
    } catch (err) {
      setError(err.message || 'Camera access denied');
      setStatus('error');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStatus('idle');
  }, []);

  const captureDescriptor = useCallback(async () => {
    if (!videoRef.current || !faceapi) throw new Error('Camera not ready');
    if (videoRef.current.readyState < 2) throw new Error('Camera is not ready yet. Please wait a moment.');
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection) throw new Error('No face detected. Make sure your face is visible and well-lit.');
    return Array.from(detection.descriptor);
  }, []);

  return { videoRef, status, error, initCamera, stopCamera, captureDescriptor };
}
