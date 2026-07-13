const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const config = require('../config');

class EmailService {
  constructor() {
    this.gmail = null;
    this.transporter = null;
  }

  async initializeGmail(accessToken) {
    const auth = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    
    auth.setCredentials({
      access_token: accessToken
    });

    this.gmail = google.gmail({ version: 'v1', auth });
    return this.gmail;
  }

  async sendWithGmail({ to, cc, bcc, subject, body, attachments, accessToken }) {
    try {
      await this.initializeGmail(accessToken);

      // Create email content
      const emailLines = [];
      emailLines.push(`To: ${to.map(t => t.email).join(', ')}`);
      
      if (cc && cc.length > 0) {
        emailLines.push(`Cc: ${cc.map(c => c.email).join(', ')}`);
      }
      
      if (bcc && bcc.length > 0) {
        emailLines.push(`Bcc: ${bcc.map(b => b.email).join(', ')}`);
      }
      
      emailLines.push(`Subject: ${subject}`);
      emailLines.push('Content-Type: text/html; charset=utf-8');
      emailLines.push('');
      emailLines.push(body);

      const email = emailLines.join('\r\n');
      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const result = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });

      return {
        success: true,
        messageId: result.data.id,
        threadId: result.data.threadId
      };
    } catch (error) {
      console.error('Gmail Send Error:', error);
      
      // Fallback to SMTP if Gmail fails
      if (config.smtp) {
        return await this.sendWithSMTP({ to, cc, bcc, subject, body, attachments });
      }
      
      throw error;
    }
  }

  async sendWithSMTP({ to, cc, bcc, subject, body, attachments }) {
    try {
      if (!this.transporter) {
        this.transporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure || false,
          auth: {
            user: config.smtp.user,
            pass: config.smtp.pass
          }
        });
      }

      const mailOptions = {
        from: config.smtp.user,
        to: to.map(t => `${t.name || ''} <${t.email}>`).join(', '),
        subject: subject,
        html: body
      };

      if (cc && cc.length > 0) {
        mailOptions.cc = cc.map(c => `${c.name || ''} <${c.email}>`).join(', ');
      }

      if (bcc && bcc.length > 0) {
        mailOptions.bcc = bcc.map(b => `${b.name || ''} <${b.email}>`).join(', ');
      }

      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content || att.url
        }));
      }

      const info = await this.transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('SMTP Send Error:', error);
      throw error;
    }
  }

  async getEmailHistory(accessToken, maxResults = 50) {
    try {
      await this.initializeGmail(accessToken);
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults: maxResults,
        q: 'in:sent'
      });

      const messages = response.data.messages || [];
      
      // Get full message details
      const fullMessages = await Promise.all(
        messages.map(async (msg) => {
          const detail = await this.gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'To', 'Date']
          });
          return detail.data;
        })
      );

      return fullMessages;
    } catch (error) {
      console.error('Get Email History Error:', error);
      return [];
    }
  }

  async getEmailStats(userId) {
    try {
      const Email = require('../models/Email');
      
      const stats = await Email.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const total = await Email.countDocuments({ userId });
      const sent = stats.find(s => s._id === 'sent')?.count || 0;
      const drafts = stats.find(s => s._id === 'draft')?.count || 0;
      const scheduled = stats.find(s => s._id === 'scheduled')?.count || 0;
      const failed = stats.find(s => s._id === 'failed')?.count || 0;

      return { total, sent, drafts, scheduled, failed };
    } catch (error) {
      console.error('Get Email Stats Error:', error);
      return { total: 0, sent: 0, drafts: 0, scheduled: 0, failed: 0 };
    }
  }
}

module.exports = new EmailService();