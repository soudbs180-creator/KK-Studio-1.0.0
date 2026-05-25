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

        const handleSourceDataUrl = (sourceDataUrl: string) => {
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

        const preparedDataUrl = (file as PreparedImageFile).__kkPreparedDataUrl;
        if (preparedDataUrl && preparedDataUrl.startsWith('data:')) {
            handleSourceDataUrl(preparedDataUrl);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const sourceDataUrl = typeof e.target?.result === 'string' ? e.target.result : '';
            handleSourceDataUrl(sourceDataUrl);
        };
        reader.onerror = () => resolveWithData(file);
        reader.readAsDataURL(file);
    });
}

/**
 * 压缩单个 Base64 格式的 Data URL 图片
 */
export function compressBase64Image(
    dataUrl: string,
    maxDimension: number = 1024,
    quality: number = 0.8
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // 如果尺寸都在限制内，可以直接返回
            if (width <= maxDimension && height <= maxDimension) {
                resolve(dataUrl);
                return;
            }

            // 计算缩放后的大小
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

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(dataUrl);
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            
            // 导出为经过压缩的 jpeg 格式 data URL
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
        };
        img.onerror = (err) => {
            reject(err);
        };
        img.src = dataUrl;
    });
}

/**
 * 自动对 ReferenceImage 数组中过大的 base64 图片进行等比缩放和压缩
 * 目标：将 base64 数据限制在合理的分辨率（如最大边 1024 像素）和 JPEG 质量（0.8）下，
 * 从而避免 HTTP POST payload 超过 Serverless 平台限制（4.5MB）导致 FUNCTION_PAYLOAD_TOO_LARGE。
 */
export async function compressReferenceImagesIfNeeded(
    images: Array<string | { data: string; mimeType: string }>
): Promise<Array<string | { data: string; mimeType: string }>> {
    if (!images || images.length === 0) {
        return [];
    }

    // 只能在浏览器环境下（有 window 和 document）使用 Canvas 压缩，否则直接返回
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return images;
    }

    return Promise.all(
        images.map(async (image) => {
            // 1. 如果是 string 类型的图片
            if (typeof image === 'string') {
                const isBase64 = image.startsWith('data:') || (!image.startsWith('http') && !image.startsWith('blob') && !image.startsWith('/'));
                if (!isBase64) {
                    return image;
                }

                const dataUrl = image.startsWith('data:') 
                    ? image 
                    : `data:image/png;base64,${image}`;

                // 如果这个 base64 字符串本身的长度较小（例如小于 200KB），无需再次压缩
                if (dataUrl.length < 200000) {
                    return image;
                }

                try {
                    const compressedDataUrl = await compressBase64Image(dataUrl, 1024, 0.8);
                    if (!image.startsWith('data:')) {
                        const commaIndex = compressedDataUrl.indexOf(',');
                        return commaIndex > -1 ? compressedDataUrl.substring(commaIndex + 1) : compressedDataUrl;
                    }
                    return compressedDataUrl;
                } catch (error) {
                    console.warn('[imageUtils] Failed to compress reference image (string), using original', error);
                    return image;
                }
            }

            // 2. 如果是对象类型 { data: string; mimeType: string }
            if (image && typeof image === 'object' && 'data' in image) {
                const { data, mimeType } = image;
                if (!data) {
                    return image;
                }

                const isBase64 = data.startsWith('data:') || (!data.startsWith('http') && !data.startsWith('blob') && !data.startsWith('/'));
                if (!isBase64) {
                    return image;
                }

                const dataUrl = data.startsWith('data:') 
                    ? data 
                    : `data:${mimeType || 'image/png'};base64,${data}`;

                if (dataUrl.length < 200000) {
                    return image;
                }

                try {
                    const compressedDataUrl = await compressBase64Image(dataUrl, 1024, 0.8);
                    let finalData = compressedDataUrl;
                    if (!data.startsWith('data:')) {
                        const commaIndex = compressedDataUrl.indexOf(',');
                        finalData = commaIndex > -1 ? compressedDataUrl.substring(commaIndex + 1) : compressedDataUrl;
                    }
                    return {
                        ...image,
                        data: finalData,
                        mimeType: 'image/jpeg' // 压缩后格式变为 jpeg
                    };
                } catch (error) {
                    console.warn('[imageUtils] Failed to compress reference image (object), using original', error);
                    return image;
                }
            }

            return image;
        })
    );
}

