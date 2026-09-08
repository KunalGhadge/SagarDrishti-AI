import { describe, it, expect } from "vitest";
import { detectInputLanguage, resolveResponseLanguage } from "./detector";

describe("Lightweight Multilingual Language Understanding Layer", () => {
  // 1. English queries
  it("should accurately detect standard English queries", () => {
    const res = detectInputLanguage("What is the sea condition near Mumbai port today?");
    expect(res.language).toBe("en");
    expect(res.languageName).toBe("English");
    expect(res.confidence).toBeGreaterThan(0.9);
    expect(res.isMixed).toBe(false);
  });

  // 2. Hindi queries
  it("should accurately detect Hindi queries in Devanagari", () => {
    const res = detectInputLanguage("मुंबई के पास आज समुद्र की स्थिति कैसी है?");
    expect(res.language).toBe("hi");
    expect(res.languageName).toBe("Hindi");
    expect(res.confidence).toBeGreaterThan(0.85);
  });

  // 3. Marathi queries
  it("should accurately detect Marathi queries in Devanagari", () => {
    const res = detectInputLanguage("उद्या समुद्रात जाणे सुरक्षित आहे का?");
    expect(res.language).toBe("mr");
    expect(res.languageName).toBe("Marathi");
    expect(res.confidence).toBeGreaterThan(0.85);
  });

  it("should detect Marathi with distinctive character ळ", () => {
    const res = detectInputLanguage("जवळचे मासेमारी क्षेत्र कुठे मिळेल?");
    expect(res.language).toBe("mr");
    expect(res.languageName).toBe("Marathi");
  });

  // 4. Gujarati queries
  it("should detect Gujarati queries", () => {
    const res = detectInputLanguage("શું આવતીકાલે દરિયામાં જવું સુરક્ષિત છે?");
    expect(res.language).toBe("gu");
    expect(res.languageName).toBe("Gujarati");
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  // 5. Bengali queries
  it("should detect Bengali queries", () => {
    const res = detectInputLanguage("কলকাতার কাছে সমুদ্রের অবস্থা কেমন?");
    expect(res.language).toBe("bn");
    expect(res.languageName).toBe("Bengali");
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  // 6. Tamil queries
  it("should detect Tamil queries", () => {
    const res = detectInputLanguage("சென்னையில் இன்றைய கடல் நிலை எப்படி உள்ளது?");
    expect(res.language).toBe("ta");
    expect(res.languageName).toBe("Tamil");
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  // 7. Telugu queries
  it("should detect Telugu queries", () => {
    const res = detectInputLanguage("విశాఖపట్నం దగ్గర సముద్రం ఎలా ఉంది?");
    expect(res.language).toBe("te");
    expect(res.languageName).toBe("Telugu");
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  // 8. Kannada queries
  it("should detect Kannada queries", () => {
    const res = detectInputLanguage("ಮಂಗಳೂರು ಬಳಿ ಸಮುದ್ರದ ಪರಿಸ್ಥಿತಿ ಹೇಗಿದೆ?");
    expect(res.language).toBe("kn");
    expect(res.languageName).toBe("Kannada");
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  // 9. Malayalam queries
  it("should detect Malayalam queries", () => {
    const res = detectInputLanguage("കൊച്ചി തീരത്ത് കടൽ എങ്ങനെയാണ്?");
    expect(res.language).toBe("ml");
    expect(res.languageName).toBe("Malayalam");
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  // 10. Punjabi queries
  it("should detect Punjabi queries", () => {
    const res = detectInputLanguage("ਕੀ ਅੱਜ ਸਮੁੰਦਰ ਵਿੱਚ ਜਾਣਾ ਸੁਰੱਖਿਅਤ ਹੈ?");
    expect(res.language).toBe("pa");
    expect(res.languageName).toBe("Punjabi");
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  // 11. Odia queries
  it("should detect Odia queries", () => {
    const res = detectInputLanguage("ପାରାଦୀପ ନିକଟରେ ସମୁଦ୍ରର ଅବସ୍ଥା କେମିତି ଅଛି?");
    expect(res.language).toBe("or");
    expect(res.languageName).toBe("Odia");
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  // 12. Urdu queries
  it("should detect Urdu queries", () => {
    const res = detectInputLanguage("کیا کراچی اور ممبئی کے درمیان سمندر پرسکون ہے؟");
    expect(res.language).toBe("ur");
    expect(res.languageName).toBe("Urdu");
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  // 13. Mixed Hindi + English technical terms
  it("should detect mixed Hindi and English queries", () => {
    const res = detectInputLanguage("मुंबई weather कैसा है?");
    expect(res.language).toBe("hi");
    expect(res.isMixed).toBe(true);
    expect(res.secondaryLanguages).toContain("en");
  });

  it("should detect mixed queries with marine terminology", () => {
    const res = detectInputLanguage("मुझे Mumbai offshore का weather और wave height बताओ");
    expect(res.language).toBe("hi");
    expect(res.isMixed).toBe(true);
    expect(res.preservedEntities).toBeDefined();
    expect(res.preservedEntities?.some(e => /mumbai/i.test(e))).toBe(true);
  });

  // 14. Mixed Marathi + English technical terms
  it("should detect mixed Marathi and English queries", () => {
    const res = detectInputLanguage("मला Mumbai port चा wave height सांगा");
    expect(res.language).toBe("mr");
    expect(res.isMixed).toBe(true);
    expect(res.secondaryLanguages).toContain("en");
  });

  // 15. Hinglish (Romanized Hindi)
  it("should detect Romanized Hindi (Hinglish)", () => {
    const res = detectInputLanguage("Mumbai offshore ka weather kaisa hai aur wave height kitni hai?");
    expect(res.language).toBe("hinglish");
    expect(res.isMixed).toBe(true);
  });

  // 16. Queries containing coordinates
  it("should detect and preserve geographic coordinates", () => {
    const res = detectInputLanguage("Location 18.922° N, 72.834° E par hawa ki gati kya hai?");
    expect(res.preservedEntities?.length).toBeGreaterThan(0);
    expect(res.preservedEntities?.some(e => e.includes("18.922"))).toBe(true);
  });

  // 17. Marine emergency in Hindi
  it("should understand Hindi safety/emergency queries", () => {
    const res = detectInputLanguage("क्या ये क्षेत्र नाव के लिए सुरक्षित है?");
    expect(res.language).toBe("hi");
    expect(res.languageName).toBe("Hindi");
  });

  // 18. Marine emergency in Marathi
  it("should understand Marathi safety/emergency queries", () => {
    const res = detectInputLanguage("सीमा ओलांडण्याचा धोका आहे का?");
    expect(res.language).toBe("mr");
    expect(res.languageName).toBe("Marathi");
  });

  // 19. Fail-open handling for empty/null/whitespace inputs
  it("should gracefully handle empty or undefined inputs without throwing", () => {
    const emptyRes = detectInputLanguage("");
    expect(emptyRes.language).toBe("en");

    const nullRes = detectInputLanguage(null as any);
    expect(nullRes.language).toBe("en");

    const whitespaceRes = detectInputLanguage("   ");
    expect(whitespaceRes.language).toBe("en");
  });

  // 20. Non-destructive guarantee: detection never mutates input
  it("should guarantee input string is completely unmodified", () => {
    const original = "मुंबई के पास आज समुद्र की स्थिति कैसी है?";
    const copy = String(original);
    detectInputLanguage(original);
    expect(original).toBe(copy);
  });
});

describe("Query-Level Response Language Resolution", () => {
  // Acceptance Test 1: Selected = English, Query = English -> English
  it("should resolve English response when selected language is English and query is English", () => {
    const res = resolveResponseLanguage("What is the current wind speed near Mumbai?", "en");
    expect(res.responseLanguage).toBe("en");
    expect(res.responseLanguageName).toBe("English");
    expect(res.isFallback).toBe(true);
  });

  // Acceptance Test 2: Selected = English, Query = Marathi -> Marathi
  it("should resolve Marathi response when selected language is English and query is Marathi", () => {
    const res = resolveResponseLanguage("मुंबईजवळ सध्या वाऱ्याचा वेग किती आहे?", "en");
    expect(res.responseLanguage).toBe("mr");
    expect(res.responseLanguageName).toBe("Marathi");
    expect(res.isFallback).toBe(false);
  });

  // Acceptance Test 3: Selected = English, Query = Hindi -> Hindi
  it("should resolve Hindi response when selected language is English and query is Hindi", () => {
    const res = resolveResponseLanguage("मुंबई के पास अभी हवा की गति कितनी है?", "en");
    expect(res.responseLanguage).toBe("hi");
    expect(res.responseLanguageName).toBe("Hindi");
    expect(res.isFallback).toBe(false);
  });

  // Acceptance Test 4: Selected = Marathi, Query = English -> English
  it("should resolve English response when selected language is Marathi and query is English", () => {
    const res = resolveResponseLanguage("What is the current wind speed near Mumbai?", "mr");
    expect(res.responseLanguage).toBe("en");
    expect(res.responseLanguageName).toBe("English");
    expect(res.isFallback).toBe(false);
  });

  // Acceptance Test 5: Selected = Marathi, Query = Marathi -> Marathi
  it("should resolve Marathi response when selected language is Marathi and query is Marathi", () => {
    const res = resolveResponseLanguage("मुंबईजवळ वाऱ्याचा वेग किती आहे?", "mr");
    expect(res.responseLanguage).toBe("mr");
    expect(res.responseLanguageName).toBe("Marathi");
    expect(res.isFallback).toBe(true);
  });

  // Acceptance Test 6 & 7: Consecutive queries are isolated (no state persistence)
  it("should guarantee consecutive query isolation (Previous Marathi -> Current English)", () => {
    // Step 1: Simulate previous query in Marathi
    const prevRes = resolveResponseLanguage("मुंबईजवळ हवामान कसं आहे?", "en");
    expect(prevRes.responseLanguage).toBe("mr");

    // Step 2: Current query in English MUST resolve to English (no leakage from prev)
    const currentRes = resolveResponseLanguage("What are the fishing conditions?", "en");
    expect(currentRes.responseLanguage).toBe("en");
    expect(currentRes.responseLanguageName).toBe("English");
  });

  it("should guarantee consecutive query isolation (Previous English -> Current Marathi)", () => {
    // Step 1: Simulate previous query in English
    const prevRes = resolveResponseLanguage("What is the weather in Mumbai?", "en");
    expect(prevRes.responseLanguage).toBe("en");

    // Step 2: Current query in Marathi MUST resolve to Marathi
    const currentRes = resolveResponseLanguage("मुंबईजवळ हवामान कसं आहे?", "en");
    expect(currentRes.responseLanguage).toBe("mr");
    expect(currentRes.responseLanguageName).toBe("Marathi");
  });

  // Acceptance Test 8: Mixed Query with English Technical Terms
  it("should resolve to dominant language (Marathi) in mixed query with English technical terms", () => {
    const res = resolveResponseLanguage("Mumbai जवळ fishing zone कुठे आहे?", "en");
    expect(res.responseLanguage).toBe("mr");
    expect(res.responseLanguageName).toBe("Marathi");
  });

  // Acceptance Test 9: Fallback to selected application language on unidentifiable input
  it("should fall back to selected application language for empty or purely numerical input", () => {
    const res1 = resolveResponseLanguage("", "mr");
    expect(res1.responseLanguage).toBe("mr");
    expect(res1.isFallback).toBe(true);

    const res2 = resolveResponseLanguage("18.922, 72.834", "hi");
    expect(res2.responseLanguage).toBe("hi");
    expect(res2.isFallback).toBe(true);
  });
});
