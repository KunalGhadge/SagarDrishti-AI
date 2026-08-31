import json
import os

with open('messages/en.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

# Common dictionaries across 9 official coastal/regional languages of India
LANGS = {
    "hi": "हिन्दी",
    "mr": "मराठी",
    "gu": "ગુજરાતી",
    "ta": "தமிழ்",
    "te": "తెలుగు",
    "bn": "বাংলা",
    "ml": "മലയാളം",
    "kn": "ಕನ್ನಡ",
    "or": "ଓଡ଼ିଆ"
}

# Rich comprehensive translations for all sections
DICT = {
    "hi": {
        "cancel": "रद्द करें", "update": "अपडेट करें", "continue": "जारी रखें", "success": "सफल", "delete": "हटाएं",
        "save": "सहेजें", "back": "पीछे", "next": "आगे", "create": "बनाएं", "showLess": "कम दिखाएं", "showMore": "अधिक दिखाएं",
        "generate": "उत्पन्न करें", "edit": "संपादित करें", "search": "खोजें...", "approve": "स्वीकृत करें", "reject": "अस्वीकार करें",
        "workflow": "कार्यप्रवाह (Workflow)", "admin": "प्रशासन", "users": "उपयोगकर्ता", "newChat": "नई चैट", "agents": "समुद्री विशेषज्ञ एजेंट",
        "newAgent": "नया एजेंट", "language": "भाषा (Language)", "settings": "सेटिंग्स", "profile": "प्रोफ़ाइल", "signOut": "साइन आउट"
    },
    "mr": {
        "cancel": "रद्द करा", "update": "अपडेट करा", "continue": "पुढे सुरू ठेवा", "success": "यशस्वी", "delete": "हटवा",
        "save": "जतन करा", "back": "मागे", "next": "पुढे", "create": "तयार करा", "showLess": "कमी दाखवा", "showMore": "अधिक दाखवा",
        "generate": "निर्मिती करा", "edit": "संपादित करा", "search": "शोधा...", "approve": "मंजूर करा", "reject": "नाकारा",
        "workflow": "कार्यप्रवाह (Workflow)", "admin": "प्रशासन", "users": "वापरकर्ते", "newChat": "नवीन चॅट", "agents": "सागरी तज्ञ एजंट्स",
        "newAgent": "नवीन एजंट", "language": "भाषा (Language)", "settings": "सेटिंग्ज", "profile": "प्रोफाइल", "signOut": "बाहेर पडा"
    },
    "gu": {
        "cancel": "રદ કરો", "update": "અપડેટ કરો", "continue": "ચાલુ રાખો", "success": "સફળ", "delete": "કાઢી નાખો",
        "save": "સાચવો", "back": "પાછળ", "next": "આગળ", "create": "બનાવો", "showLess": "ઓછું બતાવો", "showMore": "વધુ બતાવો",
        "generate": "ઉત્પન્ન કરો", "edit": "સંપાદિત કરો", "search": "શોધો...", "approve": "મંજૂર કરો", "reject": "અસ્વીકાર કરો",
        "workflow": "કાર્યપ્રવાહ (Workflow)", "admin": "એડમિન", "users": "વપરાશકર્તાઓ", "newChat": "નવી ચેટ", "agents": "દરિયાઈ નિષ્ણાત એજન્ટ્સ",
        "newAgent": "નવો એજન્ટ", "language": "ભાષા (Language)", "settings": "સેટિંગ્સ", "profile": "પ્રોફાઇલ", "signOut": "સાઇન આઉટ"
    },
    "ta": {
        "cancel": "ரத்துசெய்", "update": "புதுப்பி", "continue": "தொடரவும்", "success": "வெற்றி", "delete": "நீக்கு",
        "save": "சேமி", "back": "பின்செல்", "next": "அடுத்து", "create": "உருவாக்கு", "showLess": "குறைவாகக் காட்டு", "showMore": "மேலும் காட்டு",
        "generate": "உருவாக்கு", "edit": "திருத்து", "search": "தேடு...", "approve": "ஒப்புதல்", "reject": "நிராகரி",
        "workflow": "பணிப்பாய்வு (Workflow)", "admin": "நிர்வாகம்", "users": "பயனர்கள்", "newChat": "புதிய அரட்டை", "agents": "கடல்சார் நிபுணர் முகவர்கள்",
        "newAgent": "புதிய முகவர்", "language": "மொழி (Language)", "settings": "அமைப்புகள்", "profile": "சுயவிவரம்", "signOut": "வெளியேறு"
    },
    "te": {
        "cancel": "రద్దు చేయి", "update": "నవీకరించు", "continue": "కొనసాగించు", "success": "విజయవంతం", "delete": "తొలగించు",
        "save": "భద్రపరచు", "back": "వెనుకకు", "next": "తదుపరి", "create": "సృష్టించు", "showLess": "తక్కువ చూపు", "showMore": "మరింత చూపు",
        "generate": "రూపొందించు", "edit": "సవరించు", "search": "శోధించండి...", "approve": "ఆమోదించు", "reject": "తిరస్కరించు",
        "workflow": "వర్క్‌ఫ్లో (Workflow)", "admin": "నిర్వాహకుడు", "users": "వినియోగదారులు", "newChat": "కొత్త సంభాషణ", "agents": "సముద్ర నిపుణుల ఏజెంట్లు",
        "newAgent": "కొత్త ఏజెంట్", "language": "భాష (Language)", "settings": "సెట్టింగ్‌లు", "profile": "ప్రొఫైల్", "signOut": "సైన్ అవుట్"
    },
    "bn": {
        "cancel": "বাতিল", "update": "আপডেট", "continue": "চালিয়ে যান", "success": "সফল", "delete": "মুছুন",
        "save": "সংরক্ষণ", "back": "পেছনে", "next": "পরবর্তী", "create": "তৈরি করুন", "showLess": "কম দেখান", "showMore": "আরো দেখান",
        "generate": "উৎপাদন করুন", "edit": "সম্পাদনা", "search": "অনুসন্ধান...", "approve": "অনুমোদন", "reject": "প্রত্যাখ্যান",
        "workflow": "ওয়ার্কফ্লো (Workflow)", "admin": "প্রশাসন", "users": "ব্যবহারকারী", "newChat": "নতুন চ্যাট", "agents": "সামুদ্রিক বিশেষজ্ঞ এজেন্ট",
        "newAgent": "নতুন এজেন্ট", "language": "ভাষা (Language)", "settings": "সেটিংস", "profile": "প্রোফাইল", "signOut": "সাইন আউট"
    },
    "ml": {
        "cancel": "റദ്ദാക്കുക", "update": "പുതുക്കുക", "continue": "തുടരുക", "success": "വിജയം", "delete": "ഡിലീറ്റ് ചെയ്യുക",
        "save": "സൂക്ഷിക്കുക", "back": "പിന്നിലേക്ക്", "next": "അടുത്തത്", "create": "ഉണ്ടാക്കുക", "showLess": "കുറച്ച് കാണിക്കുക", "showMore": "കൂടുതൽ കാണിക്കുക",
        "generate": "ഉത്പാദിപ്പിക്കുക", "edit": "തിരുത്തുക", "search": "തിരയുക...", "approve": "അംഗീകരിക്കുക", "reject": "നിരസിക്കുക",
        "workflow": "വർക്ക്ഫ്ലോ (Workflow)", "admin": "അഡ്മിൻ", "users": "ഉപയോക്താക്കൾ", "newChat": "പുതിയ ചാറ്റ്", "agents": "സമുദ്ര വിദഗ്ദ്ധ ഏജന്റുകൾ",
        "newAgent": "പുതിയ ഏജന്റ്", "language": "ഭാഷ (Language)", "settings": "ക്രമീകരണങ്ങൾ", "profile": "പ്രൊഫൈൽ", "signOut": "പുറത്തുകടക്കുക"
    },
    "kn": {
        "cancel": "ರದ್ದುಮಾಡಿ", "update": "ನವೀಕರಿಸಿ", "continue": "ಮುಂದುವರಿಸಿ", "success": "ಯಶಸ್ವಿ", "delete": "ಅಳಿಸಿ",
        "save": "ಉಳಿಸಿ", "back": "ಹಿಂದಕ್ಕೆ", "next": "ಮುಂದೆ", "create": "ರಚಿಸಿ", "showLess": "ಕಡಿಮೆ ತೋರಿಸಿ", "showMore": "ಹೆಚ್ಚು ತೋರಿಸಿ",
        "generate": "ಉತ್ಪಾದಿಸಿ", "edit": "ಸಂಪಾದಿಸಿ", "search": "ಹುಡುಕಿ...", "approve": "ಅನುಮೋದಿಸಿ", "reject": "ತಿರಸ್ಕರಿಸಿ",
        "workflow": "ವರ್ಕ್‌ಫ್ಲೋ (Workflow)", "admin": "ನಿರ್ವಾಹಕ", "users": "ಬಳಕೆದಾರರು", "newChat": "ಹೊಸ ಚಾಟ್", "agents": "ಸಾಗರ ತಜ್ಞ ಏಜೆಂಟರು",
        "newAgent": "ಹೊಸ ಏಜೆಂಟ್", "language": "ಭಾಷೆ (Language)", "settings": "ಸೆಟ್ಟಿಂಗ್‌ಗಳು", "profile": "ಪ್ರೊಫೈಲ್", "signOut": "ಸೈನ್ ಔಟ್"
    },
    "or": {
        "cancel": "ବାତିଲ କରନ୍ତୁ", "update": "ଅଦ୍ୟତନ କରନ୍ତୁ", "continue": "ଜାରି ରଖନ୍ତୁ", "success": "ସଫଳ", "delete": "ଡିଲିଟ୍ କରନ୍ତୁ",
        "save": "ସଂରକ୍ଷଣ କରନ୍ତୁ", "back": "ପଛକୁ", "next": "ପରବର୍ତ୍ତୀ", "create": "ତିଆରି କରନ୍ତୁ", "showLess": "କମ୍ ଦେଖାନ୍ତୁ", "showMore": "ଅଧିକ ଦେଖାନ୍ତୁ",
        "generate": "ଉତ୍ପାଦନ କରନ୍ତୁ", "edit": "ସମ୍ପାଦନ କରନ୍ତୁ", "search": "ଖୋଜନ୍ତୁ...", "approve": "ଅନୁମୋଦନ କରନ୍ତୁ", "reject": "ପ୍ରତ୍ୟାଖ୍ୟାନ କରନ୍ତୁ",
        "workflow": "କାର୍ଯ୍ୟପ୍ରବାହ (Workflow)", "admin": "ପ୍ରଶାସନ", "users": "ବ୍ୟବହାରକାରୀ", "newChat": "ନୂତନ ଚାଟ୍", "agents": "ସାମୁଦ୍ରିକ ବିଶେଷଜ୍ଞ ଏଜେଣ୍ଟ",
        "newAgent": "ନୂତନ ଏଜେଣ୍ଟ", "language": "ଭାଷା (Language)", "settings": "ସେଟିଂସ୍", "profile": "ପ୍ରୋଫାଇଲ୍", "signOut": "ସାଇନ୍ ଆଉଟ୍"
    }
}

for lang_code, t in DICT.items():
    lang_file = f"messages/{lang_code}.json"
    data = {}
    if os.path.exists(lang_file):
        try:
            with open(lang_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {}

    for section, keys in en.items():
        if section not in data:
            data[section] = {}
        if isinstance(keys, dict):
            for k, v in keys.items():
                if k in t:
                    data[section][k] = t[k]
                elif k not in data[section]:
                    data[section][k] = v

    with open(lang_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Generated {lang_code}.json")
