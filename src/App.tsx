/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Settings, 
  History, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info,
  ArrowLeft,
  X,
  Plus,
  Trash2,
  Loader2,
  Scan,
  Search,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { cn } from './lib/utils';
import { ALLERGENS } from './constants';
import { Allergen, AllergenProfile, ScanResult, ScanStatus } from './types';
import { analyzeIngredients } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import confetti from 'canvas-confetti';

// Sub-components for better focus management and performance
const BpomInput = ({ onSearch, isProcessing }: { onSearch: (query: string) => void, isProcessing: boolean }) => {
  const [query, setQuery] = useState("");
  return (
    <motion.div 
      key="bpom-input-wrapper"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-xl"
    >
      <div className="relative">
        <input 
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Masukkan nomor MD/ML/NA..."
          className="w-full p-4 pl-12 bg-slate-50 rounded-2xl border border-slate-100 text-sm focus:ring-4 focus:ring-emerald-100 focus:border-emerald-300 focus:outline-none font-medium"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
      </div>
      <button
        id="btn-bpom-scan"
        onClick={() => onSearch(query)}
        disabled={isProcessing || !query.trim()}
        className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 disabled:bg-slate-300 shadow-lg active:scale-95 transition-all"
      >
        {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
        Cek Keaslian BPOM
      </button>
    </motion.div>
  );
};

const ManualScannerInput = ({ onScan, isProcessing }: { onScan: (text: string) => void, isProcessing: boolean }) => {
  const [text, setText] = useState("");
  return (
    <motion.div 
      key="manual-input-wrapper"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-xl"
    >
      <textarea 
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Tempel atau ketik komposisi ingredients di sini..."
        className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 focus:outline-none min-h-[120px] font-medium"
      />
      <button
        id="btn-manual-scan"
        onClick={() => onScan(text)}
        disabled={isProcessing || !text.trim()}
        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 disabled:bg-slate-300 shadow-lg active:scale-95 transition-all"
      >
        {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        Analisis Komposisi
      </button>
    </motion.div>
  );
};

export default function App() {
  const [view, setView] = useState<'onboarding' | 'home' | 'scanning' | 'result' | 'history' | 'settings' | 'bpom-result'>('onboarding');
  const [profile, setProfile] = useState<AllergenProfile>({ selected: [] });
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [bpomResult, setBpomResult] = useState<any>(null);
  const [showBpom, setShowBpom] = useState(false);

  const checkBpom = async (query: string) => {
    if (!query.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const response = await fetch(`/api/bpom?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Gagal mengecek BPOM");
      }

      setBpomResult(data);
      setView('bpom-result');
      setShowBpom(false);
    } catch (err: any) {
      console.error("Check BPOM Error:", err);
      setError(err.message || "Gagal mengecek BPOM. Coba lagi nanti.");
    } finally {
      setIsProcessing(false);
    }
  };

  const performManualScan = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const analysis = await analyzeIngredients({ text }, profile);
      const result: ScanResult = {
        ...analysis,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      
      setCurrentResult(result);
      saveHistory(result);
      setView('result');
      setShowManual(false);
      
      if (result.status === 'safe') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#34d399', '#6ee7b7']
        });
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis");
    } finally {
      setIsProcessing(false);
    }
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load persistence
  useEffect(() => {
    const savedProfile = localStorage.getItem('alergiscan_profile');
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
      setView('home');
    }
    const savedHistory = localStorage.getItem('alergiscan_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const saveProfile = (newProfile: AllergenProfile) => {
    setProfile(newProfile);
    localStorage.setItem('alergiscan_profile', JSON.stringify(newProfile));
  };

  const saveHistory = (newResult: ScanResult) => {
    const updated = [newResult, ...history].slice(0, 20);
    setHistory(updated);
    localStorage.setItem('alergiscan_history', JSON.stringify(updated));
  };

  const startScanning = async () => {
    setView('scanning');
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Try to apply advanced focus constraints if supported
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities?.focusMode?.includes('continuous')) {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' }] as any
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      setError("Kamera tidak dapat diakses. Gunakan fitur upload gambar.");
      setView('home');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setIsProcessing(true);
      setError(null);
      stopScanning(); // Just in case it was open
      
      try {
        const analysis = await analyzeIngredients({ base64 }, profile);
        const result: ScanResult = {
          ...analysis,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          image: base64
        };
        
        setCurrentResult(result);
        saveHistory(result);
        setView('result');
        
        if (result.status === 'safe') {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#34d399', '#6ee7b7']
          });
        }
      } catch (err: any) {
        setError(err.message || "Gagal memproses gambar");
        setView('home');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const stopScanning = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);
    
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8);
    stopScanning();

    try {
      const analysis = await analyzeIngredients({ base64 }, profile);
      const result: ScanResult = {
        ...analysis,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        image: base64
      };
      
      setCurrentResult(result);
      saveHistory(result);
      setView('result');
      
      if (result.status === 'safe') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#34d399', '#6ee7b7']
        });
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during scanning");
      setView('home');
    } finally {
      setIsProcessing(false);
    }
  };

  // Views components inline below in return



  return (
    <div className="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl">
      <AnimatePresence mode="wait">
        {view === 'onboarding' && (
          <motion.div 
            key="onboarding"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col min-h-screen p-8 max-w-md mx-auto bg-slate-50"
            id="onboarding-view"
          >
            <div className="flex-1 space-y-10 mt-12 text-center">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
                  <Scan className="w-10 h-10 text-white" />
                </div>
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 font-sans">
                  Alergi<span className="text-indigo-600">Scan</span>
                </h1>
                <p className="text-slate-500 text-lg leading-relaxed font-medium">
                  Scan ingredients kemasan makanan untuk deteksi alergen instan.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                {ALLERGENS.map((a) => (
                  <button
                    key={a}
                    id={`allergen-${a}`}
                    onClick={() => {
                      const isSelected = profile.selected.includes(a as Allergen);
                      const next = isSelected 
                        ? profile.selected.filter(x => x !== a)
                        : [...profile.selected, a as Allergen];
                      saveProfile({ ...profile, selected: next });
                    }}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col gap-2 relative overflow-hidden",
                      profile.selected.includes(a as Allergen)
                        ? "border-indigo-600 bg-white text-indigo-700 shadow-md ring-4 ring-indigo-50"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-sm uppercase tracking-wide">{a}</span>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        profile.selected.includes(a as Allergen)
                          ? "border-indigo-600 bg-indigo-600"
                          : "border-slate-200"
                      )}>
                        {profile.selected.includes(a as Allergen) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pb-8 pt-8">
              <button
                id="btn-onboarding-next"
                disabled={profile.selected.length === 0}
                onClick={() => setView('home')}
                className={cn(
                  "w-full py-5 rounded-2xl font-bold text-lg transition-all shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] active:scale-95",
                  profile.selected.length > 0
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-300 text-slate-100 cursor-not-allowed shadow-none"
                )}
              >
                Siap Belanja Aman
              </button>
              <div className="mt-6 p-4 bg-slate-200/50 rounded-xl border border-slate-200">
                 <p className="text-center text-[10px] text-slate-500 leading-tight uppercase font-bold tracking-tighter">
                   DISCLAIMER: Aplikasi ini alat bantu. Selalu cek label fisik secara teliti.
                 </p>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-slate-50 flex flex-col font-sans" 
            id="home-view"
          >
            {/* Header */}
            <nav className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                  <Scan className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Alergi<span className="text-indigo-600">Scan</span></h1>
              </div>
              
              <button 
                id="btn-settings"
                onClick={() => setView('settings')}
                className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </nav>

            {/* Main Action */}
            <main className="flex-1 p-6 space-y-8">
              <section className="space-y-4">
                <div className="flex flex-wrap gap-2 mb-2">
                  {profile.selected.map(a => (
                    <span key={a} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-100 uppercase tracking-wider">{a}</span>
                  ))}
                </div>
                
                <button
                  id="btn-scan"
                  onClick={startScanning}
                  className="w-full aspect-[4/3] bg-slate-900 rounded-[2rem] relative overflow-hidden border-[8px] border-white shadow-2xl group active:scale-[0.98] transition-all"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#2d3748_1px,_transparent_1px)] bg-[size:24px_24px] opacity-20"></div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-white">
                    <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white/20 group-hover:scale-110 transition-transform">
                      <Camera className="w-10 h-10" />
                    </div>
                    <div className="text-center">
                      <span className="block text-xl font-extrabold uppercase tracking-tight">Buka Kamera</span>
                      <span className="text-white/50 text-xs font-medium tracking-wide">Fokus otomatis aktif</span>
                    </div>
                  </div>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <label className="cursor-pointer py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                    <History className="w-5 h-5 text-indigo-400 rotate-180" />
                    Galeri
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                  
                  <button
                    id="btn-manual-toggle"
                    onClick={() => setShowManual(!showManual)}
                    className="py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <Plus className="w-5 h-5 text-indigo-600" />
                    Text
                  </button>
                </div>

                <button
                  id="btn-bpom-toggle"
                  onClick={() => setShowBpom(!showBpom)}
                  className="w-full py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
                >
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Cek BPOM (Nomor Registrasi)
                </button>

                <AnimatePresence>
                  {showBpom && (
                    <BpomInput onSearch={checkBpom} isProcessing={isProcessing} />
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showManual && (
                    <ManualScannerInput onScan={performManualScan} isProcessing={isProcessing} />
                  )}
                </AnimatePresence>
              </section>

              {/* History Preview */}
              <section className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    Scan Terakhir
                  </h3>
                  <button 
                    id="view-all-history"
                    onClick={() => setView('history')}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Lihat Semua
                  </button>
                </div>

                <div className="space-y-3">
                  {history.length === 0 ? (
                    <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-200 text-center space-y-2">
                      <History className="w-8 h-8 text-slate-200 mx-auto" />
                      <p className="text-slate-400 text-sm font-medium italic">Belum ada riwayat</p>
                    </div>
                  ) : (
                    history.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentResult(item);
                          setView('result');
                        }}
                        className="w-full p-4 bg-white rounded-2xl border border-slate-100 flex items-center gap-4 hover:border-slate-300 hover:shadow-md transition-all active:scale-[0.98]"
                      >
                        <div className={cn(
                          "w-2 h-10 rounded-full shrink-0",
                          item.status === 'danger' ? "bg-red-500" :
                          item.status === 'warning' ? "bg-amber-400" :
                          "bg-emerald-500"
                        )}></div>
                        <div className="flex-1 text-left">
                          <p className="font-bold text-slate-800 line-clamp-1 text-sm uppercase tracking-tight">
                            {item.foundAllergens.length > 0 ? item.foundAllergens.join(", ") : "Bahan Aman"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </button>
                    ))
                  )}
                </div>
              </section>
            </main>
            
            {/* Branding Footer */}
            <footer className="h-10 bg-slate-100 px-6 flex items-center justify-between border-t border-slate-200">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">v1.0.4-MVP • On-Device Engine</p>
              <div className="flex gap-3">
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Bantuan</p>
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Privasi</p>
              </div>
            </footer>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  className="fixed bottom-6 left-6 right-6 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-between z-50 border border-white/10"
                >
                  <span className="text-xs font-bold uppercase tracking-wide">{error}</span>
                  <button onClick={() => setError(null)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {view === 'scanning' && (
          <motion.div 
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900 z-50 flex flex-col h-[100dvh]" 
            id="scanning-view"
          >
            <div className="relative flex-1 bg-slate-900 overflow-hidden">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                className="w-full h-full object-cover opacity-80"
              />
              
              <div className="absolute inset-0 scanner-overlay"></div>
              <div className="absolute inset-[15%] border-2 border-white/20 rounded-3xl backdrop-blur-[1px]">
                <div className="absolute -top-3 -left-3 w-10 h-10 border-t-8 border-l-8 border-indigo-400 rounded-tl-xl shadow-[0_0_15px_rgba(129,140,248,0.5)]"></div>
                <div className="absolute -top-3 -right-3 w-10 h-10 border-t-8 border-r-8 border-indigo-400 rounded-tr-xl shadow-[0_0_15px_rgba(129,140,248,0.5)]"></div>
                <div className="absolute -bottom-3 -left-3 w-10 h-10 border-b-8 border-l-8 border-indigo-400 rounded-bl-xl shadow-[0_0_15px_rgba(129,140,248,0.5)]"></div>
                <div className="absolute -bottom-3 -right-3 w-10 h-10 border-b-8 border-r-8 border-indigo-400 rounded-br-xl shadow-[0_0_15px_rgba(129,140,248,0.5)]"></div>
                <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_20px_rgba(129,140,248,0.8)] scan-line"></div>
              </div>

              <button 
                id="btn-close-scan"
                onClick={() => {
                  stopScanning();
                  setView('home');
                }}
                className="absolute top-[calc(env(safe-area-inset-top)+1rem)] left-6 p-4 bg-white/10 text-white rounded-2xl backdrop-blur-xl border border-white/20 hover:bg-white/20 transition-all z-10"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>

              <div className="absolute bottom-10 left-0 right-0 flex justify-center p-4">
                  <div className="px-6 py-3 bg-black/60 text-white rounded-full text-xs font-bold uppercase tracking-widest backdrop-blur-xl border border-white/10 flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                    Fokuskan pada daftar komposisi
                  </div>
              </div>
            </div>

            <div className="bg-slate-900 p-6 flex justify-between items-center px-10 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 24px) + 1.5rem)' }}>
              <label className="p-4 bg-white/10 text-white rounded-2xl backdrop-blur-md border border-white/10 cursor-pointer active:scale-95 transition-all">
                <History className="w-6 h-6 rotate-180" />
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>

              <button 
                id="btn-capture"
                disabled={isProcessing}
                onClick={captureAndScan}
                className={cn(
                  "w-20 h-20 md:w-24 md:h-24 rounded-full border-[6px] flex items-center justify-center transition-all bg-indigo-600 shadow-[0_0_30px_rgba(79,70,229,0.4)]",
                  isProcessing ? "border-slate-700 opacity-50" : "border-white active:scale-90"
                )}
              >
                <div className={cn(
                  "transition-all flex items-center justify-center",
                  isProcessing ? "w-10 h-10 bg-slate-600 rounded-sm animate-spin" : "w-14 h-14 md:w-16 md:h-16 bg-white rounded-full"
                )}>
                  {isProcessing && <Loader2 className="w-6 h-6 text-white" />}
                </div>
              </button>

              <div className="w-14"></div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        )}

        {view === 'result' && currentResult && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="min-h-screen flex flex-col bg-slate-50 px-6 py-8 space-y-6 max-w-md mx-auto"
            id="result-view"
          >
            <header className="flex items-center gap-4">
              <button 
                id="btn-back-from-result"
                onClick={() => setView('home')} 
                className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 text-slate-600"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Analisis Hasil</h2>
            </header>

            <div className={cn(
              "p-8 rounded-[2.5rem] border-2 relative overflow-hidden shadow-2xl",
              currentResult.status === 'danger' ? "bg-red-50 border-red-200 text-red-700" :
              currentResult.status === 'warning' ? "bg-amber-50 border-amber-200 text-amber-800" :
              "bg-emerald-50 border-emerald-200 text-emerald-800"
            )}>
               <div className="absolute -right-4 -top-4 opacity-5 transform rotate-12 scale-150">
                 {currentResult.status === 'danger' ? <XCircle className="w-48 h-48" /> : 
                  currentResult.status === 'warning' ? <AlertTriangle className="w-48 h-48" /> : 
                  <CheckCircle2 className="w-48 h-48" />}
               </div>

               <div className="flex items-start gap-5 relative z-10">
                 <div className={cn(
                   "w-16 h-16 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-lg",
                   currentResult.status === 'danger' ? "bg-red-600 text-white" : 
                   currentResult.status === 'warning' ? "bg-amber-500 text-white" : 
                   "bg-emerald-600 text-white"
                 )}>
                   {currentResult.status === 'danger' ? <XCircle className="w-10 h-10" /> : 
                    currentResult.status === 'warning' ? <AlertTriangle className="w-10 h-10" /> : 
                    <CheckCircle2 className="w-10 h-10" />}
                 </div>
                 <div className="flex-1">
                   <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] mb-1 opacity-70">
                     Status: {currentResult.status === 'danger' ? "Bahaya" : currentResult.status === 'warning' ? "Hati-Hati" : "Aman"}
                   </p>
                   <h3 className="text-2xl font-black leading-none tracking-tight">
                     {currentResult.status === 'danger' ? "Mengandung Alergen" : 
                      currentResult.status === 'warning' ? "Perlu Konfirmasi" : 
                      "Bahan Aman"}
                   </h3>
                 </div>
               </div>
               
               <div className="mt-8 p-5 bg-white/60 rounded-2xl border border-white/40 backdrop-blur-sm relative z-10">
                 <div className="text-sm font-medium leading-relaxed prose prose-sm max-w-none prose-slate">
                    <ReactMarkdown>{currentResult.explanation}</ReactMarkdown>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Alergen Cocok</h4>
                <div className="flex flex-wrap gap-2">
                  {currentResult.foundAllergens.length > 0 ? (
                    currentResult.foundAllergens.map(a => (
                      <span key={a} className="px-3 py-1 bg-red-100 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-wider">{a}</span>
                    ))
                  ) : (
                    <span className="text-[10px] font-bold text-slate-300 uppercase italic">Tidak Ada</span>
                  )}
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mendeteksi</h4>
                <p className="text-3xl font-black text-slate-800 tracking-tighter">{currentResult.ingredients.length} <span className="text-xs text-slate-400 uppercase tracking-widest align-middle ml-1">Bahan</span></p>
              </div>
            </div>

            <details className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group">
              <summary className="p-5 font-bold text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors list-none flex justify-between items-center">
                <span className="text-[11px] uppercase tracking-widest">Detail Komposisi</span>
                <ChevronRight className="w-5 h-5 transition-transform group-open:rotate-90 text-slate-300" />
              </summary>
              <div className="p-5 pt-0 border-t border-slate-50 flex flex-wrap gap-2">
                 {currentResult.ingredients.map((ing, i) => (
                   <span key={i} className="text-[10px] font-bold uppercase bg-slate-100 px-2.5 py-1.5 rounded-lg text-slate-500 border border-slate-200 tracking-tight">
                     {ing}
                   </span>
                 ))}
              </div>
            </details>

            <div className="pt-4 flex gap-4">
              <button 
                onClick={startScanning}
                className="flex-1 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 active:scale-95 transition-all shadow-[0_15px_30px_-5px_rgba(79,70,229,0.3)]"
              >
                <Camera className="w-5 h-5" />
                Scan Baru
              </button>
              <button 
                onClick={() => setView('settings')}
                className="p-5 bg-white border-2 border-slate-200 rounded-[1.5rem] text-slate-600 active:scale-95 transition-all shadow-sm flex items-center justify-center"
              >
                <Settings className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200">
              <p className="text-[9px] text-slate-500 leading-normal font-medium">
                 <span className="font-bold text-slate-700">DISCLAIMER:</span> Selalu double-check label fisik. Aplikasi ini adalah alat bantu deteksi dan tidak menggantikan saran medis profesional.
              </p>
            </div>
          </motion.div>
        )}

        {view === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="min-h-screen bg-neutral-50 flex flex-col p-6 space-y-6" 
            id="history-view"
          >
            <header className="flex items-center gap-4">
              <button 
                onClick={() => setView('home')} 
                className="p-2 bg-white rounded-xl shadow-sm border border-neutral-200"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-bold">Semua Riwayat</h2>
            </header>

            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-20 text-neutral-400">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Belum ada riwayat scan</p>
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentResult(item);
                      setView('result');
                    }}
                    className="w-full p-5 bg-white rounded-3xl border border-neutral-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center",
                      item.status === 'danger' ? "bg-red-50 text-red-500" :
                      item.status === 'warning' ? "bg-amber-50 text-amber-500" :
                      "bg-emerald-50 text-emerald-500"
                    )}>
                      {item.status === 'danger' ? <XCircle className="w-8 h-8" /> : 
                       item.status === 'warning' ? <AlertTriangle className="w-8 h-8" /> : 
                       <CheckCircle2 className="w-8 h-8" />}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-neutral-900">
                        {item.foundAllergens.length > 0 ? item.foundAllergens.join(", ") : "Aman & Bersih"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          item.status === 'danger' ? "bg-red-100 text-red-600" :
                          item.status === 'warning' ? "bg-amber-100 text-amber-600" :
                          "bg-emerald-100 text-emerald-600"
                        )}>
                          {item.status}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-neutral-300" />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}

        {view === 'settings' && (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="min-h-screen bg-neutral-50 flex flex-col p-6 space-y-8" 
            id="settings-view"
          >
            <header className="flex items-center gap-4">
              <button 
                onClick={() => setView('home')} 
                className="p-2 bg-white rounded-xl shadow-sm border border-neutral-200"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-bold">Profil Alergi</h2>
            </header>

            <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-6">
              <div>
                <h3 className="font-bold text-lg mb-1">Alergen Dipantau</h3>
                <p className="text-sm text-neutral-500">Pilih bahan yang ingin kamu hindari saat belanja.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {ALLERGENS.map((a) => (
                  <button
                    key={a}
                    onClick={() => {
                      const isSelected = profile.selected.includes(a as Allergen);
                      const next = isSelected 
                        ? profile.selected.filter(x => x !== a)
                        : [...profile.selected, a as Allergen];
                      saveProfile({ ...profile, selected: next });
                    }}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all flex items-center gap-3",
                      profile.selected.includes(a as Allergen)
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-neutral-100 bg-neutral-50 text-neutral-400"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2",
                      profile.selected.includes(a as Allergen) ? "bg-emerald-500 border-emerald-500" : "border-neutral-200"
                    )}></div>
                    <span className="font-semibold text-sm">{a}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" />
                Data & Privasi
              </h3>
              <button 
                onClick={() => {
                  if(confirm("Hapus semua riwayat scan?")) {
                    setHistory([]);
                    localStorage.removeItem('alergiscan_history');
                  }
                }}
                className="w-full text-left py-2 text-red-600 font-semibold"
              >
                Hapus Riwayat Scan
              </button>
              <button 
                onClick={() => {
                  if(confirm("Reset semua pengaturan dan data?")) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="w-full text-left py-2 text-red-600 font-semibold opacity-60"
              >
                Reset Aplikasi
              </button>
            </div>

            <div className="text-center">
              <p className="text-xs text-neutral-400">AlergiScan v1.0.4-MVP</p>
              <p className="text-xs text-neutral-400">Powered by Gemini AI Studio</p>
            </div>
          </motion.div>
        )}

        {view === 'bpom-result' && bpomResult && (
          <motion.div 
            key="bpom-result"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="min-h-screen flex flex-col bg-slate-50 px-6 py-8 space-y-6 max-w-md mx-auto"
            id="bpom-result-view"
          >
            <header className="flex items-center gap-4">
              <button 
                onClick={() => setView('home')} 
                className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 text-slate-600"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Status BPOM</h2>
            </header>

            <div className={cn(
              "p-8 rounded-[2.5rem] border-2 relative overflow-hidden shadow-2xl text-center",
              bpomResult.data?.length > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
            )}>
              <div className="flex flex-col items-center gap-4 relative z-10">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center shadow-lg",
                  bpomResult.data?.length > 0 ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                )}>
                  {bpomResult.data?.length > 0 ? <ShieldCheck className="w-12 h-12" /> : <AlertTriangle className="w-12 h-12" />}
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight mb-1">
                    {bpomResult.data?.length > 0 ? "Terverifikasi BPOM" : "Tidak Ditemukan"}
                  </h3>
                  <p className="text-sm font-bold opacity-70 uppercase tracking-widest">
                    {bpomResult.data?.length > 0 ? "Produk Terdaftar Resmi" : "Periksa Kembali Nomor MD/ML/NA"}
                  </p>
                </div>
              </div>
            </div>

            {bpomResult.data?.map((item: any, idx: number) => (
              <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Nama Produk</p>
                  <p className="font-extrabold text-slate-800 leading-tight">{item.PRODUCT_NAME}</p>
                  <p className="text-xs font-bold text-indigo-600">{item.PRODUCT_BRANDS}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Nomor Reg</p>
                    <p className="font-bold text-slate-700 text-sm">{item.PRODUCT_REGISTER}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Tgl Terbit</p>
                    <p className="font-bold text-slate-700 text-sm">{item.PRODUCT_DATE}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Pendaftar/Produsen</p>
                  <p className="font-bold text-slate-700 text-sm leading-tight">{item.REGISTRAR}</p>
                  <p className="text-[10px] text-slate-500">{item.REGISTRAR_ADD}</p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <a 
                    href={`https://cekbpom.pom.go.id/produk/${item.PRODUCT_ID}/02/detail`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-100 transition-all text-sm"
                  >
                    Lihat Detail di Web BPOM
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}

            {bpomResult.data?.length === 0 && (
              <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
                <p className="text-slate-500 font-medium">Nomor registrasi yang Anda masukkan tidak terdaftar di database BPOM RI. Pastikan nomor yang dimasukkan sudah benar.</p>
                <button 
                  onClick={() => setView('home')}
                  className="px-8 py-3 bg-slate-900 text-white rounded-full font-bold text-sm"
                >
                  Coba Nomor Lain
                </button>
              </div>
            )}

            <div className="pt-4">
              <button 
                onClick={() => setView('home')}
                className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all"
              >
                Kembali ke Beranda
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            key="loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md"
          >
            <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-indigo-500/20 rounded-[2rem] absolute animate-pulse"></div>
              <div className="w-24 h-24 border-t-4 border-indigo-500 rounded-[2rem] animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Scan className="w-8 h-8 text-white animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Menganalisis...</h3>
              <p className="text-indigo-300 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Menghubungkan ke Gemini AI</p>
            </div>
            
            {/* Decorative Geometry */}
            <div className="absolute top-10 left-10 w-20 h-20 border border-white/5 rounded-full"></div>
            <div className="absolute bottom-20 right-10 w-32 h-32 border border-white/5 rounded-[3rem] rotate-12"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
