// /lib/agents/agentRouter.js
// Smart routing to determine which agent should handle a query

export function detectAgentType(query, lang = 'ar') {
  const q = query.toLowerCase().trim();
  const isAr = lang === 'ar';
  
  // Medical keywords
  const medicalKeywords = isAr 
    ? ['مرض', 'علاج', 'دواء', 'تشخيص', 'أعراض', 'فحص', 'تحليل', 'جراحة', 'طبيب', 'مريض', 'صحة', 'سرطان', 'قلب', 'ضغط', 'سكر', 'كولسترول', 'ألم', 'التهاب', 'عدوى', 'حساسية']
    : ['disease', 'treatment', 'drug', 'medication', 'diagnosis', 'symptom', 'test', 'surgery', 'doctor', 'patient', 'health', 'cancer', 'heart', 'blood pressure', 'diabetes', 'cholesterol', 'pain', 'infection', 'allergy', 'medical'];
  
  // Financial keywords
  const financialKeywords = isAr
    ? ['مال', 'ميزانية', 'تكلفة', 'سعر', 'فاتورة', 'دفع', 'إيراد', 'ربح', 'خسارة', 'حساب', 'مصروف', 'دخل', 'ميزان', 'مالي']
    : ['money', 'budget', 'cost', 'price', 'invoice', 'payment', 'revenue', 'profit', 'loss', 'account', 'expense', 'income', 'balance', 'financial'];
  
  // Count matches
  const medicalScore = medicalKeywords.filter(kw => q.includes(kw)).length;
  const financialScore = financialKeywords.filter(kw => q.includes(kw)).length;
  
  // Determine agent type
  if (medicalScore > financialScore && medicalScore > 0) {
    return 'medical';
  } else if (financialScore > 0) {
    return 'financial';
  }
  
  // Default to general/medical for ambiguous queries
  return 'medical';
}

export function getAgentForQuery(query, lang = 'ar') {
  const agentType = detectAgentType(query, lang);
  
  return {
    type: agentType,
    query,
    lang,
  };
}

















