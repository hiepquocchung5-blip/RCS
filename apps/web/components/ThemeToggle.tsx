"use client";

import { useEffect, useState } from "react";

const KEY = "rcs.theme";

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY) === "light";
    setLight(saved);
    document.documentElement.classList.toggle("light", saved);
  }, []);

  function toggle(): void {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    window.localStorage.setItem(KEY, next ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={light ? "Switch to Rise Dark" : "Switch to Ink & Emerald light"}
      className="flex h-7 w-7 items-center justify-center rounded border border-rise-border text-rise-muted transition-colors hover:border-rise-accent hover:text-rise-accent"
    >
      {light ? "☾" : "☀"}
    </button>
  );
}
