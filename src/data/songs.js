// All tracks are instrumental/karaoke versions from non-label channels — embedding allowed.
// Tags: "romantic" | "dance" | "peppy"
export const ALL_SONGS = [
  { title: "Kuch Kuch Hota Hai",       artist: "Udit Narayan & Alka Yagnik",            film: "Kuch Kuch Hota Hai",         youtubeId: "ICvOA9xwO-Y", tags: ["romantic"] },
  { title: "Chaiyya Chaiyya",           artist: "Sukhwinder Singh",                       film: "Dil Se",                     youtubeId: "UnLm6MqtvyI", tags: ["dance"] },
  { title: "Humma Humma",               artist: "A.R. Rahman",                            film: "Bombay",                     youtubeId: "v5FoB9yDbMQ", tags: ["dance"] },
  { title: "Tu Cheez Badi Hai",         artist: "Udit Narayan & Kavita Krishnamurthy",    film: "Mohra",                      youtubeId: "9fm02UHo7Fw", tags: ["dance"] },
  { title: "Tip Tip Barsa Pani",        artist: "Udit Narayan & Alka Yagnik",             film: "Mohra",                      youtubeId: "l8jELUMxBjw", tags: ["dance", "romantic"] },
  { title: "Tujhe Dekha Toh",           artist: "Kumar Sanu & Lata Mangeshkar",           film: "DDLJ",                       youtubeId: "gFtzfDk5ECY", tags: ["romantic"] },
  { title: "Pehla Nasha",               artist: "Udit Narayan & Sadhana Sargam",          film: "Jo Jeeta Wohi Sikandar",     youtubeId: "3D0NeKJxVBM", tags: ["romantic"] },
  { title: "Ole Ole",                   artist: "Abhijeet",                               film: "Yeh Dillagi",                youtubeId: "RxCCRgiXKws", tags: ["peppy", "dance"] },
  { title: "Choli Ke Peeche",           artist: "Alka Yagnik & Ila Arun",                 film: "Khalnayak",                  youtubeId: "iAUDc6n43xY", tags: ["dance", "peppy"] },
  { title: "Didi Tera Devar Deewana",   artist: "Lata Mangeshkar & S.P. Balasubrahmanyam",film: "Hum Aapke Hain Koun",        youtubeId: "mQzQ6XRWS_w", tags: ["dance"] },
  { title: "Ek Ladki Ko Dekha",         artist: "Kumar Sanu",                             film: "1942: A Love Story",         youtubeId: "cAqaifJqj9c", tags: ["romantic"] },
  { title: "Saat Samundar Paar",        artist: "Kavita Krishnamurthy",                   film: "Vishwatma",                  youtubeId: "xKfxY1G78a8", tags: ["dance"] },
  { title: "Jumma Chumma De De",        artist: "Sudesh Bhosle",                          film: "Hum",                        youtubeId: "RtmJwTDLDDk", tags: ["peppy", "dance"] },
  { title: "Kehna Hi Kya",              artist: "A.R. Rahman & K.S. Chitra",              film: "Bombay",                     youtubeId: "S2GwfcIWyEU", tags: ["romantic"] },
  { title: "Chura Ke Dil Mera",         artist: "Kumar Sanu & Alka Yagnik",               film: "Main Khiladi Tu Anari",      youtubeId: "VwRo64uDqiI", tags: ["romantic"] },
  { title: "Dilbar Dilbar",             artist: "Alka Yagnik",                            film: "Sirf Tum",                   youtubeId: "hPrP2bAK5I8", tags: ["dance", "peppy"] },
  { title: "Mere Khwabon Mein",         artist: "Lata Mangeshkar",                        film: "DDLJ",                       youtubeId: "5IJcVdz9cLc", tags: ["romantic"] },
  { title: "Kaho Naa Pyaar Hai",        artist: "Udit Narayan & Alka Yagnik",             film: "Kaho Naa... Pyaar Hai",      youtubeId: "Av3CERkY8TE", tags: ["romantic"] },
  { title: "Main Khiladi Tu Anari",     artist: "Udit Narayan & Abhijeet",                film: "Main Khiladi Tu Anari",      youtubeId: "v1-pZgYJQgo", tags: ["peppy"] },
  { title: "Roja Jaaneman",             artist: "S.P. Balasubrahmanyam",                  film: "Roja",                       youtubeId: "crfzekMEGzU", tags: ["romantic"] },
];

export const ALL_TAGS = [
  { id: "romantic", label: "💕 Romantic" },
  { id: "dance",    label: "💃 Dance" },
  { id: "peppy",    label: "🎉 Peppy" },
];

export function shuffleAndPick(count, activeTags) {
  const filtered = activeTags && activeTags.length > 0
    ? ALL_SONGS.filter(s => s.tags.some(t => activeTags.includes(t)))
    : ALL_SONGS;
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
