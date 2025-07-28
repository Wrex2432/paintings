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

// Storage for all image elements
const imageMap = {
  'in': [],
  'out': [],
  'default': null,
  'removed': null
};

// Preload and insert all frames into canvasPng (Zoetrope style)
function preloadAndPlaceImages() {
  return new Promise(resolve => {
    let loadCount = 0;
    const totalToLoad = animateInTotalFrames + animateOutTotalFrames + 2;

    // Helper
    const createFrame = (src, list) => {
      const img = document.createElement('img');
      img.src = src;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.position = 'absolute';
      img.style.top = 0;
      img.style.left = 0;
      img.style.visibility = 'hidden';

      img.onload = img.onerror = () => {
        loadCount++;
        if (loadCount === totalToLoad) resolve();
      };

      canvasPng.appendChild(img);
      list.push(img);
    };

    // Default and Removed
    imageMap.default = document.createElement('img');
    imageMap.default.src = staticDefault;
    imageMap.default.style = "width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;";
    canvasPng.appendChild(imageMap.default);

    imageMap.removed = document.createElement('img');
    imageMap.removed.src = staticRemoved;
    imageMap.removed.style = "width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;visibility:hidden;";
    canvasPng.appendChild(imageMap.removed);

    imageMap.default.onload = imageMap.default.onerror = () => {
      loadCount++;
      if (loadCount === totalToLoad) resolve();
    };
    imageMap.removed.onload = imageMap.removed.onerror = () => {
      loadCount++;
      if (loadCount === totalToLoad) resolve();
    };

    // Animate-In
    for (let i = 0; i <= animateInTotalFrames; i++) {
      const padded = i.toString().padStart(2, '0');
      const src = `${animateInPath}${filePrefix}${padded}.jpg`;
      createFrame(src, imageMap.in);
    }

    // Animate-Out
    for (let i = 0; i <= animateOutTotalFrames; i++) {
      const padded = i.toString().padStart(2, '0');
      const src = `${animateOutPath}${filePrefix}${padded}.jpg`;
      createFrame(src, imageMap.out);
    }
  });
}

function hideAllFrames() {
  Object.values(imageMap.in).forEach(img => img.style.visibility = 'hidden');
  Object.values(imageMap.out).forEach(img => img.style.visibility = 'hidden');
  if (imageMap.default) imageMap.default.style.visibility = 'hidden';
  if (imageMap.removed) imageMap.removed.style.visibility = 'hidden';
}

function playSequence(type, totalFrames, fallbackImage) {
  clearInterval(frameInterval);
  const frames = imageMap[type];
  let frame = 0;

  frameInterval = setInterval(() => {
    if (frame > totalFrames) {
      clearInterval(frameInterval);
      hideAllFrames();
      fallbackImage.style.visibility = 'visible';
      return;
    }

    hideAllFrames();
    if (frames[frame]) {
      frames[frame].style.visibility = 'visible';
    }
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
      playSequence('out', animateOutTotalFrames, imageMap.removed);
    }
  } else if (Date.now() - lastDetectionTime > 3000) {
    if (currentState !== 'default') {
      currentState = 'default';
      playSequence('in', animateInTotalFrames, imageMap.default);
    }
  }
}

async function init() {
  statusText.textContent = 'Loading model...';
  model = await cocoSsd.load();
  console.log('✅ Model loaded');

  statusText.textContent = 'Placing images...';
  await preloadAndPlaceImages();
  console.log('✅ Frames loaded');

  hideAllFrames();
  imageMap.default.style.visibility = 'visible';

  await setupCamera();
  startDetection();

  statusWrapper.style.display = 'none';
}

window.addEventListener('DOMContentLoaded', init);
