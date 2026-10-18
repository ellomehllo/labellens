import { useEffect, useState, type ReactNode } from 'react';
import { useSettings } from '../lib/settings.ts';

export type MochiMood = 'neutral' | 'happy' | 'search' | 'sleep';

const INK = '#2F2219';

/** Mochi, the LabelLens capybara: brown, round, with a mandarin on its head. */
export function Mochi({ mood = 'neutral', size = 160, decor = false }: { mood?: MochiMood; size?: number; decor?: boolean }) {
  return (
    <svg
      className="mochi"
      width={size}
      height={size * 1.06}
      viewBox="0 0 160 170"
      role="img"
      aria-label={mood === 'sleep' ? 'Mochi the capybara, asleep' : 'Mochi the capybara'}
    >
      {decor && <Sparkles />}
      <ellipse cx="80" cy="160" rx="54" ry="6" fill="#7A6447" opacity="0.16" />
      {/* body */}
      <ellipse cx="80" cy="122" rx="52" ry="40" fill="#B98A5D" />
      <ellipse cx="33" cy="124" rx="10" ry="17" fill="#A47549" transform="rotate(-12 33 124)" />
      <ellipse cx="127" cy="124" rx="10" ry="17" fill="#A47549" transform="rotate(12 127 124)" />
      <ellipse cx="80" cy="133" rx="31" ry="23" fill="#E5C8A1" />
      <ellipse cx="60" cy="158" rx="11" ry="5" fill="#8C623E" />
      <ellipse cx="100" cy="158" rx="11" ry="5" fill="#8C623E" />
      {/* ears */}
      <circle cx="36" cy="42" r="11" fill="#99693F" />
      <circle cx="36" cy="42" r="5.5" fill="#C99A6C" />
      <circle cx="124" cy="42" r="11" fill="#99693F" />
      <circle cx="124" cy="42" r="5.5" fill="#C99A6C" />
      {/* head */}
      <rect x="27" y="30" width="106" height="84" rx="42" fill="#BF9063" />
      <path d="M70 33 l4 -5 l3 5 l4 -5 l3 5 l4 -5 l2 5" fill="none" stroke="#9A6B42" strokeWidth="2.2" strokeLinejoin="round" />
      {/* blush */}
      <ellipse cx="44" cy="86" rx="9" ry="5.5" fill="#EBA597" opacity="0.85" />
      <ellipse cx="116" cy="86" rx="9" ry="5.5" fill="#EBA597" opacity="0.85" />
      {/* muzzle */}
      <ellipse cx="80" cy="86" rx="23" ry="16" fill="#A67A51" />
      <Face mood={mood} />
      {/* mandarin */}
      <circle cx="92" cy="22" r="12" fill="#F3A73A" />
      <circle cx="88" cy="18" r="4" fill="#F9C873" />
      <path d="M92 10 v-3" stroke="#6B4A2C" strokeWidth="2" strokeLinecap="round" />
      <path d="M93 8 C 99 1, 107 2, 110 6 C 104 10, 98 10, 93 8 Z" fill="#6DAA5C" />
      {mood === 'search' && <Magnifier />}
      {mood === 'sleep' && <Zzz />}
    </svg>
  );
}

function Face({ mood }: { mood: MochiMood }) {
  const closed = mood === 'happy' || mood === 'sleep';
  return (
    <g>
      {closed ? (
        mood === 'happy' ? (
          <>
            <path d="M48 68 Q55 60 62 68" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
            <path d="M98 68 Q105 60 112 68" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M48 64 Q55 71 62 64" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <path d="M98 64 Q105 71 112 64" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          </>
        )
      ) : (
        <>
          <circle cx="55" cy="66" r="7" fill={INK} />
          <circle cx="57.6" cy="63.4" r="2.3" fill="#fff" />
          <circle cx="105" cy="66" r="7" fill={INK} />
          <circle cx="107.6" cy="63.4" r="2.3" fill="#fff" />
        </>
      )}
      <ellipse cx="73.5" cy="81" rx="2.3" ry="3" fill={INK} />
      <ellipse cx="86.5" cy="81" rx="2.3" ry="3" fill={INK} />
      {mood === 'happy' ? (
        <>
          <path d="M70 92 Q80 104 90 92 Z" fill={INK} />
          <path d="M75 97 Q80 101 85 97 Q80 95 75 97 Z" fill="#E07A6B" />
        </>
      ) : (
        <path d="M71 93 Q80 100 89 93" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      )}
    </g>
  );
}

function Magnifier() {
  return (
    <g>
      <path d="M134 128 L146 141" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <circle cx="124" cy="117" r="14" fill="#DCEBFA" fillOpacity="0.75" stroke="#3E7FC4" strokeWidth="5" />
      <path d="M117 112 a8 8 0 0 1 7 -4" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <ellipse cx="116" cy="128" rx="9" ry="7" fill="#A47549" />
    </g>
  );
}

function Zzz() {
  return (
    <g fill="#7FA6CF" fontFamily="inherit" fontWeight="700">
      <text x="116" y="18" fontSize="13">z</text>
      <text x="127" y="8" fontSize="10">z</text>
      <text x="136" y="0" fontSize="8">z</text>
    </g>
  );
}

function Sparkles() {
  const star = (x: number, y: number, s: number, fill: string) =>
    `M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z|${fill}`;
  return (
    <g className="mochi-sparkles">
      {[star(8, 92, 9, '#5B97D9'), star(150, 98, 7, '#F2C14E'), star(144, 130, 5, '#7BB86B')].map((d) => {
        const [path, fill] = d.split('|');
        return <path key={path} d={path} fill={fill} />;
      })}
      <path d="M80 4 c-3 -4 -9 -1 -6 3 l6 6 l6 -6 c3 -4 -3 -7 -6 -3 Z" fill="#F1A7B5" transform="translate(-6 -2) scale(0.9)" />
    </g>
  );
}

/** A white speech bubble with a tail pointing down at Mochi. */
export function SpeechBubble({ children }: { children: ReactNode }) {
  return (
    <div className="speech" aria-live="polite">
      {children}
    </div>
  );
}

/**
 * Mochi with a rotating tip, as on the scanner and review screens. Tapping Mochi shows the next tip.
 * Hidden when the visitor turns tips off in Settings.
 */
export function MochiTips({ tips, dark = false }: { tips: string[]; dark?: boolean }) {
  const { showTips } = useSettings();
  const [index, setIndex] = useState(0);
  const key = tips.join('|');
  useEffect(() => setIndex(0), [key]);
  if (!showTips || tips.length === 0) return null;
  const current = Math.min(index, tips.length - 1);
  return (
    <div className={`tip-row${dark ? ' dark' : ''}`}>
      <button
        className="tip-mochi"
        onClick={() => setIndex((i) => (i + 1) % tips.length)}
        aria-label={tips.length > 1 ? 'Mochi: show the next tip' : 'Mochi'}
      >
        <Mochi size={52} />
      </button>
      <div className="tip-bubble" aria-live="polite">
        <p>{tips[current]}</p>
        {tips.length > 1 && (
          <div className="tip-foot">
            <span className="tip-dots" aria-hidden="true">
              {tips.map((t, i) => (
                <span key={t} className={i === current ? 'on' : ''} />
              ))}
            </span>
            <span>Tap Mochi for more</span>
          </div>
        )}
      </div>
    </div>
  );
}
