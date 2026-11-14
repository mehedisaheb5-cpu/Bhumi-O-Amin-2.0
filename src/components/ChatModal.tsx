import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  RotateCcw,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { Language, ChatMessage } from '../types';

interface ChatModalProps {
  lang: Language;
  onClose: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({ lang, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content:
        lang === 'bn'
          ? 'আসসালামু আলাইকুম! আমি "ভূমি ও আমিন" এর এআই ভূমি পরামর্শক। জমি পরিমাপের সূত্র, খতিয়ান (CS, SA, RS, BS), নামজারি বা সীমানা বিরোধ সংক্রান্ত যেকোনো প্রশ্ন আমাকে করতে পারেন।'
          : 'Welcome! I am your Bhumi O Amin AI Land Consultant. Ask me anything about Bangladesh land measurement formulas, CS/RS/BS khatians, mutation (namjari), or boundary issues.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-pro-preview'>('gemini-3.5-flash');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputPrompt;
    if (!query.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Format history for server
      const conversationHistory = newHistory.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          model: selectedModel,
          history: conversationHistory.slice(0, -1),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const error = err as Error;
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          lang === 'bn'
            ? `দুঃখিত, সংযোগে সমস্যা হয়েছে: ${error.message}। সার্ভারে GEMINI_API_KEY কনফিগার করা আছে কিনা অনুগ্রহ করে নিশ্চিত করুন।`
            : `Sorry, unable to connect: ${error.message}. Please verify GEMINI_API_KEY is configured.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleQuestions = [
    {
      bn: '১ শতাংশ সমান কত বর্গফুট ও কত কাঠা?',
      en: 'How many sq ft & katha in 1 decimal?',
    },
    {
      bn: 'সিএস ও আরএস খতিয়ানের মধ্যে পার্থক্য কী?',
      en: 'What is the difference between CS and RS?',
    },
    {
      bn: 'ই-নামজারি করতে কী কী কাগজপত্র লাগে?',
      en: 'What documents are required for e-Mutation?',
    },
    {
      bn: 'জমির আইল বা সীমানা দখল হলে করণীয় কী?',
      en: 'What to do if boundary encroachment happens?',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-lg h-[92vh] sm:h-[620px] rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <div className="bg-teal-950 text-white p-3.5 flex items-center justify-between border-b border-teal-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-800/60 text-teal-200 border border-teal-600/40 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>{lang === 'bn' ? 'ভূমি ও আমিন এআই পরামর্শক' : 'AI Land Consultant'}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-400 text-slate-950">
                  Gemini
                </span>
              </h3>
              <p className="text-[11px] text-teal-200">
                {lang === 'bn' ? 'বাংলাদেশ ভূমি আইন ও জরিপ বিশেষায়িত' : 'Trained for Bangladesh land & survey'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Model Selector */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as any)}
              className="bg-teal-900 text-teal-100 border border-teal-700 text-[10px] font-medium rounded-lg px-2 py-1 outline-hidden"
              title="Select Gemini Model"
            >
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Fast)</option>
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (In-depth)</option>
            </select>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-teal-900/80 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-slate-50 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-teal-900 text-teal-200 flex items-center justify-center shrink-0 mt-0.5 text-xs shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3 shadow-xs text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-teal-900 text-white rounded-tr-xs'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <div
                  className={`mt-1.5 text-[9px] text-right font-medium ${
                    msg.role === 'user' ? 'text-teal-200/70' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 text-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2.5 items-center">
              <div className="w-7 h-7 rounded-full bg-teal-900 text-teal-200 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 rounded-2xl bg-white border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 animate-spin text-teal-800" />
                <span>{lang === 'bn' ? 'উত্তর তৈরি হচ্ছে...' : 'Generating consultation...'}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Preset Question Suggestions */}
        <div className="p-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] text-slate-400 font-semibold shrink-0 pl-1">
            {lang === 'bn' ? 'প্রশ্নসমূহ:' : 'FAQ:'}
          </span>
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(lang === 'bn' ? q.bn : q.en)}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-950 text-slate-700 text-[10px] font-medium border border-slate-200 shrink-0 transition"
            >
              {lang === 'bn' ? q.bn : q.en}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder={
                lang === 'bn'
                  ? 'জমি, খতিয়ান বা পরিমাপ নিয়ে প্রশ্ন লিখুন...'
                  : 'Ask about land, khatian, or measurement...'
              }
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700 text-xs text-slate-900"
            />

            <button
              id="send-chat-btn"
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="p-2.5 rounded-xl bg-teal-900 hover:bg-teal-800 disabled:opacity-50 text-white shadow-xs transition active:scale-95 shrink-0"
            >
              <Send className="w-4 h-4 text-amber-300" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
