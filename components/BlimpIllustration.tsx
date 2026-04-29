import React from 'react';

const STAR_POINTS: Array<[number, number]> = [
  [40, 30],
  [90, 15],
  [160, 8],
  [310, 20],
  [380, 35],
  [420, 18],
];

function buildStarPoints(x: number, y: number) {
  return `${x},${y - 5} ${x + 2},${y} ${x + 6},${y} ${x + 3},${y + 3} ${x + 4},${y + 7} ${x},${y + 4} ${x - 4},${y + 7} ${x - 3},${y + 3} ${x - 6},${y} ${x - 2},${y}`;
}

export default function BlimpIllustration() {
  return (
    <div
      className="relative w-full max-w-md mx-auto select-none pointer-events-none"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 460 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full drop-shadow-2xl"
      >
        {/* Stars */}
        {STAR_POINTS.map(([x, y], i) => (
          <polygon
            key={i}
            points={buildStarPoints(x, y)}
            fill="#e91e8c"
            opacity="0.6"
          />
        ))}

        {/* Blimp body */}
        <ellipse cx="230" cy="140" rx="195" ry="72" fill="url(#blimpGrad)" />
        <ellipse
          cx="230"
          cy="140"
          rx="195"
          ry="72"
          fill="none"
          stroke="#f9a8d4"
          strokeWidth="2"
          opacity="0.4"
        />

        {/* Shine */}
        <ellipse
          cx="175"
          cy="110"
          rx="70"
          ry="22"
          fill="white"
          opacity="0.18"
          transform="rotate(-15 175 110)"
        />

        {/* Brand band */}
        <ellipse
          cx="230"
          cy="140"
          rx="140"
          ry="52"
          fill="url(#bandGrad)"
          opacity="0.85"
        />

        {/* Text: LucyCharms */}
        <text
          x="230"
          y="130"
          textAnchor="middle"
          fontFamily="ui-sans-serif,Arial"
          fontSize="22"
          fontWeight="800"
          fill="white"
          letterSpacing="1"
        >
          LucyCharms
        </text>
        <text
          x="230"
          y="150"
          textAnchor="middle"
          fontFamily="ui-sans-serif,Arial"
          fontSize="10"
          fontWeight="600"
          fill="#fce7f3"
          letterSpacing="2"
        >
          REALTY. BROKERAGE
        </text>
        <text
          x="230"
          y="167"
          textAnchor="middle"
          fontFamily="ui-sans-serif,Arial"
          fontSize="8.5"
          fill="#fbcfe8"
          fontStyle="italic"
        >
          Never feel like a dollar sign again!
        </text>

        {/* Gondola */}
        <rect x="195" y="208" width="70" height="22" rx="6" fill="#be185d" />
        <line
          x1="200"
          y1="208"
          x2="210"
          y2="212"
          stroke="#f9a8d4"
          strokeWidth="1.5"
        />
        <line
          x1="230"
          y1="208"
          x2="230"
          y2="213"
          stroke="#f9a8d4"
          strokeWidth="1.5"
        />
        <line
          x1="260"
          y1="208"
          x2="250"
          y2="212"
          stroke="#f9a8d4"
          strokeWidth="1.5"
        />

        {/* Fins */}
        <path
          d="M52 140 Q20 170 8 200 Q30 185 52 175 Z"
          fill="#e91e8c"
          opacity="0.7"
        />
        <path
          d="M52 140 Q20 110 8 80 Q30 95 52 105 Z"
          fill="#e91e8c"
          opacity="0.5"
        />
        <path
          d="M408 140 Q440 170 452 200 Q430 185 408 175 Z"
          fill="#e91e8c"
          opacity="0.7"
        />
        <path
          d="M408 140 Q440 110 452 80 Q430 95 408 105 Z"
          fill="#e91e8c"
          opacity="0.5"
        />

        {/* Small stars on blimp */}
        <text x="90" y="125" fontSize="14" fill="#fce7f3" opacity="0.8">
          ✦
        </text>
        <text x="355" y="155" fontSize="12" fill="#fce7f3" opacity="0.7">
          ✦
        </text>

        <defs>
          <radialGradient id="blimpGrad" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="60%" stopColor="#e91e8c" />
            <stop offset="100%" stopColor="#9d174d" />
          </radialGradient>
          <radialGradient id="bandGrad" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#be185d" />
            <stop offset="100%" stopColor="#831843" />
          </radialGradient>
        </defs>
      </svg>

      {/* Floating sparkles */}
      <div
        className="absolute top-2 right-8 text-pink-400 text-xl animate-bounce"
        style={{ animationDuration: '2.5s' }}
      >
        ✦
      </div>
      <div
        className="absolute top-12 left-4 text-pink-300 text-sm animate-bounce"
        style={{ animationDuration: '3.2s', animationDelay: '0.5s' }}
      >
        ★
      </div>
      <div
        className="absolute bottom-16 right-4 text-pink-300 text-xs animate-bounce"
        style={{ animationDuration: '2.8s', animationDelay: '1s' }}
      >
        ✦
      </div>
    </div>
  );
}
