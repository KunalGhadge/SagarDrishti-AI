import { describe, it, expect } from "vitest";
import { detectInputLanguage } from "./detector";

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
