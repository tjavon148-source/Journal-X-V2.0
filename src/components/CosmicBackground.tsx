import { useMemo } from 'react'

/**
 * Obsidian backdrop: a near-black base with a white star-dust overlay.
 *
 * Deliberately colourless — the only hues on screen belong to data (green/red
 * P&L, blue/magenta direction), so the background stays neutral rather than
 * competing with them.
 *
 * The stars are one element per layer carrying a long `box-shadow` list rather
 * than one element per star — a few hundred DOM nodes on a fixed backdrop
 * would cost more than the effect is worth. Positions come from a fixed seed,
 * so the sky is identical on every load and never reshuffles on re-render.
 */

const FIELD_W = 2600
const FIELD_H = 1700

function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A `box-shadow` list of `count` dots scattered across the field. */
function starShadows(count: number, seed: number, maxAlpha: number): string {
  const rng = makeRng(seed)
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.round(rng() * FIELD_W)
    const y = Math.round(rng() * FIELD_H)
    // Vary brightness so a layer doesn't read as one flat stipple.
    const alpha = (maxAlpha * (0.3 + rng() * 0.7)).toFixed(2)
    parts.push(`${x}px ${y}px 0 0 rgba(255, 255, 255, ${alpha})`)
  }
  return parts.join(', ')
}

interface Layer {
  size: number
  shadows: string
  className: string
}

export function CosmicBackground() {
  const layers = useMemo<Layer[]>(
    () => [
      // Far: dense, dim, 1px pinpricks.
      {
        size: 1,
        shadows: starShadows(280, 0xa11ce, 0.7),
        className: 'opacity-70 animate-[twinkle_7s_ease-in-out_infinite]',
      },
      // Mid: fewer, brighter.
      {
        size: 2,
        shadows: starShadows(85, 0xb0b1e, 0.85),
        className: 'opacity-80 animate-[twinkle_11s_ease-in-out_infinite_-3s]',
      },
      // Near: a handful of bright foreground stars.
      {
        size: 3,
        shadows: starShadows(18, 0xc0ffee, 1),
        className: 'opacity-90 animate-[twinkle_15s_ease-in-out_infinite_-7s]',
      },
    ],
    [],
  )

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Obsidian base */}
      <div className="absolute inset-0 bg-black" />

      {/* Neutral depth: a faint cool lift near the top so the page isn't a flat
          void, with no hue strong enough to register as colour. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(75rem 45rem at 20% -10%, rgba(255, 255, 255, 0.045), transparent 62%)',
            'radial-gradient(60rem 40rem at 85% 0%, rgba(255, 255, 255, 0.03), transparent 65%)',
            'radial-gradient(55rem 40rem at 60% 100%, rgba(255, 255, 255, 0.022), transparent 60%)',
          ].join(', '),
        }}
      />

      {/* Star layers */}
      {layers.map((layer, i) => (
        <div
          key={i}
          className={`absolute top-0 left-0 rounded-full ${layer.className}`}
          style={{
            width: layer.size,
            height: layer.size,
            boxShadow: layer.shadows,
          }}
        />
      ))}

      {/* Vignette, so the corners fall away and content stays the focus. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(120% 90% at 50% 40%, transparent 45%, rgba(0, 0, 0, 0.85) 100%)',
        }}
      />
    </div>
  )
}
