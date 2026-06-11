import React from "react";

interface GrimoireLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export function GrimoireLogo({ className, size, ...props }: GrimoireLogoProps) {
  // If size is provided, use it for both width and height unless overridden
  const width = size ?? props.width ?? "200";
  const height = size ?? props.height ?? "200";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <radialGradient id="portal-logo-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffaa00" stop-opacity="0.15" />
          <stop offset="100%" stop-color="#ffaa00" stop-opacity="0" />
        </radialGradient>
        
        <linearGradient id="portal-logo-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffe082" />
          <stop offset="50%" stop-color="#ffaa00" />
          <stop offset="100%" stop-color="#b17200" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="90" fill="url(#portal-logo-glow)" />

      {/* Book Cover Background (Dark violet-black leather cover) */}
      <rect x="45" y="25" width="115" height="150" rx="8" fill="#120f18" stroke="url(#portal-logo-gold)" stroke-width="2" />
      
      {/* Book Spine */}
      <rect x="35" y="25" width="15" height="150" rx="3" fill="url(#portal-logo-gold)" />
      <line x1="39" y1="45" x2="46" y2="45" stroke="#120f18" stroke-width="2" />
      <line x1="39" y1="75" x2="46" y2="75" stroke="#120f18" stroke-width="2" />
      <line x1="39" y1="100" x2="46" y2="100" stroke="#120f18" stroke-width="2" />
      <line x1="39" y1="125" x2="46" y2="125" stroke="#120f18" stroke-width="2" />
      <line x1="39" y1="155" x2="46" y2="155" stroke="#120f18" stroke-width="2" />

      {/* Gold Corner Protectors */}
      <path d="M145 25 L160 25 L160 40 Z" fill="url(#portal-logo-gold)" />
      <path d="M145 175 L160 175 L160 160 Z" fill="url(#portal-logo-gold)" />
      
      {/* Embossed Frame border on the cover */}
      <rect x="60" y="38" width="85" height="124" rx="4" fill="none" stroke="url(#portal-logo-gold)" stroke-width="1" stroke-opacity="0.6" />

      {/* Celestial Arcane Symbol (Center of Cover) */}
      <circle cx="102.5" cy="100" r="28" stroke="url(#portal-logo-gold)" stroke-width="1.5" fill="none" />
      <circle cx="102.5" cy="100" r="22" stroke="url(#portal-logo-gold)" stroke-width="1" fill="none" stroke-dasharray="2 2" stroke-opacity="0.8" />
      
      {/* Intersecting Pentagram (5-Pointed Arcane Star) */}
      <path d="M102.5 75 L117.2 120.2 L78.7 92.3 L126.3 92.3 L87.8 120.2 Z" stroke="url(#portal-logo-gold)" stroke-width="1.5" fill="none" stroke-linejoin="round" />

      {/* Core Celestial Dot */}
      <circle cx="102.5" cy="100" r="3" fill="url(#portal-logo-gold)" />

      {/* Arcane dots around the symbol */}
      <circle cx="102.5" cy="67" r="1.5" fill="url(#portal-logo-gold)" />
      <circle cx="102.5" cy="133" r="1.5" fill="url(#portal-logo-gold)" />
      <circle cx="69" cy="100" r="1.5" fill="url(#portal-logo-gold)" />
      <circle cx="136" cy="100" r="1.5" fill="url(#portal-logo-gold)" />
    </svg>
  );
}
