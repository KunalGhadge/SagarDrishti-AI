/**
 * Lightweight Language Understanding Layer (SagarDrishti AI)
 * Deterministic, zero-dependency, fail-open language detector for Indian coastal
 * multilingual inputs and mixed language queries.
 *
 * Guarantees:
 * - <1ms execution time
 * - Zero external API calls
 * - Never throws (fail-open fallback)
 * - Preserves domain entities (coordinates, ports, SST, PFZ, IMD, INCOIS)
 */

export interface DetectedLanguageResult {
  /** ISO 639-1 code (e.g. 'hi', 'mr', 'gu', 'en', 'bn', 'ta', 'te', 'kn', 'ml', 'pa', 'or', 'ur', 'hinglish') */
  language: string;
  /** Full human-readable language name (e.g. 'Hindi', 'Marathi', 'Gujarati') */
  languageName: string;
  /** Estimated confidence score between 0.0 and 1.0 */
  confidence: number;
  /** Whether the query is code-switched or contains mixed scripts (e.g. Hindi + English technical terms) */
  isMixed: boolean;
  /** List of Unicode scripts detected in the query */
  detectedScripts: string[];
  /** Secondary detected languages (e.g. 'en' when technical terms are embedded in Hindi) */
  secondaryLanguages?: string[];
  /** Marine domain entities identified that must be preserved without mutation */
  preservedEntities?: string[];
}

export const SUPPORTED_INPUT_LANGUAGES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  gu: "Gujarati",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  or: "Odia",
  ur: "Urdu",
  hinglish: "Hinglish (Romanized Hindi)",
};

// ---------------------------------------------------------------------------
// 1. Script Unicode Ranges
// ---------------------------------------------------------------------------
const SCRIPT_RANGES: Record<string, RegExp> = {
  Devanagari: /[\u0900-\u097F]/g,
  Gujarati: /[\u0A80-\u0AFF]/g,
  Bengali: /[\u0980-\u09FF]/g,
  Tamil: /[\u0B80-\u0BFF]/g,
  Telugu: /[\u0C00-\u0C7F]/g,
  Kannada: /[\u0C80-\u0CFF]/g,
  Malayalam: /[\u0D00-\u0D7F]/g,
  Gurmukhi: /[\u0A00-\u0A7F]/g,
  Odia: /[\u0B00-\u0B7F]/g,
  Arabic: /[\u0600-\u06FF]/g,
  Latin: /[a-zA-Z]/g,
};

// ---------------------------------------------------------------------------
// 2. Lexical & Grammatical Markers for Disambiguation
// ---------------------------------------------------------------------------

// Marathi specific markers (Devanagari)
// Note: ळ (\u0933) is exclusively used in Marathi (and Sanskrit), absent in modern Hindi.
const MARATHI_DISTINCT_WORDS = new Set([
  "आहे", "आहेत", "नाही", "नाहीत", "होते", "होती", "झाले", "झाली", "झाला",
  "करा", "करावे", "करावी", "सांगा", "बघा", "द्या", "येथे", "कुठे", "कधी",
  "कसा", "कशी", "कसे", "काय", "का", "कशा", "कशासाठी", "माझे", "आमचे",
  "तुमचे", "आपले", "च्या", "च्यावर", "मध्ये", "पासून", "पर्यंत", "उद्या",
  "परवा", "मासे", "मासेमारी", "लाटा", "वारा", "धोका", "सुरक्षित", "किनाऱ्यावर",
  "सागरी", "हवामान", "मदत", "बोट", "नौका", "पाऊस", "विजा", "लाट", "वेळ"
]);

// Hindi specific markers (Devanagari)
const HINDI_DISTINCT_WORDS = new Set([
  "है", "हैं", "नहीं", "था", "थी", "थे", "हुए", "हुई", "हुआ", "होगा", "होगी",
  "कर", "करें", "करना", "बताओ", "बताइए", "दीजिए", "यहाँ", "कहाँ", "कहा",
  "कब", "कैसा", "कैसी", "कैसे", "क्या", "क्यों", "मेरा", "हमारा", "आपका",
  "का", "के", "की", "में", "से", "तक", "कल", "परसों", "मछली", "मछुआरे",
  "हवा", "लहरें", "खतरा", "तट", "सुरक्षित", "नाव", "बारिश", "बिजली", "मौसम",
  "स्थिति", "कृपया", "मुझे", "पास", "दूरी", "जाना", "सकते"
]);

// Romanized Indic / Hinglish markers
const HINGLISH_MARKERS = new Set([
  "kaisa", "kaisi", "kaise", "kya", "hai", "hain", "nahi", "nahin", "kahan",
  "kidhar", "kab", "kyun", "kyu", "hoga", "hogi", "hoge", "batao", "bataye",
  "samundar", "pani", "machli", "machware", "tufan", "surakshit", "khatra",
  "ahe", "ahet", "kuthe", "kadhi", "kasa", "kashi", "kase", "sang", "sanga",
  "chya", "madhye", "sathi", "wala", "wali", "wale", "mera", "meri", "humara",
  "apka", "paas", "jana", "sakta", "sakti", "lekar", "dekho", "bhai"
]);

// Common English functional stopwords
const ENGLISH_STOPWORDS = new Set([
  "the", "is", "are", "was", "were", "what", "where", "when", "how", "why",
  "can", "will", "should", "could", "would", "in", "on", "at", "for", "to",
  "from", "with", "and", "or", "of", "about", "near", "today", "tomorrow",
  "please", "tell", "me", "show", "is", "it", "safe", "danger", "status",
  "condition", "weather", "wave", "wind", "speed", "height", "port"
]);

// Marine domain technical entities to preserve
const MARINE_ENTITIES_REGEX =
  /\b(IMD|INCOIS|ISRO|SST|PFZ|GNSS|MCP|SAR|AIS|VMS|GPS|NM|knots|km\/h|m\/s|hPa|Celsius|Mumbai|Ratnagiri|Cochin|Chennai|Kandla|Paradip|Visakhapatnam|Mormugao|Okha|Veraval|Arabian\s+Sea|Bay\s+of\s+Bengal|Indian\s+Ocean|Exclusive\s+Economic\s+Zone|EEZ|IMBL|cyclone|tsunami|wave\s+height|chlorophyll)\b/gi;

// Geographic coordinate regex
const COORDINATES_REGEX = /[-+]?\d{1,2}(?:\.\d+)?°?\s*[NSEW]?\s*,\s*[-+]?\d{1,3}(?:\.\d+)?°?\s*[NSEW]?/gi;

// ---------------------------------------------------------------------------
// 3. Core Language Detection Function
// ---------------------------------------------------------------------------

/**
 * Detects the input language of a user query deterministically.
 * Fail-open: Never throws, always returns a clean result with defaults.
 */
export function detectInputLanguage(rawQuery: string | undefined | null): DetectedLanguageResult {
  try {
    const query = (rawQuery || "").trim();
    if (!query) {
      return {
        language: "en",
        languageName: "English",
        confidence: 1.0,
        isMixed: false,
        detectedScripts: ["Latin"],
      };
    }

    // Extract preserved marine domain entities and coordinates
    const preservedEntities: string[] = [];
    const coordMatches = query.match(COORDINATES_REGEX);
    if (coordMatches) preservedEntities.push(...coordMatches);
    const entityMatches = query.match(MARINE_ENTITIES_REGEX);
    if (entityMatches) preservedEntities.push(...entityMatches);

    // Count characters per script
    const scriptCounts: Record<string, number> = {};
    let totalScriptChars = 0;

    for (const [script, regex] of Object.entries(SCRIPT_RANGES)) {
      const matches = query.match(regex);
      const count = matches ? matches.length : 0;
      if (count > 0) {
        scriptCounts[script] = count;
        totalScriptChars += count;
      }
    }

    const detectedScripts = Object.keys(scriptCounts);
    const hasLatin = (scriptCounts["Latin"] || 0) > 0;
    const hasIndic = detectedScripts.some((s) => s !== "Latin" && s !== "Arabic");
    const isMixed = (hasIndic && hasLatin) || detectedScripts.length > 1;

    // --- Case A: Devanagari Script (Hindi vs. Marathi) ---
    if ((scriptCounts["Devanagari"] || 0) > 0) {
      const latinCount = scriptCounts["Latin"] || 0;

      // Tokenize words
      const words = query
        .replace(/[^\u0900-\u097F\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

      let marathiScore = 0;
      let hindiScore = 0;

      // Unique Marathi character check: ळ (\u0933)
      if (/ळ/.test(query)) {
        marathiScore += 5;
      }

      for (const w of words) {
        if (MARATHI_DISTINCT_WORDS.has(w)) marathiScore += 2;
        if (HINDI_DISTINCT_WORDS.has(w)) hindiScore += 2;
      }

      // Contextual phrase checks (e.g. "आहे का" vs "है क्या")
      if (/आहे\s*का|सुरक्षित\s*आहे|कसा\s*आहे|कशी\s*आहे|सांगा/.test(query)) {
        marathiScore += 4;
      }
      if (/है\s*क्या|सुरक्षित\s*है|कैसा\s*है|कैसी\s*है|बताओ|बताइए|क्या\s+/.test(query)) {
        hindiScore += 4;
      }

      // Marathi markers attached as suffixes (e.g. 'च्या', 'वर', 'साठी')
      if (/च्या|वरून|साठी|मध्ये/.test(query)) {
        marathiScore += 2;
      }

      let chosenLang = "hi";
      let chosenName = "Hindi";
      let confidence = 0.92;

      if (marathiScore > hindiScore) {
        chosenLang = "mr";
        chosenName = "Marathi";
        confidence = Math.min(0.98, 0.80 + (marathiScore - hindiScore) * 0.04);
      } else if (hindiScore > marathiScore) {
        chosenLang = "hi";
        chosenName = "Hindi";
        confidence = Math.min(0.98, 0.80 + (hindiScore - marathiScore) * 0.04);
      } else {
        // Equal or ambiguous Devanagari markers:
        // Check if query matches typical Hindi common structures (e.g. 'के पास', 'की स्थिति')
        if (/के\s+पास|की\s+स्थिति|का\s+मौसम|में|से/.test(query)) {
          chosenLang = "hi";
          chosenName = "Hindi";
          confidence = 0.88;
        } else if (/च्या\s+जवळ|ची\s+स्थिती|चा\s+अंदाज/.test(query)) {
          chosenLang = "mr";
          chosenName = "Marathi";
          confidence = 0.88;
        } else {
          // Default Hindi if neutral Devanagari
          chosenLang = "hi";
          chosenName = "Hindi";
          confidence = 0.75;
        }
      }

      const secondaryLanguages: string[] = [];
      if (latinCount > 0) {
        secondaryLanguages.push("en");
      }

      return {
        language: chosenLang,
        languageName: chosenName,
        confidence,
        isMixed: isMixed || latinCount > 0,
        detectedScripts,
        secondaryLanguages: secondaryLanguages.length > 0 ? secondaryLanguages : undefined,
        preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
      };
    }

    // --- Case B: Other Indic Scripts (Unique 1-to-1 Mapping) ---
    if ((scriptCounts["Gujarati"] || 0) > 0) {
      return {
        language: "gu",
        languageName: "Gujarati",
        confidence: 0.98,
        isMixed,
        detectedScripts,
        secondaryLanguages: hasLatin ? ["en"] : undefined,
        preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
      };
    }

    if ((scriptCounts["Bengali"] || 0) > 0) {
      return {
        language: "bn",
        languageName: "Bengali",
        confidence: 0.98,
        isMixed,
        detectedScripts,
        secondaryLanguages: hasLatin ? ["en"] : undefined,
        preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
      };
    }

    if ((scriptCounts["Tamil"] || 0) > 0) {
      return {
        language: "ta",
        languageName: "Tamil",
        confidence: 0.98,
        isMixed,
        detectedScripts,
        secondaryLanguages: hasLatin ? ["en"] : undefined,
        preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
      };
    }

    if ((scriptCounts["Telugu"] || 0) > 0) {
      return {
        language: "te",
        languageName: "Telugu",
        confidence: 0.98,
        isMixed,
        detectedScripts,
        secondaryLanguages: hasLatin ? ["en"] : undefined,
        preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
      };
    }

    if ((scriptCounts["Kannada"] || 0) > 0) {
      return {
        language: "kn",
        languageName: "Kannada",
        confidence: 0.98,
        isMixed,
        detectedScripts,
        secondaryLanguages: hasLatin ? ["en"] : undefined,
        preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
      };
    }

    if ((scriptCounts["Malayalam"] || 0) > 0) {
      return {
        language: "ml",
        languageName: "Malayalam",
        confidence: 0.98,
        isMixed,
        detectedScripts,
        secondaryLanguages: hasLatin ? ["en"] : undefined,
        preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
      };
    }

    if ((scriptCounts["Gurmukhi"] || 0) > 0) {
      return {
        language: "pa",
        languageName: "Punjabi",
        confidence: 0.98,
        isMixed,
        detectedScripts,
        secondaryLanguages: hasLatin ? ["en"] : undefined,
        preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
      };
    }

    if ((scriptCounts["Odia"] || 0) > 0) {
      return {
        language: "or",
        languageName: "Odia",
        confidence: 0.98,
        isMixed,
        detectedScripts,
        secondaryLanguages: hasLatin ? ["en"] : undefined,
        preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
      };
    }

    if ((scriptCounts["Arabic"] || 0) > 0) {
      return {
        language: "ur",
        languageName: "Urdu",
        confidence: 0.95,
        isMixed,
        detectedScripts,
        secondaryLanguages: hasLatin ? ["en"] : undefined,
        preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
      };
    }

    // --- Case C: Latin Script (Pure English vs Hinglish / Romanized Indic) ---
    if (hasLatin) {
      const words = query.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
      let hinglishHits = 0;
      let englishHits = 0;

      for (const w of words) {
        if (HINGLISH_MARKERS.has(w)) hinglishHits++;
        if (ENGLISH_STOPWORDS.has(w)) englishHits++;
      }

      // Check common Hinglish phrase patterns (e.g. 'kaisa hai', 'kya hal hai', 'surakshit hai kya')
      const lowerQuery = query.toLowerCase();
      if (
        /kaisa\s+hai|kaisi\s+hai|kya\s+hai|hai\s+kya|surakshit\s+hai|weather\s+kaisa|machli\s+kahan|safe\s+hai|batao|bataye/i.test(
          lowerQuery
        )
      ) {
        hinglishHits += 3;
      }

      if (hinglishHits >= 2 || (hinglishHits >= 1 && hinglishHits > englishHits)) {
        return {
          language: "hinglish",
          languageName: "Hinglish (Romanized Hindi)",
          confidence: Math.min(0.95, 0.70 + hinglishHits * 0.08),
          isMixed: true,
          detectedScripts: ["Latin"],
          secondaryLanguages: ["en", "hi"],
          preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
        };
      }

      return {
        language: "en",
        languageName: "English",
        confidence: 0.96,
        isMixed: false,
        detectedScripts: ["Latin"],
        preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
      };
    }

    // Fallback if no specific scripts detected (e.g. only numbers, punctuation, or emojis)
    return {
      language: "en",
      languageName: "English",
      confidence: 0.5,
      isMixed: false,
      detectedScripts: detectedScripts.length > 0 ? detectedScripts : ["Unknown"],
      preservedEntities: preservedEntities.length > 0 ? preservedEntities : undefined,
    };
  } catch (err) {
    // Fail-open guarantee: never block user or throw
    return {
      language: "en",
      languageName: "English",
      confidence: 0.5,
      isMixed: false,
      detectedScripts: ["Latin"],
    };
  }
}
