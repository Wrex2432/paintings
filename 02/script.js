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
let totalFrames = 0;
let frameRate = 60;

const scene = 'Fruit Seller';
const filePrefix = 'Fruit Seller';
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

async function getFrameCount(folder, prefix) {
  let frame = 0;
  while (true) {
    const padded = frame.toString().padStart(2, '0');
    const url = `${folder}${prefix}${padded}.png`;
    const exists = await testImage(url);
    if (!exists) break;
    frame++;
  }
  return frame - 1;
}

function testImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url + `?v=${Date.now()}`;
  });
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
  totalFrames = await getFrameCount(animateInPath, filePrefix);

  statusText.textContent = 'Loading model...';
  model = await cocoSsd.load();

  await setupCamera();
  startDetection();

  // Hide status after a second
  statusWrapper.style.display = 'none';
}

window.addEventListener('DOMContentLoaded', init);
