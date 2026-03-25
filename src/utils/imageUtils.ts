/**
 * Compute SHA-256 hash of a string (mostly for Base64 image data)
 * This allows us to use content-addressable storage for images,
 * ensuring duplicates share the same storage entry.
 */
export async function calculateImageHash(data: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
        try {
            const msgBuffer = new TextEncoder().encode(data);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.warn('[imageUtils] crypto.subtle.digest failed, falling back', error);
        }
    }

    // Fallback for non-secure contexts (HTTP over LAN)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return (hash >>> 0).toString(16) + '_' + data.length.toString(16);
}

export interface PreparedImageFile extends File {
    __kkPreparedDataUrl?: string;
}

/**
 * Compress and downscale an image file if it exceeds safety limits.
 * @param file The original image file
 * @param maxDimension The maximum allowed width or height (default 2048)
 * @param quality The JPEG/WEBP compression quality (0 to 1, default 0.85)
 * @returns A promise that resolves to the compressed File or the original if no compression needed
 */
export async function compressImageFile(file: File, maxDimension: number = 2048, quality: number = 0.85): Promise<PreparedImageFile> {
    // If it's a GIF or SVG, don't try to compress with canvas as we might lose animation or vector properties
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
        return file as PreparedImageFile;
    }

    return new Promise((resolve) => {
        const resolveWithData = (nextFile: File, dataUrl?: string) => {
            const preparedFile = nextFile as PreparedImageFile;
            if (dataUrl && dataUrl.startsWith('data:')) {
                preparedFile.__kkPreparedDataUrl = dataUrl;
            }
            resolve(preparedFile);
        };

        const reader = new FileReader();
        reader.onload = (e) => {
            const sourceDataUrl = typeof e.target?.result === 'string' ? e.target.result : '';
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Check if resizing is necessary
                if (width <= maxDimension && height <= maxDimension && file.size < 2 * 1024 * 1024) {
                    resolveWithData(file, sourceDataUrl); // Return original if it's already small enough and under 2MB
                    return;
                }

                // Calculate aspect ratio and new dimensions
                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                // Draw to canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolveWithData(file, sourceDataUrl); // Fallback to original if 2d context fails
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Export to Blob (prefer webp or jpeg for compression)
                const outMime = file.type === 'image/png' && file.size < 3 * 1024 * 1024 ? 'image/png' : 'image/jpeg';
                // If png, quality parameter is ignored, but we still compress by scaling down dimensions
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const newFile = new File([blob], file.name || 'compressed_image.jpg', {
                                type: blob.type,
                                lastModified: Date.now(),
                            });
                            const preparedDataUrl = canvas.toDataURL(blob.type, blob.type === 'image/png' ? undefined : quality);
                            resolveWithData(newFile, preparedDataUrl);
                        } else {
                            resolveWithData(file, sourceDataUrl); // Fallback
                        }
                    },
                    outMime,
                    quality
                );
            };
            img.onerror = () => resolveWithData(file, sourceDataUrl); // If image fails to load, keep the original readable payload
            if (sourceDataUrl) {
                img.src = sourceDataUrl;
            } else {
                resolveWithData(file);
            }
        };
        reader.onerror = () => resolveWithData(file);
        reader.readAsDataURL(file);
    });
}
