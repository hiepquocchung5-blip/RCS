"use client";

import { useEffect, useRef, useState } from "react";

interface RetroLoaderProps {
  onComplete?: () => void;
  autoDismiss?: boolean;
}

export function RetroLoader({ onComplete, autoDismiss = false }: RetroLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [liquidFill, setLiquidFill] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;
    let fill = 0;

    const render = () => {
      time += 0.03;
      if (fill < 100) fill += 0.6;
      setLiquidFill(Math.floor(fill));

      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const w = canvas.width;
      const h = canvas.height;

      // Clear dark glass background
      ctx.fillStyle = "#0c0f18";
      ctx.fillRect(0, 0, w, h);

      // Subtle Cyber Grid Lines
      ctx.strokeStyle = "rgba(0, 240, 255, 0.04)";
      ctx.lineWidth = 1;
      const gridSize = 30;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 3D Fly-in Perspective Transformation
      ctx.save();
      ctx.translate(w / 2, h / 2 - 10);

      const flyInScale = Math.min(1, time * 0.4);
      ctx.scale(flyInScale, flyInScale);

      // Neon Cyan Ambient Glow
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 25;

      // Outer Metallic Chevron Outline
      const size = 95;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(-size, size);
      ctx.lineTo(-size * 0.5, size);
      ctx.lineTo(0, -size * 0.1);
      ctx.lineTo(size * 0.5, size);
      ctx.lineTo(size, size);
      ctx.closePath();

      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Liquid Fill Inside Chevron
      ctx.save();
      ctx.clip(); // Clip to logo boundary

      const liquidY = size - (size * 2 * fill) / 100;
      ctx.beginPath();
      ctx.moveTo(-size * 1.5, liquidY);

      // Smooth Liquid Wave Math
      for (let x = -size * 1.5; x <= size * 1.5; x += 5) {
        const waveY = liquidY + Math.sin(x * 0.04 + time * 3.5) * 7 + Math.cos(x * 0.02 + time * 2.5) * 4;
        ctx.lineTo(x, waveY);
      }

      ctx.lineTo(size * 1.5, size * 1.5);
      ctx.lineTo(-size * 1.5, size * 1.5);
      ctx.closePath();

      // Liquid Metallic Cyan/Gold Gradient
      const grad = ctx.createLinearGradient(0, size, 0, -size);
      grad.addColorStop(0, "#0088ff");
      grad.addColorStop(0.5, "#00f0ff");
      grad.addColorStop(1, "#d4b06a");

      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore(); // Restore clip

      ctx.restore();

      if (autoDismiss && fill >= 100 && onComplete) {
        setTimeout(onComplete, 800);
      } else {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [autoDismiss, onComplete]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rise-border/80 bg-rise-surface/60 backdrop-blur-xl p-4 shadow-2xl space-y-3">
      {/* 3D WebGL Canvas Screen */}
      <div className="relative flex h-[240px] w-full items-center justify-center overflow-hidden rounded-xl border border-rise-border/50 bg-[#0c0f18] shadow-inner">
        <canvas ref={canvasRef} className="h-full w-full" />

        {/* Clean Modern Liquid Level Badge */}
        <div className="absolute bottom-3 left-4 font-mono text-[11px] text-rise-accent bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-rise-accent/30 font-semibold tracking-wider">
          SYSTEM MATRIX · {liquidFill}%
        </div>
      </div>
    </div>
  );
}
