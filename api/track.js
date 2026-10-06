// =====================================================================
//  /api/track — foydalanish statistikasini qabul qiluvchi funksiya
//
//  Brauzerdan kelgan hodisani Supabase'ning track() funksiyasiga uzatadi.
//  Maxfiy kalit FAQAT shu yerda — muhit o'zgaruvchisidan o'qiladi va
//  brauzerga hech qachon yuborilmaydi.
//
//  IP manzilning o'zi saqlanmaydi: Vercel'ning geo sarlavhalaridan
//  faqat viloyat va shahar nomi olinadi.
// =====================================================================

// O'zbekiston hududlarining ISO kodlari
const HUDUDLAR = {
  TK: "Toshkent shahri",
  TO: "Toshkent viloyati",
  AN: "Andijon",
  BU: "Buxoro",
  FA: "Farg'ona",
  JI: "Jizzax",
  XO: "Xorazm",
  NG: "Namangan",
  NW: "Navoiy",
  QA: "Qashqadaryo",
  QR: "Qoraqalpog'iston",
  SA: "Samarqand",
  SI: "Sirdaryo",
  SU: "Surxondaryo"
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'faqat POST' });
    return;
  }

  // URL ni normallashtiramiz: oxiridagi '/' va ortiqcha '/rest/v1'
  // bo'lagi bo'lsa olib tashlanadi, chunki uni quyida o'zimiz qo'shamiz.
  const SUPABASE_URL = (process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '')
    .replace(/\/+$/, '');
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    // Hali sozlanmagan bo'lsa ham ilova ishlashda davom etsin
    res.status(200).json({ ok: false, error: 'sozlanmagan' });
    return;
  }

  // sendBeacon matn ko'rinishida yuborishi mumkin
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || !body.device_id) {
    res.status(400).json({ ok: false, error: 'device_id kerak' });
    return;
  }

  // Vercel geo sarlavhalari
  const h       = req.headers;
  const country = h['x-vercel-ip-country'] || null;
  const kod     = h['x-vercel-ip-country-region'] || null;
  let   shahar  = h['x-vercel-ip-city'] || null;
  if (shahar) { try { shahar = decodeURIComponent(shahar); } catch (e) {} }

  // Hudud nomini faqat O'zbekiston uchun o'giramiz
  const ipHudud = (country === 'UZ' && kod) ? (HUDUDLAR[kod] || kod) : (kod || null);

  const payload = {
    p_device:         body.device_id,
    p_session:        body.session_id || null,
    p_type:           body.type || 'session_start',
    p_region:         body.region || null,
    p_ip_region:      ipHudud,
    p_ip_region_code: kod,
    p_ip_city:        shahar,
    p_is_telegram:    !!body.is_telegram,
    p_user_agent:     (h['user-agent'] || '').slice(0, 400),
    p_payload:        body.payload || null
  };

  try {
    const javob = await fetch(SUPABASE_URL + '/rest/v1/rpc/track', {
      method: 'POST',
      headers: {
        'apikey':        SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!javob.ok) {
      const matn = await javob.text();
      console.error('Supabase xatosi:', javob.status, matn);
      // Faqat HTTP status qaytariladi — xato matni oshkor qilinmaydi.
      // 404 = SQL skript ishga tushirilmagan, 401 = kalit noto'g'ri
      res.status(200).json({ ok: false, status: javob.status });
      return;
    }

    res.status(200).json(await javob.json());
  } catch (e) {
    console.error('track xatosi:', e);
    res.status(200).json({ ok: false });
  }
};
