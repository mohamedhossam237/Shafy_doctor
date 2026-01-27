// /lib/agents/financialAgent.js
// Financial AI Agent for clinic management, billing, and financial questions

export function getFinancialAgentSystemPrompt(lang = 'ar') {
  const isAr = lang === 'ar';
  
  return isAr ? `
أنت مساعد مالي ذكي متخصص في إدارة العيادات الطبية والشؤون المالية في مصر.

السياق المصري:
• جميع العيادات في مصر
• جميع الأسعار والتكاليف بالجنيه المصري (EGP)
• النظام الضريبي المصري
• القوانين واللوائح المصرية المتعلقة بالعيادات الطبية
• الممارسات المالية الشائعة في السوق المصري

تخصصك:
• إدارة الحسابات المالية للعيادات المصرية
• حساب التكاليف والأرباح بالجنيه المصري
• إدارة الفواتير والمدفوعات
• تحليل الأداء المالي
• نصائح لتحسين الإيرادات في السوق المصري
• إدارة المواعيد من الناحية المالية
• فهم التكاليف التشغيلية للعيادات في مصر

قواعد صارمة جداً (يجب الالتزام بها تماماً):
• ممنوع تماماً - لا تخترع: لا تخترع أو تتخيل أو تضيف أي بيانات مالية غير موجودة في البيانات المرفقة. لا تضيف أرقام، حسابات، تفاصيل عن فحوصات، حقن، أدوية، أو خدمات إضافية غير موجودة في البيانات المرفقة.
• ممنوع استخدام بيانات من مستخدمين آخرين: البيانات المرفقة خاصة بهذا الطبيب فقط. لا تستخدم معلومات من طبيب آخر أو عيادة أخرى. لا تخترع بيانات بناءً على أمثلة عامة.
• استخدم فقط البيانات المتاحة: استخدم فقط الأرقام والبيانات الموجودة في "البيانات المالية" المرفقة أدناه. إذا لم تكن البيانات متاحة، قل بوضوح "البيانات غير متاحة" أو "لا توجد بيانات متاحة" بدلاً من اختراعها.
• قدم معلومات عملية وقابلة للتطبيق في السياق المصري - فقط بناءً على البيانات المرفقة
• استخدم البيانات المالية المتاحة من العيادة (عدد الكشوفات، إعادة الكشف، الإيرادات) - فقط من "البيانات المالية" المرفقة
• احسب الإيرادات بناءً على عدد الكشوفات (كشف واعادة كشف) والأسعار المحددة - فقط من البيانات المرفقة
• قدم تحليلات واضحة ومفصلة مع تفصيل الكشوفات حسب النوع - فقط بناءً على البيانات المرفقة
• اقترح حلول عملية لتحسين الأداء المالي - فقط بناءً على البيانات المرفقة
• استخدم الجنيه المصري في جميع الحسابات والأسعار
• عند الإجابة على أسئلة مالية، استخدم البيانات المالية المرفقة مباشرة - لا تستخدم بيانات من خارج "البيانات المالية" المرفقة
• مهم جداً: يجب أن تكون إجابتك موجزة - بحد أقصى 300 كلمة. كن مباشراً ومختصراً.
• التركيز على السؤال: أجب مباشرة على السؤال المطروح. لا تخرج عن الموضوع ولا تضيف معلومات غير ذات صلة. ركز على الإجابة على السؤال فقط.
• تذكر: لا تضيف أرقام أو حسابات غير موجودة في "البيانات المالية" المرفقة. لا تخترع تفاصيل عن فحوصات، حقن، أدوية، أو خدمات إضافية. إذا لم تكن البيانات متاحة، قل "البيانات غير متاحة" بوضوح.
`.trim() : `
You are an intelligent financial assistant specialized in clinic management and financial matters in Egypt.

Egyptian Context:
• All clinics are in Egypt
• All prices and costs in Egyptian Pounds (EGP)
• Egyptian tax system
• Egyptian laws and regulations related to medical clinics
• Common financial practices in the Egyptian market

Your expertise:
• Managing financial accounts for Egyptian clinics
• Calculating costs and profits in Egyptian Pounds
• Managing invoices and payments
• Financial performance analysis
• Tips to improve revenue in the Egyptian market
• Appointment management from financial perspective
• Understanding operational costs for clinics in Egypt

Rules (VERY STRICT - MUST FOLLOW):
• STRICTLY FORBIDDEN - NO INVENTION: Do not invent, fabricate, hallucinate, or add any financial data not present in the attached data. Do not add numbers, calculations, details about tests, injections, medications, or additional services not present in the attached data.
• FORBIDDEN - No data from other users: The attached data is specific to THIS doctor only. Do not use information from another doctor or clinic. Do not invent data based on general examples.
• Use only available data: Use ONLY numbers and data present in the "Financial Data" attached below. If data is not available, clearly say "Data not available" or "No data available" instead of making it up.
• Provide practical and applicable information in the Egyptian context - ONLY based on attached data
• Use available financial data from the clinic (number of checkups, follow-ups, revenues) - ONLY from "Financial Data" attached
• Calculate revenues based on number of checkups (checkup and follow-up) and specified prices - ONLY from attached data
• Provide clear and detailed analyses with breakdown by appointment type - ONLY based on attached data
• Suggest practical solutions to improve financial performance - ONLY based on attached data
• Use Egyptian Pounds (EGP) in all calculations and prices
• When answering financial questions, use the attached financial data directly - Do not use data from outside the "Financial Data" attached
• Very important: Your response must be concise - maximum 300 words. Be direct and brief.
• Focus on the question: Answer the question directly. Do not go off-topic or add irrelevant information. Focus only on answering the question.
• Remember: Do not add numbers or calculations not present in the "Financial Data" attached. Do not invent details about tests, injections, medications, or additional services. If data is not available, clearly say "Data not available".
`.trim();
}

export function analyzeFinancialData(clinicData, appointments, reports, lang = 'ar', doctorData = {}) {
  const isAr = lang === 'ar';
  const checkupPrice = Number(doctorData.checkupPrice || 0);
  const followUpPrice = Number(doctorData.followUpPrice || 0);
  const extraServices = Array.isArray(doctorData.extraServices) ? doctorData.extraServices : [];
  
  // Financial analysis with checkup vs follow-up breakdown
  const analysis = {
    totalAppointments: appointments.length,
    totalReports: reports.length,
    checkupCount: 0,
    followUpCount: 0,
    checkupRevenue: 0,
    followUpRevenue: 0,
    additionalFees: 0,
    totalRevenue: 0,
    completedCount: 0,
    confirmedCount: 0,
    pendingCount: 0,
    cancelledCount: 0,
    checkupPrice, // Store doctor's checkup price
    followUpPrice, // Store doctor's follow-up price
    extraServices, // Store doctor's extra services
    insights: [],
    breakdown: {},
  };
  
  // Analyze appointments by type and status
  appointments.forEach(apt => {
    const status = String(apt.status || 'pending').toLowerCase();
    const appointmentType = String(apt.appointmentType || 'checkup').toLowerCase();
    
    // Get price from appointment, or use doctor's default price based on type
    let basePrice = Number(apt.doctorPrice || apt.price || apt.fee || 0);
    
    // If no price in appointment, use doctor's default price
    if (basePrice === 0) {
      if (appointmentType === 'followup' || appointmentType === 'اعادة كشف' || appointmentType === 're-examination') {
        basePrice = followUpPrice;
      } else {
        basePrice = checkupPrice;
      }
    }
    
    const additionalFees = Number(apt.additionalFees || 0);
    const totalAmount = Number(apt.totalAmount || basePrice + additionalFees);
    
    // Count by status
    if (status === 'completed') {
      analysis.completedCount++;
    } else if (status === 'confirmed') {
      analysis.confirmedCount++;
    } else if (status === 'pending') {
      analysis.pendingCount++;
    } else if (status === 'cancelled') {
      analysis.cancelledCount++;
    }
    
    // Calculate revenue only for completed or confirmed appointments
    if (status === 'completed' || status === 'confirmed') {
      if (appointmentType === 'followup' || appointmentType === 'اعادة كشف' || appointmentType === 're-examination') {
        analysis.followUpCount++;
        analysis.followUpRevenue += totalAmount;
      } else {
        // Default to checkup
        analysis.checkupCount++;
        analysis.checkupRevenue += totalAmount;
      }
      analysis.additionalFees += additionalFees;
      analysis.totalRevenue += totalAmount;
    }
  });
  
  // Generate insights
  if (analysis.totalAppointments > 0) {
    const completionRate = analysis.completedCount / analysis.totalAppointments;
    
    if (completionRate < 0.7) {
      analysis.insights.push(
        isAr 
          ? 'معدل إتمام المواعيد أقل من المثالي. فكر في استراتيجيات المتابعة.'
          : 'Completion rate is below optimal. Consider follow-up strategies.'
      );
    }
    
    if (analysis.followUpCount > 0 && analysis.checkupCount > 0) {
      const followUpRatio = analysis.followUpCount / (analysis.checkupCount + analysis.followUpCount);
      if (followUpRatio > 0.5) {
        analysis.insights.push(
          isAr
            ? 'نسبة عالية من إعادة الكشف تشير إلى رضا المرضى ومتابعة جيدة.'
            : 'High follow-up ratio indicates patient satisfaction and good follow-up.'
        );
      }
    }
  }
  
  // Create breakdown summary
  analysis.breakdown = {
    checkup: {
      count: analysis.checkupCount,
      revenue: analysis.checkupRevenue,
      average: analysis.checkupCount > 0 ? analysis.checkupRevenue / analysis.checkupCount : 0,
    },
    followUp: {
      count: analysis.followUpCount,
      revenue: analysis.followUpRevenue,
      average: analysis.followUpCount > 0 ? analysis.followUpRevenue / analysis.followUpCount : 0,
    },
    additionalFees: analysis.additionalFees,
    totalRevenue: analysis.totalRevenue,
  };
  
  return analysis;
}

export function formatFinancialSummary(analysis, lang = 'ar', doctorData = {}) {
  const isAr = lang === 'ar';
  
  if (!analysis || analysis.totalAppointments === 0) {
    return isAr 
      ? 'لا توجد بيانات مالية متاحة'
      : 'No financial data available';
  }
  
  const checkupPrice = analysis.checkupPrice || Number(doctorData.checkupPrice || 0);
  const followUpPrice = analysis.followUpPrice || Number(doctorData.followUpPrice || 0);
  const extraServices = analysis.extraServices || (Array.isArray(doctorData.extraServices) ? doctorData.extraServices : []);
  
  const lines = [];
  
  lines.push(isAr ? 'البيانات المالية للطبيب:' : 'Doctor Financial Data:');
  
  // Show doctor's configured prices
  if (checkupPrice > 0 || followUpPrice > 0) {
    lines.push(`- ${isAr ? 'أسعار الكشوفات المحددة' : 'Configured Appointment Prices'}:`);
    if (checkupPrice > 0) {
      lines.push(`  • ${isAr ? 'سعر الكشف' : 'Checkup Price'}: ${checkupPrice.toFixed(2)} ${isAr ? 'جنيه' : 'EGP'}`);
    }
    if (followUpPrice > 0) {
      lines.push(`  • ${isAr ? 'سعر إعادة الكشف' : 'Follow-up Price'}: ${followUpPrice.toFixed(2)} ${isAr ? 'جنيه' : 'EGP'}`);
    }
    lines.push('');
  }
  
  // Show extra services if available
  if (extraServices.length > 0) {
    lines.push(`- ${isAr ? 'الخدمات الإضافية المتاحة' : 'Available Extra Services'}:`);
    extraServices.forEach(svc => {
      const name = svc.name_ar || svc.name_en || svc.name || '';
      const price = Number(svc.price || 0);
      if (name && price > 0) {
        lines.push(`  • ${name}: ${price.toFixed(2)} ${isAr ? 'جنيه' : 'EGP'}`);
      }
    });
    lines.push('');
  }
  
  lines.push(`- ${isAr ? 'إجمالي المواعيد' : 'Total Appointments'}: ${analysis.totalAppointments}`);
  lines.push(`  • ${isAr ? 'كشف' : 'Checkup'}: ${analysis.checkupCount} ${analysis.checkupCount > 0 ? `(${analysis.checkupRevenue.toFixed(2)} ${isAr ? 'جنيه' : 'EGP'})` : ''}`);
  lines.push(`  • ${isAr ? 'إعادة كشف' : 'Follow-up'}: ${analysis.followUpCount} ${analysis.followUpCount > 0 ? `(${analysis.followUpRevenue.toFixed(2)} ${isAr ? 'جنيه' : 'EGP'})` : ''}`);
  
  if (analysis.additionalFees > 0) {
    lines.push(`- ${isAr ? 'رسوم إضافية' : 'Additional Fees'}: ${analysis.additionalFees.toFixed(2)} ${isAr ? 'جنيه' : 'EGP'}`);
  }
  
  lines.push(`- ${isAr ? 'إجمالي الإيرادات' : 'Total Revenue'}: ${analysis.totalRevenue.toFixed(2)} ${isAr ? 'جنيه' : 'EGP'}`);
  lines.push(`- ${isAr ? 'الحالة' : 'Status'}: ${isAr ? 'مكتمل' : 'Completed'} ${analysis.completedCount}, ${isAr ? 'مؤكد' : 'Confirmed'} ${analysis.confirmedCount}, ${isAr ? 'معلق' : 'Pending'} ${analysis.pendingCount}`);
  
  // Show average prices if available
  if (analysis.checkupCount > 0 || analysis.followUpCount > 0) {
    lines.push('');
    lines.push(isAr ? 'المتوسطات:' : 'Averages:');
    if (analysis.checkupCount > 0) {
      const avg = analysis.checkupRevenue / analysis.checkupCount;
      lines.push(`  • ${isAr ? 'متوسط سعر الكشف' : 'Average Checkup Price'}: ${avg.toFixed(2)} ${isAr ? 'جنيه' : 'EGP'}`);
    }
    if (analysis.followUpCount > 0) {
      const avg = analysis.followUpRevenue / analysis.followUpCount;
      lines.push(`  • ${isAr ? 'متوسط سعر إعادة الكشف' : 'Average Follow-up Price'}: ${avg.toFixed(2)} ${isAr ? 'جنيه' : 'EGP'}`);
    }
  }
  
  if (analysis.insights.length > 0) {
    lines.push('');
    lines.push(isAr ? 'ملاحظات:' : 'Insights:');
    analysis.insights.forEach(insight => lines.push(`- ${insight}`));
  }
  
  return lines.join('\n');
}

