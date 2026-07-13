const OpenAI = require('openai');
const config = require('../config');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }

  async generateEmail({ subject, instructions, tone, language, recipients, userPreferences }) {
    try {
      const recipientNames = recipients.map(r => r.name || r.email).join(', ');
      
      const prompt = this.buildPrompt({
        subject,
        instructions,
        tone,
        language,
        recipientNames,
        userPreferences
      });

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert email writer. Generate professional, well-structured emails.
                     Tone: ${tone}
                     Language: ${language}
                     ${userPreferences?.signature ? `Signature: ${userPreferences.signature}` : ''}`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const generatedContent = completion.choices[0].message.content;
      return this.parseEmailContent(generatedContent);
    } catch (error) {
      console.error('AI Generation Error:', error);
      throw new Error('Failed to generate email');
    }
  }

  buildPrompt({ subject, instructions, tone, language, recipientNames, userPreferences }) {
    return `
      Generate a professional email with the following specifications:

      Subject: ${subject}
      Recipients: ${recipientNames}
      Tone: ${tone}
      Language: ${language}
      Additional Instructions: ${instructions || 'None'}

      Requirements:
      1. Write a clear, concise email
      2. Include a professional greeting and closing
      3. Maintain ${tone} tone throughout
      4. ${instructions ? `Follow these instructions: ${instructions}` : ''}
      5. Format with proper paragraphs
      6. Include a subject line that's compelling
      7. ${userPreferences?.signature ? `End with signature: ${userPreferences.signature}` : 'End with a professional closing'}

      Generate the complete email including:
      - Subject line
      - Greeting
      - Body paragraphs
      - Closing
      - Signature
    `;
  }

  parseEmailContent(content) {
    // Parse the AI response into structured format
    const lines = content.split('\n');
    let subject = '';
    let body = '';
    let greeting = '';
    let closing = '';
    let signature = '';

    // Simple parsing logic - can be enhanced
    let currentSection = 'body';
    
    for (const line of lines) {
      if (line.toLowerCase().includes('subject:')) {
        subject = line.replace(/subject:/i, '').trim();
        continue;
      }
      
      if (line.trim().toLowerCase().match(/^(dear|hello|hi|greetings)/)) {
        greeting = line.trim();
        currentSection = 'body';
        continue;
      }

      if (line.trim().toLowerCase().match(/^(sincerely|best regards|thanks|regards|cheers)/)) {
        closing = line.trim();
        currentSection = 'closing';
        continue;
      }

      if (currentSection === 'body' && line.trim()) {
        body += line.trim() + '\n';
      }

      if (currentSection === 'closing' && line.trim()) {
        signature += line.trim() + '\n';
      }
    }

    return {
      subject: subject || 'Generated Subject',
      body: body.trim(),
      greeting: greeting.trim(),
      closing: closing.trim(),
      signature: signature.trim(),
      fullContent: content
    };
  }

  async improveSubject(currentSubject, emailBody) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Generate 5 improved email subject lines that are more compelling and professional."
          },
          {
            role: "user",
            content: `Current subject: ${currentSubject}\nEmail body: ${emailBody}`
          }
        ],
        temperature: 0.8,
        max_tokens: 200
      });

      const suggestions = completion.choices[0].message.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim());

      return suggestions;
    } catch (error) {
      console.error('Subject Improvement Error:', error);
      return [currentSubject];
    }
  }

  async correctGrammar(text) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Correct the grammar, spelling, and improve the writing style. Keep the same meaning and tone."
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Grammar Correction Error:', error);
      return text;
    }
  }

  async generateFollowUp(originalEmail, daysWithoutReply) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Generate a polite follow-up email for an original email that hasn't received a reply."
          },
          {
            role: "user",
            content: `
              Original Email:
              Subject: ${originalEmail.subject}
              Body: ${originalEmail.body}

              Days without reply: ${daysWithoutReply}

              Generate a professional follow-up email that:
              1. References the original email
              2. Is polite and not pushy
              3. Briefly restates the purpose
              4. Asks for a response or action
            `
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Follow-up Generation Error:', error);
      return null;
    }
  }
}

module.exports = new AIService();