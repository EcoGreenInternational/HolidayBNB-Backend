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
  const nights = Math.max(Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)), 1);
  const nightlyRate = prop.price || 0;
  const subtotal = nightlyRate * nights;
  const cleaningFee = prop.cleaningFee || 0;
  const serviceFee = booking.serviceFee || 0;
  const total = booking.totalAmount || 0;
  const invoiceNo = booking.invoiceNumber || booking._id.toString().slice(-8).toUpperCase();
  const bookingId = booking._id.toString();
  const guests = (booking.guests?.adults || 0) + (booking.guests?.children || 0);
  const isPaid = booking.status === 'confirmed' || booking.status === 'completed';
  const paidAt = booking.paidAt
    ? new Date(booking.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const createdDate = new Date(booking.createdAt || booking.checkIn).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const checkInStr = new Date(booking.checkIn).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
  });
  const checkOutStr = new Date(booking.checkOut).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
  });

  const pw = doc.page.width - 96;
  const ml = 48;

  const green = '#059669';
  const greenLight = '#ecfdf5';
  const blue = '#2563eb';
  const blueLight = '#eff6ff';
  const textDark = '#1e293b';
  const textMuted = '#64748b';
  const borderColor = '#e2e8f0';
  const bgLight = '#f8fafc';

  // Top accent bar
  doc.rect(0, 0, doc.page.width, 4);
  doc.fill(green);

  // Header
  doc.y = 32;
  doc.font('Helvetica-Bold').fontSize(20).fillColor(textDark).text('INVOICE', ml, doc.y, { continued: false });
  doc.font('Helvetica').fontSize(9).fillColor(textMuted).text(`#${invoiceNo}`, ml, doc.y + 26);

  // Status badge
  const statusX = pw + ml - 90;
  if (isPaid) {
    doc.roundedRect(statusX, 32, 90, 26, 6);
    doc.fill(greenLight);
    doc.roundedRect(statusX, 32, 90, 26, 6);
    doc.lineWidth(1).stroke('#a7f3d0');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(green).text('PAID', statusX, 40, { align: 'center', width: 90 });
  } else {
    doc.roundedRect(statusX, 32, 90, 26, 6);
    doc.fill('#fff7ed');
    doc.roundedRect(statusX, 32, 90, 26, 6);
    doc.lineWidth(1).stroke('#fed7aa');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ea580c').text('PENDING', statusX, 40, { align: 'center', width: 90 });
  }

  // Date + Booking ID on right
  doc.font('Helvetica').fontSize(8).fillColor(textMuted);
  doc.text(`Date: ${createdDate}`, statusX, 64, { align: 'right', width: 90 });
  doc.text(`Booking: ${bookingId.slice(-8).toUpperCase()}`, statusX, 76, { align: 'right', width: 90 });

  // Divider
  const dividerY = 98;
  doc.moveTo(ml, dividerY).lineTo(pw + ml, dividerY).lineWidth(1).stroke(borderColor);
  doc.y = dividerY + 24;

  // BILL TO section
  const billY = doc.y;
  doc.font('Helvetica-Bold').fontSize(7).fillColor(textMuted);
  doc.text('BILL TO', ml, billY);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(textDark);
  doc.text(user.name || 'Guest', ml, billY + 14);
  doc.font('Helvetica').fontSize(9).fillColor(textMuted);
  doc.text(user.email || '', ml, billY + 32);
  if (user.phone) doc.text(user.phone, ml, billY + 46);

  // PROPERTY section
  const propX = ml + pw * 0.5;
  doc.font('Helvetica-Bold').fontSize(7).fillColor(textMuted);
  doc.text('PROPERTY', propX, billY);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(textDark);
  doc.text(prop.name || 'Property', propX, billY + 14);
  doc.font('Helvetica').fontSize(9).fillColor(textMuted);
  const propAddr = [prop.address, prop.city, prop.country].filter(Boolean).join(', ');
  doc.text(propAddr || '', propX, billY + 32);
  if (prop.propertyType) doc.text(`Type: ${prop.propertyType}`, propX, billY + 46);

  doc.y = Math.max(billY + 70, doc.y + 14);

  // Stay details row
  const stayY = doc.y;
  doc.rect(ml, stayY, pw, 44);
  doc.fill(bgLight);

  const cols = [
    { label: 'CHECK-IN', value: checkInStr },
    { label: 'CHECK-OUT', value: checkOutStr },
    { label: 'NIGHTS', value: `${nights}` },
    { label: 'GUESTS', value: `${guests}` },
  ];
  const colW = (pw - 32) / 4;
  cols.forEach((c, i) => {
    const cx = ml + 16 + i * (colW + 8);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(textMuted).text(c.label, cx, stayY + 8, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(blue).text(c.value, cx, stayY + 22, { lineBreak: false });
  });

  doc.y = stayY + 60;

  // Charges table
  const tableY = doc.y;
  const tH = 26;

  doc.rect(ml, tableY, pw, tH);
  doc.fill(green);

  doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff');
  doc.text('DESCRIPTION', ml + 14, tableY + 8, { lineBreak: false });
  doc.text('QTY', ml + pw * 0.55, tableY + 8, { align: 'center', lineBreak: false });
  doc.text('RATE', ml + pw * 0.70, tableY + 8, { align: 'right', lineBreak: false });
  doc.text('AMOUNT', ml + pw * 0.85, tableY + 8, { align: 'right', lineBreak: false });

  const rows = [
    { desc: `${prop.name || 'Accommodation'} — ${nights} night(s)`, qty: `${nights}`, rate: `$${nightlyRate.toFixed(2)}`, amt: `$${subtotal.toFixed(2)}` },
  ];
  if (cleaningFee > 0) rows.push({ desc: 'Cleaning Fee', qty: '1', rate: '—', amt: `$${cleaningFee.toFixed(2)}` });
  if (serviceFee > 0) rows.push({ desc: 'Service Fee', qty: '1', rate: '—', amt: `$${serviceFee.toFixed(2)}` });

  let rowY = tableY + tH;
  rows.forEach((r, i) => {
    const isAlt = i % 2 === 1;
    const rh = 26;
    if (isAlt) {
      doc.rect(ml, rowY, pw, rh);
      doc.fill(bgLight);
    }
    doc.font('Helvetica').fontSize(9).fillColor(textDark);
    doc.text(r.desc, ml + 14, rowY + 7, { width: pw * 0.50, lineBreak: false });
    doc.text(r.qty, ml + pw * 0.55, rowY + 7, { align: 'center', width: pw * 0.12, lineBreak: false });
    doc.text(r.rate, ml + pw * 0.70, rowY + 7, { align: 'right', width: pw * 0.12, lineBreak: false });
    doc.text(r.amt, ml + pw * 0.85, rowY + 7, { align: 'right', width: pw * 0.13, lineBreak: false });
    rowY += rh;
  });

  doc.moveTo(ml, rowY).lineTo(pw + ml, rowY).lineWidth(1).stroke(borderColor);

  doc.y = rowY + 18;

  // Total box
  const totalY = doc.y;
  const totalW = pw * 0.40;
  const totalX = pw + ml - totalW;

  doc.font('Helvetica').fontSize(9).fillColor(textMuted);
  doc.text('Subtotal', totalX, totalY, { width: totalW - 60, lineBreak: false });
  doc.text(`$${total.toFixed(2)}`, totalX + totalW - 80, totalY, { align: 'right', width: 80, lineBreak: false });

  doc.moveTo(totalX, totalY + 18).lineTo(totalX + totalW, totalY + 18).lineWidth(1).stroke(borderColor);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(blue);
  doc.text('TOTAL', totalX, totalY + 26, { width: totalW - 60, lineBreak: false });
  doc.text(`$${total.toFixed(2)}`, totalX + totalW - 80, totalY + 26, { align: 'right', width: 80, lineBreak: false });

  doc.y = totalY + 56;

  // Payment info
  const payY = doc.y;
  if (isPaid) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(green);
    doc.text('Payment completed', ml, payY);
    doc.font('Helvetica').fontSize(8).fillColor(textMuted);
    doc.text(paidAt || '', ml, payY + 14);
  } else {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ea580c');
    doc.text('Payment pending', ml, payY);
    doc.font('Helvetica').fontSize(8).fillColor(textMuted);
    doc.text('Awaiting payment confirmation', ml, payY + 14);
  }

  if (booking.stripeSessionId) {
    doc.font('Helvetica').fontSize(7).fillColor(textMuted);
    doc.text(`Session: ${booking.stripeSessionId}`, ml, payY + 30);
  }

  doc.y = payY + 56;

  // Footer
  doc.moveTo(ml, doc.y).lineTo(pw + ml, doc.y).lineWidth(1).stroke(borderColor);
  doc.y += 14;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(blue);
  doc.text('HOLIDAYBNB', ml, doc.y, { align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(textMuted);
  doc.text('support@holidaybnb.com  |  +94 11 234 5678  |  Colombo, Sri Lanka', ml, doc.y + 12, { align: 'center' });
  doc.font('Helvetica').fontSize(7).fillColor('#cbd5e1');
  doc.text('Thank you for choosing HolidayBNB', ml, doc.y + 26, { align: 'center' });

  return doc;
}
