const REVIEWED_AT='2026-11-10';
const insuranceReferences={
 SY:{url:'http://taminat.gov.sy/',titleAr:'المؤسسة العامة للتأمينات الاجتماعية السورية — التحقق من الحالة الحالية مطلوب',authority:'المؤسسة العامة للتأمينات الاجتماعية'},
 PS:{url:'https://mjr.ogb.gov.ps/Decrees/ViewText/29244',titleAr:'قرار بقانون 4 لسنة 2019 بوقف نفاذ قانون الضمان الاجتماعي',authority:'ديوان التشريع والرأي الفلسطيني',descriptionAr:'أوقف القرار بقانون نفاذ قانون الضمان الاجتماعي رقم 19 لسنة 2016. لا تحسب اشتراكات حتى يتحقق مختص من النظام البديل الساري والفئات المشمولة.'},
 SD:{url:'https://hrsw.gov.sd/?page_id=1360',titleAr:'الصندوق القومي للتأمين الاجتماعي — التعريف والاختصاص',authority:'وزارة الموارد البشرية والرعاية الاجتماعية — السودان'},
 MR:{url:'https://cnss.mr/',titleAr:'الصندوق الوطني للضمان الاجتماعي CNSS',authority:'الصندوق الوطني للضمان الاجتماعي — موريتانيا'},
 SO:{url:'https://molsa.gov.so/legislations/',titleAr:'التشريعات الاجتماعية المنشورة من وزارة العمل الصومالية',authority:'وزارة العمل والشؤون الاجتماعية — الصومال',descriptionAr:'تدرج الوزارة قانون معاشات موظفي الدولة لعام 2024، ولا يثبت ذلك تغطية العاملين في القطاع الخاص. الاشتراكات متوقفة حتى تثبيت نطاق التأمين والتشريعات النافذة.'},
 KM:{url:'https://justice.gouv.km/texte/decret-n13-020-pr-du-14-fevrier-2013-promulguant-la-loi-n12-021-au-du-25-decembre-2012-portant-creation-de-la-caisse-nationale-de-solidarite-et-de-prevoyance-sociale/',titleAr:'القانون 12-021/AU لسنة 2012 بإنشاء الصندوق الوطني للتضامن والاحتياط الاجتماعي',authority:'وزارة العدل — اتحاد جزر القمر'},
};
module.exports=function(code,nameAr,authority,url,legalNote){
 const laborSourceId=`${code.toLowerCase()}-labor-authority`,insuranceSourceId=`${code.toLowerCase()}-social-insurance`;
 const insurance=insuranceReferences[code]||{};
 const sources=[{id:laborSourceId,titleAr:legalNote?.titleAr||`بوابة التشريعات الرسمية للعمل في ${nameAr}`,url,authority,checkedAt:REVIEWED_AT},{id:insuranceSourceId,titleAr:legalNote?.insuranceTitleAr||insurance.titleAr||`مرجع التأمينات الاجتماعية في ${nameAr} — مطلوب استكمال التحقق`,url:legalNote?.insuranceUrl||insurance.url||url,authority:legalNote?.insuranceAuthority||insurance.authority||authority,checkedAt:REVIEWED_AT}];
 const rules=[{id:`${code}-LABOR-REVIEW`,category:'labor',titleAr:legalNote?.ruleTitleAr||`قواعد العمل في ${nameAr} — مراجعة مطلوبة`,status:'manual_review_required',effectiveFrom:null,sourceIds:[laborSourceId],descriptionAr:legalNote?.descriptionAr||'أضيفت الدولة لإعدادات المؤسسة، لكن لم يتم تفعيل حسابات الإجازة أو الأجور أو نهاية الخدمة قبل التحقق من النصوص الرسمية السارية ونطاق التطبيق لدى مختص محلي.'},{id:`${code}-SOCIAL-INSURANCE-REVIEW`,category:'social_insurance',titleAr:`التأمينات الاجتماعية في ${nameAr} — مراجعة مطلوبة`,status:'manual_review_required',effectiveFrom:null,sourceIds:[insuranceSourceId],descriptionAr:legalNote?.insuranceDescriptionAr||insurance.descriptionAr||'لم يتم تفعيل حسابات الاشتراكات قبل التحقق من القانون والمؤسسة المختصة والفئات المشمولة ووعاء الاشتراك والنسب الحالية.'}];
 const unavailable=()=>({available:false,reason:`${code}_LOCAL_LEGAL_REVIEW_REQUIRED`,requiresHumanReview:true});
 return {rules,sources,minimumAnnualLeave:unavailable,estimateEndOfService:unavailable,estimateOvertime:unavailable,estimateSocialInsurance:unavailable};
};
