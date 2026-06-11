import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateInvoice(booking, returnBuffer = false) {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });

  if (returnBuffer) {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {});
    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      buildInvoice(doc, booking);
      doc.end();
    });
  }

  const invoicesDir = path.join(__dirname, '..', 'invoices');
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const filename = `invoice-${booking.invoiceNumber || booking._id}.pdf`;
  const filepath = path.join(invoicesDir, filename);

  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filepath);
    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
    doc.pipe(stream);
    buildInvoice(doc, booking);
    doc.end();
  });
}

function buildInvoice(doc, booking) {
  const prop = booking.property || {};
  const user = booking.user || {};
  const nights = Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24));
  const nightlyRate = prop.price || 0;
  const subtotal = nightlyRate * nights;
  const cleaningFee = prop.cleaningFee || 0;
  const serviceFee = booking.serviceFee || 0;
  const total = booking.totalAmount || 0;
  const invoiceNo = booking.invoiceNumber || booking._id.toString().slice(-8).toUpperCase();
  const paidAt = booking.paidAt ? new Date(booking.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
  const checkInStr = new Date(booking.checkIn).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
  const checkOutStr = new Date(booking.checkOut).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });

  const pageWidth = doc.page.width - 96;

  doc.font('Helvetica-Bold').fontSize(26).fillColor('#1e293b').text('INVOICE', 48, 48);

  doc.fontSize(10).fillColor('#64748b').text('Payment Receipt', 48, 78);

  doc.fontSize(9).fillColor('#94a3b8').text(`Invoice #: ${invoiceNo}`, { continued: false });
  doc.text(`Date Paid: ${paidAt}`);

  doc.moveDown(1.5);

  const lineY = doc.y;
  doc.moveTo(48, lineY).lineTo(pageWidth + 48, lineY).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.moveDown(1);

  const leftX = 48;
  const rightX = pageWidth / 2 + 48;

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b').text('BILL TO', leftX, doc.y);
  doc.font('Helvetica').fontSize(10).fillColor('#475569');
  const nameY = doc.y;
  doc.text(user.name || 'Guest', leftX, nameY + 16);
  doc.text(user.email || '', leftX);

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b').text('PROPERTY', rightX, nameY - 16);
  doc.font('Helvetica').fontSize(10).fillColor('#475569');
  doc.text(prop.name || 'Property', rightX);
  doc.text([prop.city, prop.country].filter(Boolean).join(', ') || '');

  doc.moveDown(2);
  const tableTop = doc.y;

  doc.moveTo(48, tableTop).lineTo(pageWidth + 48, tableTop).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.moveDown(0.5);

  const col1 = 48;
  const col2 = pageWidth * 0.55 + 48;
  const col3 = pageWidth * 0.75 + 48;
  const col4 = pageWidth + 48;

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b');
  doc.text('DESCRIPTION', col1, doc.y, { width: col2 - col1 });
  doc.text('QTY', col2, doc.y - 12, { width: col3 - col2, align: 'center' });
  doc.text('RATE', col3, doc.y - 12, { width: col4 - col3 - 48, align: 'right' });

  doc.moveDown(0.3);
  const headerBottom = doc.y;
  doc.moveTo(48, headerBottom).lineTo(pageWidth + 48, headerBottom).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.moveDown(0.8);

  doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
  const row1Y = doc.y;
  doc.text(`${prop.name || 'Stay'} (${checkInStr} - ${checkOutStr})`, col1, row1Y, { width: col2 - col1 });
  doc.text(`${nights}`, col2, row1Y, { width: col3 - col2, align: 'center' });
  doc.text(`$${nightlyRate.toFixed(2)}`, col3, row1Y, { width: col4 - col3 - 48, align: 'right' });

  doc.moveDown(1.2);
  const row2Y = doc.y;
  doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
  doc.text('Cleaning Fee', col1, row2Y, { width: col2 - col1 });
  doc.text('1', col2, row2Y, { width: col3 - col2, align: 'center' });
  doc.text(`$${cleaningFee.toFixed(2)}`, col3, row2Y, { width: col4 - col3 - 48, align: 'right' });

  doc.moveDown(1.2);
  const row3Y = doc.y;
  doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
  doc.text('Service Fee', col1, row3Y, { width: col2 - col1 });
  doc.text('1', col2, row3Y, { width: col3 - col2, align: 'center' });
  doc.text(`$${serviceFee.toFixed(2)}`, col3, row3Y, { width: col4 - col3 - 48, align: 'right' });

  doc.moveDown(1.5);
  const totalLineY = doc.y;
  doc.moveTo(48, totalLineY).lineTo(pageWidth + 48, totalLineY).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e293b');
  doc.text('TOTAL', col1, doc.y, { width: col2 - col1 });
  doc.text(`$${total.toFixed(2)}`, col2, doc.y - 16, { width: col4 - col2, align: 'right' });

  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#10b981');
  doc.text('PAID', col1, doc.y);

  doc.moveDown(3);
  const footerY = doc.y;
  doc.moveTo(48, footerY).lineTo(pageWidth + 48, footerY).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
  doc.text('HollyBnB — Holiday Booking Platform', 48, doc.y, { align: 'center' });
  doc.text('Thank you for your booking!', 48, doc.y, { align: 'center' });

  return doc;
}
