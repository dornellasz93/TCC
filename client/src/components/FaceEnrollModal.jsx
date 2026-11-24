import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, CheckCircle2, Scan, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function FaceEnrollModal({ student, onClose, onEnrolled }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

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

      // Navegadores bloqueiam getUserMedia em HTTP fora de localhost/127.0.0.1
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Acesso direto à câmera bloqueado pelo navegador porque a página não está em HTTPS ou localhost. Use o botão "Tirar Foto / Enviar Imagem" abaixo ou acesse via http://localhost.'
        );
        setStreamActive(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreamActive(true);
      }
    } catch (err) {
      let msg = 'Não foi possível abrir a câmera do navegador.';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        msg = 'Permissão de câmera negada no navegador. Libere o acesso no ícone de cadeado da barra de endereços ou use o botão de foto abaixo.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        msg = 'Nenhuma webcam encontrada neste dispositivo. Use o botão de envio de foto abaixo ou o app React Native.';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        msg = 'A câmera está sendo usada por outro aplicativo. Feche o outro app ou use o botão de envio de foto abaixo.';
      }
      setCameraError(msg);
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
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

  // Fallback universal: funciona no celular via câmera nativa mesmo sem HTTPS, e no PC via arquivo
  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const targetW = 480;
        const targetH = Math.max(1, Math.round((img.height / img.width) * targetW));
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(jpegDataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFileSelected}
              className="hidden"
            />

            {/* Mantém o elemento de vídeo sempre montado para que videoRef.current exista ao iniciar a câmera */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${
                !capturedPhoto && streamActive ? 'block' : 'hidden'
              }`}
            />

            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Biometria capturada" className="w-full h-full object-cover" />
            ) : streamActive ? (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-44 h-56 face-oval-guide success" />
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-amber-300 flex flex-col items-center gap-3">
                <span>{cameraError || 'Iniciando câmera...'}</span>
                {cameraError && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="btn-secondary px-3 py-1.5 text-[11px] flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tentar Câmera Novamente</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {capturedPhoto ? (
              <>
                <button
                  type="button"
                  onClick={() => setCapturedPhoto(null)}
                  className="btn-secondary w-full sm:flex-1 py-2.5 text-xs"
                >
                  Tirar Outra
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-success w-full sm:flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{saving ? 'Extraindo Vetor...' : 'Salvar Biometria'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={!streamActive}
                  className="btn-primary w-full sm:flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capturar Rosto</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary w-full sm:flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Tirar Foto / Enviar Imagem</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
