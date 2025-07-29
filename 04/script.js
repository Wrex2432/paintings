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
let reconnectInterval = null;
let isAnimating = false;
let videoDevices = [];
let currentDeviceIndex = 0;

const frameRate = 30;
const scene = 'Palay Maiden';
const filePrefix = 'Palay Maiden';
const animateInTotalFrames = 39;
const animateOutTotalFrames = 84;

const basePath = `assets/${scene}/`;
const animateInPath = `${basePath}Animate-In/`;
const animateOutPath = `${basePath}Animate-Out/`;
const staticDefault = `${basePath}Static/${filePrefix}.jpg`;
const staticRemoved = `${basePath}Static/${filePrefix}_Edited.jpg`;

const phoneClasses = ['cell phone', 'mobile phone', 'remote'];

const imageMap = {
  in: [],
  out: [],
  default: null,
  removed: null
};

// Preload and inject all image frames
function preloadAndPlaceImages () {
  return new Promise(resolve => {
    let loadCount = 0;
    const totalToLoad = animateInTotalFrames + animateOutTotalFrames + 2;

    const addImg = (src, list) => {
      const img = document.createElement('img');
      img.src = src;
      img.style = 'width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;visibility:hidden;';
      img.onload = img.onerror = () => {
        loadCount++;
        if (loadCount === totalToLoad) resolve();
      };
      canvasPng.appendChild(img);
      list.push(img);
    };

    // Default
    imageMap.default = document.createElement('img');
    imageMap.default.src = staticDefault;
    imageMap.default.style = 'width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;';
    imageMap.default.onload = imageMap.default.onerror = () => {
      loadCount++;
      if (loadCount === totalToLoad) resolve();
    };
    canvasPng.appendChild(imageMap.default);

    // Removed
    imageMap.removed = document.createElement('img');
    imageMap.removed.src = staticRemoved;
    imageMap.removed.style = 'width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;visibility:hidden;';
    imageMap.removed.onload = imageMap.removed.onerror = () => {
      loadCount++;
      if (loadCount === totalToLoad) resolve();
    };
    canvasPng.appendChild(imageMap.removed);

    for (let i = 0; i <= animateInTotalFrames; i++) {
      const padded = i.toString().padStart(2, '0');
      addImg(`${animateInPath}${filePrefix}${padded}.jpg`, imageMap.in);
    }
    for (let i = 0; i <= animateOutTotalFrames; i++) {
      const padded = i.toString().padStart(2, '0');
      addImg(`${animateOutPath}${filePrefix}${padded}.jpg`, imageMap.out);
    }
  });
}

function hideAllFrames () {
  imageMap.in.forEach(img => img.style.visibility = 'hidden');
  imageMap.out.forEach(img => img.style.visibility = 'hidden');
  if (imageMap.default) imageMap.default.style.visibility = 'hidden';
  if (imageMap.removed) imageMap.removed.style.visibility = 'hidden';
}

function playSequence (type, totalFrames, fallbackImage) {
  if (isAnimating) return;
  isAnimating = true;
  clearInterval(frameInterval);
  const frames = imageMap[type];
  let frame = 0;

  frameInterval = setInterval(() => {
    if (frame > totalFrames) {
      clearInterval(frameInterval);
      hideAllFrames();
      fallbackImage.style.visibility = 'visible';
      isAnimating = false;
      return;
    }
    hideAllFrames();
    if (frames[frame]) frames[frame].style.visibility = 'visible';
    frame++;
  }, frameRate);
}

async function listVideoDevices () {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter(d => d.kind === 'videoinput');
  console.log('🎥 Devices:', videoDevices);
}

async function switchCamera () {
  if (videoDevices.length <= 1) return;

  currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
  const selectedDevice = videoDevices[currentDeviceIndex];
  console.log(`🔁 Switching to: ${selectedDevice.label}`);

  if (webcam.srcObject) webcam.srcObject.getTracks().forEach(track => track.stop());

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: { exact: selectedDevice.deviceId },
      width: { ideal: 640 }, height: { ideal: 480 },
      facingMode: 'environment'
    },
    audio: false
  });

  webcam.srcObject = stream;
  webcam.onloadedmetadata = () => webcam.play();
}

function toggleDebugView() {
  const isHidden = canvasPng.style.display === 'none';
  canvasPng.style.display = isHidden ? 'block' : 'none';
  webcam.style.display = isHidden ? 'none' : 'block';
  detectionContainer.style.display = isHidden ? 'none' : 'block';
  console.log(`🐞 Debug mode: ${isHidden ? 'Off (PNG active)' : 'On (Webcam visible + Detection Boxes)'}`);
}


async function setupCamera () {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
      audio: false
    });

    webcam.srcObject = stream;

    return new Promise(resolve => {
      webcam.onloadedmetadata = () => {
        webcam.play();
        statusWrapper.style.display = 'none';
        if (reconnectInterval) clearInterval(reconnectInterval);

        const track = stream.getVideoTracks()[0];
        if (track && track.onended === null) {
          track.onended = () => {
            console.warn('📴 Camera ended');
            enterReconnectMode();
          };
        }

        resolve();
      };
    });
  } catch (e) {
    console.warn('❌ No camera:', e);
    enterReconnectMode();
    throw e;
  }
}

function enterReconnectMode () {
  statusWrapper.style.display = 'block';
  statusText.textContent = 'Searching for camera...';

  if (!reconnectInterval) {
    reconnectInterval = setInterval(async () => {
      try {
        await setupCamera();
        startDetection();
      } catch { }
    }, 3000);
  }
}

function drawDetectionBox (prediction, isPhone) {
  const box = document.createElement('div');
  box.className = 'detection-box';
  box.style.left = `${prediction.bbox[0]}px`;
  box.style.top = `${prediction.bbox[1]}px`;
  box.style.width = `${prediction.bbox[2]}px`;
  box.style.height = `${prediction.bbox[3]}px`;

  const label = document.createElement('div');
  label.className = 'detection-label';
  label.textContent = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
  box.appendChild(label);

  if (isPhone) {
    box.style.borderColor = '#EF4444';
    box.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
    label.style.backgroundColor = '#EF4444';
    box.classList.add('pulse');
  }

  detectionContainer.appendChild(box);
}

function startDetection () {
  if (isDetecting) return;
  isDetecting = true;
  detectionInterval = setInterval(detectObjects, 300);
}

async function detectObjects () {
  if (!model || isAnimating) return;

  const predictions = await model.detect(webcam);
  detectionContainer.innerHTML = '';

  let phoneDetected = false;

  predictions.forEach(pred => {
    const cls = pred.class.toLowerCase();
    const isPhone = phoneClasses.includes(cls);
    if (isPhone) phoneDetected = true;

    drawDetectionBox(pred, isPhone);
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

async function init () {
  statusText.textContent = 'Loading model...';
  model = await cocoSsd.load();
  console.log('✅ Model loaded');

  statusText.textContent = 'Placing images...';
  await preloadAndPlaceImages();
  hideAllFrames();
  imageMap.default.style.visibility = 'visible';

  try {
    await setupCamera();
    startDetection();
  } catch {
    console.warn('Retrying camera...');
  }

  await listVideoDevices();
}

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'q') switchCamera();
  if (e.key.toLowerCase() === 'c') toggleDebugView();
});
navigator.mediaDevices.addEventListener('devicechange', listVideoDevices);
