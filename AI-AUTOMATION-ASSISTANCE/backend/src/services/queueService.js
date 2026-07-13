const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const config = require('../config');
const emailService = require('./emailService');
const Email = require('../models/Email');
const User = require('../models/User');

class QueueService {
  constructor() {
    this.connection = new Redis(config.redis.url);
    
    this.emailQueue = new Queue('email-queue', {
      connection: this.connection
    });

    this.setupWorkers();
  }

  setupWorkers() {
    // Worker for sending scheduled emails
    new Worker('email-queue', async (job) => {
      console.log(`Processing job ${job.id} for email ${job.data.emailId}`);
      
      try {
        const { emailId, userId } = job.data;
        
        const email = await Email.findOne({ _id: emailId, userId });
        const user = await User.findById(userId);

        if (!email || !user) {
          throw new Error('Email or user not found');
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

        console.log(`Email ${emailId} sent successfully`);
        return { success: true, messageId: sendResult.messageId };
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        
        // Update email status to failed
        await Email.findByIdAndUpdate(job.data.emailId, {
          status: 'failed',
          'deliveryStatus.error': error.message
        });
        
        throw error;
      }
    }, {
      connection: this.connection
    });

    // Worker for generating follow-up emails
    new Worker('followup-queue', async (job) => {
      console.log(`Processing follow-up job ${job.id}`);
      
      try {
        const { emailId, userId } = job.data;
        const email = await Email.findOne({ _id: emailId, userId });
        
        if (!email) {
          throw new Error('Email not found');
        }

        // Check if we should send follow-up
        const daysSinceSent = Math.floor(
          (Date.now() - email.sentAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceSent >= job.data.followUpDelay) {
          // Generate follow-up email
          const aiService = require('./aiService');
          const followUpBody = await aiService.generateFollowUp(email, daysSinceSent);
          
          // Create follow-up email record
          const newEmail = new Email({
            userId,
            subject: `Re: ${email.subject}`,
            body: followUpBody,
            to: email.to,
            cc: email.cc,
            bcc: email.bcc,
            status: 'draft',
            tone: email.tone,
            isReply: true,
            threadId: email.threadId
          });
          
          await newEmail.save();
          
          console.log(`Follow-up email generated for ${emailId}`);
        }
      } catch (error) {
        console.error(`Follow-up job ${job.id} failed:`, error);
      }
    }, {
      connection: this.connection
    });
  }

  async scheduleEmail({ emailId, userId, scheduledFor }) {
    const delay = scheduledFor.getTime() - Date.now();
    
    if (delay <= 0) {
      // Send immediately if scheduled time is in the past
      const job = await this.emailQueue.add('send-email', {
        emailId,
        userId
      });
      return job;
    }

    const job = await this.emailQueue.add('send-email', {
      emailId,
      userId
    }, {
      delay: Math.max(delay, 0),
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });

    return job;
  }

  async scheduleFollowUp({ emailId, userId, followUpDelay = 3 }) {
    const delay = followUpDelay * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    
    const job = await this.emailQueue.add('generate-followup', {
      emailId,
      userId,
      followUpDelay
    }, {
      delay,
      attempts: 1
    });

    return job;
  }

  async getQueueStats() {
    const counts = await this.emailQueue.getJobCounts();
    const active = await this.emailQueue.getActiveCount();
    const waiting = await this.emailQueue.getWaitingCount();
    const completed = await this.emailQueue.getCompletedCount();
    const failed = await this.emailQueue.getFailedCount();

    return {
      active,
      waiting,
      completed,
      failed,
      ...counts
    };
  }

  async cleanQueue() {
    await this.emailQueue.clean(24 * 60 * 60 * 1000, 1000); // Clean completed jobs older than 24 hours
  }
}

const queueService = new QueueService();
module.exports = { queueService };