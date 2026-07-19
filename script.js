'use strict';

// ── State Management ───────────────────────────────────────────────────────
const AppState = {
  mode: 'photo', // 'photo' | 'video'
  file: null,
  fileUrl: null,
  hdUrl: null,
  multiplier: 1,
  isProcessing: false,
};

// ── DOM Elements Selection ────────────────────────────────────────────────
const DOM = {
  tabs: { photo: document.getElementById('tabPhoto'), video: document.getElementById('tabVideo') },
  dz: {
    container: document.getElementById('dropZone'), input: document.getElementById('mediaFile'),
    preview: document.getElementById('dzPreview'), img: document.getElementById('dzPreviewImg'),
    vid: document.getElementById('dzPreviewVid'), content: document.getElementById('dzContent'),
    labelText: document.getElementById('dzPreviewLabelText')
  },
  config: { select: document.getElementById('kaliSelect'), hint: document.getElementById('kaliHint'), videoNote: document.getElementById('videoNote') },
  actions: { enhance: document.getElementById('enhanceBtn'), download: document.getElementById('downloadBtn'), reset: document.getElementById('resetBtn') },
  alerts: { error: document.getElementById('errorBar'), errorText: document.getElementById('errorText') },
  loading: {
    overlay: document.getElementById('loadingOverlay'), title: document.getElementById('loadingTitle'),
    sub: document.getElementById('loadingSub'), container: document.getElementById('loadingRounds'),
    track: document.getElementById('roundsTrack'), text: document.getElementById('roundsText')
  },
  results: {
    section: document.getElementById('resultSection'), photoBlock: document.getElementById('photoResult'),
    videoBlock: document.getElementById('videoResult'),
    comp: {
      wrap: document.getElementById('compWrap'), after: document.getElementById('compAfter'),
      beforeClip: document.getElementById('compBeforeClip'), beforeImg: document.getElementById('compBefore'),
      divider: document.getElementById('compDivider'), handle: document.getElementById('compHandle')
    },
    vid: { before: document.getElementById('vidBefore'), after: document.getElementById('vidAfter') }
  }
};

// ── Initialization & Event Listeners ──────────────────────────────────────
function init() {
  DOM.tabs.photo.addEventListener('click', () => switchMode('photo'));
  DOM.tabs.video.addEventListener('click', () => switchMode('video'));
  
  DOM.config.select.addEventListener('change', handleMultiplierChange);
  
  // Drag & Drop
  DOM.dz.container.addEventListener('click', () => { if (!AppState.isProcessing) DOM.dz.input.click(); });
  DOM.dz.container.addEventListener('dragover', (e) => { e.preventDefault(); DOM.dz.container.classList.add('dragover'); });
  DOM.dz.container.addEventListener('dragleave', () => DOM.dz.container.classList.remove('dragover'));
  DOM.dz.container.addEventListener('drop', handleFileDrop);
  DOM.dz.input.addEventListener('change', (e) => { if (e.target.files[0]) processSelectedFile(e.target.files[0]); });

  DOM.actions.enhance.addEventListener('click', executeEnhancement);
  DOM.actions.reset.addEventListener('click', resetApp);
  initSlider(); // Initialize Hardware-Accelerated Slider
}

// ── Core Functions ────────────────────────────────────────────────────────
function switchMode(mode) {
  if (AppState.isProcessing) return;
  AppState.mode = mode;
  
  DOM.tabs.photo.classList.toggle('active', mode === 'photo');
  DOM.tabs.video.classList.toggle('active', mode === 'video');
  DOM.config.videoNote.classList.toggle('show', mode === 'video');

  const accepts = mode === 'photo' ? 'image/jpeg, image/png, image/webp' : 'video/mp4, video/quicktime, video/webm';
  DOM.dz.input.accept = accepts;
  
  const title = mode === 'photo' ? 'Tarik & Lepas Foto Disini' : 'Tarik & Lepas Video Disini';
  const sub = mode === 'photo' ? 'Format didukung: JPG, PNG, WEBP' : 'Format didukung: MP4, MOV, WEBM';
  
  document.getElementById('dzTitle').textContent = title;
  document.getElementById('dzSub').textContent = sub;
  
  resetApp();
}

function handleMultiplierChange(e) {
  AppState.multiplier = parseInt(e.target.value, 10);
  const timeEstimates = AppState.mode === 'photo' 
    ? [0, 15, 30, 45, 60, 90] // Detik
    : [0, 120, 240, 360, 480, 600]; // Detik untuk video
    
  const estimate = timeEstimates[AppState.multiplier];
  const unit = estimate >= 60 ? `${(estimate/60).toFixed(1)} menit` : `${estimate} detik`;
  DOM.config.hint.textContent = `Estimasi proses: ~${unit}`;
}

function handleFileDrop(e) {
  e.preventDefault();
  DOM.dz.container.classList.remove('dragover');
  if (AppState.isProcessing) return;
  
  const file = e.dataTransfer.files[0];
  if (!file) return;

  const validPhoto = AppState.mode === 'photo' && file.type.startsWith('image/');
  const validVideo = AppState.mode === 'video' && file.type.startsWith('video/');

  if (validPhoto || validVideo) {
    processSelectedFile(file);
  } else {
    showError(AppState.mode === 'photo' ? 'Pilih file format gambar (JPG/PNG/WEBP).' : 'Pilih file format video (MP4/MOV).');
  }
}

function processSelectedFile(file) {
  // SECURITY/MEMORY LEAK FIX: Hapus Object URL lama sebelum membuat yang baru
  if (AppState.fileUrl) URL.revokeObjectURL(AppState.fileUrl);
  
  AppState.file = file;
  AppState.fileUrl = URL.createObjectURL(file);

  DOM.dz.content.style.display = 'none';
  DOM.dz.preview.classList.add('show');
  
  if (AppState.mode === 'photo') {
    DOM.dz.vid.style.display = 'none';
    DOM.dz.img.style.display = 'block';
    DOM.dz.img.src = AppState.fileUrl;
    DOM.dz.labelText.textContent = 'Foto siap — klik untuk mengubah';
  } else {
    DOM.dz.img.style.display = 'none';
    DOM.dz.vid.style.display = 'block';
    DOM.dz.vid.src = AppState.fileUrl;
    DOM.dz.labelText.textContent = 'Video siap — klik untuk mengubah';
  }

  DOM.actions.enhance.disabled = false;
  hideError();
}

// ── UI Helpers ────────────────────────────────────────────────────────────
function showError(msg) {
  DOM.alerts.errorText.textContent = msg;
  DOM.alerts.error.classList.add('show');
}
function hideError() {
  DOM.alerts.error.classList.remove('show');
}

function showLoading(title, subtitle, maxRounds = 0) {
  AppState.isProcessing = true;
  DOM.actions.enhance.disabled = true;
  DOM.loading.title.textContent = title;
  DOM.loading.sub.textContent = subtitle;
  DOM.loading.overlay.classList.add('active');

  if (maxRounds > 1) {
    DOM.loading.container.style.display = 'block';
    DOM.loading.track.innerHTML = '';
    for (let i = 0; i < maxRounds; i++) {
      const dot = document.createElement('div');
      dot.className = 'progress-dot';
      dot.id = `pd-${i}`;
      DOM.loading.track.appendChild(dot);
    }
    updateProgressDot(0, maxRounds);
  } else {
    DOM.loading.container.style.display = 'none';
  }
}

function hideLoading() {
  AppState.isProcessing = false;
  DOM.loading.overlay.classList.remove('active');
}

function updateProgressDot(currentIdx, total) {
  for (let i = 0; i < total; i++) {
    const dot = document.getElementById(`pd-${i}`);
    if (!dot) continue;
    dot.className = 'progress-dot' + (i < currentIdx ? ' done' : i === currentIdx ? ' active' : '');
  }
  DOM.loading.text.textContent = `Processing Engine ${currentIdx + 1} of ${total}`;
}

// ── Enhancement Simulation (Mock API) ─────────────────────────────────────
// Sengaja dibuat modular agar mudah di-plug dengan API sungguhan di backend (Python/Node)
async function executeEnhancement() {
  if (!AppState.file) return;
  hideError();
  
  if (AppState.mode === 'photo') {
    await processPhotoEnhancement();
  } else {
    await processVideoEnhancement();
  }
}

async function processPhotoEnhancement() {
  const total = AppState.multiplier;
  showLoading('XAERISOFT Engine Aktif', 'Menginisialisasi analisis visual...', total);

  try {
    // MOCKUP PROSES - Ganti fetch dengan backend API XAERISOFT Anda nanti
    for(let r = 0; r < total; r++) {
      if(total > 1) {
        updateProgressDot(r, total);
        DOM.loading.sub.textContent = `Menjalankan Neural Network Lapis ${r+1}...`;
      }
      
      // Simulasi Latensi Jaringan Premium
      await new Promise(res => setTimeout(res, 1200)); 
    }

    DOM.loading.sub.textContent = 'Merender hasil High Definition...';
    await new Promise(res => setTimeout(res, 800));

    // Untuk demo UI tanpa backend nyata, kita menggunakan URL file asli
    AppState.hdUrl = AppState.fileUrl; 
    
    renderPhotoResult(AppState.fileUrl, AppState.hdUrl);
  } catch(err) {
    showError("AI Engine Gagal: " + err.message);
  } finally {
    hideLoading();
    DOM.actions.enhance.disabled = false;
  }
}

async function processVideoEnhancement() {
  showLoading('XAERISOFT Video Engine', 'Mengekstrak frame video...', AppState.multiplier);
  try {
    // Simulasi Proses Kompleks
    await new Promise(res => setTimeout(res, 3000));
    AppState.hdUrl = AppState.fileUrl;
    renderVideoResult(AppState.fileUrl, AppState.hdUrl);
  } catch(err) {
    showError("Video Engine Gagal: " + err.message);
  } finally {
    hideLoading();
    DOM.actions.enhance.disabled = false;
  }
}

// ── Results Rendering ─────────────────────────────────────────────────────
function renderPhotoResult(beforeUrl, afterUrl) {
  DOM.results.comp.beforeImg.src = beforeUrl;
  DOM.results.comp.after.src = afterUrl;

  DOM.results.photoBlock.style.display = 'block';
  DOM.results.videoBlock.classList.remove('show');
  DOM.results.section.classList.add('active');
  
  // Sync width of overlay image once loaded
  DOM.results.comp.after.onload = () => {
    DOM.results.comp.beforeImg.style.width = DOM.results.comp.wrap.offsetWidth + 'px';
  };
  
  setTimeout(() => DOM.results.section.scrollIntoView({ behavior: 'smooth' }), 100);

  setupDownload(afterUrl, `XAERISOFT-Premium-${Date.now()}.jpg`);
}

function renderVideoResult(beforeUrl, afterUrl) {
  DOM.results.vid.before.src = beforeUrl;
  DOM.results.vid.after.src = afterUrl;

  DOM.results.photoBlock.style.display = 'none';
  DOM.results.videoBlock.classList.add('show');
  DOM.results.section.classList.add('active');
  
  setTimeout(() => DOM.results.section.scrollIntoView({ behavior: 'smooth' }), 100);

  setupDownload(afterUrl, `XAERISOFT-Video-${Date.now()}.mp4`);
}

function setupDownload(url, filename) {
  DOM.actions.download.onclick = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
}

// ── Performance Optimized Slider (60FPS via requestAnimationFrame) ────────
function initSlider() {
  let isDragging = false;
  let rafId = null;

  function updateSliderPosition(clientX) {
    const rect = DOM.results.comp.wrap.getBoundingClientRect();
    let percentage = (clientX - rect.left) / rect.width;
    percentage = Math.max(0.02, Math.min(0.98, percentage)); // Batasi 2% - 98%
    
    DOM.results.comp.beforeClip.style.width = `${percentage * 100}%`;
    DOM.results.comp.divider.style.left = `${percentage * 100}%`;
  }

  function handleMove(e) {
    if (!isDragging) return;
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => updateSliderPosition(clientX));
  }

  // Mouse Events
  DOM.results.comp.divider.addEventListener('mousedown', (e) => { isDragging = true; e.preventDefault(); });
  DOM.results.comp.handle.addEventListener('mousedown', (e) => { isDragging = true; e.preventDefault(); });
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', () => { isDragging = false; });

  // Touch Events (Passive false for preventing scroll while dragging)
  DOM.results.comp.divider.addEventListener('touchstart', (e) => { isDragging = true; }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    if (isDragging) { e.preventDefault(); handleMove(e); }
  }, { passive: false });
  window.addEventListener('touchend', () => { isDragging = false; });

  // Handle Resize untuk sinkronisasi layout gambar "before"
  window.addEventListener('resize', () => {
    if(DOM.results.comp.after.src) {
      DOM.results.comp.beforeImg.style.width = DOM.results.comp.wrap.offsetWidth + 'px';
    }
  });
}

// ── Reset/Cleanup System ──────────────────────────────────────────────────
function resetApp() {
  // MEMORY LEAK FIX: Hapus Object URL[span_6](start_span)[span_6](end_span)
  if (AppState.fileUrl) URL.revokeObjectURL(AppState.fileUrl);
  if (AppState.hdUrl && AppState.hdUrl.startsWith('blob:')) URL.revokeObjectURL(AppState.hdUrl);
  
  AppState.file = null;
  AppState.fileUrl = null;
  AppState.hdUrl = null;
  
  DOM.dz.input.value = '';
  DOM.dz.img.src = '';
  DOM.dz.vid.src = '';
  DOM.dz.preview.classList.remove('show');
  DOM.dz.content.style.display = 'flex';
  
  DOM.actions.enhance.disabled = true;
  DOM.results.section.classList.remove('active');
  hideError();
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Start
document.addEventListener('DOMContentLoaded', init);
