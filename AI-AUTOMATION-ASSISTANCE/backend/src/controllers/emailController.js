const Email = require('../models/Email');
const Contact = require('../models/Contact');
const aiService = require('../services/aiService');
const emailService = require('../services/emailService');
const { queueService } = require('../services/queueService');

exports.generateEmail = async (req, res) => {
  try {
    const { subject, instructions, tone, language, recipients, cc, bcc } = req.body;
    const userId = req.userId;

    // Get user preferences
    const User = require('../models/User');
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const allRecipients = [...recipients, ...(cc || []), ...(bcc || [])];

    const generatedEmail = await aiService.generateEmail({
      subject,
      instructions,
      tone: tone || user.preferences?.defaultTone || 'professional',
      language: language || user.preferences?.defaultLanguage || 'en',
      recipients: allRecipients,
      userPreferences: user.preferences
    });

    // Save as draft
    const email = new Email({
      userId,
      subject: generatedEmail.subject || subject,
      body: generatedEmail.body,
      generatedBody: generatedEmail.fullContent,
      to: recipients,
      cc: cc || [],
      bcc: bcc || [],
      tone: tone || user.preferences?.defaultTone || 'professional',
      language: language || user.preferences?.defaultLanguage || 'en',
      status: 'draft',
      aiMetadata: {
        prompt: instructions || 'No additional instructions',
        generatedAt: new Date(),
        model: 'gpt-4'
      }
    });

    await email.save();

    // Update AI usage
    await User.findByIdAndUpdate(userId, {
      $inc: { 'aiUsage.totalGenerations': 1 },
      'aiUsage.lastGenerated': new Date()
    });

    res.json({
      success: true,
      email: {
        id: email._id,
        subject: email.subject,
        body: email.body,
        generatedBody: email.generatedBody,
        tone: email.tone,
        status: email.status
      }
    });
  } catch (error) {
    console.error('Generate Email Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate email'
    });
  }
};

exports.sendEmail = async (req, res) => {
  try {
    const { emailId, edits } = req.body;
    const userId = req.userId;

    const email = await Email.findOne({ _id: emailId, userId });
    
    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      });
    }

    // Apply edits if provided
    if (edits) {
      if (edits.subject) email.subject = edits.subject;
      if (edits.body) email.body = edits.body;
      if (edits.to) email.to = edits.to;
      if (edits.cc) email.cc = edits.cc;
      if (edits.bcc) email.bcc = edits.bcc;
    }

    // Get user for access token
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user || !user.accessToken) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated with Gmail'
      });
    }

    // Send email
    const sendResult = await emailService.sendWithGmail({
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      subject: email.subject,
      body: email.body,
      attachments: email.attachments,
      accessToken: user.accessToken
    });

    // Update email status
    email.status = 'sent';
    email.sentAt = new Date();
    email.deliveryStatus = {
      sent: true,
      delivered: true,
      messageId: sendResult.messageId
    };
    email.threadId = sendResult.threadId;

    await email.save();

    // Update contacts frequency
    const allEmails = [...email.to, ...email.cc, ...email.bcc];
    for (const recipient of allEmails) {
      await Contact.findOneAndUpdate(
        { userId, email: recipient.email },
        { $inc: { frequency: 1 }, $set: { lastContacted: new Date() } },
        { upsert: true }
      );
    }

    res.json({
      success: true,
      message: 'Email sent successfully',
      email: {
        id: email._id,
        status: email.status,
        sentAt: email.sentAt,
        messageId: sendResult.messageId
      }
    });
  } catch (error) {
    console.error('Send Email Error:', error);
    
    // Mark as failed
    if (req.body.emailId) {
      await Email.findByIdAndUpdate(req.body.emailId, {
        status: 'failed',
        'deliveryStatus.error': error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to send email'
    });
  }
};

exports.getEmailHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, status } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const emails = await Email.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-generatedBody');

    const total = await Email.countDocuments(query);

    res.json({
      success: true,
      emails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get Email History Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email history'
    });
  }
};

exports.getEmailById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const email = await Email.findOne({ _id: id, userId });
    
    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      });
    }

    res.json({
      success: true,
      email
    });
  } catch (error) {
    console.error('Get Email Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email'
    });
  }
};

exports.scheduleEmail = async (req, res) => {
  try {
    const { emailId, scheduleDate } = req.body;
    const userId = req.userId;

    const email = await Email.findOne({ _id: emailId, userId });
    
    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      });
    }

    email.status = 'scheduled';
    email.scheduledFor = new Date(scheduleDate);
    await email.save();

    // Schedule job in BullMQ
    await queueService.scheduleEmail({
      emailId: email._id,
      userId,
      scheduledFor: email.scheduledFor
    });

    res.json({
      success: true,
      message: 'Email scheduled successfully',
      email: {
        id: email._id,
        status: email.status,
        scheduledFor: email.scheduledFor
      }
    });
  } catch (error) {
    console.error('Schedule Email Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule email'
    });
  }
};

exports.improveSubject = async (req, res) => {
  try {
    const { currentSubject, emailBody } = req.body;
    
    const suggestions = await aiService.improveSubject(currentSubject, emailBody);
    
    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Improve Subject Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate subject suggestions'
    });
  }
};

exports.correctGrammar = async (req, res) => {
  try {
    const { text } = req.body;
    
    const corrected = await aiService.correctGrammar(text);
    
    res.json({
      success: true,
      corrected
    });
  } catch (error) {
    console.error('Grammar Correction Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to correct grammar'
    });
  }
};