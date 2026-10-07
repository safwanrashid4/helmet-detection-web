import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import {
  detectImage,
  detectVideoFrame,
  type Detection,
} from "./model/detector";

import "./App.css";

type MediaMode = "image" | "video";

const CLASS_COLORS: Record<string, string> = {
  bicyclist: "#facc15",
  driver: "#38bdf8",
  helmet: "#22c55e",
  "no-helmet": "#ef4444",
};

function App() {
  const [mode, setMode] = useState<MediaMode>("image");

  // Image state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(false);

  // Video state
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState("");
  const [videoDetections, setVideoDetections] = useState<Detection[]>([]);
  const [videoDetecting, setVideoDetecting] = useState(false);

  // Shared state
  const [dragging, setDragging] = useState(false);
  const [confidence, setConfidence] = useState(25);

  // Image refs
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoRunningRef = useRef(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const clearVideoCanvas = () => {
    const canvas = videoCanvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  // -------------------------------------------------------
  // IMAGE
  // -------------------------------------------------------

  const selectImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    const url = URL.createObjectURL(file);

    setImageUrl(url);
    setFileName(file.name);
    setDetections([]);

    clearCanvas();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      selectImage(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    setDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      selectImage(file);
    }
  };

  const drawDetections = (image: HTMLImageElement, results: Detection[]) => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    results.forEach((detection) => {
      drawBox(ctx, canvas.width, canvas.height, detection);
    });
  };

  const runDetection = async () => {
    const image = imageRef.current;

    if (!image) return;

    setLoading(true);

    try {
      const results = await detectImage(image, confidence / 100);

      setDetections(results);

      drawDetections(image, results);
    } catch (error) {
      console.error("Detection failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeImage = () => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl(null);
    setFileName("");
    setDetections([]);

    clearCanvas();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // -------------------------------------------------------
  // VIDEO
  // -------------------------------------------------------

  const selectVideo = (file: File) => {
    if (!file.type.startsWith("video/")) {
      alert("Please select a video file.");
      return;
    }

    stopVideoDetection();

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    const url = URL.createObjectURL(file);

    setVideoUrl(url);
    setVideoFileName(file.name);
    setVideoDetections([]);

    clearVideoCanvas();
  };

  const handleVideoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      selectVideo(file);
    }
  };

  const handleVideoDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    setDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      selectVideo(file);
    }
  };

  const drawVideoDetections = (
    video: HTMLVideoElement,
    results: Detection[],
  ) => {
    const canvas = videoCanvasRef.current;

    if (!canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    results.forEach((detection) => {
      drawBox(ctx, canvas.width, canvas.height, detection);
    });
  };

  const startVideoDetection = async () => {
    const video = videoRef.current;

    if (!video || videoRunningRef.current) {
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    videoRunningRef.current = true;
    setVideoDetecting(true);

    try {
      while (videoRunningRef.current && !video.paused && !video.ended) {
        const results = await detectVideoFrame(video, confidence / 100);

        if (!videoRunningRef.current) {
          break;
        }

        setVideoDetections(results);

        drawVideoDetections(video, results);

        /*
         * Your WASM inference already takes roughly
         * 450-500 ms, so this tiny delay prevents
         * unnecessarily hammering the browser.
         */
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 50);
        });
      }
    } catch (error) {
      console.error("Video detection failed:", error);
    } finally {
      videoRunningRef.current = false;
      setVideoDetecting(false);
    }
  };

  function stopVideoDetection() {
    videoRunningRef.current = false;
    setVideoDetecting(false);
  }

  const removeVideo = () => {
    stopVideoDetection();

    const video = videoRef.current;

    if (video) {
      video.pause();
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    setVideoUrl(null);
    setVideoFileName("");
    setVideoDetections([]);

    clearVideoCanvas();

    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  // -------------------------------------------------------
  // SHARED DRAWING
  // -------------------------------------------------------

  const drawBox = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    detection: Detection,
  ) => {
    const x = detection.x * canvasWidth;

    const y = detection.y * canvasHeight;

    const width = detection.width * canvasWidth;

    const height = detection.height * canvasHeight;

    const color = CLASS_COLORS[detection.className] ?? "#ffffff";

    ctx.strokeStyle = color;

    ctx.lineWidth = Math.max(3, canvasWidth / 300);

    ctx.strokeRect(x, y, width, height);

    const label =
      `${detection.className} ` + `${(detection.score * 100).toFixed(1)}%`;

    const fontSize = Math.max(16, Math.round(canvasWidth / 50));

    ctx.font = `600 ${fontSize}px Inter, Arial, sans-serif`;

    const padding = 8;

    const textWidth = ctx.measureText(label).width;

    const labelHeight = fontSize + padding * 1.4;

    let labelY = y - labelHeight;

    if (labelY < 0) {
      labelY = y;
    }

    ctx.fillStyle = color;

    ctx.fillRect(x, labelY, textWidth + padding * 2, labelHeight);

    ctx.fillStyle = "#07111f";

    ctx.fillText(label, x + padding, labelY + fontSize);
  };

  // -------------------------------------------------------
  // COUNTS
  // -------------------------------------------------------

  const getClassCount = (className: string) =>
    detections.filter((detection) => detection.className === className).length;

  const getVideoClassCount = (className: string) =>
    videoDetections.filter((detection) => detection.className === className)
      .length;

  const switchMode = (newMode: MediaMode) => {
    if (newMode === "image") {
      stopVideoDetection();

      if (videoRef.current) {
        videoRef.current.pause();
      }
    }

    setMode(newMode);
  };

  return (
    <div className="app">
      <header className="navbar">
        <div className="nav-content">
          <div className="brand">
            <div className="brand-icon">H</div>

            <div>
              <span className="brand-name">HelmetAI</span>

              <span className="brand-subtitle">Road Safety Detection</span>
            </div>
          </div>

          <div className="nav-status">
            <span className="status-dot" />
            Browser AI
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-badge">YOLO11 COMPUTER VISION</div>

          <h1>
            Intelligent Helmet
            <span> Detection</span>
          </h1>

          <p className="hero-description">
            Detect riders, drivers, helmets and safety violations directly in
            your browser using an optimized YOLO11 TFLite model.
          </p>

          <div className="model-grid">
            <div className="model-card">
              <span>Model</span>
              <strong>YOLO11n</strong>
            </div>

            <div className="model-card">
              <span>Format</span>
              <strong>INT8 TFLite</strong>
            </div>

            <div className="model-card">
              <span>Input</span>
              <strong>640 × 640</strong>
            </div>

            <div className="model-card">
              <span>Classes</span>
              <strong>4 Classes</strong>
            </div>
          </div>
        </section>

        <section className="workspace">
          <div className="workspace-header">
            <div>
              <span className="section-label">DETECTION WORKSPACE</span>

              <h2>Analyze Media</h2>

              <p>
                Upload an image or video and run helmet detection locally in
                your browser.
              </p>
            </div>

            <div className="mode-switch">
              <button
                className={mode === "image" ? "mode-active" : ""}
                onClick={() => switchMode("image")}
              >
                Image
              </button>

              <button
                className={mode === "video" ? "mode-active" : ""}
                onClick={() => switchMode("video")}
              >
                Video
              </button>
            </div>
          </div>

          {/* VIDEO MODE */}

          {mode === "video" ? (
            <>
              {!videoUrl ? (
                <div
                  className={`upload-zone ${
                    dragging ? "upload-zone-active" : ""
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleVideoDrop}
                  onClick={() => videoInputRef.current?.click()}
                >
                  <div className="upload-icon">▶</div>

                  <h3>Drop your video here</h3>

                  <p>or click to browse from your computer</p>

                  <span>MP4, WEBM, MOV</span>

                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoFileChange}
                    hidden
                  />
                </div>
              ) : (
                <div className="analysis-grid">
                  <div className="viewer-panel">
                    <div className="panel-header">
                      <div>
                        <span className="panel-title">Video Detection</span>

                        <span className="file-name">{videoFileName}</span>
                      </div>

                      <div className="video-header-actions">
                        <span
                          className={`video-status ${
                            videoDetecting ? "video-status-running" : ""
                          }`}
                        >
                          <span />
                          {videoDetecting ? "AI Running" : "Ready"}
                        </span>

                        <button className="remove-button" onClick={removeVideo}>
                          Change Video
                        </button>
                      </div>
                    </div>

                    <div className="image-viewer video-viewer">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        controls
                        playsInline
                        onPlay={startVideoDetection}
                        onPause={stopVideoDetection}
                        onEnded={stopVideoDetection}
                      />

                      <canvas ref={videoCanvasRef} />
                    </div>

                    <div className="viewer-controls">
                      <div className="confidence-control">
                        <div>
                          <span>Confidence</span>

                          <strong>{confidence}%</strong>
                        </div>

                        <input
                          type="range"
                          min="25"
                          max="90"
                          value={confidence}
                          onChange={(event) =>
                            setConfidence(Number(event.target.value))
                          }
                        />
                      </div>

                      <div className="video-ai-note">
                        {videoDetecting
                          ? "Analyzing current frames..."
                          : "Press play to start AI detection"}
                      </div>
                    </div>
                  </div>

                  <aside className="results-panel">
                    <div className="results-heading">
                      <div>
                        <span className="section-label">LIVE RESULTS</span>

                        <h3>Current Frame</h3>
                      </div>

                      <div className="result-total">
                        {videoDetections.length}
                      </div>
                    </div>

                    {videoDetections.length === 0 ? (
                      <div className="empty-results">
                        <div>◎</div>

                        <h4>Waiting for detections</h4>

                        <p>
                          Play the video to start frame-by-frame YOLO inference.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="class-summary">
                          {["helmet", "no-helmet", "driver", "bicyclist"].map(
                            (className) => (
                              <div className="class-count" key={className}>
                                <span
                                  className="class-color"
                                  style={{
                                    background: CLASS_COLORS[className],
                                  }}
                                />

                                <span>{className}</span>

                                <strong>{getVideoClassCount(className)}</strong>
                              </div>
                            ),
                          )}
                        </div>

                        <div className="detection-list">
                          {videoDetections.map((detection, index) => (
                            <div
                              className="detection-item"
                              key={`${detection.className}-${index}`}
                            >
                              <span
                                className="detection-indicator"
                                style={{
                                  background: CLASS_COLORS[detection.className],
                                }}
                              />

                              <div>
                                <strong>{detection.className}</strong>

                                <span>Current frame</span>
                              </div>

                              <b>{(detection.score * 100).toFixed(1)}%</b>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </aside>
                </div>
              )}
            </>
          ) : (
            <>
              {/* IMAGE MODE */}

              {!imageUrl ? (
                <div
                  className={`upload-zone ${
                    dragging ? "upload-zone-active" : ""
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="upload-icon">↑</div>

                  <h3>Drop your image here</h3>

                  <p>or click to browse from your computer</p>

                  <span>JPG, JPEG, PNG, WEBP</span>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    hidden
                  />
                </div>
              ) : (
                <div className="analysis-grid">
                  <div className="viewer-panel">
                    <div className="panel-header">
                      <div>
                        <span className="panel-title">Detection Preview</span>

                        <span className="file-name">{fileName}</span>
                      </div>

                      <button className="remove-button" onClick={removeImage}>
                        Change Image
                      </button>
                    </div>

                    <div className="image-viewer">
                      <img
                        ref={imageRef}
                        src={imageUrl}
                        alt="Detection input"
                      />

                      <canvas ref={canvasRef} />

                      {loading && (
                        <div className="loading-overlay">
                          <div className="spinner" />

                          <span>Running YOLO11...</span>
                        </div>
                      )}
                    </div>

                    <div className="viewer-controls">
                      <div className="confidence-control">
                        <div>
                          <span>Confidence</span>

                          <strong>{confidence}%</strong>
                        </div>

                        <input
                          type="range"
                          min="25"
                          max="90"
                          value={confidence}
                          onChange={(event) =>
                            setConfidence(Number(event.target.value))
                          }
                        />
                      </div>

                      <button
                        className="detect-button"
                        onClick={runDetection}
                        disabled={loading}
                      >
                        {loading ? "Detecting..." : "Run Detection"}
                      </button>
                    </div>
                  </div>

                  <aside className="results-panel">
                    <div className="results-heading">
                      <div>
                        <span className="section-label">RESULTS</span>

                        <h3>Detection Summary</h3>
                      </div>

                      <div className="result-total">{detections.length}</div>
                    </div>

                    {detections.length === 0 ? (
                      <div className="empty-results">
                        <div>◎</div>

                        <h4>No results yet</h4>

                        <p>Run detection to analyze the uploaded image.</p>
                      </div>
                    ) : (
                      <>
                        <div className="class-summary">
                          {["helmet", "no-helmet", "driver", "bicyclist"].map(
                            (className) => (
                              <div className="class-count" key={className}>
                                <span
                                  className="class-color"
                                  style={{
                                    background: CLASS_COLORS[className],
                                  }}
                                />

                                <span>{className}</span>

                                <strong>{getClassCount(className)}</strong>
                              </div>
                            ),
                          )}
                        </div>

                        <div className="detection-list">
                          {detections.map((detection, index) => (
                            <div
                              className="detection-item"
                              key={`${detection.className}-${index}`}
                            >
                              <span
                                className="detection-indicator"
                                style={{
                                  background: CLASS_COLORS[detection.className],
                                }}
                              />

                              <div>
                                <strong>{detection.className}</strong>

                                <span>Detection #{index + 1}</span>
                              </div>

                              <b>{(detection.score * 100).toFixed(1)}%</b>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </aside>
                </div>
              )}
            </>
          )}
        </section>

        <section className="legend-section">
          <div>
            <span className="section-label">MODEL CLASSES</span>

            <h2>What the model detects</h2>
          </div>

          <div className="legend">
            {["bicyclist", "driver", "helmet", "no-helmet"].map((className) => (
              <div className="legend-item" key={className}>
                <span
                  style={{
                    background: CLASS_COLORS[className],
                  }}
                />

                {className}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <p>YOLO11n • LiteRT • React • Browser-based inference</p>
      </footer>
    </div>
  );
}

export default App;
