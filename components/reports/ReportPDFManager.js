'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import arabicReshaper from 'arabic-persian-reshaper';
import bidi from 'bidi-js';

export default class ReportPDFManager {
  constructor(t, isArabic = false) {
    this.t = t || ((en) => en);
    this.isArabic = isArabic;
  }

  async loadArabicFont(pdf) {
    try {
      const res = await fetch('/fonts/Amiri-Regular.ttf');
      const buffer = await res.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), '')
      );
      pdf.addFileToVFS('Amiri-Regular.ttf', base64);
      pdf.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
      pdf.setFont('Amiri');
      pdf.setFontSize(14);
      console.log('✅ Arabic font loaded');
    } catch (err) {
      console.error('⚠️ Failed to load Arabic font:', err);
      pdf.setFont('helvetica');
    }
  }

  // ✅ Proper mixed Arabic + English formatter
  formatMixed(text) {
    if (!text) return '';
    try {
      const parts = text.split(/([A-Za-z0-9@.\-_/():%]+)/g);
      return parts
        .map((part) => {
          if (/^[A-Za-z0-9@.\-_/():%]+$/.test(part)) return part; // English/numbers
          const reshaped = arabicReshaper(part);
          return bidi.getVisualString(reshaped, { reverseText: false });
        })
        .join('');
    } catch {
      return text;
    }
  }

  async generate(reportData) {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

    if (this.isArabic) await this.loadArabicFont(pdf);
    else pdf.setFont('helvetica');

    const rtl = this.isArabic;
    const margin = 15;
    let y = 25;
    const t = (en, ar) => (rtl ? ar : en);
    const fmt = (txt) => (rtl ? this.formatMixed(txt) : txt);

    if (rtl) {
      pdf.setR2L(true);
      pdf.setLanguage && pdf.setLanguage('ar');
      pdf.setTextDirection && pdf.setTextDirection('rtl');
    }

    // === Header / Title ===
    pdf.setFontSize(18);
    pdf.text(fmt(t('Clinical Report', 'تقرير سريري')), pdf.internal.pageSize.getWidth() / 2, y, {
      align: 'center',
    });
    y += 10;

    // === Patient Info ===
    pdf.setFontSize(13);
    const info = [
      [t('Patient Name', 'اسم المريض'), reportData.patientName],
      [t('Patient ID', 'رقم المريض'), reportData.patientID],
      [t('Diagnosis', 'التشخيص'), reportData.diagnosis],
      [t('Findings', 'النتائج'), reportData.findings],
      [t('Procedures', 'الإجراءات'), reportData.procedures],
    ];

    info.forEach(([label, value]) => {
      const line = `${fmt(label)} : ${fmt(value || '—')}`;
      pdf.text(line, rtl ? 200 - margin : margin, y, { align: rtl ? 'right' : 'left' });
      y += 8;
    });

    // === Vitals ===
    pdf.setFont(undefined, 'bold');
    pdf.text(fmt(t('Vitals', 'العلامات الحيوية')), rtl ? 200 - margin : margin, y, {
      align: rtl ? 'right' : 'left',
    });
    y += 6;
    pdf.setFont(undefined, 'normal');

    const vitalsLine = [
      `${fmt(t('BP', 'ضغط الدم'))}: ${fmt(reportData.vitals?.bp || '—')}`,
      `${fmt(t('HR', 'النبض'))}: ${fmt(reportData.vitals?.hr || '—')}`,
      `${fmt(t('Temp', 'الحرارة'))}: ${fmt(reportData.vitals?.temp || '—')}`,
      `${fmt(t('SpO₂', 'الأوكسجين'))}: ${fmt(reportData.vitals?.spo2 || '—')}`,
    ].join('    ');

    pdf.text(vitalsLine, rtl ? 200 - margin : margin, y, { align: rtl ? 'right' : 'left' });
    y += 10;

    // === Medications ===
    if (Array.isArray(reportData.medicationsList) && reportData.medicationsList.length) {
      pdf.setFont(undefined, 'bold');
      pdf.text(fmt(t('Medications', 'الأدوية')), rtl ? 200 - margin : margin, y, {
        align: rtl ? 'right' : 'left',
      });
      y += 5;

      autoTable(pdf, {
        startY: y,
        head: [
          rtl
            ? ['الدواء', 'الجرعة', 'عدد المرات', 'المدة', 'ملاحظات']
            : ['Medicine', 'Dose', 'Frequency', 'Duration', 'Notes'],
        ],
        body: reportData.medicationsList.map((m) =>
          rtl
            ? [
                fmt(m.name || '—'),
                fmt(m.dose || '—'),
                fmt(m.frequency || '—'),
                fmt(m.duration || '—'),
                fmt(m.notes || '—'),
              ]
            : [m.name || '—', m.dose || '—', m.frequency || '—', m.duration || '—', m.notes || '—']
        ),
        styles: {
          font: rtl ? 'Amiri' : 'helvetica',
          fontSize: 11,
          halign: rtl ? 'right' : 'left',
        },
        headStyles: {
          fillColor: [22, 105, 122],
          halign: rtl ? 'center' : 'left',
          font: rtl ? 'Amiri' : 'helvetica',
        },
      });

      y = pdf.lastAutoTable.finalY + 10;
    }

    // === Tests ===
    if (Array.isArray(reportData.testsList) && reportData.testsList.length) {
      pdf.setFont(undefined, 'bold');
      pdf.text(fmt(t('Tests', 'الفحوصات')), rtl ? 200 - margin : margin, y, {
        align: rtl ? 'right' : 'left',
      });
      y += 5;

      autoTable(pdf, {
        startY: y,
        head: [rtl ? ['الفحص', 'ملاحظات'] : ['Test', 'Notes']],
        body: reportData.testsList.map((tItem) =>
          rtl
            ? [fmt(tItem.name || '—'), fmt(tItem.notes || '—')]
            : [tItem.name || '—', tItem.notes || '—']
        ),
        styles: {
          font: rtl ? 'Amiri' : 'helvetica',
          fontSize: 11,
          halign: rtl ? 'right' : 'left',
        },
        headStyles: {
          fillColor: [122, 49, 49],
          halign: rtl ? 'center' : 'left',
          font: rtl ? 'Amiri' : 'helvetica',
        },
      });

      y = pdf.lastAutoTable.finalY + 10;
    }

    // === Footer ===
    pdf.setFont(undefined, 'bold');
    pdf.text(
      fmt(`${t('Consultation Fee', 'رسوم الكشف')}: ${reportData.fee ? reportData.fee + ' QAR' : '—'}`),
      rtl ? 200 - margin : margin,
      y,
      { align: rtl ? 'right' : 'left' }
    );

    pdf.setFont(undefined, 'italic');
    pdf.text(
      fmt(`${t('Generated on', 'تاريخ الإنشاء')}: ${new Date().toLocaleString('en-GB')}`),
      rtl ? 200 - margin : margin,
      y + 8,
      { align: rtl ? 'right' : 'left' }
    );

    return pdf;
  }

  async upload(pdf, reportId) {
    const blob = pdf.output('blob');
    const sRef = storageRef(storage, `reports/${reportId}.pdf`);
    await uploadBytes(sRef, blob);
    const url = await getDownloadURL(sRef);
    return url;
  }

  shareOnWhatsApp(patientName, diagnosis, number) {
    if (!number) return;
    const formatted = number.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(
      `${this.t('Hello, this is your medical report.', 'مرحبًا، هذا تقريرك الطبي.')}\n\n${this.t(
        'Patient Name',
        'اسم المريض'
      )}: ${patientName}\n${this.t('Diagnosis', 'التشخيص')}: ${diagnosis}`
    );
    window.open(`https://wa.me/2${formatted}?text=${msg}`, '_blank');
  }
}
