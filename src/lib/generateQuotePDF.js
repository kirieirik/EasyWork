import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate a professional PDF quote in A4 format
 * @param {Object} quote - The quote data
 * @param {Array} lines - Quote lines/items
 * @param {Object} organization - Organization data
 * @param {Object} profile - User profile (quote creator)
 * @param {Object} customer - Customer data
 */
export async function generateQuotePDF(quote, lines, organization, profile, customer) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Professional color palette
  const darkColor = [17, 24, 39];
  const textColor = [31, 41, 55];
  const mutedColor = [107, 114, 128];
  const lightBg = [249, 250, 251];

  // Helper functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nb-NO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0) + ' kr';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // ==========================================
  // HEADER - Organization + TILBUD on same line
  // ==========================================
  
  // Organization name (left)
  doc.setTextColor(...darkColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(organization?.name || 'Firma', margin, yPos + 2);

  // TILBUD title + number (right)
  doc.setFontSize(20);
  doc.text('TILBUD', pageWidth - margin, yPos + 2, { align: 'right' });
  
  yPos += 6;
  
  // Organization details (left) + Quote number/date (right)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  
  const orgLine = [
    organization?.address,
    organization?.postal_code && organization?.city ? `${organization.postal_code} ${organization.city}` : null,
    organization?.org_number ? `Org.nr: ${organization.org_number}` : null,
  ].filter(Boolean).join(' • ');
  
  doc.text(orgLine, margin, yPos + 2);
  
  // Quote meta (right side)
  doc.text(`#${quote.quote_number} • ${formatDate(quote.created_at)}`, pageWidth - margin, yPos + 2, { align: 'right' });

  yPos += 8;

  // Divider
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 8;

  // ==========================================
  // TWO COLUMN: Customer & Quote Details (compact)
  // ==========================================
  const colWidth = (pageWidth - margin * 2 - 15) / 2;
  const col1X = margin;
  const col2X = margin + colWidth + 15;

  // Left column - Customer info
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedColor);
  doc.text('TILBUD TIL', col1X, yPos);
  
  let custY = yPos + 5;
  
  if (customer) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text(customer.name || '-', col1X, custY);
    custY += 4;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    
    const custDetails = [
      customer.address,
      customer.postal_code || customer.city ? `${customer.postal_code || ''} ${customer.city || ''}`.trim() : null,
      customer.org_number ? `Org.nr: ${customer.org_number}` : null,
    ].filter(Boolean);
    
    custDetails.forEach(detail => {
      doc.text(detail, col1X, custY);
      custY += 3.5;
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.text('Ingen kunde valgt', col1X, custY);
    custY += 4;
  }

  // Right column - Quote details (compact)
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedColor);
  doc.text('DETALJER', col2X, yPos);

  let detY = yPos + 5;
  doc.setFontSize(8);
  
  const details = [
    ['Gyldig til:', formatDate(quote.valid_until)],
    ['Kontakt:', profile?.full_name || '-'],
    ['E-post:', organization?.email || '-'],
    ['Tlf:', organization?.phone || '-'],
  ];

  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(label, col2X, detY);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(value, col2X + 25, detY);
    detY += 3.5;
  });

  yPos = Math.max(custY, detY) + 6;

  // ==========================================
  // DESCRIPTION (if exists) - compact
  // ==========================================
  if (quote.description) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedColor);
    doc.text('BESKRIVELSE', margin, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    
    const splitDescription = doc.splitTextToSize(quote.description, pageWidth - margin * 2);
    doc.text(splitDescription, margin, yPos);
    yPos += splitDescription.length * 4 + 5;
  }

  // ==========================================
  // QUOTE LINES TABLE
  // ==========================================
  
  // Prepare table data
  const tableData = lines.map(line => [
    line.description || '-',
    (line.quantity || 1).toString(),
    line.unit_name || 'stk',
    formatCurrency(line.unit_price),
    `${line.vat_rate || 25}%`,
    formatCurrency((line.quantity || 1) * (line.unit_price || 0))
  ]);

  doc.autoTable({
    startY: yPos,
    head: [['Beskrivelse', 'Ant.', 'Enhet', 'Pris', 'MVA', 'Sum']],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      textColor: textColor,
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: mutedColor,
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 14, halign: 'center' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.setTextColor(...mutedColor);
      doc.text(
        `Side ${doc.internal.getCurrentPageInfo().pageNumber}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    }
  });

  yPos = doc.lastAutoTable.finalY + 8;

  // ==========================================
  // TOTALS - Compact, right aligned
  // ==========================================
  const totalsWidth = 70;
  const totalsX = pageWidth - margin - totalsWidth;
  
  doc.setFillColor(...lightBg);
  doc.roundedRect(totalsX, yPos, totalsWidth, 32, 2, 2, 'F');

  let totY = yPos + 7;
  
  // Subtotal
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Sum eks. mva', totalsX + 5, totY);
  doc.setTextColor(...textColor);
  doc.text(formatCurrency(quote.subtotal), totalsX + totalsWidth - 5, totY, { align: 'right' });

  totY += 5;

  // VAT
  doc.setTextColor(...mutedColor);
  doc.text('MVA', totalsX + 5, totY);
  doc.setTextColor(...textColor);
  doc.text(formatCurrency(quote.vat_amount), totalsX + totalsWidth - 5, totY, { align: 'right' });

  totY += 4;
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.2);
  doc.line(totalsX + 5, totY, totalsX + totalsWidth - 5, totY);

  totY += 6;

  // Total
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Totalt', totalsX + 5, totY);
  doc.text(formatCurrency(quote.total), totalsX + totalsWidth - 5, totY, { align: 'right' });

  yPos += 42;

  // ==========================================
  // TERMS - Compact
  // ==========================================
  if (yPos < pageHeight - 40) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedColor);
    doc.text('VILKÅR', margin, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    
    const terms = quote.terms || quote.notes || 'Tilbudet er gyldig i 30 dager. Betaling: 14 dager netto.';
    const splitTerms = doc.splitTextToSize(terms, pageWidth - margin * 2);
    doc.text(splitTerms, margin, yPos);
  }

  // ==========================================
  // FOOTER
  // ==========================================
  const footerY = pageHeight - 10;
  
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
  
  doc.setFontSize(7);
  doc.setTextColor(...mutedColor);
  
  const footerText = [organization?.name, organization?.email, organization?.phone].filter(Boolean).join('  •  ');
  doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });

  // ==========================================
  // DOWNLOAD
  // ==========================================
  const fileName = `Tilbud-${quote.quote_number}-${quote.title?.replace(/[^a-zA-Z0-9æøåÆØÅ ]/g, '').replace(/\s+/g, '_') || 'tilbud'}.pdf`;
  doc.save(fileName);
}

/**
 * Generate PDF as base64 for email attachment
 */
export async function generateQuotePDFBase64(quote, lines, organization, profile, customer) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  const darkColor = [17, 24, 39];
  const textColor = [31, 41, 55];
  const mutedColor = [107, 114, 128];
  const lightBg = [249, 250, 251];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nb-NO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0) + ' kr';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Header
  doc.setTextColor(...darkColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(organization?.name || 'Firma', margin, yPos + 2);

  doc.setFontSize(20);
  doc.text('TILBUD', pageWidth - margin, yPos + 2, { align: 'right' });
  
  yPos += 6;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  
  const orgLine = [
    organization?.address,
    organization?.postal_code && organization?.city ? `${organization.postal_code} ${organization.city}` : null,
    organization?.org_number ? `Org.nr: ${organization.org_number}` : null,
  ].filter(Boolean).join(' • ');
  
  doc.text(orgLine, margin, yPos + 2);
  doc.text(`#${quote.quote_number} • ${formatDate(quote.created_at)}`, pageWidth - margin, yPos + 2, { align: 'right' });

  yPos += 8;

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 8;

  const colWidth = (pageWidth - margin * 2 - 15) / 2;
  const col1X = margin;
  const col2X = margin + colWidth + 15;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedColor);
  doc.text('TILBUD TIL', col1X, yPos);
  
  let custY = yPos + 5;
  
  if (customer) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text(customer.name || '-', col1X, custY);
    custY += 4;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    
    const custDetails = [
      customer.address,
      customer.postal_code || customer.city ? `${customer.postal_code || ''} ${customer.city || ''}`.trim() : null,
      customer.org_number ? `Org.nr: ${customer.org_number}` : null,
    ].filter(Boolean);
    
    custDetails.forEach(detail => {
      doc.text(detail, col1X, custY);
      custY += 3.5;
    });
  }

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedColor);
  doc.text('DETALJER', col2X, yPos);

  let detY = yPos + 5;
  doc.setFontSize(8);
  
  const details = [
    ['Gyldig til:', formatDate(quote.valid_until)],
    ['Kontakt:', profile?.full_name || '-'],
    ['E-post:', organization?.email || '-'],
    ['Tlf:', organization?.phone || '-'],
  ];

  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(label, col2X, detY);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(value, col2X + 25, detY);
    detY += 3.5;
  });

  yPos = Math.max(custY, detY) + 6;

  if (quote.description) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedColor);
    doc.text('BESKRIVELSE', margin, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    
    const splitDescription = doc.splitTextToSize(quote.description, pageWidth - margin * 2);
    doc.text(splitDescription, margin, yPos);
    yPos += splitDescription.length * 4 + 5;
  }

  const tableData = lines.map(line => [
    line.description || '-',
    (line.quantity || 1).toString(),
    line.unit_name || 'stk',
    formatCurrency(line.unit_price),
    `${line.vat_rate || 25}%`,
    formatCurrency((line.quantity || 1) * (line.unit_price || 0))
  ]);

  doc.autoTable({
    startY: yPos,
    head: [['Beskrivelse', 'Ant.', 'Enhet', 'Pris', 'MVA', 'Sum']],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      textColor: textColor,
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: mutedColor,
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 14, halign: 'center' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  yPos = doc.lastAutoTable.finalY + 8;

  const totalsWidth = 70;
  const totalsX = pageWidth - margin - totalsWidth;
  
  doc.setFillColor(...lightBg);
  doc.roundedRect(totalsX, yPos, totalsWidth, 32, 2, 2, 'F');

  let totY = yPos + 7;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Sum eks. mva', totalsX + 5, totY);
  doc.setTextColor(...textColor);
  doc.text(formatCurrency(quote.subtotal), totalsX + totalsWidth - 5, totY, { align: 'right' });

  totY += 5;

  doc.setTextColor(...mutedColor);
  doc.text('MVA', totalsX + 5, totY);
  doc.setTextColor(...textColor);
  doc.text(formatCurrency(quote.vat_amount), totalsX + totalsWidth - 5, totY, { align: 'right' });

  totY += 4;
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.2);
  doc.line(totalsX + 5, totY, totalsX + totalsWidth - 5, totY);

  totY += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Totalt', totalsX + 5, totY);
  doc.text(formatCurrency(quote.total), totalsX + totalsWidth - 5, totY, { align: 'right' });

  yPos += 42;

  if (yPos < pageHeight - 40) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedColor);
    doc.text('VILKÅR', margin, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    
    const terms = quote.terms || quote.notes || 'Tilbudet er gyldig i 30 dager. Betaling: 14 dager netto.';
    const splitTerms = doc.splitTextToSize(terms, pageWidth - margin * 2);
    doc.text(splitTerms, margin, yPos);
  }

  const footerY = pageHeight - 10;
  
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
  
  doc.setFontSize(7);
  doc.setTextColor(...mutedColor);
  
  const footerText = [organization?.name, organization?.email, organization?.phone].filter(Boolean).join('  •  ');
  doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });

  // Return as base64
  return doc.output('datauristring').split(',')[1];
}
