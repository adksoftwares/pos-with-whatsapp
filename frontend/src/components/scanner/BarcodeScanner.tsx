'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, Image as ImageIcon, Flashlight, Copy, CheckCircle2, RefreshCw, Upload, Sparkles, AlertCircle } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
import { 
  playBeepSound, 
  createPaddedCanvas, 
  applyProcessing, 
  PASSES, 
  SUPPORTED_BARCODE_FORMATS, 
  ZXING_WASM_FORMATS 
} from '../../lib/barcode-utils';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
}

export function BarcodeScanner({ onScan, onClose, title = "Barcode Scanner" }: BarcodeScannerProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'file'>('camera');
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("Initializing camera...");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [hasFlash, setHasFlash] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<any>(null);
  const scanCompletedRef = useRef<boolean>(false);

  const stopCamera = useCallback(() => {
    if (zxingControlsRef.current) {
       try { zxingControlsRef.current.stop(); } catch(e){}
       zxingControlsRef.current = null;
    }
    if (animationFrameRef.current) {
       cancelAnimationFrame(animationFrameRef.current);
       animationFrameRef.current = null;
    }
    if (streamRef.current) {
       streamRef.current.getTracks().forEach(track => {
           try { track.stop(); } catch(e){}
       });
       streamRef.current = null;
    }
    if (videoRef.current) {
       videoRef.current.srcObject = null;
    }
  }, []);

  const handleSuccess = useCallback((text: string) => {
    if (scanCompletedRef.current) return;
    scanCompletedRef.current = true;
    playBeepSound();
    setResult(text);
    setStatusText(`Detected: ${text}`);
    stopCamera();
    setTimeout(() => {
      onScan(text);
    }, 600);
  }, [onScan, stopCamera]);

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    readerRef.current = new BrowserMultiFormatReader(hints);
    
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const fetchDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      setVideoDevices(videoInputs);
      
      if (!selectedDeviceId && videoInputs.length > 0) {
        const backCamera = videoInputs.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('environment') || 
          d.label.toLowerCase().includes('rear')
        );
        if (backCamera) {
          setSelectedDeviceId(backCamera.deviceId);
        } else {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      }
    } catch (e) {
      console.warn("Could not enumerate camera devices", e);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (activeTab !== 'camera') {
      stopCamera();
      return;
    }

    let isMounted = true;
    scanCompletedRef.current = false;

    const startCamera = async () => {
      try {
        stopCamera();
        setError(null);
        setStatusText("Requesting camera access...");
        
        let videoConstraints: MediaTrackConstraints = {};
        if (selectedDeviceId) {
          videoConstraints = { deviceId: { exact: selectedDeviceId } };
        } else {
          videoConstraints = { facingMode: { ideal: "environment" } };
        }

        videoConstraints.width = { ideal: 1280 };
        videoConstraints.height = { ideal: 720 };
        (videoConstraints as any).advanced = [{ focusMode: "continuous" }];
        
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
        } catch (e) {
          const fallbackConstraints = selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: "environment" };
          stream = await navigator.mediaDevices.getUserMedia({ video: fallbackConstraints, audio: false });
        }

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(e => console.warn(e));
          
          fetchDevices();
          
          try {
            const track = stream.getVideoTracks()[0];
            if (track && (track.getCapabilities?.() as any)?.torch) {
              setHasFlash(true);
            } else {
              setHasFlash(false);
            }
          } catch (e) {
            setHasFlash(false);
          }
          
          // 3-Tier Scanning Engine Hierarchy
          let DetectorClass: any = null;
          
          // Tier 1: Native BarcodeDetector (Android Chrome / Chromium)
          if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            try {
              const supported = await (window as any).BarcodeDetector.getSupportedFormats();
              if (supported && supported.includes('ean_13')) {
                DetectorClass = (window as any).BarcodeDetector;
                if (isMounted) setStatusText("Using Native Barcode Engine");
              }
            } catch (e) {}
          }
          
          // Tier 2: WASM Polyfill (barcode-detector/pure)
          if (!DetectorClass) {
            try {
              if (isMounted) setStatusText("Initializing WASM Engine...");
              const polyfill = await import('barcode-detector/pure');
              DetectorClass = polyfill.BarcodeDetector;
              if (isMounted) setStatusText("WASM Barcode Engine Ready");
            } catch (e) {
              if (isMounted) setStatusText("Using JS Scanner Fallback");
            }
          }
          
          let detectorInstance: any = null;
          if (DetectorClass) {
            try {
              detectorInstance = new DetectorClass({
                formats: Array.from(SUPPORTED_BARCODE_FORMATS)
              });
            } catch (e) {
              try { detectorInstance = new DetectorClass(); } catch (err) {}
            }
          }
          
          if (detectorInstance) {
            let lastCheck = 0;
            const scanFrame = async (now: number) => {
              if (!isMounted || scanCompletedRef.current) return;

              if (!videoRef.current || videoRef.current.readyState < 2 || videoRef.current.paused) {
                animationFrameRef.current = requestAnimationFrame(scanFrame);
                return;
              }
              
              if (now - lastCheck > 80) {
                lastCheck = now;
                try {
                  const barcodes = await detectorInstance.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    handleSuccess(barcodes[0].rawValue);
                    return;
                  }
                } catch (e) {
                  // Keep scanning
                }
              }
              
              animationFrameRef.current = requestAnimationFrame(scanFrame);
            };
            animationFrameRef.current = requestAnimationFrame(scanFrame);
          } else if (readerRef.current) {
            // Tier 3: Pure JS Fallback (@zxing/browser)
            try {
              const controls = await readerRef.current.decodeFromStream(stream, videoRef.current, (res) => {
                if (res && isMounted && !scanCompletedRef.current) {
                  const text = res.getText();
                  if (text) {
                    handleSuccess(text);
                  }
                }
              });
              if (isMounted) {
                zxingControlsRef.current = controls;
              } else {
                try { controls.stop(); } catch(e){}
              }
            } catch (zxingErr) {
              console.warn("ZXing Stream error", zxingErr);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError("Camera could not be started. Check your browser camera permissions or try switching cameras.");
          setStatusText("Camera access denied or unavailable");
        }
      }
    };

    startCamera();
    
    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [activeTab, selectedDeviceId, stopCamera, handleSuccess]);

  const toggleFlash = async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track && hasFlash) {
        const nextState = !isFlashOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any]
        });
        setIsFlashOn(nextState);
      }
    } catch (e) {
      console.warn("Torch toggle failed", e);
    }
  };

  const processImageFile = async (file: File) => {
    if (!file) return;
    setIsProcessingFile(true);
    setError(null);
    setStatusText("Analyzing image...");

    try {
      // Pass 1: Direct WASM Reader
      try {
        const { readBarcodesFromImageFile } = await import('zxing-wasm/reader');
        const wasmResults = await readBarcodesFromImageFile(file, {
          tryHarder: true,
          formats: Array.from(ZXING_WASM_FORMATS) as any
        });
        if (wasmResults && wasmResults.length > 0 && wasmResults[0].text) {
          handleSuccess(wasmResults[0].text);
          return;
        }
      } catch (e) {
        // Fall through
      }

      // Load image into HTMLImageElement
      const imageUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to load image element"));
        image.src = imageUrl;
      });

      // Pass 2: Multi-pass canvas preprocessing with BarcodeDetector
      let DetectorClass: any = null;
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        DetectorClass = (window as any).BarcodeDetector;
      } else {
        try {
          const polyfill = await import('barcode-detector/pure');
          DetectorClass = polyfill.BarcodeDetector;
        } catch (e) {}
      }

      const paddedCanvas = createPaddedCanvas(img, 0.1);

      if (DetectorClass) {
        try {
          const detector = new DetectorClass({
            formats: Array.from(SUPPORTED_BARCODE_FORMATS)
          });

          for (const pass of PASSES) {
            setStatusText(`Scanning filter: ${pass}...`);
            const processedCanvas = applyProcessing(paddedCanvas, pass);
            try {
              const barcodes = await detector.detect(processedCanvas);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                URL.revokeObjectURL(imageUrl);
                handleSuccess(barcodes[0].rawValue);
                return;
              }
            } catch (e) {}
          }
        } catch (e) {}
      }

      // Pass 3: ZXing Browser Canvas & Image element fallback
      if (readerRef.current) {
        setStatusText("Applying ZXing deep scan...");
        try {
          const zxingRes = await readerRef.current.decodeFromCanvas(paddedCanvas);
          if (zxingRes && zxingRes.getText()) {
            URL.revokeObjectURL(imageUrl);
            handleSuccess(zxingRes.getText());
            return;
          }
        } catch (e) {}

        try {
          const directZxingRes = await readerRef.current.decodeFromImageElement(img);
          if (directZxingRes && directZxingRes.getText()) {
            URL.revokeObjectURL(imageUrl);
            handleSuccess(directZxingRes.getText());
            return;
          }
        } catch (e) {}
      }

      URL.revokeObjectURL(imageUrl);
      setError("No readable barcode detected. Please try a clearer or better-lit photo.");
      setStatusText("Detection failed");
    } catch (err: any) {
      setError(err?.message || "Error processing image.");
      setStatusText("Error processing file");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    } else {
      setError("Please drop a valid image file (PNG, JPG, WEBP).");
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const switchCamera = () => {
    if (videoDevices.length > 1) {
      const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      setSelectedDeviceId(videoDevices[nextIndex].deviceId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 backdrop-blur-sm sm:p-6 animate-in fade-in duration-200">
      <style>{`
        @keyframes laserSweep {
          0% {
            top: 8%;
            opacity: 0.85;
          }
          50% {
            top: 88%;
            opacity: 1;
          }
          100% {
            top: 8%;
            opacity: 0.85;
          }
        }
        .animate-laser {
          animation: laserSweep 2s ease-in-out infinite;
        }
      `}</style>

      <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col h-full max-h-[88vh] sm:h-auto sm:max-h-[90vh] border border-gray-100">
        
        {/* Header */}
        <header className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              {title}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Instant hardware/camera barcode reader</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Tabs & Controls */}
        <div className="flex border-b border-gray-100 bg-gray-50/70 px-3 pt-2 shrink-0 justify-between items-center">
          <div className="flex gap-1">
            <button
              onClick={() => { setActiveTab('camera'); setError(null); setResult(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors ${
                activeTab === 'camera' 
                  ? 'bg-white text-blue-600 border-t-2 border-t-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
              }`}
            >
              <Camera className="w-4 h-4" />
              Live Camera
            </button>
            <button
              onClick={() => { setActiveTab('file'); setError(null); setResult(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors ${
                activeTab === 'file' 
                  ? 'bg-white text-blue-600 border-t-2 border-t-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Image File
            </button>
          </div>
          
          {activeTab === 'camera' && videoDevices.length > 1 && (
            <button
              onClick={switchCamera}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors mb-1 rounded-md border border-gray-200 bg-white shadow-xs"
              title="Switch camera device"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Flip Camera</span>
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 flex flex-col items-center justify-center">
          
          {/* CAMERA TAB */}
          {activeTab === 'camera' && (
            <div className="w-full max-w-md flex flex-col items-center">
              <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden shadow-md border border-gray-800">
                {error ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-6 text-center bg-gray-900/90">
                    <AlertCircle className="w-12 h-12 mb-3 opacity-80 text-red-400" />
                    <p className="text-sm font-semibold">{error}</p>
                    <p className="text-xs mt-2 text-gray-400">Please check browser permissions or switch to another device camera.</p>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />
                    
                    {/* Viewfinder Reticle & Animated Laser Line */}
                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                      <div className="relative w-4/5 h-3/5 border border-white/30 rounded-lg">
                        
                        {/* Target Reticle Corners */}
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-cyan-400 rounded-tl-sm -mt-0.5 -ml-0.5"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-cyan-400 rounded-tr-sm -mt-0.5 -mr-0.5"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-cyan-400 rounded-bl-sm -mb-0.5 -ml-0.5"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-cyan-400 rounded-br-sm -mb-0.5 -mr-0.5"></div>

                        {/* Animated Red Laser Scanning Beam */}
                        <div className="absolute w-full h-[2px] bg-red-500 shadow-[0_0_12px_3px_rgba(239,68,68,0.9)] animate-laser"></div>
                        
                        {/* Live Status Pill */}
                        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[11px] font-medium text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-md whitespace-nowrap shadow-sm">
                          {statusText}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Flash / Torch Toggle */}
                {hasFlash && !error && (
                  <button
                    onClick={toggleFlash}
                    className={`absolute bottom-3 right-3 p-2.5 rounded-full z-20 shadow-md backdrop-blur-md transition-all ${
                      isFlashOn ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300' : 'bg-black/50 text-white hover:bg-black/70'
                    }`}
                    title="Toggle Flashlight / Torch"
                  >
                    <Flashlight className="w-5 h-5" />
                  </button>
                )}
                
                {/* Mobile Camera Switch Overlay */}
                {videoDevices.length > 1 && !error && (
                  <button
                    onClick={switchCamera}
                    className="absolute bottom-3 left-3 p-2.5 rounded-full z-20 shadow-md backdrop-blur-md transition-all bg-black/50 text-white hover:bg-black/70 sm:hidden"
                    title="Switch Camera"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              {/* Camera Selection Dropdown */}
              {!error && videoDevices.length > 1 && (
                <div className="mt-3 w-full flex justify-center">
                  <select 
                    className="bg-white border border-gray-300 text-gray-700 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-1.5 max-w-[85%] shadow-xs"
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                  >
                    {videoDevices.map((device, idx) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-2 text-center">
                Position barcode or QR inside the glowing viewfinder.
              </p>
            </div>
          )}

          {/* FILE UPLOAD / DRAG & DROP TAB */}
          {activeTab === 'file' && (
            <div 
              className={`w-full max-w-md flex flex-col items-center justify-center py-10 px-6 border-2 border-dashed rounded-2xl bg-white transition-all cursor-pointer ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' 
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileInputChange}
              />
              
              <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-3 shadow-inner">
                {isProcessingFile ? (
                  <RefreshCw className="w-8 h-8 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8" />
                )}
              </div>

              <p className="text-sm font-semibold text-gray-800">
                {isProcessingFile ? "Analyzing Barcode Across Multiple Passes..." : "Click or drag & drop image file here"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Supports PNG, JPG, JPEG, WEBP</p>
              
              {isProcessingFile && (
                <p className="text-xs text-blue-600 mt-2 font-medium animate-pulse">
                  {statusText}
                </p>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2 max-w-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* DETECTED RESULT CARD */}
          {result && (
            <div className="mt-5 w-full max-w-md bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-emerald-800 tracking-wide uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Barcode Detected
                </span>
                <button 
                  onClick={copyToClipboard}
                  className="text-emerald-700 hover:text-emerald-900 bg-emerald-100/60 hover:bg-emerald-200 p-1.5 rounded-md transition-colors"
                  title="Copy barcode"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="font-mono text-base font-semibold text-emerald-950 break-all bg-white p-2.5 rounded-lg border border-emerald-200 shadow-inner">
                {result}
              </div>
              <p className="text-xs text-emerald-700 mt-2 font-medium flex items-center gap-1">
                Applying to current workflow automatically...
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
