const REVIEWED_AT = '2026-11-10';
const EFFECTIVE_LABOR_LAW = '2025-02-19';

const sources = [
  { id: 'hrsd-labor-law', titleAr: 'نظام العمل السعودي وعلاقات العمل', url: 'https://www.hrsd.gov.sa/%D8%B9%D9%84%D8%A7%D9%82%D8%A7%D8%AA-%D8%A7%D9%84%D8%B9%D9%85%D9%84', authority: 'HRSD', checkedAt: REVIEWED_AT },
  { id: 'hrsd-annual-leave', titleAr: 'الإجازات السنوية – المادة 109 وما بعدها', url: 'https://www.hrsd.gov.sa/%D8%B4%D8%B1%D9%88%D8%B7-%D8%A7%D9%84%D8%B9%D9%85%D9%84-%D9%88%D8%B8%D8%B1%D9%88%D9%81%D9%87', authority: 'HRSD', checkedAt: REVIEWED_AT },
  { id: 'hrsd-end-of-service', titleAr: 'احتساب مكافأة نهاية الخدمة – المواد 84 إلى 88', url: 'https://www.hrsd.gov.sa/en/knowledge-centre/articles/316', authority: 'HRSD', checkedAt: REVIEWED_AT },
  { id: 'gosi-new-system', titleAr: 'النظام الجديد للتأمينات الاجتماعية والأحكام الانتقالية', url: 'https://beta.gosi.gov.sa/new-system', authority: 'GOSI', checkedAt: REVIEWED_AT },
  { id: 'gosi-new-members', titleAr: 'المنصة التوعوية للمشمولين بالنظام الجديد', url: 'https://awareness.gosi.gov.sa/businessJourney.html', authority: 'GOSI', checkedAt: REVIEWED_AT },
  { id: 'gosi-old-members', titleAr: 'الأسئلة الشائعة للمشتركين ونسب النظام السابق', url: 'https://www.gosi.gov.sa/GOSIOnline/FAQ_Contributor', authority: 'GOSI', checkedAt: REVIEWED_AT },
];

const rules = [
  { id: 'SA-LAB-ANNUAL-LEAVE', category: 'leave', titleAr: 'الحد الأدنى للإجازة السنوية', status: 'active_reference', effectiveFrom: EFFECTIVE_LABOR_LAW, sourceIds: ['hrsd-annual-leave'], descriptionAr: '21 يوماً عن كل سنة خدمة، وترتفع إلى 30 يوماً بعد إكمال خمس سنوات متصلة لدى صاحب العمل. لا يشمل ذلك الأرصدة السابقة أو اتفاقيات العمل الأفضل.' },
  { id: 'SA-LAB-EOSB', category: 'end_of_service', titleAr: 'مكافأة نهاية الخدمة', status: 'estimate_only', effectiveFrom: EFFECTIVE_LABOR_LAW, sourceIds: ['hrsd-end-of-service'], descriptionAr: 'نصف أجر شهر عن كل سنة من السنوات الخمس الأولى، وأجر شهر عن كل سنة تالية، على أساس الأجر الأخير، مع التناسب لجزء السنة. الاستقالة والاستثناءات القانونية تحتاج بيانات وقراراً منفصلين.' },
  { id: 'SA-GOSI-LEGACY', category: 'social_insurance', titleAr: 'التأمينات للفئات المستمرة على النظام السابق', status: 'manual_scheme_confirmation', effectiveFrom: '2001-04-29', sourceIds: ['gosi-old-members'], descriptionAr: 'للسعودي: المعاشات 9% على الموظف و9% على صاحب العمل، وساند 1% لكل طرف، والأخطار المهنية 2% على صاحب العمل. يجب تأكيد أهلية المشترك وأجر الاشتراك من ملف التأمينات.' },
  { id: 'SA-GOSI-NEW', category: 'social_insurance', titleAr: 'التأمينات للمشمولين بالنظام الجديد', status: 'manual_scheme_confirmation', effectiveFrom: '2024-07-03', sourceIds: ['gosi-new-system', 'gosi-new-members'], descriptionAr: 'يقتصر على المشمولين الذين لا تنطبق عليهم مدد الاشتراك المستثناة. فرع المعاشات يرتفع تدريجياً من 18% إجمالاً إلى 22% إجمالاً، مناصفة بين الطرفين؛ وفي 2026-11-10 المعدل 20% إجمالاً (10% لكل طرف). ساند 0.75% لكل طرف، والأخطار المهنية 2% على صاحب العمل.' },
  { id: 'SA-GOSI-OCCUPATIONAL', category: 'social_insurance', titleAr: 'الأخطار المهنية لغير السعودي', status: 'estimate_only', effectiveFrom: null, sourceIds: ['gosi-old-members'], descriptionAr: 'نسبة الأخطار المهنية 2% على صاحب العمل بحسب الأجر المسجل. تعامل مواطنو الخليج يدوياً وفق مد الحماية التأمينية.' },
  { id: 'SA-GOSI-GCC-FOREIGN', category: 'social_insurance', titleAr: 'مواطنو الخليج وغير السعوديين', status: 'manual_review_required', effectiveFrom: null, sourceIds: ['gosi-old-members', 'gosi-new-system'], descriptionAr: 'لا يطبق عليهم تقدير سعودي افتراضي؛ قواعد مد الحماية التأمينية أو الاتفاقيات والفئات المهنية تحتاج مراجعة حسب الجنسية والتسجيل الفعلي.' },
  { id: 'SA-LAB-OVERTIME', category: 'overtime', titleAr: 'العمل الإضافي', status: 'reference_only', effectiveFrom: EFFECTIVE_LABOR_LAW, sourceIds: ['hrsd-labor-law'], descriptionAr: 'التعويض عن الساعة الإضافية يعادل أجر الساعة مضافاً إليه 50% من الأجر الأساسي للساعة. يلزم تحديد ساعات العمل القانونية وفئة العامل وأجر الساعة قبل الاحتساب.' },
];

function validDate(value) { if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T00:00:00Z`);return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value; }
function serviceYears(startDate, endDate) {
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) throw Object.assign(new Error('Enter valid service dates'), { status: 422 });
  const start=new Date(`${startDate}T00:00:00Z`),end=new Date(`${endDate}T00:00:00Z`);
  const anniversary=(year)=>new Date(Date.UTC(year,start.getUTCMonth(),Math.min(start.getUTCDate(),new Date(Date.UTC(year,start.getUTCMonth()+1,0)).getUTCDate())));
  let fullYears=end.getUTCFullYear()-start.getUTCFullYear();
  if(anniversary(start.getUTCFullYear()+fullYears)>end)fullYears--;
  const completed=anniversary(start.getUTCFullYear()+fullYears),next=anniversary(start.getUTCFullYear()+fullYears+1);
  return fullYears+(end-completed)/(next-completed);
}

function estimateEndOfService({ startDate, endDate, lastMonthlyWage, terminationReason = 'employer' }) {
  const years = serviceYears(startDate, endDate);
  const wage = Number(lastMonthlyWage);
  if (!Number.isFinite(wage) || wage < 0 || wage > 1_000_000_000) throw Object.assign(new Error('Enter a valid last monthly wage'), { status: 422 });
  let amount = wage * (Math.min(years, 5) * 0.5 + Math.max(0, years - 5));
  if (terminationReason === 'resignation') {
    const ratio = years < 2 ? 0 : years <= 5 ? 1 / 3 : years < 10 ? 2 / 3 : 1;
    amount *= ratio;
  } else if (terminationReason !== 'employer') {
    throw Object.assign(new Error('This termination scenario requires legal review'), { status: 422 });
  }
  return { estimate: Math.round(amount * 100) / 100, serviceYears: Math.round(years * 10000) / 10000, terminationReason, requiresHumanReview: true, ruleId: 'SA-LAB-EOSB' };
}

function minimumAnnualLeave({ startDate, asOf }) {
  const years=serviceYears(startDate,asOf);
  return { minimumAnnualDays:years>=5?30:21,serviceYears:Math.round(years*10000)/10000,ruleId:'SA-LAB-ANNUAL-LEAVE',requiresHumanReview:true };
}

function estimateOvertime({ hourlyWage, basicHourlyWage, overtimeHours }) {
  const total=Number(hourlyWage),basic=Number(basicHourlyWage),hours=Number(overtimeHours);
  if(!Number.isFinite(total)||!Number.isFinite(basic)||!Number.isFinite(hours)||total<0||basic<0||hours<0||hours>744||total>1_000_000||basic>1_000_000)throw Object.assign(new Error('Enter valid hourly wages and overtime hours'),{status:422});
  const amount=(total+basic*0.5)*hours;
  return { estimate:Math.round(amount*100)/100,overtimeHours:hours,ruleId:'SA-LAB-OVERTIME',requiresHumanReview:true };
}

function estimateSocialInsurance({ nationality, confirmedGosiScheme, gosiCoveredMonthlyWage, payrollDate }) {
  if (!validDate(payrollDate)) throw Object.assign(new Error('Enter a valid payroll date'), { status: 422 });
  if (!['saudi', 'non_saudi', 'gcc'].includes(nationality)) {
    return { available: false, reason: 'GOSI_MEMBERSHIP_CONFIRMATION_REQUIRED', requiresHumanReview: true };
  }
  const wage = Number(gosiCoveredMonthlyWage);
  if (!Number.isFinite(wage) || wage < 0 || wage > 1_000_000_000) throw Object.assign(new Error('Enter the GOSI covered wage from the official member record'), { status: 422 });
  if(nationality==='gcc')return { available:false,reason:'GCC_EXTENSION_REQUIRES_MANUAL_REVIEW',requiresHumanReview:true };
  if(nationality==='non_saudi')return { available:true,scheme:'occupational_hazards_only',payrollDate,coveredWage:wage,rates:{employeePension:0,employerPension:0,employeeUnemployment:0,employerUnemployment:0,employerOccupationalHazards:0.02},employeeContribution:0,employerContribution:Math.round(wage*0.02*100)/100,requiresHumanReview:true,ruleId:'SA-GOSI-OCCUPATIONAL' };
  if(!['legacy','new'].includes(confirmedGosiScheme))return { available:false,reason:'GOSI_MEMBERSHIP_CONFIRMATION_REQUIRED',requiresHumanReview:true };
  let pensionRate = 0.09;
  if (confirmedGosiScheme === 'new') {
    if (payrollDate < '2025-07-01') pensionRate = 0.09;
    else if (payrollDate < '2026-07-01') pensionRate = 0.095;
    else if (payrollDate < '2027-07-01') pensionRate = 0.10;
    else if (payrollDate < '2028-07-01') pensionRate = 0.105;
    else pensionRate = 0.11;
  }
  const unemploymentRate = confirmedGosiScheme === 'new' ? 0.0075 : 0.01;
  const employee = wage * (pensionRate + unemploymentRate);
  const employer = wage * (pensionRate + unemploymentRate + 0.02);
  return {
    available: true,
    scheme: confirmedGosiScheme,
    payrollDate,
    coveredWage: wage,
    rates: { employeePension: pensionRate, employerPension: pensionRate, employeeUnemployment: unemploymentRate, employerUnemployment: unemploymentRate, employerOccupationalHazards: 0.02 },
    employeeContribution: Math.round(employee * 100) / 100,
    employerContribution: Math.round(employer * 100) / 100,
    requiresHumanReview: true,
    ruleId: confirmedGosiScheme === 'new' ? 'SA-GOSI-NEW' : 'SA-GOSI-LEGACY',
  };
}

module.exports = { rules, sources, minimumAnnualLeave, estimateEndOfService, estimateOvertime, estimateSocialInsurance };
