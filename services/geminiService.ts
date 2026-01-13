import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { NewsItem, GeneratedContent, GroundingImage } from "../types";

const apiKey = process.env.API_KEY || '';

// Helper to create client
const getClient = () => {
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// Retry helper with exponential backoff
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, baseDelay = 2000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      const isRateLimit = error.message?.includes('429') || 
                          error.message?.includes('Too Many Requests') || 
                          error.status === 429 ||
                          error.response?.status === 429;

      if (isRateLimit && i < retries - 1) {
        const delay = baseDelay * Math.pow(2, i) + (Math.random() * 1000); // Exponential backoff + jitter
        console.warn(`API Rate limit hit. Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

export const fetchPoliticalNews = async (): Promise<NewsItem[]> => {
  const ai = getClient();
  
  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        snippet: { type: Type.STRING },
        source: { type: Type.STRING },
        url: { type: Type.STRING },
        publishedDate: { type: Type.STRING },
      },
      required: ['title', 'snippet']
    }
  };

  try {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Find the top 10 latest hot political news headlines from around the world from the last 24 hours. Focus on major geopolitical events, elections, or major policy shifts. Return a list JSON.",
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }));

    const text = response.text;
    if (!text) return [];
    
    const items = JSON.parse(text) as Omit<NewsItem, 'id'>[];
    
    // Add IDs
    return items.map((item, index) => ({
      ...item,
      id: `news-${Date.now()}-${index}`
    }));

  } catch (error) {
    console.error("Error fetching news:", error);
    throw error;
  }
};

export const generateContentKit = async (newsItem: NewsItem): Promise<GeneratedContent> => {
  const ai = getClient();

  const prompt = `
    Act as a professional content creator for political news targeting a Burmese audience.
    I have this news item:
    Title: ${newsItem.title}
    Snippet: ${newsItem.snippet}
    Source: ${newsItem.source}

    Please perform the following tasks:
    1. Write a concise summary in English.
    2. Translate that summary into Burmese.
    3. Write a viral-style, engaging script for a 1.5-minute video (TikTok/Reels/Shorts) in Burmese language. 
       - The script should have a hook, body, and call to action. 
       - CRITICAL: Place all visual instructions, camera movements, or image descriptions inside square brackets like this: [Show map of Ukraine]. 
       - The spoken dialogue should be outside brackets.
    4. Write a detailed, engaging, and professional Facebook Page post in Burmese suitable for a news media page.
       - It should be a standalone article (approx 3-4 paragraphs) that explains the full context of the news, why it matters, and key details.
       - It must be significantly longer than a caption. 
       - Do NOT mention "video" or "watch this". It is a pure text-based news update.
       - Use an engaging journalistic tone.
       - Include relevant hashtags at the end.
    5. Provide a list of 5 specific search queries to find relevant images for this video.
    6. Provide 5 text-to-image prompts describing visuals that would match the script.
    7. Provide 3 interesting, viral, click-bait style titles in Burmese language.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      summaryEnglish: { type: Type.STRING },
      summaryBurmese: { type: Type.STRING },
      scriptBurmese: { type: Type.STRING },
      facebookPostBurmese: { type: Type.STRING },
      burmeseTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
      visualPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
      imageQueries: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['summaryEnglish', 'summaryBurmese', 'scriptBurmese', 'facebookPostBurmese', 'visualPrompts', 'imageQueries', 'burmeseTitles']
  };

  try {
    // Using retry for Pro model as well
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }));

    const text = response.text;
    if (!text) throw new Error("No content generated");

    return JSON.parse(text) as GeneratedContent;

  } catch (error) {
    console.error("Error generating content kit:", error);
    throw error;
  }
};

export const searchRelatedImages = async (queries: string[]): Promise<GroundingImage[]> => {
  const ai = getClient();
  const searchQuery = queries.length > 0 ? queries[0] : "political news";

  try {
    // Retry for image search as well
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find relevant news images for: ${searchQuery}`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    }));

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const images: GroundingImage[] = [];

    if (chunks) {
        chunks.forEach(chunk => {
            if (chunk.web?.uri && (chunk.web.uri.match(/\.(jpeg|jpg|gif|png|webp)$/) || chunk.web.title)) {
                 images.push({
                     url: chunk.web.uri,
                     title: chunk.web.title || 'Source Link',
                     source: chunk.web.title || 'Web Result'
                 });
            }
        });
    }
    
    // Filter duplicates
    const uniqueImages = images.filter((v,i,a)=>a.findIndex(v2=>(v2.url===v.url))===i);
    return uniqueImages.slice(0, 10);

  } catch (error) {
    console.error("Error searching images:", error);
    return [];
  }
}