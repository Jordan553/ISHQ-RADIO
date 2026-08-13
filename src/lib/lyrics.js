/**
 * Time-coded (LRC) lyrics for the ISHQ RADIO playlist.
 * Timestamps are tuned to the listed songs; if your audio copies differ,
 * either edit the lines below or add an [offset:±ms] tag as the first line.
 * These are parsed on demand — a 10-second intro with no timestamps is a
 * normal instrumental opening and will not highlight anything.
 */

import { parseLrc } from './lrcParser.js';

/** plain lyrics -> evenly-timed LRC across the given duration (LRCLIB fallback). */
export function plainToLrc(text, duration = 0) {
  const lines = String(text || '')
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const d = Number(duration) > 0 ? Number(duration) : lines.length * 3.2;
  const slot = d / Math.max(1, lines.length);
  return lines
    .map((t, i) => {
      const s = i * slot;
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `[${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}] ${t}`;
    })
    .join('\n');
}

const lrcInflight = new Map(); // "title|artist" -> Promise<{lrc,status,source}>

/**
 * Fetch synchronized lyrics from LRCLIB (via our /lyrics relay) for any
 * track — Drive-library or online YouTube picks. Returns a parseLrc
 * result plus status; never throws.
 */
export async function fetchLrc(track) {
  if (!track) return { lrc: null, status: 'missing', source: null };
  if (LYRICS[track.id]) {
    return { lrc: parseLrc(LYRICS[track.id]), status: 'ok', source: 'static' };
  }
  const title = String(track.title || '').trim();
  const artist = String(track.artist || '').trim();
  if (!title) return { lrc: null, status: 'missing', source: null };
  const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
  if (lrcInflight.has(key)) return lrcInflight.get(key);

  const job = (async () => {
    try {
      const u = new URL('/lyrics', location.origin);
      u.searchParams.set('title', title);
      u.searchParams.set('artist', artist);
      u.searchParams.set('duration', Number(track.duration) || 0);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      let res;
      try {
        res = await fetch(u, { signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
      const { hit } = await res.json();
      if (!hit) return { lrc: null, status: 'missing', source: 'lrclib' };

      if (hit.instrumental) {
        return {
          lrc: parseLrc('[00:00.00]♪ an instrumental — let the melody speak ♪'),
          status: 'ok', source: 'lrclib'
        };
      }

      const syncedText = (hit.syncedLyrics || '').trim();
      const plainText = (hit.plainLyrics || '').trim();
      if (!syncedText && !plainText) return { lrc: null, status: 'missing', source: 'lrclib' };

      const synced = Boolean(syncedText);
      const lrcText = syncedText || plainToLrc(plainText, hit.duration);
      const hasMeta = /^\[(ti|ar|al|by|re|ve|offset):/m.test(lrcText);
      const lrc = parseLrc(
        (hasMeta ? '' : `[ti:${hit.trackName || ''}]\n[ar:${hit.artistName || ''}]\n`) + lrcText
      );
      lrc.meta.source = 'lrclib';
      lrc.meta.synced = synced;
      lrc.meta.album = hit.albumName || '';
      return { lrc, status: 'ok', source: 'lrclib' };
    } catch {
      return { lrc: null, status: 'error', source: 'lrclib' };
    }
  })();

  lrcInflight.set(key, job);
  return job;
}

export const LYRICS = {
  'tum-hi-ho': `[ar:Arijit Singh]
[ti:Tum Hi Ho]
[00:16.00]Hum tere bin ab reh nahi sakte
[00:21.50]Tere bina kya wajood mera
[00:27.00]Tujhse juda agar ho jaayenge
[00:33.00]Toh khud se hi ho jaayenge juda
[00:39.00]Kyunki tum hi ho
[00:45.00]Ab tum hi ho
[00:51.00]Zindagi ab tum hi ho
[00:57.00]Chain bhi, mera dard bhi
[01:03.00]Aashiqui ab tum hi ho
[01:10.00]Tera pyaar hai, toh keh do
[01:16.00]Kahin bhi ho, hum hai wahin
[01:22.00]Aankhon ke aage ye din hai
[01:28.00]Na tum kaho, na hum kahein
[01:34.00]Kyunki tum hi ho
[01:40.00]Ab tum hi ho
[01:46.00]Zindagi ab tum hi ho
[01:52.00]Chain bhi, mera dard bhi
[01:58.00]Aashiqui ab tum hi ho
[02:06.00](instrumental — वाद्य संगीत)
[02:40.00]Tumse hi din hota hai
[02:46.00]Tumse hi subah hoti hai
[02:52.00]Tumse hi saans aati hai
[02:58.00]Tumse hi chain aata hai
[03:04.00]Kyunki tum hi ho
[03:10.00]Ab tum hi ho
[03:16.00]Zindagi ab tum hi ho
[03:22.00]Chain bhi, mera dard bhi
[03:28.00]Aashiqui ab tum hi ho
[03:36.00]Hum tere bin ab reh nahi sakte
[03:42.00]Tere bina kya wajood mera
[03:48.00]Aa tum hi ho, tum hi ho
[03:55.00]Tum hi ho`,

  'tum-se-hi': `[ar:Mohit Chauhan]
[ti:Tum Se Hi]
[00:28.00]Tum se hi din hota hai
[00:34.00]Tum se hi subah hoti hai
[00:40.00]Tum se hi saans aati hai
[00:46.00]Tum se hi chain aata hai
[00:52.00]Tum se hi dil dhadakta hai
[00:58.00]Tum se hi ho khushiyan
[01:04.00]Tum se hi subah hoti hai
[01:10.00]Tum se hi shaam hoti hai
[01:16.00]Tum se hi har dhoop garm
[01:22.00]Aur tum se hi barasata
[01:28.00]Ab toh har pal mein ho
[01:34.00]Tum se hi har lamha
[01:40.00]Sochta hoon toh ye lage
[01:46.00]Jeevan hai tumse hi
[01:54.00](instrumental — वाद्य संगीत)
[02:30.00]Tum se hi chahaton mein
[02:36.00]Dhoon dhoon chehra hai tera
[02:42.00]Tum se hi pyaar karna
[02:48.00]Tum se hi muskuralna
[02:54.00]Tum se hi jeevan ye
[03:00.00]Tum se hi sajta hai
[03:06.00]Tum se hi aasmaan, tum se hi hai basti
[03:12.00]Tum se hi har ek khushi
[03:18.00]Dhoond le dil mein mujhe
[03:24.00]Tum ho wahin kahin
[03:30.00]Sochta hoon toh ye lage
[03:36.00]Jeevan hai tumse hi`,

  'lag-ja-gale': `[ar:Rahat Fateh Ali Khan]
[ti:Lag Ja Gale]
[00:24.00]Lag jaa gale
[00:30.00]Ke phir ye haseen raat ho na ho
[00:38.00]Shaayad phir is janam mein
[00:44.00]Mulaqaat ho na ho
[00:52.00]Hum ko unke waade par
[00:58.00]Aaj bhi hai yakeen
[01:04.00]Pehle bhi tha yakeen
[01:10.00]Aaj bhi hai yakeen
[01:16.00]Lag jaa gale
[01:22.00]Ke phir ye haseen raat ho na ho
[01:30.00]Shaayad phir is janam mein
[01:36.00]Mulaqaat ho na ho
[01:44.00](instrumental — वाद्य संगीत)
[02:20.00]Hum ko unke waade par
[02:26.00]Aaj bhi hai yakeen
[02:32.00]Pehle bhi tha yakeen
[02:38.00]Aaj bhi hai yakeen
[02:44.00]Ye haseen raat
[02:50.00]Ye khushi bhari bahaar
[02:56.00]Tumhi se hai, tumhi se hai
[03:02.00]Ye mehki mehki raat
[03:10.00]Lag jaa gale
[03:16.00]Ke phir ye haseen raat ho na ho
[03:24.00]Shaayad phir is janam mein
[03:30.00]Mulaqaat ho na ho`,

  'darasal': `[ar:Atif Aslam]
[ti:Darasal]
[00:20.00]Darasal mujhko bhi nahi maloom
[00:27.00]Ke hai ye dil mein kya aaj kal
[00:34.00]Darasal mujhko bhi nahi pata
[00:41.00]Ke ye wafa hai ke saza aaj kal
[00:48.00]Pehle bhi dil toote hain magar
[00:55.00]Tera kissa juda hai
[01:02.00]Toota tha jo dil toota wahi
[01:09.00]Ye khaatir hai nayi
[01:16.00]Darasal mujhko bhi nahi maloom
[01:23.00]Ke hai ye dil mein kya aaj kal
[01:30.00](instrumental — वाद्य संगीत)
[02:10.00]Uthi hain yun teri yaadein
[02:17.00]Ke sari raat jaagi
[02:24.00]Bahut ruhaani si ho tum
[02:31.00]Ke baatein bhi nibhaagi
[02:38.00]Darasal mujhko bhi nahi maloom
[02:45.00]Ke hai ye dil mein kya aaj kal
[02:52.00]Pehle bhi dil toote hain magar
[02:59.00]Tera kissa juda hai
[03:06.00]Darasal mujhko bhi nahi pata
[03:13.00]Ke ye wafa hai ke saza aaj kal`,

  'humsafar': `[ar:Akhil Sachdeva, Mansheel Gujral]
[ti:Humsafar]
[00:12.00]Jee lein zara, kal ho na ho
[00:18.00]Ishq ye humsafar
[00:23.00]Yaar ho tum agar
[00:28.00]Aasmaan se baatein
[00:33.00]Pyaar bhari lagaatein
[00:38.00]Tum sang dil khushnuma
[00:43.00]Ho jaaun bepata
[00:48.00]Chal chalein door tak
[00:53.00]Dhoondhein jahan hum dua
[00:58.00]Jee lein zara, kal ho na ho
[01:03.00]Ishq ye humsafar
[01:08.00]Yaar ho tum agar
[01:15.00](instrumental — वाद्य संगीत)
[01:55.00]Tumse hi ye mann ki baatein
[02:00.00]Khol dein saari raatein
[02:05.00]Aur kya chahiye, bas tum hi toh ho
[02:10.00]Tere ishq mein hum
[02:15.00]Khone lage hain daam
[02:20.00]Aur sada keh rahe
[02:25.00]Tum ho humsafar
[02:30.00]Jee lein zara, kal ho na ho
[02:35.00]Ishq ye humsafar
[02:40.00]Yaar ho tum agar`,

  'mast-magan': `[ar:Arijit Singh, Chinmayi Sripada]
[ti:Mast Magan]
[00:16.00]Mast magan, mast magan
[00:23.00]Meethi baatein tum karo
[00:29.00]Naseebo ko jaga do
[00:35.00]Ye khushi tum saath do
[00:41.00]Udaaso ko hata do
[00:47.00]Ye dil tuta hai toote jagah
[00:53.00]Jo phool khile woh jaane
[00:59.00]Dil dhadka hai dhadke jagaah
[01:05.00]Khushboo kare wo bhi jaane
[01:11.00]Mast magan, mast magan
[01:17.00]Roz khwaabo mein hum gaate hain
[01:23.00]Tere intezaar mein
[01:29.00]Rishton ke baandh ye
[01:35.00]Toot na jayein kahin
[01:41.00]Mast magan, mast magan
[01:48.00](instrumental — वाद्य संगीत)
[02:30.00]Chaand taro ke siwa
[02:36.00]Jab na koi humsafar
[02:42.00]Chalo tumse baatein karein
[02:48.00]Tanha raat mein
[02:54.00]Mast magan, mast magan,
[03:00.00]ye dil tuta hai toote jagah
[03:06.00]Jo phool khile woh jaane`,

  'soch-na-sake': `[ar:Amaal Mallik, Arijit Singh, Tulsi Kumar]
[ti:Soch Na Sake]
[00:14.00]Soch na sake hum toh sanam
[00:21.00]Itna pyaar hoga
[00:28.00]Pehli dafa tere baare mein
[00:35.00]Sochun toh rah kehna hai
[00:42.00]Bas tera main hoon, bas mera tu hai
[00:49.00]Jhootha ye kehna hai
[00:56.00]Soch na sake hum toh sanam
[01:03.00]Itna pyaar hoga
[01:10.00]Pehli dafa tere baare mein
[01:17.00]Sochun toh rah kehna hai
[01:24.00](instrumental — वाद्य संगीत)
[02:05.00]Teri baahon mein bheegi raaton mein
[02:12.00]Yun hi khoya rahoon
[02:19.00]Teri aankhon mein doobun
[02:26.00]Teri narm dhoop mein
[02:33.00]Soch na sake hum toh sanam
[02:40.00]Itna pyaar hoga
[02:47.00]Bas tera main hoon, bas mera tu hai
[02:54.00]Jhootha ye kehna hai`,

  'kaun-tujhe': `[ar:Palak Muchhal]
[ti:Kaun Tujhe]
[00:14.00]Kaun tujhe yun pyaar karega
[00:21.00]Jo main karta hoon
[00:28.00]Tujhe chand kahoon ya sitara
[00:35.00]Tu maine hi hai
[00:42.00]Teri aankhon mein hi rehta hai
[00:49.00]Mera jahaan
[00:56.00]Kaun tujhe yun pyaar karega
[01:03.00]Jo main karta hoon
[01:10.00]Tujhe chand kahoon ya sitara
[01:17.00]Tu maine hi hai
[01:24.00](instrumental — वाद्य संगीत)
[02:05.00]Tere bina ho na jeeun
[02:12.00]Yun tere bina na marna
[02:19.00]Dil mein hai bas ek basera
[02:26.00]Teri yaadon ka karna
[02:33.00]Kaun tujhe yun pyaar karega
[02:40.00]Jo main karta hoon
[02:47.00]Tujhe chand kahoon ya sitara
[02:54.00]Tu maine hi hai`,

  'sab-tera': `[ar:Armaan Malik, Shraddha Kapoor]
[ti:Sab Tera]
[00:12.00]Sab tera, sab tera
[00:19.00]Dil bhi dekh ke dhadka hai
[00:26.00]Dhadkanon mein bas tera naam hai
[00:33.00]Sab tera, sunn le zara
[00:40.00]Tere hone se hi dil mein
[00:47.00]Roshn si hai
[00:54.00]Yun bata de ke lab pe
[01:01.00]Bas dua si hai
[01:08.00]Sab tera, sab tera
[01:15.00]Dil bhi dekh ke dhadka hai
[01:22.00]Dhadkanon mein bas tera naam hai
[01:29.00](instrumental — वाद्य संगीत)
[02:10.00]Teri nazron mein bhi kuch
[02:17.00]Kehne ko hai baaki
[02:24.00]Teri baaton mein hai bas
[02:31.00]Muskurahat saaki
[02:38.00]Sab tera, sab tera
[02:45.00]Dil bhi dekh ke dhadka hai
[02:52.00]Dhadkanon mein bas tera naam hai
[02:59.00]Sab tera, sunn le zara`,

  'ban-ja-rani': `[ar:Guru Randhawa]
[ti:Ban Ja Rani]
[00:18.00]Ban ja rani sohniye
[00:25.00]Ban ja tu rani
[00:32.00]Tere bin rehna sajna
[00:39.00]Nu ji nahi lage
[00:46.00]Main ta tera hoya
[00:53.00]Tu hove meri
[01:00.00]Ban ja rani sohniye
[01:07.00]Ban ja tu rani
[01:14.00]Maine dil ko tere hawale kiya
[01:21.00]Ab kya rakha hai mira chhawni
[01:28.00]Tere ishq ne banaya hai
[01:35.00]Tere ishq ne maara
[01:42.00]Ban ja rani sohniye
[01:49.00]Ban ja tu rani
[01:56.00](instrumental — वाद्य संगीत)
[02:40.00]Aankhan naal dekhi je tu
[02:47.00]Dil de dillagi si
[02:54.00]Rabb ne banaaya tujhe
[03:01.00]Meri saanjh diagli si
[03:08.00]Ban ja rani sohniye
[03:15.00]Ban ja tu rani`,

  fallback: `[00:00.00]— love songs, ghazals & romantic hits —
[00:06.00]Live together.
[00:12.00]Feel the love.`,

  empty: ''
};