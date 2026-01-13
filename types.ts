export interface NewsItem {
  id: string;
  title: string;
  snippet: string;
  source?: string;
  url?: string;
  publishedDate?: string;
}

export interface GeneratedContent {
  summaryEnglish: string;
  summaryBurmese: string;
  scriptBurmese: string; // 1.5 min script
  facebookPostBurmese: string; // Content for Facebook page
  burmeseTitles: string[];
  visualPrompts: string[];
  imageQueries: string[]; // For searching images
}

export interface SavedProject {
  id: string;
  newsItem: NewsItem;
  generatedContent: GeneratedContent | null;
  savedAt: string;
  groundingImages: GroundingImage[];
}

export interface GroundingImage {
  url: string;
  title: string;
  source: string;
}

export enum ViewState {
  DISCOVER = 'DISCOVER',
  DETAIL = 'DETAIL',
  SAVED = 'SAVED'
}

export interface SearchResponse {
    items: NewsItem[];
}