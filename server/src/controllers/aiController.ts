import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

export const summarizeChat = async (req: AuthRequest, res: Response) => {
  try {
    const { messages } = req.body; // Expecting array of { senderName: string, content: string }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Conversation messages are required for summarization' });
    }

    const formattedConversation = messages
      .map((msg: any) => `${msg.senderName || 'User'}: ${msg.content || ''}`)
      .join('\n');

    const genAI = getGeminiClient();

    if (!genAI) {
      // Mock Summarizer fallback
      console.log('Gemini API key not configured. Using heuristic mock summarizer.');
      const topicCount = messages.length;
      const summary = `• Conversation includes ${topicCount} messages discussing recent updates.\n• Key participants: ${Array.from(new Set(messages.map((m: any) => m.senderName || 'User'))).join(', ')}.\n• (Configure GEMINI_API_KEY in server/.env for real AI summaries!)`;
      return res.status(200).json({ summary });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Summarize the following chat conversation in 2-3 concise, bullet points. Focus on key details, questions, or action items. Keep the tone helpful and professional. Return HTML-style bullet points (using <li> tags) or clean Markdown.

Conversation:
${formattedConversation}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.status(200).json({ summary: text });
  } catch (error: any) {
    console.error('AI Summarize error:', error);
    res.status(500).json({ error: 'Failed to generate conversation summary' });
  }
};

export const translateMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'Text and target language are required' });
    }

    const genAI = getGeminiClient();

    if (!genAI) {
      // Mock Translator fallback
      console.log('Gemini API key not configured. Using mock translator.');
      const translated = `[Translated to ${targetLanguage}]: ${text} (API Key missing)`;
      return res.status(200).json({ translatedText: translated });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Translate the following text into "${targetLanguage}". Return ONLY the translation, with no quotes, explanations, or additional text.

Text: ${text}`;

    const result = await model.generateContent(prompt);
    const translatedText = result.response.text().trim();
    res.status(200).json({ translatedText });
  } catch (error: any) {
    console.error('AI Translation error:', error);
    res.status(500).json({ error: 'Failed to translate message' });
  }
};

export const suggestReplies = async (req: AuthRequest, res: Response) => {
  try {
    const { messages } = req.body; // Expecting last 3-5 messages { senderName: string, content: string }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Conversation history is required for reply suggestion' });
    }

    const formattedConversation = messages
      .map((msg: any) => `${msg.senderName || 'User'}: ${msg.content || ''}`)
      .join('\n');

    const genAI = getGeminiClient();

    if (!genAI) {
      // Mock Smart Reply fallback
      return res.status(200).json({
        suggestions: ['Okay!', 'Sounds good.', 'Got it, thanks!']
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `You are a chat helper. Based on the recent conversation flow below, suggest exactly 3 short, natural, and helpful quick reply options that the last recipient could click. They should be brief (1-5 words).
Return your response ONLY as a parseable JSON array of strings, for example: ["Sounds great!", "Sure, what time?", "I will check"]. No markdown code blocks, no other text.

Conversation:
${formattedConversation}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    try {
      // Clean potential JSON markdown wrapping
      const cleanedJSON = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const suggestions = JSON.parse(cleanedJSON);
      res.status(200).json({ suggestions });
    } catch (parseError) {
      console.warn('Failed to parse Gemini smart reply JSON, using fallback. Output was:', responseText);
      res.status(200).json({
        suggestions: ['Okay!', 'Makes sense.', 'I will let you know.']
      });
    }
  } catch (error: any) {
    console.error('AI Smart Reply error:', error);
    res.status(500).json({ error: 'Failed to suggest replies' });
  }
};

export const checkToxicity = async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text to analyze is required' });
    }

    const genAI = getGeminiClient();

    if (!genAI) {
      // Mock toxicity checker (heuristics for demonstration)
      const lowercase = text.toLowerCase();
      const triggerWords = ['abuse', 'spam', 'viagra', 'idiot', 'stupid', 'hate', 'kill'];
      const foundTrigger = triggerWords.some(word => lowercase.includes(word));
      
      return res.status(200).json({
        toxicityScore: foundTrigger ? 0.8 : 0.1,
        flagged: foundTrigger,
        reason: foundTrigger ? 'Contains flagged keywords' : 'Clean'
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Analyze the following message for toxicity, abuse, spam, hate speech, or harassment. 
Return your assessment ONLY as a valid, parseable JSON object with the following fields: "toxicityScore" (number between 0.0 and 1.0), "flagged" (boolean indicating if toxicityScore is >= 0.6), and "reason" (brief string explaining the classification). Do not wrap in markdown code blocks.

Message: "${text}"`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    try {
      const cleanedJSON = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const analysis = JSON.parse(cleanedJSON);
      res.status(200).json(analysis);
    } catch (parseError) {
      console.warn('Failed to parse Gemini toxicity JSON, using fallback. Output was:', responseText);
      res.status(200).json({
        toxicityScore: 0.1,
        flagged: false,
        reason: 'Unable to analyze text'
      });
    }
  } catch (error: any) {
    console.error('AI Toxicity checker error:', error);
    res.status(500).json({ error: 'Failed to analyze message content' });
  }
};
