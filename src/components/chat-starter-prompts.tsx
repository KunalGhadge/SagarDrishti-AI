"use client";

import { useLocale } from "next-intl";
import {
  Waves,
  Navigation,
  Activity,
  ShieldAlert,
  Compass,
  Radio,
} from "lucide-react";
import { useMemo } from "react";

interface PromptItem {
  id: "sea" | "pfz" | "sst" | "geofence" | "harbor" | "sos";
  label: string;
  query: string;
}

const PROMPTS_BY_LOCALE: Record<string, PromptItem[]> = {
  mr: [
    { id: "sea", label: "समुद्राची स्थिती", query: "माझ्या जवळील सध्याची समुद्राची स्थिती दाखवा" },
    { id: "pfz", label: "मासेमारी क्षेत्र (PFZ)", query: "माझ्या जवळील सर्वोत्तम मासेमारी क्षेत्र शोधा" },
    { id: "sst", label: "SST आणि क्लोरोफिल", query: "माझ्या स्थानाजवळील SST आणि क्लोरोफिल दाखवा" },
    { id: "geofence", label: "प्रतिबंधित सागरी क्षेत्र", query: "जवळपास काही प्रतिबंधित सागरी क्षेत्र आहेत का?" },
    { id: "harbor", label: "सुरक्षित बंदर मार्ग", query: "जवळच्या बंदरासाठी मला सुरक्षित मार्ग दाखवा" },
    { id: "sos", label: "आपत्कालीन SOS मदत", query: "माझे जहाज संकटात असल्यास मी काय करावे?" },
  ],
  hi: [
    { id: "sea", label: "समुद्र की स्थिति", query: "मेरे आस-पास समुद्र की वर्तमान स्थिति दिखाएं" },
    { id: "pfz", label: "मत्स्य पालन क्षेत्र (PFZ)", query: "मेरे आस-पास सर्वोत्तम मछली पकड़ने के क्षेत्र खोजें" },
    { id: "sst", label: "SST और क्लोरोफिल", query: "मेरे स्थान के पास SST और क्लोरोफिल दिखाएं" },
    { id: "geofence", label: "प्रतिबंधित समुद्री क्षेत्र", query: "क्या आस-पास कोई प्रतिबंधित समुद्री क्षेत्र हैं?" },
    { id: "harbor", label: "सुरक्षित बंदरगाह मार्ग", query: "निकटतम बंदरगाह के लिए सुरक्षित मार्ग दिखाएं" },
    { id: "sos", label: "आपातकालीन SOS सहायता", query: "यदि मेरा जहाज खतरे में है तो मुझे क्या करना चाहिए?" },
  ],
  ta: [
    { id: "sea", label: "கடல் நிலை", query: "என் அருகிலுள்ள தற்போதைய கடல் நிலையை காட்டுங்கள்" },
    { id: "pfz", label: "மீன்பிடி மண்டலங்கள் (PFZ)", query: "என் அருகிலுள்ள சிறந்த மீன்பிடி மண்டலங்களை கண்டறியவும்" },
    { id: "sst", label: "SST & குளோரோபில்", query: "என் இருப்பிடத்திற்கு அருகிலுள்ள SST மற்றும் குளோரோபில் காட்டுங்கள்" },
    { id: "geofence", label: "தடைசெய்யப்பட்ட பகுதிகள்", query: "அருகில் ஏதேனும் தடைசெய்யப்பட்ட கடல் பகுதிகள் உள்ளதா?" },
    { id: "harbor", label: "பாதுகாப்பான துறைமுக வழி", query: "அருகிலுள்ள துறைமுகத்திற்கு பாதுகாப்பான வழியைக் காட்டுங்கள்" },
    { id: "sos", label: "அவசர உதவி SOS", query: "என் படகு ஆபத்தில் இருந்தால் நான் என்ன செய்ய வேண்டும்?" },
  ],
  te: [
    { id: "sea", label: "సముద్ర పరిస్థితులు", query: "నా సమీపంలోని ప్రస్తుత సముద్ర పరిస్థితులను చూపించు" },
    { id: "pfz", label: "చేపల వేట ప్రాంతాలు (PFZ)", query: "నా సమీపంలోని ఉత్తమ చేపల వేట ప్రాంతాలను కనుగొనండి" },
    { id: "sst", label: "SST & క్లోరోఫిల్", query: "నా స్థానానికి సమీపంలో ఉన్న SST మరియు క్లోరోఫిల్ చూపించు" },
    { id: "geofence", label: "నిషేధిత సముద్ర మండలాలు", query: "సమీపంలో ఏవైనా నిషేధిత సముద్ర మండలాలు ఉన్నాయా?" },
    { id: "harbor", label: "సురక్షిత నౌకాశ్రయ మార్గం", query: "సమీపంలోని ఓడరేవుకు సురక్షితమైన మార్గాన్ని చూపించు" },
    { id: "sos", label: "అత్యవసర SOS సహాయం", query: "నా పడవ ప్రమాదంలో ఉంటే నేను ఏమి చేయాలి?" },
  ],
  gu: [
    { id: "sea", label: "દરિયાની સ્થિતિ", query: "મારી નજીકની વર્તમાન દરિયાઈ સ્થિતિ બતાવો" },
    { id: "pfz", label: "માછીમારી ઝોન (PFZ)", query: "મારી નજીકના શ્રેષ્ઠ માછીમારી વિસ્તારો શોધો" },
    { id: "sst", label: "SST અને ક્લોરોફિલ", query: "મારા સ્થાન નજીક SST અને ક્લોરોફિલ બતાવો" },
    { id: "geofence", label: "પ્રતિબંધિત વિસ્તારો", query: "શું નજીકમાં કોઈ પ્રતિબંધિત દરિયાઈ વિસ્તારો છે?" },
    { id: "harbor", label: "બંદર માટે સલામત માર્ગ", query: "નજીકના બંદર માટે સલામત માર્ગ બતાવો" },
    { id: "sos", label: "કટોકટી SOS સહાય", query: "જો મારું જહાજ જોખમમાં હોય તો મારે શું કરવું જોઈએ?" },
  ],
  bn: [
    { id: "sea", label: "সমুদ্রের অবস্থা", query: "আমার কাছাকাছি বর্তমান সমুদ্রের অবস্থা দেখাও" },
    { id: "pfz", label: "মৎস্য শিকার অঞ্চল (PFZ)", query: "আমার কাছাকাছি সেরা মাছ ধরার অঞ্চল খুঁজুন" },
    { id: "sst", label: "SST ও ক্লোরোফিল", query: "আমার অবস্থানের কাছাকাছি SST এবং ক্লোরোফিল দেখাও" },
    { id: "geofence", label: "নিষিদ্ধ সামুদ্রিক অঞ্চল", query: "কাছাকাছি কোনো নিষিদ্ধ সামুদ্রিক অঞ্চল আছে কি?" },
    { id: "harbor", label: "নিরাপদ বন্দর পথ", query: "নিকটতম বন্দরের জন্য নিরাপদ পথ দেখাও" },
    { id: "sos", label: "জরুরি SOS সাহায্য", query: "আমার জাহাজ বিপদে পড়লে আমার কী করা উচিত?" },
  ],
  kn: [
    { id: "sea", label: "ಸಮುದ್ರದ ಪರಿಸ್ಥಿತಿ", query: "ನನ್ನ ಸಮೀಪದ ಪ್ರಸ್ತುತ ಸಮುದ್ರದ ಪರಿಸ್ಥಿತಿಯನ್ನು ತೋರಿಸಿ" },
    { id: "pfz", label: "ಮೀನುಗಾರಿಕೆ ವಲಯ (PFZ)", query: "ನನ್ನ ಸಮೀಪದ ಉತ್ತಮ ಮೀನುಗಾರಿಕೆ ವಲಯಗಳನ್ನು ಹುಡುಕಿ" },
    { id: "sst", label: "SST ಮತ್ತು ಕ್ಲೋರೊಫಿಲ್", query: "ನನ್ನ ಸ್ಥಳದ ಸಮೀಪವಿರುವ SST ಮತ್ತು ಕ್ಲೋರೊಫಿಲ್ ತೋರಿಸಿ" },
    { id: "geofence", label: "ನಿರ್ಬಂಧಿತ ಸಮುದ್ರ ವಲಯಗಳು", query: "ಸಮೀಪದಲ್ಲಿ ಯಾವುದೇ ನಿರ್ಬಂಧಿತ ಸಮುದ್ರ ವಲಯಗಳಿವೆಯೇ?" },
    { id: "harbor", label: "ಸುರಕ್ಷಿತ ಬಂದರು ಮಾರ್ಗ", query: "ಹತ್ತಿರದ ಬಂದರಿಗೆ ಸುರಕ್ಷಿತ ಮಾರ್ಗವನ್ನು ತೋರಿಸಿ" },
    { id: "sos", label: "ತುರ್ತು SOS ಸಹಾಯ", query: "ನನ್ನ ಹಡಗು ಅಪಾಯದಲ್ಲಿದ್ದರೆ ನಾನು ಏನು ಮಾಡಬೇಕು?" },
  ],
  ml: [
    { id: "sea", label: "കടൽ അവസ്ഥ", query: "എന്റെ അടുത്തുള്ള നിലവിലെ കടൽ അവസ്ഥ കാണിക്കുക" },
    { id: "pfz", label: "മത്സ്യബന്ധന മേഖലകൾ (PFZ)", query: "എന്റെ അടുത്തുള്ള മികച്ച മത്സ്യബന്ധന മേഖലകൾ കണ്ടെത്തുക" },
    { id: "sst", label: "SST & ക്ലോറോഫിൽ", query: "എന്റെ ലൊക്കേഷന് സമീപമുള്ള SST, ക്ലോറോഫിൽ കാണിക്കുക" },
    { id: "geofence", label: "വിലക്കപ്പെട്ട സമുദ്ര മേഖലകൾ", query: "സമീപത്ത് എന്തെങ്കിലും നിയന്ത്രിത സമുദ്ര മേഖലകൾ ഉണ്ടോ?" },
    { id: "harbor", label: "സുരക്ഷിത തുറമുഖ റൂട്ട്", query: "ഏറ്റവും അടുത്തുള്ള തുറമുഖത്തേക്കുള്ള സുരക്ഷിത റൂട്ട് കാണിക്കുക" },
    { id: "sos", label: "അടിയന്തര SOS സഹായം", query: "എന്റെ ബോട്ട് അപകടത്തിലായാൽ ഞാൻ എന്തുചെയ്യണം?" },
  ],
  or: [
    { id: "sea", label: "ସମୁଦ୍ର ସ୍ଥିତି", query: "ମୋ ନିକଟରେ ବର୍ତ୍ତମାନର ସମୁଦ୍ର ସ୍ଥିତି ଦେଖାନ୍ତୁ" },
    { id: "pfz", label: "ମାଛ ଧରିବା ଅଞ୍ଚଳ (PFZ)", query: "ମୋ ନିକଟରେ ଥିବା ସର୍ବୋତ୍ତମ ମାଛ ଧରିବା ଅଞ୍ଚଳ ଖୋଜନ୍ତୁ" },
    { id: "sst", label: "SST ଏବଂ କ୍ଲୋରୋଫିଲ୍", query: "ମୋ ସ୍ଥାନ ନିକଟରେ SST ଏବଂ କ୍ଲୋରୋଫିଲ୍ ଦେଖାନ୍ତୁ" },
    { id: "geofence", label: "ନିଷିଦ୍ଧ ସାମୁଦ୍ରିକ କ୍ଷେତ୍ର", query: "ନିକଟରେ କୌଣସି ନିଷିଦ୍ଧ ସାମୁଦ୍ରିକ କ୍ଷେତ୍ର ଅଛି କି?" },
    { id: "harbor", label: "ନିରାପଦ ବନ୍ଦର ମାର୍ଗ", query: "ନିକଟତମ ବନ୍ଦର ପାଇଁ ଏକ ନିରାପଦ ମାର୍ଗ ଦେଖାନ୍ତୁ" },
    { id: "sos", label: "ଜରୁରୀକାଳୀନ SOS ସହାୟତା", query: "ମୋ ଜାହାଜ ବିପଦରେ ପଡ଼ିଲେ ମୁଁ କ'ଣ କରିବା ଉଚିତ୍?" },
  ],
  en: [
    { id: "sea", label: "Sea Conditions", query: "Show me the current sea conditions near me" },
    { id: "pfz", label: "Fishing Zones (PFZ)", query: "Find the best fishing zones near me" },
    { id: "sst", label: "SST & Chlorophyll", query: "Show SST and chlorophyll near my location" },
    { id: "geofence", label: "Restricted Zones", query: "Are there any restricted maritime zones nearby?" },
    { id: "harbor", label: "Safe Route to Harbor", query: "Show me a safe route to the nearest harbor" },
    { id: "sos", label: "Emergency Distress SOS", query: "What should I do if my vessel is in danger?" },
  ],
};

const PROMPT_ICONS = {
  sea: Waves,
  pfz: Navigation,
  sst: Activity,
  geofence: ShieldAlert,
  harbor: Compass,
  sos: Radio,
};

interface ChatStarterPromptsProps {
  onSelect: (query: string) => void;
  disabled?: boolean;
}

export function ChatStarterPrompts({
  onSelect,
  disabled = false,
}: ChatStarterPromptsProps) {
  const locale = useLocale();

  const prompts = useMemo(() => {
    return PROMPTS_BY_LOCALE[locale] || PROMPTS_BY_LOCALE.en;
  }, [locale]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto px-4 mt-3.5">
      {prompts.map((item) => {
        const Icon = PROMPT_ICONS[item.id];
        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(item.query)}
            className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-secondary/35 hover:bg-secondary/80 text-foreground/80 hover:text-foreground border border-border/50 hover:border-border transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
