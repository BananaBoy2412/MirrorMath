
import React from 'react';

// --- Logo Component ---
export const Logo: React.FC<{ size?: number | string; className?: string; withBackground?: boolean }> = ({
    size = 40,
    className = "",
    withBackground = true
}) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="bgGradientLogo" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#4facfe', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#00f2fe', stopOpacity: 1 }} />
                </linearGradient>

                <filter id="dropShadowLogo" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
                    <feOffset dx="0" dy="8" result="offsetblur" />
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.3" />
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>

                <pattern id="gridPatternLogo" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.15" />
                </pattern>

                <mask id="linesMaskLogo">
                    <rect x="0" y="0" width="512" height="512" fill="white" />
                    <path d="M 256 160 L 450 160 M 256 200 L 450 200 M 256 240 L 450 240 M 256 280 L 450 280 M 256 320 L 450 320 M 256 360 L 450 360"
                        stroke="black" strokeWidth="4" />
                </mask>

                <linearGradient id="reflectionFadeLogo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>

                <mask id="reflectionMaskLogo">
                    <rect x="0" y="0" width="512" height="200" fill="url(#reflectionFadeLogo)" />
                </mask>
            </defs>

            {withBackground && (
                <>
                    <rect x="0" y="0" width="512" height="512" rx="100" ry="100" fill="url(#bgGradientLogo)" />
                    <rect x="0" y="0" width="512" height="512" rx="100" ry="100" fill="url(#gridPatternLogo)" />
                    <g fill="#ffffff" fillOpacity="0.15" fontFamily="Arial, sans-serif" fontWeight="bold">
                        <text x="80" y="100" fontSize="40">+</text>
                        <text x="400" y="450" fontSize="40">÷</text>
                        <text x="60" y="420" fontSize="40">x</text>
                        <text x="420" y="100" fontSize="40">=</text>
                    </g>
                </>
            )}

            <g transform="translate(0, -20)">
                <g id="MainMLogo" filter="url(#dropShadowLogo)">
                    <path d="M 106 376 L 106 136 L 166 136 L 256 256 L 256 376 L 196 376 L 196 296 L 166 256 L 166 376 Z" fill={withBackground ? "#ffffff" : "#4facfe"} />
                    <path d="M 406 376 L 406 136 L 346 136 L 256 256 L 256 376 L 316 376 L 316 296 L 346 256 L 346 376 Z" fill={withBackground ? "#e0f7fa" : "#00f2fe"} mask="url(#linesMaskLogo)" />
                    <line x1="256" y1="136" x2="256" y2="376" stroke="#00b0ff" strokeWidth="2" strokeOpacity="0.5" />
                </g>

                <g transform="translate(0, 752) scale(1, -1)" opacity="1">
                    <g mask="url(#reflectionMaskLogo)">
                        <path d="M 106 376 L 106 136 L 166 136 L 256 256 L 256 376 L 196 376 L 196 296 L 166 256 L 166 376 Z" fill={withBackground ? "#ffffff" : "#4facfe"} />
                        <path d="M 406 376 L 406 136 L 346 136 L 256 256 L 256 376 L 316 376 L 316 296 L 346 256 L 346 376 Z" fill={withBackground ? "#e0f7fa" : "#00f2fe"} />
                    </g>
                </g>
            </g>
        </svg>
    );
};
