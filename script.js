document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadPrompt = document.getElementById('uploadPrompt');
    const canvasContainer = document.getElementById('canvasContainer');
    const viewControls = document.getElementById('viewControls');
    const beforeCanvas = document.getElementById('beforeCanvas');
    const afterCanvas = document.getElementById('afterCanvas');
    const sliderHandle = document.getElementById('sliderHandle');
    
    const processBtn = document.getElementById('processBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const scaleBtns = document.querySelectorAll('.scale-btn');
    const qualityBtns = document.querySelectorAll('.quality-btn');
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    const progressBar = document.getElementById('progressBar');
    const statusText = document.getElementById('statusText');
    const etaText = document.getElementById('etaText');

    let originalImage = null;
    let processedBlob = null;
    let currentScale = 1;
    let currentQuality = 1;
    
    let zoom = 1;
    let panX = 0; let panY = 0;
    let isDragging = false; let startX, startY;
    let isSliderDragging = false;

    const ctxBefore = beforeCanvas.getContext('2d');
    const ctxAfter = afterCanvas.getContext('2d');

    const mouseGlow = document.getElementById('mouseGlow');
    window.addEventListener('mousemove', (e) => {
        mouseGlow.style.left = e.clientX + 'px';
        mouseGlow.style.top = e.clientY + 'px';
    });

    scaleBtns.forEach(btn => btn.addEventListener('click', (e) => {
        scaleBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentScale = parseFloat(e.target.dataset.scale);
    }));

    qualityBtns.forEach(btn => btn.addEventListener('click', (e) => {
        qualityBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentQuality = parseFloat(e.target.dataset.quality);
    }));

    dropZone.addEventListener('click', (e) => {
        if(e.target === uploadPrompt || uploadPrompt.contains(e.target)) fileInput.click();
    });

    fileInput.addEventListener('change', handleFileSelect);
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadPrompt.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => uploadPrompt.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); uploadPrompt.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect();
        }
    });

    function handleFileSelect() {
        const file = fileInput.files[0];
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                originalImage = img;
                setupWorkspace(img);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function setupWorkspace(img) {
        uploadPrompt.classList.add('hidden');
        canvasContainer.classList.remove('hidden');
        viewControls.classList.remove('hidden');
        processBtn.disabled = false;
        downloadBtn.disabled = true;

        const maxDim = 800;
        let w = img.width; let h = img.height;
        if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w *= ratio; h *= ratio;
        }

        // --- FIX: Gunakan w dan h yang sudah dikecilkan agar RAM HP tidak crash ---
        beforeCanvas.width = afterCanvas.width = w;
        beforeCanvas.height = afterCanvas.height = h;
        
        beforeCanvas.style.width = afterCanvas.style.width = `${w}px`;
        beforeCanvas.style.height = afterCanvas.style.height = `${h}px`;

        // --- FIX: Draw image dengan ukuran w dan h ---
        ctxBefore.drawImage(img, 0, 0, w, h);
        ctxAfter.clearRect(0, 0, afterCanvas.width, afterCanvas.height);
        
        resetPanZoom();
    }

    sliderHandle.addEventListener('mousedown', () => isSliderDragging = true);
    window.addEventListener('mouseup', () => isSliderDragging = false);
    window.addEventListener('mousemove', (e) => {
        if (!isSliderDragging) return;
        const rect = canvasContainer.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
        document.documentElement.style.setProperty('--clip-pos', `${percent}%`);
        sliderHandle.style.left = `${percent}%`;
    });
    
    sliderHandle.addEventListener('touchstart', () => isSliderDragging = true);
    window.addEventListener('touchend', () => isSliderDragging = false);
    window.addEventListener('touchmove', (e) => {
        if (!isSliderDragging) return;
        const rect = canvasContainer.getBoundingClientRect();
        let x = e.touches[0].clientX - rect.left;
        let percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
        document.documentElement.style.setProperty('--clip-pos', `${percent}%`);
        sliderHandle.style.left = `${percent}%`;
    });

    function applyTransform() {
        beforeCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        afterCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        document.getElementById('zoomLevel').innerText = `${Math.round(zoom * 100)}%`;
    }

    function resetPanZoom() { zoom = 1; panX = 0; panY = 0; applyTransform(); }
    document.getElementById('resetView').addEventListener('click', resetPanZoom);
    document.getElementById('zoomIn').addEventListener('click', () => { zoom *= 1.2; applyTransform(); });
    document.getElementById('zoomOut').addEventListener('click', () => { zoom /= 1.2; applyTransform(); });

    canvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        if (e.deltaY < 0) zoom *= (1 + zoomIntensity);
        else zoom /= (1 + zoomIntensity);
        applyTransform();
    });

    canvasContainer.addEventListener('mousedown', (e) => {
        if (e.target === sliderHandle || sliderHandle.contains(e.target)) return;
        isDragging = true; startX = e.clientX - panX; startY = e.clientY - panY;
    });
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panX = e.clientX - startX; panY = e.clientY - startY;
        applyTransform();
    });

    processBtn.addEventListener('click', () => {
        if (!originalImage) return;
        
        loadingOverlay.classList.remove('hidden');
        processBtn.disabled = true;
        const startTime = Date.now();

        const imageData = ctxBefore.getImageData(0, 0, beforeCanvas.width, beforeCanvas.height);
        
        const worker = new Worker('worker.js');
        
        worker.postMessage({
            imageData: imageData,
            scale: currentScale
        }, [imageData.data.buffer]);

        worker.onmessage = (e) => {
            const data = e.data;
            if (data.type === 'progress') {
                progressBar.style.width = `${data.percent}%`;
                statusText.innerText = data.task;
                
                const elapsed = (Date.now() - startTime) / 1000;
                if(data.percent > 0) {
                    const totalTime = elapsed / (data.percent / 100);
                    const remaining = Math.max(0, Math.round(totalTime - elapsed));
                    etaText.innerText = `Estimated time: ${remaining}s remaining`;
                }
            } 
            else if (data.type === 'done') {
                handleProcessComplete(data.imageData, data.width, data.height);
                worker.terminate();
            }
            else if (data.type === 'error') {
                alert('Processing Error: ' + data.message);
                resetUI();
                worker.terminate();
            }
        };
    });

    function handleProcessComplete(imgData, w, h) {
        afterCanvas.width = w;
        afterCanvas.height = h;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w; tempCanvas.height = h;
        tempCanvas.getContext('2d').putImageData(imgData, 0, 0);
        
        ctxAfter.drawImage(tempCanvas, 0, 0);

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = w * currentQuality;
        finalCanvas.height = h * currentQuality;
        const fctx = finalCanvas.getContext('2d');
        fctx.imageSmoothingEnabled = true;
        fctx.imageSmoothingQuality = 'high';
        fctx.drawImage(tempCanvas, 0, 0, finalCanvas.width, finalCanvas.height);

        finalCanvas.toBlob((blob) => {
            processedBlob = blob;
            downloadBtn.disabled = false;
            resetUI();
            document.documentElement.style.setProperty('--clip-pos', `50%`);
            sliderHandle.style.left = `50%`;
        }, 'image/png');
    }

    function resetUI() {
        loadingOverlay.classList.add('hidden');
        processBtn.disabled = false;
        progressBar.style.width = '0%';
        statusText.innerText = 'Initializing...';
        etaText.innerText = '';
    }

    downloadBtn.addEventListener('click', () => {
        if (!processedBlob) return;
        const url = URL.createObjectURL(processedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Xaerisoft_Enhanced_${currentScale}x_Q${currentQuality*100}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});
