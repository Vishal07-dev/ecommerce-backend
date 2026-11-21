import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { Order } from '../models/Order.js';
import { ownsOrder } from './account.controller.js';
import { summarizeOrder } from '../utils/order-summary.js';

/**
 * PDF receipt in KŌRA's own type and colours. Every figure comes from
 * summarizeOrder(), the same numbers the account page and Studio show:
 * line amounts are what was charged; subtotal + delivery = total.
 */

const FONTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');
const C = { ink: '#14110e', fg2: '#4a453d', fg3: '#7c766b', line: '#e4ddd0', bone: '#f6f2ea' };
const TZ = 'Asia/Kolkata';
const STATUS = { paid: 'Paid', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const STORE_URL = (process.env.CLIENT_URL || 'https://ecommerce-frontend-three-ruby.vercel.app').replace(/\/$/, '');

const inr = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });
const when = d => {
  const date = new Date(d);
  const day = date.toLocaleDateString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day}, ${time} IST`;
};

export const downloadReceipt = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).catch(() => null);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    // Receipts carry personal details: only the buyer (or the team) may download one.
    if (!(await ownsOrder(req.user, order))) return res.status(404).json({ message: 'Order not found' });

    const s = summarizeOrder(order);
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `KŌRA receipt #${s.ref}`, Author: 'KŌRA' } });
    doc.registerFont('body', path.join(FONTS, 'Geist-Regular.ttf'));
    doc.registerFont('medium', path.join(FONTS, 'Geist-Medium.ttf'));
    doc.registerFont('display', path.join(FONTS, 'BodoniModa-Medium.ttf'));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kora-receipt-${s.ref}.pdf"`);
    doc.pipe(res);

    const W = doc.page.width, H = doc.page.height, M = 56, R = W - M, CW = R - M;
    const FOOTER_H = 150;
    const rule = (y, color = C.line, width = 0.75) => doc.moveTo(M, y).lineTo(R, y).lineWidth(width).strokeColor(color).stroke();
    const label = (text, x, y, opts = {}) => doc.font('medium').fontSize(7.5).fillColor(C.fg3).text(text.toUpperCase(), x, y, { characterSpacing: 0.9, lineBreak: false, ...opts });

    // --- Masthead -----------------------------------------------------------
    doc.rect(0, 0, W, 132).fill(C.bone);
    doc.font('display').fontSize(30).fillColor(C.ink).text('KŌRA', M, 46, { characterSpacing: 6, lineBreak: false });
    label('Everyday Garments · Ahmedabad', M, 86);
    doc.font('display').fontSize(22).fillColor(C.ink).text('Receipt', M, 50, { width: CW, align: 'right', lineBreak: false });
    const status = STATUS[s.status] ?? 'Paid';
    doc.font('medium').fontSize(9).fillColor(s.status === 'cancelled' ? '#a3271f' : C.fg2)
      .text(`${status} · #${s.ref}`, M, 84, { width: CW, align: 'right', lineBreak: false });

    // --- Order facts (two rows of three) -----------------------------------
    let y = 164;
    const col = CW / 3;
    const fact = (title, value, i, row) => {
      const x = M + col * i, yy = y + row * 44;
      label(title, x, yy);
      doc.font('body').fontSize(10).fillColor(C.ink).text(value, x, yy + 13, { width: col - 14, lineBreak: false, ellipsis: true });
    };
    fact('Order reference', `#${s.ref}`, 0, 0);
    fact('Date', when(s.createdAt), 1, 0);
    fact('Status', status, 2, 0);
    fact('Billed to', s.email ?? '—', 0, 1);
    fact('Payment', 'Card, via Stripe', 1, 1);
    fact('Order ID', s._id, 2, 1);
    y += 96;

    // --- Items --------------------------------------------------------------
    const X = { item: M, qty: M + CW * 0.56, unit: M + CW * 0.66, amount: M + CW * 0.83 };
    const colW = { qty: CW * 0.08, unit: CW * 0.16, amount: CW * 0.17 };
    rule(y, C.ink, 1);
    y += 10;
    label('Item', X.item, y);
    label('Qty', X.qty, y, { width: colW.qty, align: 'right' });
    label('Unit price', X.unit, y, { width: colW.unit, align: 'right' });
    label('Amount', X.amount, y, { width: colW.amount, align: 'right' });
    y += 18;
    rule(y);

    const header = () => {
      doc.addPage({ size: 'A4', margin: 0 });
      y = M;
      label(`Receipt #${s.ref} (continued)`, M, y);
      y += 24; rule(y);
    };

    for (const l of s.lines) {
      const nameH = doc.font('medium').fontSize(10).heightOfString(l.name, { width: CW * 0.52 });
      const rowH = Math.max(44, nameH + (l.size ? 36 : 24));
      if (y + rowH > H - 64) header();
      const ty = y + 13;
      doc.font('medium').fontSize(10).fillColor(C.ink).text(l.name, X.item, ty, { width: CW * 0.52 });
      if (l.size) doc.font('body').fontSize(8.5).fillColor(C.fg3).text(`Size ${l.size}`, X.item, ty + nameH + 2, { lineBreak: false });
      doc.font('body').fontSize(10).fillColor(C.ink)
        .text(String(l.quantity), X.qty, ty, { width: colW.qty, align: 'right', lineBreak: false })
        .text(inr(l.unitPrice), X.unit, ty, { width: colW.unit, align: 'right', lineBreak: false })
        .text(inr(l.amount), X.amount, ty, { width: colW.amount, align: 'right', lineBreak: false });
      y += rowH;
      rule(y);
    }

    // --- Totals ---------------------------------------------------------------
    // Totals and the footer stay together on the last page.
    if (y + 120 + FOOTER_H > H - 40) header();
    y += 16;
    const TL = M + CW * 0.5, TW = CW * 0.5;
    const total = (name, value, big = false) => {
      doc.font(big ? 'medium' : 'body').fontSize(big ? 13 : 10).fillColor(big ? C.ink : C.fg2)
        .text(name, TL, y, { width: TW * 0.5, lineBreak: false });
      doc.font(big ? 'medium' : 'body').fontSize(big ? 13 : 10).fillColor(C.ink)
        .text(value, TL + TW * 0.5, y, { width: TW * 0.5, align: 'right', lineBreak: false });
      y += big ? 24 : 20;
    };
    total(`Subtotal (${s.itemCount} ${s.itemCount === 1 ? 'piece' : 'pieces'})`, inr(s.subtotal));
    total('Delivery', s.deliveryFee > 0 ? inr(s.deliveryFee) : 'Free');
    y += 2;
    doc.moveTo(TL, y).lineTo(R, y).lineWidth(1).strokeColor(C.ink).stroke();
    y += 10;
    total('Total paid', inr(s.total), true);
    doc.font('body').fontSize(8.5).fillColor(C.fg3).text('All prices are in Indian rupees and include GST.', TL, y, { width: TW, align: 'right' });

    // Safety net: flag (never hide) a mismatch between the parts and the total.
    const diff = Math.round((s.subtotal + s.deliveryFee - s.total) * 100) / 100;
    if (Math.abs(diff) >= 0.01) {
      y += 16;
      doc.font('body').fontSize(8.5).fillColor('#a3271f').text(`Adjustment applied at payment: ${inr(-diff)}`, TL, y, { width: TW, align: 'right' });
    }

    // --- Footer ---------------------------------------------------------------
    const fy = H - FOOTER_H - 20;
    rule(fy);
    doc.font('display').fontSize(15).fillColor(C.ink).text('Thank you for choosing KŌRA.', M, fy + 22, { lineBreak: false });
    // Flowing text (no fixed y for the second line), so wrapping can't overlap.
    doc.font('body').fontSize(9).fillColor(C.fg2)
      .text('Delivery takes 3–6 working days across India. You can follow this order in your account.', M, fy + 50, { width: CW * 0.72, lineGap: 2 })
      .moveDown(0.4)
      .text(`Questions? Write to us at ${STORE_URL}/contact and mention order #${s.ref}.`, { width: CW * 0.72, lineGap: 2 });
    doc.moveDown(0.9).font('body').fontSize(7.5).fillColor(C.fg3)
      .text('This receipt was generated by KŌRA and needs no signature.', { width: CW * 0.72 });

    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Error generating receipt' });
  }
};
