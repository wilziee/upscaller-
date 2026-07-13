/**
 * Xaerisoft Image Enhancer
 * Created by: WillXD
 * Logic: 100% Local Browser Processing via Canvas API
 */

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const editorArea = document.getElementById('editor-area');
const btnReset = document.getElementById('btn-reset');
const loadingOverlay = document.getElementById('loading-overlay');

// Preview Elements
const imgBefore = document.getElementById('img-before');
const imgAfter = document.getElementById('img-after');
const slider = document.getElementById('compare-slider');
const beforeWrapper = document.getElementById('before-wrapper');
const sliderLine = document.getElementById('slider-line');

// Controls Elements
const controls = {
    b: document.getElementById('brightness'),
    c: document.getElementById('contrast'),
    s: document.getElementById('saturation'),
    valB: document.getElementById('val-brightness'),
    valC: document.getElementById('val-contrast'),
    valS: document.getElementById('val-saturation'),
    sharpen: document.getElementById('sharpen'),
    noise: document.getElementById('noise-reduction')
};
const scaleBtns = document.querySelectorAll('.btn-scale');
const downloadBtn = document.getElementById('btn-download');
const downloadFormat = document.getElementById('download-format');

// History
const historyGallery = document.getElementById('history-gallery');
const historySection = document.getElementById('history-section');

// State Variables
let originalImage = new Image();
let originalFileName = "image";
let currentScale = 1;
let processTimeout = null;

// ==========================================
// 1. Initialization & Event Listeners
// ==========================================

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) loadImage(e.dataTransfer.files[0]);
});

// Input File & Paste
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) loadImage(e.target.files[0]);
});
window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.type.indexOf('image') === 0) {
            loadImage(item.getAsFile());
            break;
        }
    }
});

// Comparison Slider
slider.addEventListener('input', (e) => {
    const value = e.target.value;
    beforeWrapper.style.width = `${value}%`;
    sliderLine.style.left = `${value}%`;
});

// Setting Controls (Debounced for performance)
const updateLabels = () => {
    controls.valB.innerText = `${controls.b.value}%`;
    controls.valC.innerText = `${controls.c.value}%`;
    controls.valS.innerText = `${controls.s.value}%`;
};

Object.values(controls).forEach(el => {
    if(el.tagName === 'INPUT') {
        el.addEventListener('input', () => {
            if(el.type === 'range') updateLabels();
            clearTimeout(processTimeout);
            // Delay rendering to prevent lag during slider dragging
            processTimeout = setTimeout(() => requestProcess(), 100); 
        });
    }
});

// Scale Buttons
scaleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        scaleBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        if (e.target.id === 'btn-1x') currentScale = 1;
        if (e.target.id === 'btn-2x') currentScale = 2;
        if (e.target.id === 'btn-4x') currentScale = 4;
        requestProcess();
    });
});

// Reset
btnReset.addEventListener('click', () => {
    dropZone.style.display = 'block';
    editorArea.style.display = 'none';
    fileInput.value = '';
    // Reset controls
    controls.b.value = 100; controls.c.value = 100; controls.s.value = 100;
    controls.sharpen.checked = false; controls.noise.checked = false;
    currentScale = 1; updateLabels();
    scaleBtns.forEach(b => b.classList.remove('active'));
    document.getElementById('btn-1x').classList.add('active');
});

// Download
downloadBtn.addEventListener('click', () => {
    downloadFinalImage();
});

// ==========================================
// 2. Image Loading
// ==========================================
function loadImage(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('Mohon masukkan file gambar yang valid.');
        return;
    }
    
    originalFileName = file.name.split('.')[0] || "xaerisoft-image";
    const reader = new FileReader();
    
    reader.onload = (e) => {
        originalImage.onload = () => {
            imgBefore.src = originalImage.src;
            dropZone.style.display = 'none';
            editorArea.style.display = 'grid';
            
            // Simpan thumbnail history
            saveToHistory(originalImage.src);

            // Proses awal
            requestProcess();
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ==========================================
// 3. Image Processing (Canvas API)
// ==========================================
function requestProcess() {
    loadingOverlay.style.display = 'flex';
    // Beri waktu UI untuk render overlay sebelum blocking thread dengan render
    setTimeout(processAndRender, 50); 
}

function processAndRender() {
    // 1. Buat Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const targetWidth = originalImage.width * currentScale;
    const targetHeight = originalImage.height * currentScale;
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Browser High-Quality Smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 2. Terapkan Filter Dasar (Brightness, Contrast, Saturation) via CSS Filter di Canvas
    const b = controls.b.value;
    const c = controls.c.value;
    const s = controls.s.value;
    ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
    
    // Gambar ke canvas
    ctx.drawImage(originalImage, 0, 0, targetWidth, targetHeight);
    
    // Reset filter untuk proses pixel manual
    ctx.filter = 'none';

    // 3. Terapkan Reduksi Noise Sederhana (Fake Median / Slight Blur Blend)
    if (controls.noise.checked) {
        ctx.globalAlpha = 0.5;
        // Draw slightly offset untuk efek blur/reduksi noise ringan
        ctx.drawImage(canvas, 1, 1);
        ctx.drawImage(canvas, -1, -1);
        ctx.globalAlpha = 1.0;
    }

    // 4. Terapkan Sharpen (Convolution Matrix) jika dicentang
    if (controls.sharpen.checked) {
        applySharpenFilter(ctx, targetWidth, targetHeight);
    }

    // Tampilkan ke UI Preview
    imgAfter.src = canvas.toDataURL('image/jpeg', 0.9); // Gunakan JPEG untuk preview agar performa browser tetap cepat
    
    // Simpan canvas tersembunyi ke memori untuk di-download nanti
    window.finalCanvas = canvas; 
    
    loadingOverlay.style.display = 'none';
}

// Algoritma Sharpen Sederhana (3x3 Matrix)
function applySharpenFilter(ctx, w, h) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    
    // Mengamankan copy data origin
    const buff = new Uint8ClampedArray(data);
    
    // Matrix Sharpen Standar
    const weights = [
         0, -1,  0,
        -1,  5, -1,
         0, -1,  0
    ];
    
    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);
    
    // Iterasi piksel (Lewati pinggiran untuk performa)
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const dstOff = (y * w + x) * 4;
            let r = 0, g = 0, b = 0;
            
            for (let cy = 0; cy < side; cy++) {
                for (let cx = 0; cx < side; cx++) {
                    const scy = y + cy - halfSide;
                    const scx = x + cx - halfSide;
                    const srcOff = (scy * w + scx) * 4;
                    const wt = weights[cy * side + cx];
                    
                    r += buff[srcOff] * wt;
                    g += buff[srcOff + 1] * wt;
                    b += buff[srcOff + 2] * wt;
                }
            }
            
            data[dstOff] = r;
            data[dstOff + 1] = g;
            data[dstOff + 2] = b;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// ==========================================
// 4. Download Export
// ==========================================
function downloadFinalImage() {
    if (!window.finalCanvas) return;
    
    const mime = downloadFormat.value;
    const ext = mime.split('/')[1];
    const quality = mime === 'image/jpeg' || mime === 'image/webp' ? 0.95 : 1.0;
    
    const dataURL = window.finalCanvas.toDataURL(mime, quality);
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `${originalFileName}_Xaerisoft_Enhanced.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ==========================================
// 5. Local Storage History
// ==========================================
function saveToHistory(base64Image) {
    // Karena quota LocalStorage terbatas (~5MB), kita simpan thumbnail resolusi kecil saja
    const thumbCanvas = document.createElement('canvas');
    const thumbCtx = thumbCanvas.getContext('2d');
    
    // Skala thumbnail
    const MAX_SIZE = 150;
    let tw = originalImage.width;
    let th = originalImage.height;
    if (tw > th) { if (tw > MAX_SIZE) { th *= MAX_SIZE / tw; tw = MAX_SIZE; } } 
    else { if (th > MAX_SIZE) { tw *= MAX_SIZE / th; th = MAX_SIZE; } }
    
    thumbCanvas.width = tw;
    thumbCanvas.height = th;
    thumbCtx.drawImage(originalImage, 0, 0, tw, th);
    const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

    // Ambil histori lama
    let history = JSON.parse(localStorage.getItem('xaerisoft_history') || '[]');
    const newItem = {
        date: new Date().toLocaleTimeString(),
        thumb: thumbDataUrl
    };
    
    history.unshift(newItem);
    if(history.length > 8) history.pop(); // Max 8 item
    
    try {
        localStorage.setItem('xaerisoft_history', JSON.stringify(history));
    } catch(e) {
        console.warn("LocalStorage penuh, membersihkan riwayat lama...");
        localStorage.clear();
    }
    
    loadHistoryUI();
}

function loadHistoryUI() {
    let history = JSON.parse(localStorage.getItem('xaerisoft_history') || '[]');
    if (history.length > 0) {
        historySection.style.display = 'block';
        historyGallery.innerHTML = '';
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <img src="${item.thumb}" alt="History">
                <div class="hist-date">${item.date}</div>
            `;
            historyGallery.appendChild(div);
        });
    }
}

// Jalankan load pertama kali
window.onload = loadHistoryUI;
