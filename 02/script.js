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

let animateInTotalFrames = 0;
let animateOutTotalFrames = 0;

const scene = 'Fruit Seller';
const filePrefix = 'Fruit Seller';
const basePath = `assets/${scene}/`;
const animateInPath = `${basePath}Animate-In/`;
const animateOutPath = `${basePath}Animate-Out/`;
const staticDefault = `${basePath}Static/${filePrefix}Default.jpg`;
const staticRemoved = `${basePath}Static/${filePrefix}Removed.jpg`;

const phoneClasses = ['cell phone', 'mobile phone', 'remote'];

const imgElement = document.createElement('img');
imgElement.style.width = '100%';
imgElement.style.height = '100%';
imgElement.style.objectFit = 'contain';
canvasPng.appendChild(imgElement);

// Check how many frames exist in a given folder
async function getFrameCount(folder, prefix) {
  let frame = 0;
  while (true) {
    const padded = frame.toString().padStart(2, '0');
    const url = `${folder}${prefix}${padded}.jpg`;
    const exists = await testImage(url);
    if (!exists) break;
    frame++;
  }
  return frame - 1;
}

// Check if an image exists
function testImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url + `?v=${Date.now()}`;
  });
}

// Play an animation sequence
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

// Set up webcam
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

// Start detection
function startDetection() {
  if (isDetecting) return;
  isDetecting = true;
  detectionInterval = setInterval(detectObjects, 300);
}

// Main detection logic
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

// Initialization
async function init() {
  imgElement.src = staticDefault;
  statusText.textContent = 'Loading model...';

  model = await cocoSsd.load();
  console.log('✅ Model loaded');

  statusText.textContent = 'Counting animation frames...';
  [animateInTotalFrames, animateOutTotalFrames] = await Promise.all([
    getFrameCount(animateInPath, filePrefix),
    getFrameCount(animateOutPath, filePrefix)
  ]);
  console.log(`🎞 Animate-In: ${animateInTotalFrames + 1} frames`);
  console.log(`🎞 Animate-Out: ${animateOutTotalFrames + 1} frames`);

  await setupCamera();
  startDetection();

  statusWrapper.style.display = 'none';
}

window.addEventListener('DOMContentLoaded', init);
