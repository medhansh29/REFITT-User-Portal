import React, { useEffect, useRef, useState } from "react";
import { Map } from "lucide-react";

interface AladinViewerProps {
  ra?: number;
  dec?: number;
  name: string;
}

// Ensure TypeScript knows about A.aladin
declare global {
  interface Window {
    A: any;
  }
}

export default function AladinViewer({ ra, dec, name }: AladinViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const aladinContainer = useRef<HTMLDivElement>(null);
  const aladinInstance = useRef<any>(null);
  const markerLayer = useRef<any>(null);

  const [isVisible, setIsVisible] = useState(false);

  // 1. Use refs instead of state for synchronous tracking to beat Strict Mode
  const isInitialized = useRef(false);
  const lastTarget = useRef<string | null>(null);

  // Use IntersectionObserver to only init Aladin when visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initialize Aladin only when visible and NOT yet initialized
  useEffect(() => {
    // Check our synchronous ref instead of state
    if (!isVisible || isInitialized.current || !aladinContainer.current || !window.A) return;
    if (ra === undefined || dec === undefined) return;

    // 2. Lock it down synchronously BEFORE calling A.aladin
    isInitialized.current = true;
    lastTarget.current = `${ra},${dec}`;

    try {
      aladinInstance.current = window.A.aladin(aladinContainer.current, {
        survey: "P/PanSTARRS/DR1/color-z-zg-g",
        fov: 0.05,
        target: `${ra} ${dec}`,
        showLayersControl: false,
        showFullscreenControl: false,
        showReticle: true,
        showZoomControl: true,
        showGotoControl: false,
      });

      markerLayer.current = window.A.catalog({
        name: "Supernova",
        sourceSize: 18,
        color: "#ef4444",
        shape: "cross",
      });
      aladinInstance.current.addCatalog(markerLayer.current);

      const source = window.A.source(ra, dec, {
        name: name,
        desc: `Supernova ${name}`,
      });
      markerLayer.current.addSources([source]);
    } catch (e) {
      console.warn(`[AladinViewer] Failed to init for ${name}:`, e);
      // Unlock if it natively failed so it can try again
      isInitialized.current = false; 
    }
  }, [isVisible, ra, dec, name]);

  // Update position when ra/dec changes on an already-initialized instance
  useEffect(() => {
    if (!isInitialized.current || !aladinInstance.current || ra === undefined || dec === undefined) return;

    // Prevent the update logic from running if the coordinates haven't actually changed
    const currentTarget = `${ra},${dec}`;
    if (lastTarget.current === currentTarget) return;

    lastTarget.current = currentTarget;

    // Wait for the modal's CSS fade-in transition (300ms) to complete before panning. 
    // If we pan while opacity is 0, Aladin's tile-culling engine thinks the map 
    // is off-screen and cancels the network requests!
    const timer = setTimeout(() => {
      aladinInstance.current.gotoRaDec(ra, dec);

      aladinInstance.current.setFoV(0.05); // This zooms out to show the object in context of the whole sky
      
      if (markerLayer.current) {
        markerLayer.current.removeAllSources();
        const source = window.A.source(ra, dec, {
          name: name,
          desc: `Supernova ${name}`,
        });
        markerLayer.current.addSources([source]);
      }
    }, 350); // 350ms ensures the 300ms transition is 100% finished

    // Cleanup the timer if the user closes the modal before the animation finishes
    return () => clearTimeout(timer);
  }, [ra, dec, name]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full border border-white/10 rounded-xl overflow-hidden bg-black"
    >
      {/* REMOVED the conditional 'hidden' class. The WebGL canvas must NEVER be display: none */}
      <div
        ref={aladinContainer}
        id="aladin-lite-container"
        className="w-full h-full" 
      />

      {/* Fallback UI overlays the canvas if coordinates are missing */}
      {(ra === undefined || dec === undefined) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0b0c10] p-2 z-20">
          <Map className="w-5 h-5 text-slate-700 mb-1" />
          <p className="text-[8px] font-mono text-slate-500 text-center uppercase tracking-wider leading-tight">
            No coords
          </p>
        </div>
      )}

      
    </div>
  );
}