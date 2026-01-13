import React from 'react';
import { NewsItem } from '../types';
import { ChevronRight, Globe, Calendar } from 'lucide-react';

interface NewsCardProps {
  item: NewsItem;
  onClick: (item: NewsItem) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({ item, onClick }) => {
  return (
    <div 
      onClick={() => onClick(item)}
      className="group bg-slate-900 border border-slate-800 hover:border-blue-500 rounded-xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/10 flex flex-col gap-3"
    >
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-bold text-slate-100 group-hover:text-blue-400 leading-snug">
          {item.title}
        </h3>
        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 shrink-0 mt-1" />
      </div>
      
      <p className="text-slate-400 text-sm line-clamp-2">
        {item.snippet}
      </p>

      <div className="flex items-center gap-4 text-xs text-slate-500 mt-auto pt-2 border-t border-slate-800">
        <div className="flex items-center gap-1">
          <Globe className="w-3 h-3" />
          <span className="truncate max-w-[150px]">{item.source || 'Unknown Source'}</span>
        </div>
        {item.publishedDate && (
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{item.publishedDate}</span>
          </div>
        )}
      </div>
    </div>
  );
};
