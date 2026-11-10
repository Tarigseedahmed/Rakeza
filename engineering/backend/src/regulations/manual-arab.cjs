const REVIEWED_AT='2026-11-10';
module.exports=function(code,nameAr,authority,url){
 const sources=[{id:`${code.toLowerCase()}-labor-authority`,titleAr:`الجهة الرسمية للعمل في ${nameAr}`,url,authority,checkedAt:REVIEWED_AT}];
 const rules=[{id:`${code}-MANUAL-REVIEW`,category:'all',titleAr:`ملف ${nameAr} — بانتظار التحقق النظامي`,status:'manual_review_required',effectiveFrom:null,sourceIds:[sources[0].id],descriptionAr:'أضيفت الدولة لإعدادات المؤسسة، لكن لم يتم تفعيل حسابات الإجازة أو الأجور أو نهاية الخدمة قبل التحقق من النصوص الرسمية السارية ونطاق التطبيق لدى مختص محلي.'}];
 const unavailable=()=>({available:false,reason:`${code}_LOCAL_LEGAL_REVIEW_REQUIRED`,requiresHumanReview:true});
 return {rules,sources,minimumAnnualLeave:unavailable,estimateEndOfService:unavailable,estimateOvertime:unavailable,estimateSocialInsurance:unavailable};
};
