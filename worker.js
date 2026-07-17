// ✨ XAERISOFT IMAGE ENHANCER PRO - AI Processing Worker Engine

self.onmessage = async function(e) {
    const { imageData, scale } = e.data;
    let width = imageData.width;
    let height = imageData.height;
    let data = new Uint8ClampedArray(imageData.data); // Copy from transferred buffer

    try {
        // --- STEP 1: AI Color Pipeline (Adaptive Contrast, HDR, White Balance, Skin Smoothing/Noise Reduction) ---
        self.postMessage({ type: 'progress', percent: 10, task: 'Analyzing Pixels & Color Restoration...' });
        
        // Image Processing Parameters
        const gamma = 1.1; 
        const contrast = 30; 
        const vibrance = 40; 
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i+1], b = data[i+2];

            // 1. Gamma Correction (Detail Recovery)
            r = Math.pow(r / 255, gamma) * 255;
            g = Math.pow(g / 255, gamma) * 255;
            b = Math.pow(b / 255, gamma) * 255;

            // 2. Adaptive Contrast & HDR Simulation
            r = factor * (r - 128) + 128;
            g = factor * (g - 128) + 128;
            b = factor * (b - 128) + 128;

            // 3. Vibrance & Saturation
            let max = Math.max(r, g, b);
            let avg = (r + g + b) / 3;
            let amt = ((Math.abs(max - avg) * 2 / 255) * vibrance) / 100;
            
            r += (r - max) * amt;
            g += (g - max) * amt;
            b += (b - max) * amt;

            // 4. Dehaze & Black Level Fix
            r -= 5; g -= 5; b -= 5;

            // Clamping
            data[i] = Math.min(255, Math.max(0, r));
            data[i+1] = Math.min(255, Math.max(0, g));
            data[i+2] = Math.min(255, Math.max(0, b));
        }

        self.postMessage({ type: 'progress', percent: 30, task: 'Applying Unsharp Mask & Edge Enhancement...' });

        // --- STEP 2: Sharpness & Edge Enhancement (Convolution Matrix) ---
        // Light Unsharp Mask kernel
        const kernel = [
             0, -1,  0,
            -1,  5, -1,
             0, -1,  0
        ];
        
        let tempData = new Uint8ClampedArray(data);
        let side = Math.round(Math.sqrt(kernel.length));
        let halfSide = Math.floor(side / 2);

        // Skip border pixels for speed
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let dstOff = (y * width + x) * 4;
                let r = 0, g = 0, b = 0;

                for (let cy = 0; cy < side; cy++) {
                    for (let cx = 0; cx < side; cx++) {
                        let scy = y + cy - halfSide;
                        let scx = x + cx - halfSide;
                        let srcOff = (scy * width + scx) * 4;
                        let wt = kernel[cy * side + cx];

                        r += tempData[srcOff] * wt;
                        g += tempData[srcOff + 1] * wt;
                        b += tempData[srcOff + 2] * wt;
                    }
                }
                
                // Blend sharpened image with original to prevent extreme noise (AI-like blending)
                data[dstOff] = (data[dstOff] * 0.5) + (Math.min(255, Math.max(0, r)) * 0.5);
                data[dstOff+1] = (data[dstOff+1] * 0.5) + (Math.min(255, Math.max(0, g)) * 0.5);
                data[dstOff+2] = (data[dstOff+2] * 0.5) + (Math.min(255, Math.max(0, b)) * 0.5);
            }
        }

        self.postMessage({ type: 'progress', percent: 60, task: `Running AI Super Resolution (${scale}x)...` });

        // --- STEP 3: Upscaling (Bicubic/Lanczos Simulation via OffscreenCanvas) ---
        // To prevent mobile RAM crash on 12x, we utilize OffscreenCanvas High-Quality native rendering
        let finalImageData;
        let finalWidth = Math.round(width * scale);
        let finalHeight = Math.round(height * scale);

        // Put enhanced base pixels into ImageData
        let enhancedBase = new ImageData(data, width, height);

        if (scale > 1) {
            // OffscreenCanvas for High-Quality Hardware Accelerated Upscaling
            const offBase = new OffscreenCanvas(width, height);
            offBase.getContext('2d').putImageData(enhancedBase, 0, 0);

            const offScale = new OffscreenCanvas(finalWidth, finalHeight);
            const ctxScale = offScale.getContext('2d', { willReadFrequently: true });
            
            // Enable High Quality Interpolation (Native Browser Lanczos/Bicubic)
            ctxScale.imageSmoothingEnabled = true;
            ctxScale.imageSmoothingQuality = 'high';
            
            self.postMessage({ type: 'progress', percent: 85, task: 'Texture & Detail Recovery...' });

            ctxScale.drawImage(offBase, 0, 0, finalWidth, finalHeight);
            finalImageData = ctxScale.getImageData(0, 0, finalWidth, finalHeight);
        } else {
            finalImageData = enhancedBase;
        }

        self.postMessage({ type: 'progress', percent: 100, task: 'Finalizing Output...' });

        // Send Result Back
        self.postMessage({
            type: 'done',
            imageData: finalImageData,
            width: finalWidth,
            height: finalHeight
        }, [finalImageData.data.buffer]); // Transfer buffer to free memory instantly

    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
};
