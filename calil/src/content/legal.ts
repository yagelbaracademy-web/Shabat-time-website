/**
 * Calil legal documents (Hebrew + English).
 * Bump LEGAL_VERSION whenever the terms or privacy policy change materially:
 * every user is then asked to agree again before continuing.
 */
export const LEGAL_VERSION = "2026-10-01";
export const LEGAL_UPDATED = { he: "1 באוקטובר 2026", en: "1 October 2026" };
export const OWNER = { he: "יגל בר", en: "Yagel Bar" };
export const CONTACT = "contact@yagelbar.com";

export type Lang = "he" | "en";
export interface Section {
  h: string;
  p: string[];
}
export interface Doc {
  title: string;
  intro: string;
  sections: Section[];
}

/* ───────────────────────────── Terms of Use ───────────────────────────── */

export const TERMS: Record<Lang, Doc> = {
  he: {
    title: "תנאי שימוש",
    intro:
      "ברוכים הבאים ל-Calil, יומן אימונים דיגיטלי. השימוש באפליקציה כפוף לתנאים האלה. יצירת חשבון או שימוש באפליקציה מהווים הסכמה להם, ולכן כדאי לקרוא אותם. הם כתובים בלשון זכר מטעמי נוחות ופונים לכל המגדרים.",
    sections: [
      {
        h: "1. מי אנחנו",
        p: [
          `Calil מופעלת על ידי ${OWNER.he} ("אנחנו"). לכל שאלה: ${CONTACT}.`,
        ],
      },
      {
        h: "2. מי יכול להשתמש",
        p: [
          "השימוש מותר רק למי שמלאו לו 18 שנים. ביצירת חשבון אתה מצהיר שאתה בן 18 ומעלה. האפליקציה אינה מיועדת לקטינים. אם נודע לנו שחשבון שייך לקטין, נמחק אותו.",
          "אתה אחראי לשמור על פרטי ההתחברות שלך ועל כל פעולה שנעשית בחשבון שלך.",
        ],
      },
      {
        h: "3. אין כאן ייעוץ רפואי",
        p: [
          "Calil היא כלי לתיעוד אימונים בלבד. היא לא מאמן, לא רופא ולא פיזיותרפיסט, ושום דבר בה (כולל תוכניות, הצעות, נתוני התקדמות או תוכן שנוצר על ידי בינה מלאכותית) אינו ייעוץ רפואי, מקצועי או המלצה לפעילות גופנית.",
          "פעילות גופנית כרוכה בסיכון לפציעה. לפני תחילת תוכנית אימונים, ובמיוחד אם יש לך מצב רפואי, פציעה, הריון או כאב, יש להתייעץ עם רופא או איש מקצוע מוסמך. האחריות לבחירת התרגילים, המשקלים והעומסים ולביצוע הבטוח שלהם היא שלך בלבד.",
        ],
      },
      {
        h: "4. הכתבה, ייבוא ובינה מלאכותית",
        p: [
          "חלק מהפעולות (הכתבה קולית, הקלדת משפט חופשי וייבוא תוכנית) נעזרות בשירות בינה מלאכותית של Google לצורך תמלול והבנה. התוצאה עלולה להיות שגויה: מספר לא נכון, תרגיל לא נכון או סט חסר. עליך לבדוק את הנתונים לפני שאתה מסתמך עליהם.",
          "לשימוש בתכונות האלה יש מגבלה יומית סבירה, כדי לשמור על השירות זמין לכולם.",
        ],
      },
      {
        h: "5. התוכן שלך",
        p: [
          "הנתונים שאתה מזין (אימונים, תוכניות והערות) שייכים לך. אתה נותן לנו רשות להשתמש בהם רק כדי להפעיל עבורך את השירות: לשמור, לסנכרן, להציג ולעבד אותם לפי בקשתך. איך אנחנו שומרים ומגינים עליהם מוסבר במדיניות הפרטיות.",
          "אפשר להוריד עותק של כל הנתונים או למחוק את החשבון בכל עת מתוך ההגדרות.",
        ],
      },
      {
        h: "6. שימוש הוגן",
        p: [
          "אסור להשתמש באפליקציה לכל מטרה לא חוקית, לנסות לגשת לנתונים של אחרים, לפגוע באבטחה או בזמינות של השירות, להפעיל אותה באופן אוטומטי בהיקף חריג, או להעתיק ולמכור את השירות או חלקים ממנו.",
          "נוכל להשעות או לסגור חשבון שמפר את התנאים האלה.",
        ],
      },
      {
        h: "7. השירות כפי שהוא",
        p: [
          "השירות ניתן כפי שהוא (AS IS) וכפי שהוא זמין, ללא כל התחייבות לזמינות רציפה, לדיוק או להתאמה למטרה מסוימת. אנחנו עושים מאמץ סביר לשמור על הנתונים, אך ממליצים להוריד מדי פעם עותק שלהם.",
          "אנחנו רשאים לשנות, להוסיף או להפסיק תכונות, או להפסיק את השירות כולו, ונשתדל להודיע מראש במידה סבירה.",
        ],
      },
      {
        h: "8. הגבלת אחריות",
        p: [
          "במידה המרבית שהחוק מתיר, לא נהיה אחראים לכל נזק ישיר או עקיף שנגרם משימוש באפליקציה או מהסתמכות עליה, ובכלל זה פציעה, נזק גופני, אובדן נתונים, או נזק שנגרם מטעות בתמלול, בייבוא או בחישוב.",
          "האפליקציה ניתנת ללא תשלום. ככל שתחול עלינו אחריות כלשהי, היא תוגבל לסכום ששילמת לנו בשנים עשר החודשים שקדמו לאירוע, אם שילמת.",
          "אתה מתחייב לשפות אותנו בגין נזק שייגרם לנו עקב הפרת התנאים האלה על ידך.",
        ],
      },
      {
        h: "9. קניין רוחני",
        p: [
          "השם Calil, הלוגו, העיצוב והקוד של האפליקציה שייכים לנו. אין להעתיק או להשתמש בהם בלי אישור בכתב.",
        ],
      },
      {
        h: "10. שינויים בתנאים",
        p: [
          "אם נשנה את התנאים באופן מהותי, נבקש ממך לאשר אותם מחדש בכניסה הבאה. אם לא תאשר, תוכל להוריד את הנתונים שלך ולמחוק את החשבון.",
        ],
      },
      {
        h: "11. דין וסמכות שיפוט",
        p: [
          "על התנאים האלה יחול הדין הישראלי בלבד. סמכות השיפוט הבלעדית בכל עניין הקשור אליהם תהיה לבתי המשפט המוסמכים בתל אביב-יפו.",
        ],
      },
    ],
  },
  en: {
    title: "Terms of Use",
    intro:
      "Welcome to Calil, a digital workout notebook. Using the app is subject to these terms. By creating an account or using the app you agree to them, so please read them.",
    sections: [
      { h: "1. Who we are", p: [`Calil is operated by ${OWNER.en} ("we"). Questions: ${CONTACT}.`] },
      {
        h: "2. Who can use Calil",
        p: [
          "You must be at least 18 years old. By creating an account you confirm that you are 18 or older. Calil is not intended for minors; if we learn an account belongs to a minor, we will delete it.",
          "You are responsible for keeping your sign-in details safe and for all activity in your account.",
        ],
      },
      {
        h: "3. Not medical advice",
        p: [
          "Calil is a tool for recording workouts. It is not a coach, doctor or physiotherapist, and nothing in it (including plans, suggestions, progress figures or AI-generated content) is medical or professional advice or a recommendation to exercise.",
          "Exercise carries a risk of injury. Before starting a training program, and especially if you have a medical condition, an injury, are pregnant or feel pain, consult a doctor or qualified professional. You alone are responsible for choosing exercises, weights and loads, and for performing them safely.",
        ],
      },
      {
        h: "4. Dictation, import and AI",
        p: [
          "Some features (voice dictation, typed sentences and program import) use Google's AI service to transcribe and understand your input. Results can be wrong: a wrong number, exercise or a missing set. Check your data before relying on it.",
          "These features have a reasonable daily limit to keep the service available for everyone.",
        ],
      },
      {
        h: "5. Your content",
        p: [
          "The data you enter (workouts, plans and notes) belongs to you. You allow us to use it only to run the service for you: to store, sync, display and process it at your request. How we store and protect it is explained in the Privacy Policy.",
          "You can download a copy of all your data or delete your account at any time in Settings.",
        ],
      },
      {
        h: "6. Fair use",
        p: [
          "Don't use the app for anything unlawful, try to access other people's data, harm the security or availability of the service, automate it at unusual volume, or copy or resell the service or parts of it.",
          "We may suspend or close accounts that break these terms.",
        ],
      },
      {
        h: "7. The service as is",
        p: [
          "The service is provided as is and as available, without any promise of uninterrupted availability, accuracy or fitness for a particular purpose. We make reasonable efforts to keep your data safe, and recommend downloading a copy from time to time.",
          "We may change, add or remove features, or discontinue the service, and will try to give reasonable notice.",
        ],
      },
      {
        h: "8. Limitation of liability",
        p: [
          "To the fullest extent permitted by law, we are not liable for any direct or indirect damage arising from using or relying on the app, including injury, physical harm, data loss, or damage caused by errors in transcription, import or calculation.",
          "Calil is free. If we are held liable for anything, our liability is limited to the amount you paid us in the twelve months before the event, if any.",
          "You agree to indemnify us for damage caused to us by your breach of these terms.",
        ],
      },
      { h: "9. Intellectual property", p: ["The Calil name, logo, design and code belong to us and may not be copied or used without written permission."] },
      {
        h: "10. Changes",
        p: [
          "If we change these terms materially, we will ask you to accept them again on your next visit. If you don't accept, you can download your data and delete your account.",
        ],
      },
      {
        h: "11. Governing law",
        p: [
          "These terms are governed solely by the laws of the State of Israel. The competent courts of Tel Aviv-Jaffa have exclusive jurisdiction over any matter relating to them.",
        ],
      },
    ],
  },
};

/* ───────────────────────────── Privacy Policy ───────────────────────────── */

export const PRIVACY: Record<Lang, Doc> = {
  he: {
    title: "מדיניות פרטיות",
    intro:
      "המסמך הזה מסביר איזה מידע Calil אוספת, למה, איפה הוא נשמר, עם מי הוא משותף ומה הזכויות שלך. הוא נכתב לפי חוק הגנת הפרטיות, התשמ\"א-1981, כולל תיקון 13.",
    sections: [
      {
        h: "1. מי אחראי על המידע",
        p: [`בעל המאגר והאחראי על המידע: ${OWNER.he}. ליצירת קשר בכל נושא פרטיות: ${CONTACT}.`],
      },
      {
        h: "2. איזה מידע נאסף",
        p: [
          "פרטי חשבון: כתובת מייל וסיסמה מוצפנת. אם התחברת עם Google, גם השם ותמונת הפרופיל שמסרה Google.",
          "נתוני אימון שאתה מזין: תרגילים, סטים, משקלים, חזרות, זמנים, תוכניות, הערות והשמות שאתה נותן לתרגילים.",
          "הגדרות ותיעוד הסכמה: יחידת משקל, טיימר מנוחה, ומתי ולאיזו גרסה של המסמכים הסכמת.",
          "נתוני שימוש מינימליים: מונה יומי של שימוש בהכתבה ובייבוא, לצורך מגבלת השימוש. ספקי האחסון שומרים רישומים טכניים (כמו כתובת IP) לצורכי אבטחה.",
          "אנחנו לא משתמשים בכלי אנליטיקה, בפרסומות או במעקב אחרי הגלישה שלך.",
        ],
      },
      {
        h: "3. מידע בעל רגישות מיוחדת",
        p: [
          "הערות חופשיות (למשל \"כאב קל בכתף\") עשויות להיחשב מידע רפואי, שהוא מידע בעל רגישות מיוחדת לפי החוק. הזנת הערות היא לגמרי לבחירתך ואינה נדרשת לשימוש באפליקציה. המידע הזה משמש רק כדי להציג לך אותו, והוא מוגן כמו כל שאר הנתונים שלך.",
        ],
      },
      {
        h: "4. למה המידע משמש",
        p: [
          "כדי להפעיל עבורך את השירות: לשמור ולסנכרן את האימונים, להציג היסטוריה והתקדמות, ולבצע הכתבה וייבוא כשאתה מבקש.",
          "כדי לשמור על אבטחת השירות ולמנוע שימוש לרעה, וכדי לשלוח מיילים הכרחיים (אימות חשבון ואיפוס סיסמה).",
          "אנחנו לא מוכרים מידע, לא משתמשים בו לפרסום ולא בונים ממנו פרופיל שיווקי.",
          "אין חובה חוקית למסור את המידע. בלי פרטי חשבון ונתוני אימון לא ניתן להשתמש באפליקציה.",
        ],
      },
      {
        h: "5. בינה מלאכותית",
        p: [
          "כשאתה משתמש בהכתבה, בהקלדת משפט או בייבוא תוכנית, ההקלטה או הטקסט נשלחים ל-Google Gemini לצורך תמלול והבנה, יחד עם שמות התרגילים שלך ומצב האימון הנוכחי. אנחנו לא שומרים את ההקלטה או את הטקסט המקורי, רק את התוצאה שאישרת.",
          "Calil משתמשת בשירות בתשלום של Google. לפי התנאים שלו, Google לא משתמשת בתוכן כדי לאמן מודלים או לשפר מוצרים, ושומרת אותו לזמן מוגבל לצורך זיהוי שימוש לרעה בלבד.",
        ],
      },
      {
        h: "6. עם מי המידע משותף ואיפה הוא נשמר",
        p: [
          "המידע עובר רק לספקי שירות שמפעילים את Calil עבורנו, ולא לשום גורם אחר:",
          "Supabase: מסד הנתונים וההתחברות. השרתים בפרנקפורט, גרמניה (האיחוד האירופי). Cloudflare: אחסון האפליקציה והעברתה ברשת. Google: עיבוד בינה מלאכותית, והתחברות עם Google למי שבחר בה. Brevo: שליחת מיילים מהשירות.",
          "חלק מהספקים הם חברות אמריקאיות, והמידע עשוי לעבור או להיות נגיש מחוץ לישראל. בהסכמתך למדיניות זו אתה מסכים להעברה הזו. אנחנו בוחרים ספקים שמחויבים לסטנדרטים מקובלים של אבטחה ופרטיות.",
          "נמסור מידע לרשויות רק אם נידרש לכך על פי דין.",
        ],
      },
      {
        h: "7. אחסון במכשיר ועוגיות",
        p: [
          "האפליקציה שומרת במכשיר שלך רק את מה שנחוץ כדי שתעבוד: את פרטי ההתחברות ועותק של הנתונים כדי שתוכל לרשום אימון גם בלי אינטרנט. אלה אמצעים חיוניים לתפעול השירות. אין עוגיות של פרסום, אנליטיקה או מעקב, ולכן אין צורך באישור עוגיות נפרד.",
          "ביציאה מהחשבון העותק נמחק מהמכשיר.",
        ],
      },
      {
        h: "8. אבטחת מידע",
        p: [
          "המידע מוצפן בהעברה (HTTPS) ובאחסון. כל משתמש יכול לגשת רק לנתונים שלו, והגישה נאכפת ברמת מסד הנתונים. מפתחות ניהול נשמרים רק בשרת. הגישה הניהולית מוגבלת לבעל המאגר בלבד.",
          "אף שירות לא מאובטח לחלוטין. אם יתרחש אירוע אבטחה חמור, נדווח לרשות להגנת הפרטיות ולמשתמשים שנפגעו כנדרש בחוק.",
        ],
      },
      {
        h: "9. כמה זמן המידע נשמר",
        p: [
          "כל עוד החשבון קיים. כשאתה מוחק את החשבון, כל הנתונים נמחקים ממסד הנתונים מיד. עותקי גיבוי אצל ספקי השירות עשויים להישמר לתקופה מוגבלת נוספת עד שיימחקו אוטומטית.",
        ],
      },
      {
        h: "10. הזכויות שלך",
        p: [
          "עיון: אפשר להוריד את כל הנתונים שלך מתוך ההגדרות (Download my data).",
          "תיקון: אפשר לערוך כל נתון ישירות באפליקציה.",
          "מחיקה: אפשר למחוק את החשבון וכל המידע מתוך ההגדרות (Delete account).",
          `לכל בקשה אחרת או שאלה אפשר לפנות אל ${CONTACT}, ונשיב תוך 30 יום. אם אינך מרוצה מהטיפול, ניתן לפנות לרשות להגנת הפרטיות.`,
        ],
      },
      {
        h: "11. גיל",
        p: ["השירות מיועד לבני 18 ומעלה בלבד. איננו אוספים ביודעין מידע על קטינים, ואם יתברר שחשבון שייך לקטין נמחק אותו."],
      },
      {
        h: "12. שינויים במדיניות",
        p: ["אם נשנה את המדיניות באופן מהותי, נבקש ממך לאשר אותה מחדש לפני שתמשיך להשתמש באפליקציה."],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    intro:
      "This explains what Calil collects, why, where it is stored, who it is shared with and what your rights are. It follows the Israeli Protection of Privacy Law, 5741-1981, including Amendment 13.",
    sections: [
      { h: "1. Who is responsible", p: [`Database owner and controller: ${OWNER.en}. Privacy contact: ${CONTACT}.`] },
      {
        h: "2. What we collect",
        p: [
          "Account details: email and an encrypted password. If you sign in with Google, also the name and profile picture Google provides.",
          "Workout data you enter: exercises, sets, weights, reps, times, plans, notes and the names you give exercises.",
          "Settings and consent record: weight unit, rest timer, and when and to which version of these documents you agreed.",
          "Minimal usage data: a daily count of dictation and import use, for the usage limit. Hosting providers keep technical logs (such as IP address) for security.",
          "We don't use analytics, advertising or tracking of your browsing.",
        ],
      },
      {
        h: "3. Especially sensitive information",
        p: [
          "Free-text notes (for example \"slight shoulder pain\") may count as medical information, which the law treats as especially sensitive. Writing notes is entirely optional and not needed to use the app. This information is only used to show it back to you, and it is protected like the rest of your data.",
        ],
      },
      {
        h: "4. How we use it",
        p: [
          "To run the service for you: store and sync workouts, show history and progress, and perform dictation and import when you ask.",
          "To keep the service secure, prevent abuse, and send essential emails (account confirmation and password reset).",
          "We don't sell data, use it for advertising or build marketing profiles.",
          "You are not legally required to provide any information, but without account and workout data the app cannot work.",
        ],
      },
      {
        h: "5. Artificial intelligence",
        p: [
          "When you use dictation, typed sentences or program import, the recording or text is sent to Google Gemini to be transcribed and understood, together with your exercise names and the current workout. We don't keep the recording or the original text, only the result you accept.",
          "Calil uses Google's paid service. Under its terms, Google does not use the content to train models or improve products, and keeps it for a limited time only to detect abuse.",
        ],
      },
      {
        h: "6. Who we share it with and where it is stored",
        p: [
          "Data goes only to service providers that run Calil for us, and to no one else:",
          "Supabase: database and sign-in, on servers in Frankfurt, Germany (EU). Cloudflare: hosting and delivery. Google: AI processing, and Sign in with Google if you use it. Brevo: service emails.",
          "Some providers are US companies, and data may be transferred to or accessed from outside Israel. By agreeing to this policy you consent to that transfer. We choose providers committed to accepted security and privacy standards.",
          "We will disclose data to authorities only when required by law.",
        ],
      },
      {
        h: "7. Device storage and cookies",
        p: [
          "The app stores on your device only what it needs to work: your sign-in and a copy of your data so you can log workouts offline. These are strictly necessary. There are no advertising, analytics or tracking cookies, so no separate cookie consent is needed.",
          "Signing out removes the copy from the device.",
        ],
      },
      {
        h: "8. Security",
        p: [
          "Data is encrypted in transit (HTTPS) and at rest. Each user can access only their own data, enforced in the database itself. Admin keys stay on the server, and admin access is limited to the database owner.",
          "No service is perfectly secure. If a serious security incident occurs, we will notify the Privacy Protection Authority and affected users as the law requires.",
        ],
      },
      {
        h: "9. How long we keep it",
        p: [
          "For as long as your account exists. When you delete your account, all data is removed from the database immediately. Provider backups may keep it for a limited period until they are deleted automatically.",
        ],
      },
      {
        h: "10. Your rights",
        p: [
          "Access: download all your data in Settings (Download my data).",
          "Correction: edit any data directly in the app.",
          "Deletion: delete your account and all data in Settings (Delete account).",
          `For anything else, write to ${CONTACT}; we reply within 30 days. If you're not satisfied, you can contact the Israeli Privacy Protection Authority.`,
        ],
      },
      { h: "11. Age", p: ["Calil is for people aged 18 and over. We don't knowingly collect data about minors, and we delete accounts found to belong to minors."] },
      { h: "12. Changes", p: ["If we change this policy materially, we'll ask you to accept it again before you continue using the app."] },
    ],
  },
};

/* ───────────────────────────── Accessibility ───────────────────────────── */

export const ACCESSIBILITY: Record<Lang, Doc> = {
  he: {
    title: "הצהרת נגישות",
    intro:
      "אנחנו רוצים ש-Calil תהיה נוחה לשימוש לכל אחד ואחת, כולל אנשים עם מוגבלות. האפליקציה פותחה בהתאם לתקן הישראלי ת\"י 5568, המבוסס על הנחיות WCAG 2.0 ברמה AA.",
    sections: [
      {
        h: "מה עשינו",
        p: [
          "ניגודיות צבעים גבוהה בין טקסט לרקע, וגודל טקסט שאפשר להגדיל בהגדרות המכשיר.",
          "תוויות ותיאורים לכל הכפתורים והשדות, לתמיכה בקוראי מסך.",
          "ניווט מלא במקלדת עם סימון פוקוס ברור.",
          "אזורי לחיצה גדולים, נוחים גם ביד אחת.",
          "כיבוד הגדרת \"הפחתת תנועה\" במכשיר.",
          "לכל פעולה במחווה (כמו החלקה למחיקה) יש גם דרך חלופית בלחיצה.",
          "גרפים מלווים תמיד במספרים כתובים.",
        ],
      },
      {
        h: "מגבלות ידועות",
        p: [
          "הכתבה קולית דורשת מיקרופון. אפשר תמיד להקליד את אותו מידע במקום.",
          "תוכן שנוצר בבינה מלאכותית (תמלול וייבוא) עלול להכיל טעויות, ומוצג לבדיקה לפני שמירה.",
        ],
      },
      {
        h: "פנייה בנושא נגישות",
        p: [
          `רכז הנגישות: ${OWNER.he}. מייל: ${CONTACT}. נשמח לשמוע על כל קושי או הצעה, ונשתדל לטפל בכל פנייה בהקדם.`,
        ],
      },
    ],
  },
  en: {
    title: "Accessibility Statement",
    intro:
      "We want Calil to be easy to use for everyone, including people with disabilities. The app was built following Israeli Standard IS 5568, based on WCAG 2.0 level AA.",
    sections: [
      {
        h: "What we did",
        p: [
          "High color contrast between text and background, and text that scales with your device settings.",
          "Labels and descriptions for every button and field, for screen readers.",
          "Full keyboard navigation with a clear focus indicator.",
          "Large touch targets, comfortable with one hand.",
          "Respect for the device's reduce motion setting.",
          "Every gesture (such as swipe to delete) also has a tap alternative.",
          "Charts are always accompanied by written numbers.",
        ],
      },
      {
        h: "Known limitations",
        p: [
          "Voice dictation needs a microphone. You can always type the same information instead.",
          "AI-generated content (transcription and import) may contain mistakes and is shown for review before saving.",
        ],
      },
      {
        h: "Accessibility contact",
        p: [`Accessibility coordinator: ${OWNER.en}. Email: ${CONTACT}. We'd like to hear about any difficulty or suggestion and will handle every request as soon as we can.`],
      },
    ],
  },
};
