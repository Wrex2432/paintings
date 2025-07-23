const webcam = document.getElementById('webcam');
const detectionContainer = document.getElementById('detection-container');
const statusText = document.getElementById('status-text');
const statusWrapper = document.getElementById('status');
const canvasPng = document.getElementById('canvas-png');

let model = null;
let isDetecting = false;
let detectionInterval = null;
let lastDetectionTime = 0;
let currentState = 'default';
let frameInterval = null;
let frameRate = 60;
let totalFrames = 60;

const scene = 'Carabao Painting';
const filePrefix = 'CarabaoPainting';
const basePath = `assets/${scene}/`;
const animateInPath = `${basePath}Animate-In/`;
const animateOutPath = `${basePath}Animate-Out/`;
const staticDefault = `${basePath}Static/${filePrefix}Default.png`;
const staticRemoved = `${basePath}Static/${filePrefix}Removed.png`;

const phoneClasses = ['cell phone', 'mobile phone', 'remote'];

const imgElement = document.createElement('img');
imgElement.style.width = '100%';
imgElement.style.height = '100%';
imgElement.style.objectFit = 'contain';
canvasPng.appendChild(imgElement);

function preloadAndPlaceImages () {
  const preloadContainer = document.createElement('div');
  preloadContainer.style.display = 'none';
  document.body.appendChild(preloadContainer);

  const sources = [];

  // Static frames
  sources.push(staticDefault);
  sources.push(staticRemoved);

  // Frame sequences
  for (let i = 0; i <= totalFrames; i++) {
    const padded = i.toString().padStart(2, '0');
    sources.push(`${animateInPath}${filePrefix}${padded}.png`);
    sources.push(`${animateOutPath}${filePrefix}${padded}.png`);
  }

  return Promise.all(
    sources.map(src => {
      return new Promise(resolve => {
        const img = document.createElement('img');
        img.src = src;
        img.onload = img.onerror = resolve;
        preloadContainer.appendChild(img); // force inclusion in build + preload
      });
    })
  );
}

function playSequence(folder, endImage, onComplete = null) {
  clearInterval(frameInterval);
  let frame = 0;

  frameInterval = setInterval(() => {
    if (frame > totalFrames) {
      clearInterval(frameInterval);
      imgElement.src = endImage;
      if (onComplete) onComplete();
      return;
    }
    const padded = frame.toString().padStart(2, '0');
    imgElement.src = `${folder}${filePrefix}${padded}.png`;
    frame++;
  }, frameRate);
}

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
      audio: false
    });
    webcam.srcObject = stream;
    return new Promise(resolve => {
      webcam.onloadedmetadata = () => {
        webcam.play();
        resolve();
      };
    });
  } catch (err) {
    statusText.textContent = '❌ Camera access denied.';
    console.error('Camera error:', err);
    throw err;
  }
}

function startDetection() {
  if (isDetecting) return;
  isDetecting = true;
  detectionInterval = setInterval(detectObjects, 300);
}

async function detectObjects() {
  if (!model) return;
  const predictions = await model.detect(webcam);

  let phoneDetected = false;

  predictions.forEach(pred => {
    const predictionClass = pred.class.toLowerCase();
    if (phoneClasses.includes(predictionClass)) {
      phoneDetected = true;
    }
  });

  if (phoneDetected) {
    lastDetectionTime = Date.now();
    if (currentState !== 'removed') {
      currentState = 'removed';
      playSequence(animateOutPath, staticRemoved);
    }
  } else if (Date.now() - lastDetectionTime > 3000) {
    if (currentState !== 'default') {
      currentState = 'default';
      playSequence(animateInPath, staticDefault);
    }
  }
}

async function init() {
  imgElement.src = staticDefault;
  statusText.textContent = 'Loading model...';

  try {
    model = await cocoSsd.load();
    console.log('✅ Model loaded');

    statusText.textContent = 'Preloading PNGs...';
    await preloadAndPlaceImages();
    console.log('✅ PNGs preloaded & injected');

    await setupCamera();
    startDetection();

    statusWrapper.style.display = 'none';
  } catch (err) {
    console.error('Initialization error:', err);
    statusText.textContent = '❌ Initialization failed.';
  }
}

window.addEventListener('DOMContentLoaded', init);
