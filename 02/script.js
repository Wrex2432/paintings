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
let reconnectInterval = null;

const scene = 'Fruit Seller';
const filePrefix = 'Fruit Seller';
const basePath = `assets/${scene}/`;
const animateInPath = `${basePath}Animate-In/`;
const animateOutPath = `${basePath}Animate-Out/`;
const staticDefault = `${basePath}Static/${filePrefix}.jpg`;
const staticRemoved = `${basePath}Static/${filePrefix}_Edited.jpg`;

const animateInTotalFrames = 69;
const animateOutTotalFrames = 69;
const phoneClasses = ['cell phone', 'mobile phone', 'remote'];

const imageMap = {
  in: [],
  out: [],
  default: null,
  removed: null
};

let videoDevices = [];
let currentDeviceIndex = 0;

function preloadAndPlaceImages() {
  return new Promise(resolve => {
    let loadCount = 0;
    const totalToLoad = animateInTotalFrames + animateOutTotalFrames + 2;

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

    // Default
    imageMap.default = document.createElement('img');
    imageMap.default.src = staticDefault;
    imageMap.default.style = "width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;";
    canvasPng.appendChild(imageMap.default);
    imageMap.default.onload = imageMap.default.onerror = () => {
      loadCount++;
      if (loadCount === totalToLoad) resolve();
    };

    // Removed
    imageMap.removed = document.createElement('img');
    imageMap.removed.src = staticRemoved;
    imageMap.removed.style = "width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;visibility:hidden;";
    canvasPng.appendChild(imageMap.removed);
    imageMap.removed.onload = imageMap.removed.onerror = () => {
      loadCount++;
      if (loadCount === totalToLoad) resolve();
    };

    // Animate-In
    for (let i = 0; i <= animateInTotalFrames; i++) {
      const padded = i.toString().padStart(2, '0');
      createFrame(`${animateInPath}${filePrefix}${padded}.jpg`, imageMap.in);
    }

    // Animate-Out
    for (let i = 0; i <= animateOutTotalFrames; i++) {
      const padded = i.toString().padStart(2, '0');
      createFrame(`${animateOutPath}${filePrefix}${padded}.jpg`, imageMap.out);
    }
  });
}

function hideAllFrames() {
  imageMap.in.forEach(img => img.style.visibility = 'hidden');
  imageMap.out.forEach(img => img.style.visibility = 'hidden');
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

async function listVideoDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter(device => device.kind === 'videoinput');
  console.log('📷 Video Devices:', videoDevices);
}

async function switchCamera() {
  if (videoDevices.length <= 1) return;

  currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
  console.log(`🔁 Switching to camera: ${videoDevices[currentDeviceIndex].label}`);

  if (webcam.srcObject) {
    webcam.srcObject.getTracks().forEach(track => track.stop());
  }

  const constraints = {
    video: {
      deviceId: { exact: videoDevices[currentDeviceIndex].deviceId },
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'environment'
    },
    audio: false
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    webcam.srcObject = stream;
    webcam.onloadedmetadata = () => webcam.play();
  } catch (e) {
    console.warn('❌ Failed to switch camera', e);
  }
}

function toggleDebugView() {
  const isHidden = canvasPng.style.display === 'none';
  canvasPng.style.display = isHidden ? 'block' : 'none';
  webcam.style.display = isHidden ? 'none' : 'block';
  console.log(`🐞 Debug mode: ${isHidden ? 'Off (PNG active)' : 'On (Webcam visible)'}`);
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
        statusWrapper.style.display = 'none';
        if (reconnectInterval) {
          clearInterval(reconnectInterval);
          reconnectInterval = null;
        }

        const tracks = stream.getVideoTracks();
        if (tracks.length > 0 && tracks[0].onended === null) {
          tracks[0].onended = () => {
            console.warn('🔌 Camera disconnected (onended)');
            enterReconnectMode();
          };
        }

        resolve();
      };
    });
  } catch (err) {
    console.warn('❌ Camera setup failed:', err);
    enterReconnectMode();
    throw err;
  }
}

function enterReconnectMode() {
  statusWrapper.style.display = 'block';
  statusText.textContent = 'Searching for camera...';

  if (!reconnectInterval) {
    reconnectInterval = setInterval(async () => {
      console.log('🔄 Retrying camera setup...');
      try {
        await setupCamera();
        startDetection();
      } catch (e) {}
    }, 3000);
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

  try {
    await setupCamera();
    startDetection();
  } catch (e) {
    console.warn('Camera will retry...');
  }

  await listVideoDevices();
}

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'q') {
    switchCamera();
  } else if (e.key.toLowerCase() === 'c') {
    toggleDebugView();
  }
});
navigator.mediaDevices.addEventListener('devicechange', listVideoDevices);
