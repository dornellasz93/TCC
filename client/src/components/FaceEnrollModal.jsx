import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, CheckCircle2, Scan, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function FaceEnrollModal({ student, onClose, onEnrolled }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamActive(true);
      }
    } catch (err) {
      setCameraError('Não foi possível abrir a câmera do navegador. Verifique permissões ou cadastre diretamente pelo app React Native.');
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = 480;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * 480);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
  };

  const handleSave = async () => {
    if (!capturedPhoto) return;
    setSaving(true);
    setError(null);
    try {
      const { ok, data } = await apiFetch('/api/auth/enroll-face', {
        method: 'POST',
        body: JSON.stringify({ photo_base64: capturedPhoto })
      });
      if (!ok || !data.success) {
        throw new Error(data.message || 'Erro ao cadastrar biometria facial.');
      }
      if (onEnrolled) onEnrolled(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="glass-card max-w-lg w-full border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-2.5">
            <Scan className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white font-heading">Cadastro Biométrico Facial (SQLite)</h3>
              <p className="text-[11px] text-slate-400">{student?.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Capture uma foto frontal bem iluminada. O back-end Node.js extrairá o <strong>vetor biométrico facial</strong> e salvará no banco SQLite para validação real nas suas chamadas.
          </p>

          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
            <canvas ref={canvasRef} className="hidden" />
            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Biometria capturada" className="w-full h-full object-cover" />
            ) : streamActive ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-44 h-56 face-oval-guide success" />
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-xs text-amber-300">
                {cameraError || 'Iniciando câmera...'}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            {capturedPhoto ? (
              <>
                <button
                  type="button"
                  onClick={() => setCapturedPhoto(null)}
                  className="btn-secondary flex-1 py-2.5 text-xs"
                >
                  Tirar Outra
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-success flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{saving ? 'Extraindo Vetor...' : 'Salvar Biometria'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleCapture}
                disabled={!streamActive}
                className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                <span>Capturar Rosto de Referência</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
