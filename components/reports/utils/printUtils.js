/**
 * printUtils.js — generic printing helpers for reports
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Prints a given HTML element (for reports or invoices)
 * @param {string} elementId - The ID of the HTML element to print
 * @param {object} options
 * @param {string} options.title - Document title
 * @param {boolean} options.landscape - Print in landscape mode (default false)
 */
export async function printElement(elementId, { title = 'Report', landscape = false } = {}) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert('Element not found for printing.');
    return;
  }

  const canvas = await html2canvas(element, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let y = 0;
  while (y < imgHeight) {
    pdf.addImage(imgData, 'PNG', 0, -y, imgWidth, imgHeight);
    if (y + pageHeight < imgHeight) pdf.addPage();
    y += pageHeight;
  }

  pdf.save(`${title}.pdf`);
}

/**
 * Simple HTML print function (opens browser print dialog)
 * @param {string} elementId
 */
export function printDirect(elementId) {
  const printContent = document.getElementById(elementId);
  if (!printContent) {
    alert('Nothing to print.');
    return;
  }
  const win = window.open('', '', 'height=800,width=900');
  win.document.write('<html><head><title>Print</title>');
  win.document.write('<link rel="stylesheet" href="/print.css" />');
  win.document.write('</head><body>');
  win.document.write(printContent.innerHTML);
  win.document.write('</body></html>');
  win.document.close();
  win.print();
}

/**
 * Exports report data to JSON for debugging or saving
 * @param {string} fileName
 * @param {object} data
 */
export function exportJSON(fileName, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
  link.click();
}
