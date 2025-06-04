import { createTransport } from 'nodemailer';

export async function sendEmail(req, res) {
  const { firstName, lastName, email, phone, subject, message } = req.body;
  const fullName = `${firstName} ${lastName}`;

  const transporter = createTransport({
    service: 'gmail',
    auth: {
      user: 'roheravishal567@gmail.com',
      pass: 'xtxs uyxf jgfv odfk',    
    },
  });

  const mailOptions = {
    from: email,
    to: 'roheravishal567@gmail.com',
    subject: `✨ New Contact: ${subject}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Contact Message</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }
          
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            overflow: hidden;
          }
          
          .header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="25" r="1" fill="white" opacity="0.05"/><circle cx="50" cy="50" r="1" fill="white" opacity="0.08"/><circle cx="25" cy="75" r="1" fill="white" opacity="0.06"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          }
          
          .header h1 {
            color: white;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            position: relative;
            z-index: 1;
          }
          
          .header p {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 400;
            position: relative;
            z-index: 1;
          }
          
          .content {
            padding: 40px 30px;
          }
          
          .contact-card {
            background: linear-gradient(135deg, #f8f9ff, #f0f2ff);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
            border: 1px solid rgba(102, 126, 234, 0.1);
            position: relative;
          }
          
          .contact-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 16px 16px 0 0;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
          }
          
          .info-item {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(102, 126, 234, 0.08);
            transition: all 0.3s ease;
          }
          
          .info-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
          }
          
          .info-label {
            font-size: 12px;
            font-weight: 600;
            color: #667eea;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }
          
          .info-value {
            font-size: 16px;
            font-weight: 500;
            color: #1a1a1a;
            word-break: break-all;
          }
          
          .message-section {
            background: white;
            border-radius: 16px;
            padding: 25px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            border-left: 5px solid #667eea;
            margin-top: 25px;
          }
          
          .message-label {
            font-size: 14px;
            font-weight: 600;
            color: #667eea;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .message-content {
            font-size: 15px;
            line-height: 1.7;
            color: #2d3748;
            background: #f8f9ff;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid rgba(102, 126, 234, 0.1);
          }
          
          .footer {
            background: linear-gradient(135deg, #f8f9ff, #f0f2ff);
            padding: 25px 30px;
            text-align: center;
            border-top: 1px solid rgba(102, 126, 234, 0.1);
          }
          
          .footer p {
            font-size: 13px;
            color: #667eea;
            font-weight: 500;
          }
          
          .badge {
            display: inline-block;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 10px;
          }
          
          @media (max-width: 640px) {
            .email-wrapper {
              margin: 10px;
              border-radius: 16px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .contact-card {
              padding: 25px 20px;
            }
            
            .info-grid {
              grid-template-columns: 1fr;
              gap: 15px;
            }
            
            .header h1 {
              font-size: 24px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>💫 New Contact Message</h1>
            <p>Someone reached out through your contact form</p>
          </div>
          
          <div class="content">
            <div class="contact-card">
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">👤 Full Name</div>
                  <div class="info-value">${fullName}</div>
                </div>
                
                <div class="info-item">
                  <div class="info-label">📧 Email Address</div>
                  <div class="info-value">${email}</div>
                </div>
                
                <div class="info-item">
                  <div class="info-label">📱 Phone Number</div>
                  <div class="info-value">${phone || 'Not provided'}</div>
                </div>
                
                <div class="info-item">
                  <div class="info-label">📋 Subject</div>
                  <div class="info-value">${subject}</div>
                </div>
              </div>
              
              <div class="message-section">
                <div class="message-label">
                  💬 Message Content
                </div>
                <div class="message-content">
                  ${message.replace(/\n/g, '<br>')}
                </div>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p>✨ This message was automatically generated from your contact form</p>
            <div class="badge">Contact Form Notification</div>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: 'Email sending failed.' });
  }
}