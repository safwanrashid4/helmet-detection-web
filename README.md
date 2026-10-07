# 🪖 Helmet Detection Web App

A browser-based helmet detection application built using **YOLO11n**, **INT8 TFLite**, **LiteRT**, **React**, and **TypeScript**.

The application detects riders, drivers, helmets, and riders without helmets from images and videos directly inside the user's browser.

> **No inference server is required.**  
> The TFLite model is downloaded by the browser and inference runs locally on the user's device using LiteRT WebAssembly.

---

## 🚀 Features

- Image-based helmet detection
- Video frame detection
- Bounding-box visualization
- Adjustable confidence threshold
- Detection summary by class
- Drag-and-drop media upload
- Client-side AI inference
- INT8 quantized TFLite model
- Responsive React interface
- No Python backend required for inference

---

## 🧠 Model

| Property          | Value              |
| ----------------- | ------------------ |
| Model             | YOLO11n            |
| Framework         | Ultralytics YOLO   |
| Input Size        | 640 × 640          |
| TFLite Model      | INT8 Quantized     |
| Browser Runtime   | LiteRT             |
| Execution         | WebAssembly (WASM) |
| Number of Classes | 4                  |

### Detection Classes

The model detects:

1. `bicyclist`
2. `driver`
3. `helmet`
4. `no-helmet`

---

## 📊 Training Results

The YOLO11n model was trained for **2 epochs** for this learning and deployment project.

Final validation results were approximately:

| Metric    | Result |
| --------- | -----: |
| Precision |  0.818 |
| Recall    |  0.752 |
| mAP@50    |  0.826 |
| mAP@50-95 |  0.557 |

### Per-Class Results

| Class     | Precision | Recall | mAP@50 | mAP@50-95 |
| --------- | --------: | -----: | -----: | --------: |
| bicyclist |     0.644 |  0.776 |  0.749 |     0.537 |
| driver    |     0.859 |  0.887 |  0.938 |     0.705 |
| helmet    |     0.891 |  0.748 |  0.833 |     0.541 |
| no-helmet |     0.879 |  0.595 |  0.784 |     0.447 |

The goal of this project is to demonstrate the complete deployment pipeline rather than maximize model accuracy.

---

## ⚡ Model Optimization

The trained YOLO11n model was exported and quantized to **INT8 TFLite** for lightweight deployment.

Approximate model sizes:

| Model                       |    Size |
| --------------------------- | ------: |
| YOLO11n PyTorch (`best.pt`) | 5.21 MB |
| INT8 TFLite                 | 3.04 MB |

The deployed application uses:

```text
helmet_yolo11n_best_int8.tflite
```

with model input:

```text
[1, 3, 640, 640]
```

and output:

```text
[1, 8, 8400]
```

---

## 🌐 Client-Side Inference Architecture

Unlike a traditional AI web application, this project does **not** send uploaded images or videos to a Python inference server.

Instead:

```text
                 Web Server
                     │
                     │
          React + JavaScript + TFLite
                     │
                     ▼
              User's Browser
                     │
              Download Model
                     │
                     ▼
             LiteRT WebAssembly
                     │
                     ▼
              YOLO11 Inference
                     │
                     ▼
               YOLO Output
                     │
                     ▼
               NMS / Filtering
                     │
                     ▼
              Bounding Boxes
```

This means that when another user opens the application, **their own device performs the AI inference**.

The server is only responsible for serving the website and model files.

### Why Client-Side Inference?

This approach provides several advantages:

- No dedicated inference server required
- User media stays on the client
- Reduced server-side compute requirements
- Easy static deployment
- Different users use their own device resources for inference

Inference performance depends on the hardware and browser of the device running the application.

---

## 🎥 Video Detection

Video detection is performed frame-by-frame.

Because browser-based WASM inference is significantly slower than a typical 30 or 60 FPS video, the AI bounding boxes may update at a lower rate than the source video.

For example:

```text
60 FPS Video
     │
     ├── Video continues playing
     │
     └── YOLO inference runs periodically
                │
                ▼
         Updated detections
```

Therefore, detection FPS depends on the user's hardware and model inference time rather than the original video's FPS.

---

## 🛠️ Tech Stack

### Frontend

- React
- TypeScript
- Vite
- HTML5 Canvas

### Machine Learning

- YOLO11n
- Ultralytics
- TFLite
- INT8 Quantization

### Browser Inference

- LiteRT.js
- WebAssembly (WASM)

---

## 📁 Project Structure

```text
helmet-detector-react/
│
├── public/
│   └── models/
│       └── helmet_yolo11n_best_int8.tflite
│
├── src/
│   ├── model/
│   │   └── detector.ts
│   │
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── main.tsx
│
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

---

## 💻 Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/safwanrashid4/helmet-detection-web.git
```

Enter the project:

```bash
cd helmet-detection-web
```

### 2. Install dependencies

Make sure Node.js and npm are installed.

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

Vite will display a local development URL such as:

```text
http://localhost:5173
```

Open it in your browser.

---

## 🖼️ Image Detection

1. Select the **Image** tab.
2. Upload or drag and drop an image.
3. Choose the confidence threshold.
4. Click **Run Detection**.
5. Bounding boxes and detection results will appear.

Detected objects are displayed using different colors for:

- 🟡 Bicyclist
- 🔵 Driver
- 🟢 Helmet
- 🔴 No Helmet

---

## 🎬 Video Detection

1. Select the **Video** tab.
2. Upload a supported video.
3. Press **Play**.
4. The model analyzes frames while the video plays.
5. Current detections are displayed over the video and in the results panel.

Video inference performance depends on the user's CPU and browser performance.

---

## 🔍 YOLO Output Processing

The exported model produces an output tensor with shape:

```text
[1, 8, 8400]
```

The eight channels represent:

```text
0 → x center
1 → y center
2 → width
3 → height
4 → bicyclist confidence
5 → driver confidence
6 → helmet confidence
7 → no-helmet confidence
```

The application:

1. Preprocesses the image/video frame to `640 × 640`
2. Converts RGB pixels into NCHW Float32 input
3. Executes the TFLite model using LiteRT
4. Decodes the YOLO output
5. Applies confidence filtering
6. Applies Non-Maximum Suppression (NMS)
7. Draws the final detections using HTML Canvas

---

## ⚠️ Current Limitations

- The model was trained for only 2 epochs as part of a learning/deployment project.
- Browser WASM inference is slower than native GPU inference.
- Video bounding boxes can lag behind fast-moving objects when inference is slower than video playback.
- Detection accuracy depends on image quality, camera angle, lighting, and similarity to the training dataset.
- Confidence values from the current quantized model may be less granular than the original model.

---

## 🎯 Project Objective

The main objective of this project is to demonstrate an end-to-end computer vision deployment workflow:

```text
Dataset
   ↓
YOLO11 Training
   ↓
Model Evaluation
   ↓
INT8 Quantization
   ↓
TFLite Export
   ↓
Browser Integration
   ↓
React Web Application
   ↓
Client-Side AI Inference
```

The project demonstrates how a trained object detection model can be optimized and deployed directly into a modern web application without requiring a dedicated inference backend.

---

## 👨‍💻 Author

**Safwan Rashid**

GitHub: [safwanrashid4](https://github.com/safwanrashid4)

LinkedIn: [Safwan Rashid](https://www.linkedin.com/in/safwan-rashid-082581247/)

---

## 📄 License

This project is intended for educational and demonstration purposes.
