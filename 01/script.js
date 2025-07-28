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

const scene = 'Carabao Painting';
const filePrefix = 'CarabaoPainting';
const basePath = `assets/${scene}/`;
const animateInPath = `${basePath}Animate-In/`;
const animateOutPath = `${basePath}Animate-Out/`;
const staticDefault = `${basePath}Static/${filePrefix}.jpg`;
const staticRemoved = `${basePath}Static/${filePrefix}_Edited.jpg`;

const animateInTotalFrames = 60;
const animateOutTotalFrames = 59;

const phoneClasses = ['cell phone', 'mobile phone', 'remote'];

const imgElement = document.createElement('img');
imgElement.style.width = '100%';
imgElement.style.height = '100%';
imgElement.style.objectFit = 'contain';
canvasPng.appendChild(imgElement);

// Preload and inject all necessary images
function preloadAndPlaceImages() {
  const preloadContainer = document.createElement('div');
  preloadContainer.style.display = 'none';
  document.body.appendChild(preloadContainer);

  const sources = [];

  // Static images
  sources.push(staticDefault);
  sources.push(staticRemoved);

  // Animate-In frames
  for (let i = 0; i <= animateInTotalFrames; i++) {
    const padded = i.toString().padStart(2, '0');
    sources.push(`${animateInPath}${filePrefix}${padded}.jpg`);
  }

  // Animate-Out frames
  for (let i = 0; i <= animateOutTotalFrames; i++) {
    const padded = i.toString().padStart(2, '0');
    sources.push(`${animateOutPath}${filePrefix}${padded}.jpg`);
  }

  return Promise.all(
    sources.map(src => {
      return new Promise(resolve => {
        const img = document.createElement('img');
        img.src = src;
        img.onload = img.onerror = resolve;
        preloadContainer.appendChild(img); // Ensures inclusion + preload
      });
    })
  );
}

// Plays a specific animation sequence with its frame count
function playSequence(folder, frameCount, endImage, onComplete = null) {
  clearInterval(frameInterval);
  let frame = 0;

  frameInterval = setInterval(() => {
    if (frame > frameCount) {
      clearInterval(frameInterval);
      imgElement.src = endImage;
      if (onComplete) onComplete();
      return;
    }
    const padded = frame.toString().padStart(2, '0');
    imgElement.src = `${folder}${filePrefix}${padded}.jpg`;
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
      playSequence(animateOutPath, animateOutTotalFrames, staticRemoved);
    }
  } else if (Date.now() - lastDetectionTime > 3000) {
    if (currentState !== 'default') {
      currentState = 'default';
      playSequence(animateInPath, animateInTotalFrames, staticDefault);
    }
  }
}

async function init() {
  imgElement.src = staticDefault;
  statusText.textContent = 'Loading model...';

  try {
    model = await cocoSsd.load();
    console.log('✅ Model loaded');

    statusText.textContent = 'Preloading images...';
    await preloadAndPlaceImages();
    console.log('✅ Images preloaded and injected');

    await setupCamera();
    startDetection();

    statusWrapper.style.display = 'none';
  } catch (err) {
    console.error('Initialization error:', err);
    statusText.textContent = '❌ Initialization failed.';
  }
}

window.addEventListener('DOMContentLoaded', init);
