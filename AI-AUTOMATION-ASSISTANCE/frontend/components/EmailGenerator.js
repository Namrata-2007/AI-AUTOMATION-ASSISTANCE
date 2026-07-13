import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  SparklesIcon,
  EnvelopeIcon,
  UserIcon,
  PaperAirplaneIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Select from 'react-select';
import { ThreeDots } from 'react-loader-spinner';

const EmailGenerator = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState(null);
  
  const [formData, setFormData] = useState({
    subject: '',
    recipients: [],
    cc: [],
    bcc: [],
    instructions: '',
    tone: 'professional',
    language: 'en',
  });

  const [emailContent, setEmailContent] = useState({
    subject: '',
    body: '',
  });

  const [emailPreview, setEmailPreview] = useState(null);

  const toneOptions = [
    { value: 'formal', label: 'Formal' },
    { value: 'professional', label: 'Professional' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'casual', label: 'Casual' },
  ];

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ja', label: 'Japanese' },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRecipientsChange = (selected, field) => {
    setFormData(prev => ({ ...prev, [field]: selected }));
  };

  const generateEmail = async () => {
    if (!formData.subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    if (formData.recipients.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    setGenerating(true);
    try {
      const response = await axios.post('/api/email/generate', {
        subject: formData.subject,
        recipients: formData.recipients,
        cc: formData.cc,
        bcc: formData.bcc,
        instructions: formData.instructions,
        tone: formData.tone,
        language: formData.language,
      });

      const email = response.data.email;
      setGeneratedEmail(email);
      setEmailContent({
        subject: email.subject,
        body: email.body,
      });
      setEmailPreview(email);
      setEditing(true);
      toast.success('Email generated successfully!');
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate email');
    } finally {
      setGenerating(false);
    }
  };

  const sendEmail = async () => {
    if (!generatedEmail) return;

    setLoading(true);
    try {
      const response = await axios.post('/api/email/send', {
        emailId: generatedEmail.id,
        edits: {
          subject: emailContent.subject,
          body: emailContent.body,
        },
      });

      toast.success('Email sent successfully!');
      setGeneratedEmail(null);
      setEditing(false);
      setEmailPreview(null);
      // Reset form
      setFormData({
        subject: '',
        recipients: [],
        cc: [],
        bcc: [],
        instructions: '',
        tone: 'professional',
        language: 'en',
      });
    } catch (error) {
      console.error('Send error:', error);
      toast.error('Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const scheduleEmail = async () => {
    const date = prompt('Enter schedule date (YYYY-MM-DD HH:MM):');
    if (!date) return;

    try {
      await axios.post('/api/email/schedule', {
        emailId: generatedEmail.id,
        scheduleDate: new Date(date),
      });
      toast.success('Email scheduled successfully!');
    } catch (error) {
      toast.error('Failed to schedule email');
    }
  };

  const improveSubject = async () => {
    try {
      const response = await axios.post('/api/email/improve-subject', {
        currentSubject: emailContent.subject,
        emailBody: emailContent.body,
      });
      
      const suggestions = response.data.suggestions;
      const selected = prompt(
        'Select a subject suggestion (enter number 1-5):\n\n' +
        suggestions.map((s, i) => `${i+1}. ${s}`).join('\n')
      );
      
      if (selected && !isNaN(selected)) {
        const index = parseInt(selected) - 1;
        if (index >= 0 && index < suggestions.length) {
          setEmailContent(prev => ({
            ...prev,
            subject: suggestions[index],
          }));
        }
      }
    } catch (error) {
      toast.error('Failed to improve subject');
    }
  };

  const correctGrammar = async () => {
    try {
      const response = await axios.post('/api/email/correct-grammar', {
        text: emailContent.body,
      });
      setEmailContent(prev => ({
        ...prev,
        body: response.data.corrected,
      }));
      toast.success('Grammar corrected!');
    } catch (error) {
      toast.error('Failed to correct grammar');
    }
  };

  // Preview mode
  if (emailPreview && !editing) {
    return (
      <div className="animate-fade-in">
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Email Preview
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setEditing(true)}
                className="btn-secondary"
              >
                <PencilIcon className="w-4 h-4 inline mr-1" />
                Edit
              </button>
              <button
                onClick={() => setEmailPreview(null)}
                className="btn-secondary"
              >
                <XMarkIcon className="w-4 h-4 inline mr-1" />
                Close
              </button>
            </div>
          </div>
          <div className="prose dark:prose-invert max-w-none">
            <h3>{emailPreview.subject}</h3>
            <div dangerouslySetInnerHTML={{ __html: emailPreview.body }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Compose Email
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Let AI help you write the perfect email
          </p>
        </div>
        {user && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {user.preferences?.defaultTone || 'Professional'} tone
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="space-y-4">
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject *
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    placeholder="Enter email subject"
                    className="input-primary flex-1"
                    disabled={editing}
                  />
                  {editing && (
                    <button
                      onClick={improveSubject}
                      className="btn-secondary whitespace-nowrap"
                    >
                      <SparklesIcon className="w-4 h-4 inline mr-1" />
                      Improve
                    </button>
                  )}
                </div>
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To *
                </label>
                <Select
                  isMulti
                  options={[]}
                  value={formData.recipients}
                  onChange={(selected) => handleRecipientsChange(selected, 'recipients')}
                  placeholder="Type email and press enter..."
                  className="react-select"
                  classNamePrefix="react-select"
                  isDisabled={editing}
                  formatOptionLabel={(option) => (
                    <div className="flex items-center">
                      <UserIcon className="w-4 h-4 mr-2 text-gray-400" />
                      <span>{option.label}</span>
                    </div>
                  )}
                  onInputChange={(input) => {
                    if (input && input.includes('@')) {
                      const email = input.trim();
                      if (email.includes('@') && email.includes('.')) {
                        // Add as tag
                        const newOption = { label: email, value: email };
                        if (!formData.recipients.find(r => r.value === email)) {
                          setFormData(prev => ({
                            ...prev,
                            recipients: [...prev.recipients, newOption]
                          }));
                          return '';
                        }
                      }
                    }
                    return input;
                  }}
                />
              </div>

              {/* CC & BCC */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CC
                  </label>
                  <Select
                    isMulti
                    options={[]}
                    value={formData.cc}
                    onChange={(selected) => handleRecipientsChange(selected, 'cc')}
                    placeholder="CC recipients..."
                    className="react-select"
                    classNamePrefix="react-select"
                    isDisabled={editing}
                    onInputChange={(input) => {
                      if (input && input.includes('@')) {
                        const email = input.trim();
                        if (email.includes('@') && email.includes('.')) {
                          const newOption = { label: email, value: email };
                          if (!formData.cc.find(r => r.value === email)) {
                            setFormData(prev => ({
                              ...prev,
                              cc: [...prev.cc, newOption]
                            }));
                            return '';
                          }
                        }
                      }
                      return input;
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    BCC
                  </label>
                  <Select
                    isMulti
                    options={[]}
                    value={formData.bcc}
                    onChange={(selected) => handleRecipientsChange(selected, 'bcc')}
                    placeholder="BCC recipients..."
                    className="react-select"
                    classNamePrefix="react-select"
                    isDisabled={editing}
                    onInputChange={(input) => {
                      if (input && input.includes('@')) {
                        const email = input.trim();
                        if (email.includes('@') && email.includes('.')) {
                          const newOption = { label: email, value: email };
                          if (!formData.bcc.find(r => r.value === email)) {
                            setFormData(prev => ({
                              ...prev,
                              bcc: [...prev.bcc, newOption]
                            }));
                            return '';
                          }
                        }
                      }
                      return input;
                    }}
                  />
                </div>
              </div>

              {/* Tone & Language */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tone
                  </label>
                  <Select
                    options={toneOptions}
                    value={toneOptions.find(t => t.value === formData.tone)}
                    onChange={(option) => setFormData(prev => ({ ...prev, tone: option.value }))}
                    className="react-select"
                    classNamePrefix="react-select"
                    isDisabled={editing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Language
                  </label>
                  <Select
                    options={languageOptions}
                    value={languageOptions.find(l => l.value === formData.language)}
                    onChange={(option) => setFormData(prev => ({ ...prev, language: option.value }))}
                    className="react-select"
                    classNamePrefix="react-select"
                    isDisabled={editing}
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Additional Instructions
                </label>
                <textarea
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Add any specific instructions for the AI..."
                  className="input-primary"
                  disabled={editing}
                />
              </div>

              {/* Generate button */}
              {!editing && (
                <button
                  onClick={generateEmail}
                  disabled={generating}
                  className="btn-primary w-full py-3"
                >
                  {generating ? (
                    <ThreeDots color="#ffffff" height={20} width={40} />
                  ) : (
                    <>
                      <SparklesIcon className="w-5 h-5 inline mr-2" />
                      Generate Email with AI
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Email content editor */}
          {editing && (
            <div className="card animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit & Send
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={correctGrammar}
                    className="btn-secondary text-sm"
                  >
                    <DocumentDuplicateIcon className="w-4 h-4 inline mr-1" />
                    Correct Grammar
                  </button>
                  <button
                    onClick={() => setEmailPreview(generatedEmail)}
                    className="btn-secondary text-sm"
                  >
                    <EnvelopeIcon className="w-4 h-4 inline mr-1" />
                    Preview
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={emailContent.subject}
                    onChange={(e) => setEmailContent(prev => ({ ...prev, subject: e.target.value }))}
                    className="input-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Body
                  </label>
                  <ReactQuill
                    theme="snow"
                    value={emailContent.body}
                    onChange={(content) => setEmailContent(prev => ({ ...prev, body: content }))}
                    className="bg-white dark:bg-gray-800 rounded-lg"
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['link', 'image'],
                        ['clean']
                      ]
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={sendEmail}
                    disabled={loading}
                    className="btn-primary flex-1 min-w-[120px]"
                  >
                    {loading ? (
                      <ThreeDots color="#ffffff" height={20} width={40} />
                    ) : (
                      <>
                        <PaperAirplaneIcon className="w-4 h-4 inline mr-2" />
                        Send Now
                      </>
                    )}
                  </button>
                  <button
                    onClick={scheduleEmail}
                    className="btn-secondary flex-1 min-w-[120px]"
                  >
                    <ClockIcon className="w-4 h-4 inline mr-2" />
                    Schedule
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setGeneratedEmail(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Tips & Stats */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              AI Writing Tips
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start space-x-2">
                <span className="text-indigo-500 font-bold">•</span>
                <span>Be specific in your instructions for better results</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-indigo-500 font-bold">•</span>
                <span>Choose the right tone for your audience</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-indigo-500 font-bold">•</span>
                <span>Review and personalize the generated content</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-indigo-500 font-bold">•</span>
                <span>Use the grammar correction feature for polish</span>
              </li>
            </ul>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Total Emails</span>
                <span className="font-semibold text-gray-900 dark:text-white">24</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">AI Generations</span>
                <span className="font-semibold text-gray-900 dark:text-white">18</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Drafts</span>
                <span className="font-semibold text-gray-900 dark:text-white">3</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .react-select__control {
          @apply border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800;
        }
        .react-select__control:hover {
          @apply border-gray-400 dark:border-gray-500;
        }
        .react-select__control--is-focused {
          @apply ring-2 ring-indigo-500 border-transparent;
        }
        .react-select__menu {
          @apply bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mt-1;
        }
        .react-select__option {
          @apply text-gray-900 dark:text-gray-100 hover:bg-indigo-50 dark:hover:bg-indigo-900/30;
        }
        .react-select__option--is-focused {
          @apply bg-indigo-50 dark:bg-indigo-900/30;
        }
        .react-select__option--is-selected {
          @apply bg-indigo-600 text-white;
        }
        .react-select__multi-value {
          @apply bg-indigo-100 dark:bg-indigo-900/30 rounded;
        }
        .react-select__multi-value__label {
          @apply text-indigo-700 dark:text-indigo-300;
        }
        .react-select__multi-value__remove {
          @apply text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded;
        }
        .react-select__input {
          @apply text-gray-900 dark:text-gray-100;
        }
        .react-select__placeholder {
          @apply text-gray-400 dark:text-gray-500;
        }
      `}</style>
    </div>
  );
};

export default EmailGenerator;