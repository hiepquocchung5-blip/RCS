"use client";

import { useEffect, useRef, useState } from "react";

interface RetroLoaderProps {
  onComplete?: () => void;
  autoDismiss?: boolean;
}

export function RetroLoader({ onComplete, autoDismiss = false }: RetroLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [powerOn, setPowerOn] = useState(true);
  const [frequency, setFrequency] = useState("108.0 MHz");
  const [liquidFill, setLiquidFill] = useState(0);
  const [colorScheme, setColorScheme] = useState<"emerald" | "gold" | "violet">("emerald");

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
      if (fill < 100) fill += 0.5;
      setLiquidFill(Math.floor(fill));

      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const w = canvas.width;
      const h = canvas.height;

      // Clear dark background
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, w, h);

      if (!powerOn) return;

      // Draw Retro TV Static / Noise Background
      const imgData = ctx.createImageData(w, h);
      for (let i = 0; i < imgData.data.length; i += 16) {
        const noise = Math.random() * 18;
        imgData.data[i] = noise;
        imgData.data[i + 1] = noise + 5;
        imgData.data[i + 2] = noise + 10;
        imgData.data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      // 3D Perspective Math for Floating Flying-In Logo
      ctx.save();
      ctx.translate(w / 2, h / 2 - 20);

      // Fly-in perspective scale & rotation
      const flyInScale = Math.min(1, time * 0.4);
      const rotY = Math.sin(time * 1.5) * 0.15;
      const rotX = Math.cos(time * 1.2) * 0.1;

      ctx.scale(flyInScale, flyInScale);

      // 3D Shadow / Glow
      ctx.shadowColor = colorScheme === "emerald" ? "#10b981" : colorScheme === "gold" ? "#f59e0b" : "#8b5cf6";
      ctx.shadowBlur = 30;

      // Outer Chevron Outline
      const size = 110;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(-size, size);
      ctx.lineTo(-size * 0.5, size);
      ctx.lineTo(0, -size * 0.1);
      ctx.lineTo(size * 0.5, size);
      ctx.lineTo(size, size);
      ctx.closePath();

      ctx.strokeStyle = colorScheme === "emerald" ? "#34d399" : colorScheme === "gold" ? "#fbbf24" : "#a78bfa";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Liquid Fill Inside Logo
      ctx.save();
      ctx.clip(); // Clip to logo boundary

      // Liquid Height Math
      const liquidY = size - (size * 2 * fill) / 100;
      ctx.beginPath();
      ctx.moveTo(-size * 1.5, liquidY);

      // Liquid Wave Sine Formula
      for (let x = -size * 1.5; x <= size * 1.5; x += 5) {
        const waveY = liquidY + Math.sin(x * 0.04 + time * 3) * 8 + Math.cos(x * 0.02 + time * 2) * 4;
        ctx.lineTo(x, waveY);
      }

      ctx.lineTo(size * 1.5, size * 1.5);
      ctx.lineTo(-size * 1.5, size * 1.5);
      ctx.closePath();

      // Liquid Gradient Fill
      const grad = ctx.createLinearGradient(0, size, 0, -size);
      if (colorScheme === "emerald") {
        grad.addColorStop(0, "#059669");
        grad.addColorStop(1, "#10b981");
      } else if (colorScheme === "gold") {
        grad.addColorStop(0, "#b45309");
        grad.addColorStop(1, "#f59e0b");
      } else {
        grad.addColorStop(0, "#6d28d9");
        grad.addColorStop(1, "#8b5cf6");
      }

      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore(); // Restore clip

      // Retro CRT Scanlines
      ctx.restore();
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1.5);
      }

      if (autoDismiss && fill >= 100 && onComplete) {
        setTimeout(onComplete, 800);
      } else {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [powerOn, colorScheme, autoDismiss, onComplete]);

  const handleShuffleColor = () => {
    const schemes: ("emerald" | "gold" | "violet")[] = ["emerald", "gold", "violet"];
    const idx = schemes.indexOf(colorScheme);
    const next = schemes[(idx + 1) % schemes.length] ?? "emerald";
    setColorScheme(next);
  };

  const handleTuneRadio = () => {
    const freqs = ["98.4 MHz", "104.2 MHz", "108.0 MHz RCS Sound"];
    const idx = freqs.indexOf(frequency);
    const next = freqs[(idx + 1) % freqs.length] ?? "108.0 MHz RCS Sound";
    setFrequency(next);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rise-border/80 bg-[#090d16] p-6 shadow-2xl space-y-4">
      {/* Retro TV Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rise-border/50 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPowerOn(!powerOn)}
            className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-mono transition-transform active:scale-90 ${
              powerOn
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                : "border-rose-500/50 bg-rose-500/20 text-rose-400"
            }`}
            title="Toggle TV Power"
          >
            ⏻
          </button>
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-rise-accent">
              RiseCoreStudio WebGL 3D Shell
            </h3>
            <p className="font-mono text-[11px] text-rise-muted">
              Retro CRT TV & Liquid Matrix Synthesizer
            </p>
          </div>
        </div>

        {/* Radio Tuning & Shuffle Controls */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={handleTuneRadio}
            className="rounded border border-rise-gold/40 bg-rise-gold/10 px-2.5 py-1 text-rise-gold hover:bg-rise-gold/20 transition-colors"
          >
            📻 {frequency}
          </button>
          <button
            onClick={handleShuffleColor}
            className="rounded border border-rise-accent/40 bg-rise-accent/10 px-2.5 py-1 text-rise-accent hover:bg-rise-accent/20 transition-colors"
          >
            🔀 Liquid Shuffle
          </button>
        </div>
      </div>

      {/* 3D Canvas Screen */}
      <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden rounded-xl border border-rise-border bg-black shadow-inner">
        <canvas ref={canvasRef} className="h-full w-full" />

        {/* Liquid Fill Gauge Display */}
        <div className="absolute bottom-4 left-4 font-mono text-xs text-rise-accent bg-black/60 backdrop-blur px-2.5 py-1 rounded border border-rise-border/50">
          LIQUID: {liquidFill}%
        </div>

        {/* Frequency Spectrum Visualizer Bars */}
        <div className="absolute bottom-4 right-4 flex items-end gap-1 h-6">
          <div className="w-1 bg-emerald-400 h-3 animate-pulse" />
          <div className="w-1 bg-emerald-400 h-5 animate-pulse delay-75" />
          <div className="w-1 bg-rise-gold h-4 animate-pulse delay-150" />
          <div className="w-1 bg-emerald-400 h-6 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
