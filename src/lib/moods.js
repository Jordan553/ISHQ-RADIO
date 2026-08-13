/**
 * Mood / category definitions.
 *
 * Six moods stream online through the existing YouTube flow; "Jordan Core"
 * is the dedicated Google Drive collection (served by /jordan/playlist).
 */

export const MOODS = [
  { id: 'love',      label: 'Love',      icon: 'fa-heart',            query: 'best hindi romantic love songs' },
  { id: 'breakup',   label: 'Breakup',   icon: 'fa-heart-crack',      query: 'sad hindi breakup songs' },
  { id: 'rain',      label: 'Rain',      icon: 'fa-cloud-rain',       query: 'romantic hindi rain songs' },
  { id: 'night',     label: 'Night',     icon: 'fa-moon',             query: 'late night romantic hindi songs' },
  { id: 'chill',     label: 'Chill',     icon: 'fa-couch',            query: 'chill romantic hindi songs' },
  { id: 'romance',   label: 'Romance',   icon: 'fa-hand-holding-heart', query: 'romantic hindi songs' },
  { id: 'english-pop', label: 'English Pop', icon: 'fa-globe',        query: 'best english pop songs' },
  { id: 'genz',      label: 'Gen-Z',     icon: 'fa-bolt',             query: 'gen z trending viral songs' },
  { id: 'jordan-core', label: 'Jordan Core', icon: 'fa-fire',         drive: true }
];

export const REACTIONS = ['❤️', '😢', '🌙', '✨'];

export const moodById = (id) => MOODS.find((m) => m.id === id);