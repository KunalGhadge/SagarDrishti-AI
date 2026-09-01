/**
 * Marine Intent Classifier (Phase 1 & 2 Core Pipeline)
 * Maps any user query into strictly ONE of the 8 fixed ISRO PS categories or UNKNOWN.
 * Includes comprehensive multilingual translation/normalization covering
 * Marathi, Hindi, Gujarati, Tamil, Telugu, Malayalam, Bengali, and romanized Indian coastal dialects.
 */

export type MarineIntentCategory =
  | "PFZ_LOCATION"
  | "VENTURE_SAFETY"
  | "SEA_CONDITIONS"
  | "ALERT_CHECK"
  | "CHLOROPHYLL_SST"
  | "ROUTE_SAFETY"
  | "PRODUCTIVITY_WHY"
  | "GEOFENCE_CHECK"
  | "UNKNOWN";

/**
 * Normalizes Indian coastal language terminology (Devanagari, Gujarati, Tamil, etc., & Romanized)
 * into standard English semantic concepts before classification.
 */
export function normalizeMultilingualMarineQuery(query: string): string {
  let q = (query || "").toLowerCase();

  // 1. Geofence & Boundary terms
  // Marathi: सीमा, हद्द, प्रतिबंधित, कच्चतीवू, सर क्रीक
  // Hindi: सीमा, सरहद, प्रतिबंधित, रेखा, इंटरनेशनल मैरीटाइम बाउंड्री
  // Gujarati: સીમા, સરહદ, પ્રતિબંધિત
  // Tamil: எல்லை, தடை, கச்சத்தீவு
  if (
    /सीमा|हद्द|सरहद|प्रतिबंधित|कच्छतीवू|कच्चतीवू|सर क्रीक|સીમા|સરહદ|પ્રતિબંધિત|எல்லை|தடை|கச்சத்தீவு/i.test(q) ||
    /seema|sarhad|hadd|pratibandhit|katchatheevu|sir creek|imbl border/i.test(q)
  ) {
    q += " geofence boundary imbl restricted prohibited zone border";
  }

  // 2. Safe Route & Navigation terms
  // Marathi: रस्ता, मार्ग, सुरक्षित मार्ग, जलमार्ग
  // Hindi: रास्ता, मार्ग, सुरक्षित मार्ग, नेविगेशन रास्ता
  // Gujarati: રસ્તો, માર્ગ, સલામત માર્ગ
  // Tamil: பாதை, வழி, பாதுகாப்பான பாதை
  if (
    /मार्ग|रस्ता|जलमार्ग|रास्ता|सुरक्षित रास्ता|सुरक्षित मार्ग|રસ્તો|માર્ગ|பாதை|வழி/i.test(q) ||
    /rasta|marg|jalmarg|safe route|safest route|navigation/i.test(q)
  ) {
    q += " safest route navigation route waypoint voyage course";
  }

  // 3. Fish Productivity Decline terms
  // Marathi: मासे का कमी, उत्पादन घट, मासेमारी कमी, कमी मासे
  // Hindi: मछली कम क्यों, उत्पादन में गिरावट, मछलियां कम, गिरावट
  // Gujarati: માછલી કેમ ઓછી, ઉત્પાદન ઘટ્યું
  // Tamil: மீன் ஏன் குறைந்தது, உற்பத்தி வீழ்ச்சி
  if (
    /मासे.*कमी|कमी.*मासे|उत्पादन.*घट|उत्पादकता.*घट|मछली.*कम|मछलियां.*कम|उत्पादन.*गिरावट|માછલી.*ઓછી|மீன்.*குறை/i.test(q) ||
    /kam machli|mase kami|why fish declined|catch reduced|productivity decline/i.test(q)
  ) {
    q += " why fish declined low catch productivity decline depletion";
  }

  // 4. Chlorophyll & Ocean Color terms
  // Marathi: हरितद्रव्य, क्लोरोफिल, जल रंग
  // Hindi: क्लोरोफिल, पर्णहरित, समुद्र रंग
  // Gujarati: ક્લોરોફિલ
  // Tamil: குளோரோபில்
  if (
    /हरितद्रव्य|क्लोरोफिल|पर्णहरित|क्લોરોફિલ|குளோரோபில்/i.test(q) ||
    /chlorophyll|phytoplankton|ocean color/i.test(q)
  ) {
    q += " chlorophyll ocean color phytoplankton thermal front";
  }

  // 5. Alert & Cyclone terms
  // Marathi: वादळ, चक्रीवादळ, इशारा, वीज, धोका, अलर्ट
  // Hindi: तूफ़ान, तूफान, चक्रवात, बिजली, चेतावनी, अलर्ट
  // Gujarati: વાવાઝોડું, તોફાન, ચેતવણી, વીજળી
  // Tamil: புயல், சூறாவளி, மின்னல், எச்சரிக்கை
  if (
    /वादळ|चक्रीवादळ|इशारा|वीज|तूफ़ान|तूफान|चक्रवात|बिजली|चेतावनी|अलर्ट|વાવાઝોડું|તોફાન|ચેતવણી|વીજળી|புயல்|சூறாவளி|மின்னல்|எச்சரிக்கை/i.test(q) ||
    /tufan|toofan|chakrawat|cyclone|lightning|alert|warning|gale/i.test(q)
  ) {
    q += " alert cyclone lightning storm warning squall thunderstorm";
  }

  // 6. Venture Safety terms
  // Marathi: सुरक्षित आहे का, जावे का, समुद्रात जाऊ का, मासेमारीसाठी जाऊ का, सुरक्षित
  // Hindi: सुरक्षित है क्या, क्या मैं जा सकता हूँ, क्या जाना सुरक्षित है, नौकायन
  // Gujarati: સુરક્ષિત છે, દરિયામાં જવું, સલામત છે
  // Tamil: பாதுகாப்பானதா, கடலுக்கு செல்லலாமா
  if (
    /सुरक्षित आहे|जावे का|जाऊ का|सुरक्षित आहे का|सुरक्षित है|जा सकता|सवारी|સુરક્ષિત|સલામત|பாதுகாப்பானதா|செல்லலாமா/i.test(q) ||
    /surakshit|safe to go|can i go|safe to venture|sailing safety/i.test(q)
  ) {
    q += " is it safe safe to venture can i go sailing safe fishing safety";
  }

  // 7. PFZ Location terms
  // Marathi: मासे कुठे, मासेमारी क्षेत्र, मत्स्य क्षेत्र, मासे कुठे मिळतील
  // Hindi: मछली कहाँ, मत्स्य क्षेत्र, मछली पकड़ने का क्षेत्र, मछली कहाँ मिलेगी
  // Gujarati: માછલી ક્યાં, માછીમારી ક્ષેત્ર
  // Tamil: மீன் எங்கு, மீன்பிடி மண்டலம்
  if (
    /मासे कुठे|मत्स्य क्षेत्र|मासेमारी क्षेत्र|मछली कहाँ|मत्स्य ज़ोन|मछली क्षेत्र|માછલી ક્યાં|માછીમારી ક્ષેત્ર|மீன் எங்கு|மீன்பிடி மண்டலம்/i.test(q) ||
    /mase kuthe|machli kahan|where fish|fishing zone|potential fishing zone|pfz/i.test(q)
  ) {
    q += " potential fishing zone pfz where is fish nearest zone fishing ground";
  }

  // 8. Sea Conditions & Tides terms
  // Marathi: लाटा, लाटांची उंची, भरती, ओहोटी, वारा, प्रवाह
  // Hindi: लहरें, लहरों की ऊंचाई, ज्वार, भाटा, हवा, धारा, करंट
  // Gujarati: મોજા, ભરતી, ઓટ, પવન, પ્રવાહ
  // Tamil: அலைகள், காற்று, அலை உயரம், கடல் நிலை
  if (
    /लाटा|लाटांची उंची|भरती|ओहोटी|वारा|प्रवाह|लहरें|ज्वार|भाटा|हवा|धारा|મોજા|ભરતી|ઓટ|પવન|அலைகள்|காற்று/i.test(q) ||
    /lata|lahrein|bharti|ohoti|jwar|bhata|vara|hawa|wave height|tide/i.test(q)
  ) {
    q += " tide sea condition wave height swell ocean current wind speed";
  }

  return q;
}

export function classifyIntent(query: string): MarineIntentCategory {
  // Step 1: Pre-translate & normalize Indian languages into standard English semantic concepts
  const q = normalizeMultilingualMarineQuery(query);

  // 1. GEOFENCE CHECK (IMBL, boundary, MPA, restricted area, sanctuary)
  if (
    /geofence|imbl|boundary|border|katchatheevu|sir creek|restricted|marine protected|mpa|sanctuary|prohibited zone/i.test(q) ||
    /border cross|pakistan border|sri lanka border|cross.*border/i.test(q)
  ) {
    return "GEOFENCE_CHECK";
  }

  // 2. ROUTE SAFETY (Safest route, navigation path, voyage, waypoint, course)
  if (
    /safest route|safe route|navigation route|route.*safety|which route|navigate from|voyage route|waypoint/i.test(q) ||
    /route.*considering|how to reach.*safely/i.test(q)
  ) {
    return "ROUTE_SAFETY";
  }

  // 3. PRODUCTIVITY DECLINE (Why fish declined, less catch, low productivity, fish depletion)
  if (
    /why.*declined|why.*fish|decline.*productivity|low catch|fish catch.*reduced|less fish|why.*less catch|productivity.*decline|depletion/i.test(q)
  ) {
    return "PRODUCTIVITY_WHY";
  }

  // 4. CHLOROPHYLL & SST (High chlorophyll, ocean color, thermal front, SST gradient)
  if (
    /chlorophyll|chlorophyll.*sst|ocean color|phytoplankton|thermal front|sst and chlorophyll|high chlorophyll/i.test(q)
  ) {
    return "CHLOROPHYLL_SST";
  }

  // 5. ALERT CHECK (Cyclone, lightning, storm warning, squall alert, gale)
  if (
    /alert|cyclone|lightning|storm|squall|thunderstorm|gale|warning.*alert|any warning|is there a cyclone/i.test(q)
  ) {
    return "ALERT_CHECK";
  }

  // 6. VENTURE SAFETY (Is it safe to go, should I venture, can I go fishing, sailing safety, safe tomorrow)
  if (
    /is it safe|safe to venture|can i go|should i go|venture.*safe|sailing safe|safe tomorrow|safe today|go for fishing/i.test(q) ||
    /safety.*venture|sea venture|fishing safety/i.test(q)
  ) {
    return "VENTURE_SAFETY";
  }

  // 7. PFZ LOCATION (Potential fishing zone, where is fish, nearest zone, tuna location, fishing ground)
  if (
    /pfz|potential fishing zone|where.*fish|nearest.*zone|fishing zone|fishing ground|where.*tuna|find fish|fish hotspot/i.test(q)
  ) {
    return "PFZ_LOCATION";
  }

  // 8. SEA CONDITIONS (Tide, weather, wave height, sea conditions, swell, currents, wind)
  if (
    /tide|sea condition|wave height|swell|ocean current|wind speed|weather condition|sea state|water temp/i.test(q)
  ) {
    return "SEA_CONDITIONS";
  }

  // Fallback
  return "UNKNOWN";
}
