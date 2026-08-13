/**
 * Auto Romantic Visuals — ambient background scenes keyed to the
 * active mood. rain + roses are canvas particle scenes; the rest are
 * pure CSS glow scenes. Falls back to a subtle ember scene.
 */

export const MOOD_SCENES = {
  love: 'roses',
  breakup: 'rain',
  rain: 'rain',
  night: 'city',
  chill: 'sunset',
  romance: 'candles',
  'jordan-core': 'moonlight'
};

export const SCENE_META = {
  rain: { label: 'rain', canvas: true },
  roses: { label: 'roses', canvas: true },
  candles: { label: 'candles', canvas: false },
  city: { label: 'city', canvas: false },
  sunset: { label: 'sunset', canvas: false },
  moonlight: { label: 'moonlight', canvas: false }
};

/** Resolve the scene for a mood (or the default ember backdrop). */
export function sceneFor(moodId, midnight) {
  const scene = (moodId && MOOD_SCENES[moodId]) || (midnight ? 'moonlight' : 'city');
  return SCENE_META[scene] ? scene : 'city';
}