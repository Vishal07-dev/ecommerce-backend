import PDFDocument from 'pdfkit';
import { Order } from '../models/Order.js';

export const downloadReceipt = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Create PDF document with custom margins
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      bufferPages: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${order._id}.pdf`);
    doc.pipe(res);

    // Define colors
    const primaryColor = '#2563eb';
    const secondaryColor = '#64748b';
    const accentColor = '#f1f5f9';
    const successColor = '#10b981';

    // Helper function to draw rounded rectangle
    const drawRoundedRect = (x, y, width, height, radius = 5) => {
      doc.roundedRect(x, y, width, height, radius);
    };

    // Header Section with gradient-like effect
    doc.save();
    doc.rect(0, 0, doc.page.width, 120)
       .fill(primaryColor);
    
    // Company/Store name
    doc.fillColor('white')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('SHOPIFY STORE', 50, 30, { align: 'left' });
    
    doc.fontSize(12)
       .font('Helvetica')
       .text('Premium E-Commerce Experience', 50, 65);
    
    // Receipt badge
    drawRoundedRect(doc.page.width - 150, 25, 100, 30, 15);
    doc.fill('white')
       .stroke(primaryColor)
       .fillColor(primaryColor)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('RECEIPT', doc.page.width - 135, 35);
    
    doc.restore();

    // Move down after header
    doc.y = 140;

    // Order Information Card - Make it taller to accommodate content
    const cardY = doc.y;
    drawRoundedRect(50, cardY, doc.page.width - 100, 120, 8);
    doc.fillAndStroke(accentColor, '#e2e8f0');

    doc.fillColor('#1e293b')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('Order Details', 70, cardY + 20);

    // Order info in two columns with proper spacing
    const leftCol = 70;
    const rightCol = 320;
    const infoY = cardY + 45;
    const maxWidth = 200; // Maximum width for text to prevent overflow

    doc.fontSize(11)
       .font('Helvetica')
       .fillColor(secondaryColor)
       .text('Order ID:', leftCol, infoY)
       .fillColor('#1e293b')
       .font('Helvetica-Bold')
       .text(order._id.toString().substring(0, 12) + '...', leftCol, infoY + 15, { width: maxWidth });

    doc.fillColor(secondaryColor)
       .font('Helvetica')
       .text('Email:', rightCol, infoY)
       .fillColor('#1e293b')
       .font('Helvetica-Bold')
       .text(order.email, rightCol, infoY + 15, { width: maxWidth });

    doc.fillColor(secondaryColor)
       .font('Helvetica')
       .text('Date:', leftCol, infoY + 35)
       .fillColor('#1e293b')
       .font('Helvetica-Bold')
       .text(new Date(order.createdAt).toLocaleDateString('en-IN', {
         day: '2-digit',
         month: 'short',
         year: 'numeric'
       }) + ' at ' + new Date(order.createdAt).toLocaleTimeString('en-IN', {
         hour: '2-digit',
         minute: '2-digit',
         hour12: true
       }), leftCol, infoY + 50, { width: maxWidth });

    // Items Section
    doc.y = cardY + 150;
    
    doc.fillColor('#1e293b')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('Items Purchased', 50, doc.y);

    doc.y += 25;

    // Table positions - adjusted for better spacing
    const tableTop = doc.y;
    const itemX = 50;
    const priceX = 320;
    const quantityX = 420;
    const totalX = 480;

    drawRoundedRect(50, tableTop, doc.page.width - 100, 35, 5);
    doc.fillAndStroke(primaryColor, primaryColor);

    doc.fillColor('white')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Item', itemX + 10, tableTop + 12)
       .text('Price', priceX, tableTop + 12)
       .text('Qty', quantityX, tableTop + 12)
       .text('Total', totalX, tableTop + 12);

    // Table rows
    let currentY = tableTop + 35;
    let totalAmount = 0;

    order.items.forEach((item, index) => {
      const rowColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      const itemTotal = item.price * item.quantity;
      totalAmount += itemTotal;

      drawRoundedRect(50, currentY, doc.page.width - 100, 30, 3);
      doc.fillAndStroke(rowColor, '#e2e8f0');

      doc.fillColor('#1e293b')
         .fontSize(11)
         .font('Helvetica')
         .text(item.name, itemX + 10, currentY + 10, { width: 280 })
         .text(`Rs.${item.price.toLocaleString('en-IN')}`, priceX, currentY + 10)
         .text(item.quantity.toString(), quantityX + 10, currentY + 10)
         .font('Helvetica-Bold')
         .text(`Rs.${itemTotal.toLocaleString('en-IN')}`, totalX, currentY + 10);

      currentY += 30;
    });

    // Total Section
    currentY += 20;
    drawRoundedRect(doc.page.width - 250, currentY, 200, 60, 8);
    doc.fillAndStroke('#ecfdf5', '#10b981');

    doc.fillColor(successColor)
       .fontSize(14)
       .font('Helvetica')
       .text('Total Amount:', doc.page.width - 240, currentY + 15);

    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(`Rs.${order.totalAmount.toLocaleString('en-IN')}`, doc.page.width - 240, currentY + 35);

    // Footer Section
    currentY += 100;
    
    // Thank you message
    doc.fillColor(primaryColor)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('Thank you for your purchase!', 50, currentY, { align: 'center' });

    currentY += 30;

    // Additional info
    doc.fillColor(secondaryColor)
       .fontSize(10)
       .font('Helvetica')
       .text('For any queries, please contact our customer support.', 50, currentY, { align: 'center' })
       .text('This is a computer-generated receipt and does not require a signature.', 50, currentY + 15, { align: 'center' });

    // QR Code placeholder (you can integrate a QR code library)
    currentY += 40;
    drawRoundedRect(doc.page.width/2 - 25, currentY, 50, 50, 5);
    doc.fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor(secondaryColor)
       .fontSize(8)
       .text('QR Code', doc.page.width/2 - 15, currentY + 22);

    // Watermark
    doc.save();
    doc.rotate(-45, { origin: [doc.page.width/2, doc.page.height/2] });
    doc.fillColor('#f1f5f9')
       .fontSize(72)
       .font('Helvetica-Bold')
       .text('PAID', 0, doc.page.height/2 - 50, { 
         align: 'center',
         opacity: 0.1
       });
    doc.restore();

    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Error generating receipt' });
  }
};