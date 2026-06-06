import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    alpha: number;
    color: string;
}

export type GpuBackgroundMode = 'normal' | 'interactive-throttled' | 'paused';

interface GpuBackgroundProps {
    particleCount?: number;
    colors?: string[];
    enabled?: boolean;
    opacity?: number;
    connectionDistance?: number;
    showConnections?: boolean;
    mode?: GpuBackgroundMode;
}

let isGpuSupportedCache: boolean | null = null;
let recommendedCountCache: number | null = null;

function getRecommendedParticleCount(): number {
    if (typeof window === 'undefined') return 20;
    if (recommendedCountCache !== null) return recommendedCountCache;

    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (!gl) {
        recommendedCountCache = 20;
        isGpuSupportedCache = false;
        return 20;
    }

    // 显式释放临时 WebGL 上下文，防止内存泄露与 context 堆积警告
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) {
        ext.loseContext();
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;

    let count = 60;
    if (isMobile) {
        count = 25;
    } else if (isLowEndDevice) {
        count = 40;
    }

    recommendedCountCache = count;
    isGpuSupportedCache = true;
    return count;
}

const GpuBackground: React.FC<GpuBackgroundProps> = ({
    particleCount,
    colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e'],
    enabled = true,
    opacity = 0.6,
    connectionDistance = 150,
    showConnections = true,
    mode = 'normal',
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animationRef = useRef<number>(0);
    const [isSupported, setIsSupported] = useState(true);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

        handleChange();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, []);

    const initParticles = useCallback((width: number, height: number, count: number) => {
        const particles: Particle[] = [];

        for (let index = 0; index < count; index++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1,
                alpha: Math.random() * 0.5 + 0.3,
                color: colors[Math.floor(Math.random() * colors.length)],
            });
        }

        return particles;
    }, [colors]);

    const runtimeMode: GpuBackgroundMode = prefersReducedMotion ? 'paused' : mode;
    const baseParticleCount = particleCount ?? getRecommendedParticleCount();

    const effectiveParticleCount = useMemo(() => {
        if (runtimeMode === 'paused') {
            return Math.max(10, Math.floor(baseParticleCount * 0.25));
        }

        if (runtimeMode === 'interactive-throttled') {
            return Math.max(12, Math.floor(baseParticleCount * 0.35));
        }

        return baseParticleCount;
    }, [baseParticleCount, runtimeMode]);

    const effectiveShowConnections = runtimeMode === 'normal' && showConnections;
    const targetFrameInterval = runtimeMode === 'interactive-throttled' ? 50 : 1000 / 60;

    useEffect(() => {
        if (!enabled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setIsSupported(false);
            return;
        }

        setIsSupported(true);

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        };

        const drawFrame = (stepMultiplier: number, shouldAdvance: boolean) => {
            const width = window.innerWidth;
            const height = window.innerHeight;

            ctx.clearRect(0, 0, width, height);

            const particles = particlesRef.current;
            for (let index = 0; index < particles.length; index++) {
                const particle = particles[index];

                if (shouldAdvance) {
                    particle.x += particle.vx * stepMultiplier;
                    particle.y += particle.vy * stepMultiplier;

                    if (particle.x < 0 || particle.x > width) particle.vx *= -1;
                    if (particle.y < 0 || particle.y > height) particle.vy *= -1;
                }

                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                ctx.fillStyle = particle.color;
                ctx.globalAlpha = particle.alpha * opacity;
                ctx.fill();

                if (!effectiveShowConnections) {
                    continue;
                }

                for (let nextIndex = index + 1; nextIndex < particles.length; nextIndex++) {
                    const nextParticle = particles[nextIndex];
                    const dx = particle.x - nextParticle.x;
                    const dy = particle.y - nextParticle.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist >= connectionDistance) continue;

                    ctx.beginPath();
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(nextParticle.x, nextParticle.y);
                    ctx.strokeStyle = particle.color;
                    ctx.globalAlpha = (1 - dist / connectionDistance) * 0.2 * opacity;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }

            ctx.globalAlpha = 1;
        };

        resize();
        window.addEventListener('resize', resize);

        particlesRef.current = initParticles(window.innerWidth, window.innerHeight, effectiveParticleCount);

        drawFrame(1, runtimeMode !== 'paused');

        if (runtimeMode === 'paused') {
            return () => {
                window.removeEventListener('resize', resize);
                cancelAnimationFrame(animationRef.current);
            };
        }

        let lastFrameTime = 0;
        const animate = (timestamp: number) => {
            if (!lastFrameTime) {
                lastFrameTime = timestamp;
            }

            const elapsed = timestamp - lastFrameTime;
            if (elapsed >= targetFrameInterval) {
                const normalizedStep = Math.min(3, Math.max(0.75, elapsed / (1000 / 60)));
                drawFrame(normalizedStep, true);
                lastFrameTime = timestamp;
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationRef.current);
        };
    }, [
        connectionDistance,
        effectiveParticleCount,
        effectiveShowConnections,
        enabled,
        initParticles,
        opacity,
        runtimeMode,
        targetFrameInterval,
    ]);

    if (!enabled || !isSupported) return null;

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-0 pointer-events-none gpu-particle"
            style={{
                opacity,
                mixBlendMode: 'screen',
            }}
        />
    );
};

export default GpuBackground;

export function isGpuAccelerated(): boolean {
    if (typeof window === 'undefined') return false;
    if (isGpuSupportedCache !== null) return isGpuSupportedCache;

    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (!gl) {
        isGpuSupportedCache = false;
        return false;
    }

    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) {
        ext.loseContext();
    }

    isGpuSupportedCache = true;
    return true;
}
