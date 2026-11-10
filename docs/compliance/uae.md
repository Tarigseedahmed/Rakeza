# الإمارات: ملف القواعد الأولي

**آخر مراجعة للمصادر:** 2026-11-10  
**النطاق:** الحد الأدنى الاتحادي لعلاقات العمل في القطاع الخاص الخاضع لـ MOHRE  
**الحالة:** تقديري؛ ليس اعتماداً قانونياً أو مسيراً للرواتب.

## القواعد المنفذة

| الموضوع | القاعدة في الملف | القيود |
|---|---|---|
| الإجازة السنوية | 30 يوماً بعد سنة خدمة، ويومان عن كل شهر بعد إكمال ستة أشهر وقبل السنة. | يعرض الحد الأدنى النظامي حسب مدة الخدمة، ولا يحسب رصيداً مستخدماً أو منقولاً. |
| مكافأة نهاية الخدمة | للأجنبي بدوام كامل الذي أكمل سنة خدمة متصلة: 21 يوماً من الأجر الأساسي عن كل سنة من أول خمس سنوات، ثم 30 يوماً، مع تناسب الجزء من السنة وسقف أجر سنتين. | المدخلات تتطلب الأجر الأساسي وأيام الغياب غير المدفوعة. المواطنون الإماراتيون وغير المتفرغين وأنماط العمل الأخرى خارج هذه الحاسبة. |
| العمل الإضافي | على أساس الأجر الأساسي للساعة: زيادة لا تقل عن 25%، أو 50% بين 10 مساءً و4 صباحاً لغير العاملين بالورديات. يوم الراحة الأسبوعية يعالج بزيادة 50% أو راحة بديلة. | يفصل النموذج ساعات الليل ويوم الراحة؛ لا يقرر قانونية الساعات أو استحقاق الراحة البديلة. |
| GPSSA - قانون 57 لسنة 2023 | 11% على المؤمن عليه و15% على جهة العمل. قد تتحمل الحكومة 2.5% من حصة جهة العمل بالقطاع الخاص إذا كان أجر الاشتراك دون 20,000 درهم. | تقدير مشروط بإمارة مشمولة، قطاع وجهة GPSSA وبرنامج عضوية مؤكدين، وأجر اشتراك رسمي. |
| GPSSA - قانون 7 لسنة 1999 | 5% على المؤمن عليه و15% على جهة العمل؛ ودعم حكومي 2.5% من حصة جهة العمل للقطاع الخاص حسب الشروط. | التغطية والأجر يجب تأكيدهما من سجل GPSSA. |
| سلطات تقاعد غير GPSSA | صناديق محلية للجهات والفئات المختلفة. | أبوظبي وصندوق الشارقة للموظفين الحكوميين وبعض المناطق الحرة لا تحسب آلياً. |

## حماية النطاق والبيانات

- اختيار الإمارات لا يكفي لتحديد القانون المطبق: القطاع، الإمارة، الجنسية، نمط العمل، سلطة التقاعد، وتسجيل الموظف لها أثر مباشر.
- تقدير المعاشات يقتصر على مواطن إماراتي مع اختيار GPSSA/الإمارة/القطاع والنظام كما تم تأكيدها من حساب الجهة. إذا كانت جهة التقاعد مختلفة، يعيد النظام نتيجة مراجعة يدوية دون مبلغ.
- نتيجة مكافأة نهاية الخدمة لا تشمل نظام الادخار البديل، أحكام العقود السابقة الخاصة، المنازعات، الاستقطاعات القضائية، والأنظمة المستقلة للمناطق الحرة.
- النتائج `advisory` ولا تحفظ بيانات الأجور المقدمة، ولا تنشئ خصومات أو قيوداً محاسبية. يسجل سجل التدقيق نوع التقدير ومعرف القاعدة فقط.
- لا يرفع النظام ملفاً إلى MOHRE أو WPS ولا يتصل بجهة تقاعدية خارجية.

## واجهات النظام

- `GET /api/compliance/profile` يعيد ملف الإمارات مع القواعد والمراجع.
- `POST /api/compliance/AE/estimate` يدعم `annualLeave` (`startDate`, `asOf`)، `endOfService` (`workerType: foreign_full_time`, `startDate`, `endDate`, `basicMonthlyWage`, `unpaidAbsenceDays`)، و`overtime` (`basicHourlyWage`, `overtimeHours`, `nightHours`, `restDayHours`, `shiftWorker`)، و`socialInsurance` (`nationality: emirati`, `emirate`, `sector`, `confirmedScheme`, `contributionSalary`).
- كل التقديرات تحتاج جلسة وصلاحية قراءة الرواتب. النتائج لا تُرحّل تلقائياً.

## المصادر الرسمية

- [قوانين العمل في القطاع الخاص - بوابة حكومة الإمارات](https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/employment-laws-and-regulations-in-the-private-sector)
- [الإجازة السنوية](https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/types-of-leaves-and-entitlements-in-the-private-sector/annual-leave)
- [مكافأة نهاية الخدمة](https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/end-of-service-benefits-for-employees-in-the-private-sector)
- [ساعات العمل والعمل الإضافي](https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/working-hours)
- [قانون GPSSA الجديد ومعدلات الاشتراك](https://gpssa.gov.ae/pages/en/media-center/news/gpssa-reviews-most-prominent-features-federal-law-no-57-2023)
- [الجهات والفئات المشمولة بقانون GPSSA الجديد](https://www.gpssa.gov.ae/pages/en/media-center/news/gpssas-newly-published-federal-law-no-57-of-2023-now-available-website)
- [معدلات قانون GPSSA السابق](https://gpssa.gov.ae/pages/en/help/faq/what-distribution-contributions-due-insured-individuals)
