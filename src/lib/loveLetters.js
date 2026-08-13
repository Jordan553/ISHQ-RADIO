/** Curated romantic one-liners per mood — no AI backend needed. */

const POOL = {
  love: [
    'Teri yaadon ki baarish me aaj bhi bheegta hoon.',
    'Tu mile toh saal bhi lamhe lagte hain.',
    'Meri subah teri awaaz se shuru hoti hai.',
    'Jitna paas hoon, utna hi kam lagta hai.',
    'Tu hai toh chaand bhi itna khas nahi.',
    'Dhadkanon ka pehla shor tumse juda hai.'
  ],
  breakup: [
    'Teri yaadein chhod ke bhi nahi jaati.',
    'Chai ab bhi banati hoon, magar ek hi cup.',
    'Jo rukhi thi baat, wo baras hi gayi.',
    'Tere bina aadhi raat aur lambi ho gayi.',
    'Na tu tha na raah thi, phir bhi chala.',
    'Jo todte hain waade, wo dua se nahi milte.'
  ],
  rain: [
    'Baarish me bheegte hain, toh yaad tu aata hai.',
    'Barishon ka naam sunte hi dil sambhalta nahi.',
    'Geeli raaton me teri khushboo bhatakti hai.',
    'Baadal chale aaye, tu kyun nahi aaya.',
    'Mausam poochta hai, tera kya haal hai.',
    'Boondon ki ungliyon se likha tera naam.'
  ],
  night: [
    'Raat ke andhere me bhi tera chehra jagmagaata hai.',
    'Taare gin-ta raha, tujhe chahta raha.',
    'Neend teri baatein karti hai, jagata nahi.',
    'Chaand tere saath ho toh raat sirf khubsurat hai.',
    'Adhoori raaton ka hisaab tera naam likha hai.',
    'Sitaare bhi sharmate hain teri roshni se.'
  ],
  chill: [
    'Halke halke ishq me bhi dil dhadakta hai.',
    'Aaram se, dheere dheere — sath raho humesha.',
    'Chai ho ya shaam, tu dono ka swaad hai.',
    'Gulabi shaam ka tohfa le ke aaya hoon.',
    'Sufficient: tera haath aur ek dhoop waali shaam.',
    'Zindagi ke sach se behtar, tera jhooth bhi achha.'
  ],
  romance: [
    'Gulab ki sharm, teri hasi ka aaina hai.',
    'Tere haath ki lakirein mere naam se judi hain.',
    'Palkon ke nishaan pe tumhara naam likha hai.',
    'Har geet ke sargam me tera rang sama hai.',
    'Mohabbat ki ibtida teri aankhon se hui.',
    'Tumhari chahat me zindagi ka raaz hai.'
  ],
  'jordan-core': [
    'Jordaan ke galiyon se guzre, tera ishq yahan bhi mila.',
    'Core wala pyaar — shaam ke aansu, subah ka chaand.',
    'Ek hi naam jabaan par, bas ek hi raah teri.',
    'Sard raatein, garam jazbaat — ye teri kahani.',
    'Ishq ka koi map nahi, sirf ehsas hai.',
    'Har gana tera, har baat teri — ye core hai.'
  ]
};

const DEFAULT_POOL = POOL.romance;

/** Pick a fresh line for a mood, favouring ones not used recently. */
export function loveLetter(moodId, used = []) {
  const pool = POOL[moodId] || DEFAULT_POOL;
  const fresh = pool.filter((l) => !used.includes(l));
  const source = fresh.length ? fresh : pool;
  return source[Math.floor(Math.random() * source.length)];
}

export const SHARE_INTENTS = [
  { id: 'wa', label: 'WhatsApp', icon: 'fa-brands fa-whatsapp',
    href: (t) => `https://wa.me/?text=${encodeURIComponent(t)}` },
  { id: 'tg', label: 'Telegram', icon: 'fa-brands fa-telegram',
    href: (t) => `https://t.me/share/url?url=${encodeURIComponent('https://ishq.fm')}&text=${encodeURIComponent(t)}` },
  { id: 'x', label: 'X', icon: 'fa-brands fa-x-twitter',
    href: (t) => `https://x.com/intent/tweet?text=${encodeURIComponent(t)}` }
];
