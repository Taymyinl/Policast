import React, { useState, useEffect, useRef } from 'react';
import { NewsItem, GeneratedContent, GroundingImage, SavedProject } from '../types';
import { generateContentKit, searchRelatedImages } from '../services/geminiService';
import { ArrowLeft, Loader2, Save, ExternalLink, Copy, Download, RefreshCw, Image as ImageIcon, Search, Facebook, GripVertical, GripHorizontal } from 'lucide-react';

interface DetailViewProps {
  newsItem: NewsItem;
  onBack: () => void;
  onSave: (project: SavedProject) => void;
  existingProject?: SavedProject | null;
}

export const DetailView: React.FC<DetailViewProps> = ({ newsItem, onBack, onSave, existingProject }) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<GeneratedContent | null>(existingProject?.generatedContent || null);
  const [groundingImages, setGroundingImages] = useState<GroundingImage[]>(existingProject?.groundingImages || []);
  const [error, setError] = useState<string | null>(null);

  // Layout State
  const [leftWidth, setLeftWidth] = useState(60); // Percentage
  const [scriptHeight, setScriptHeight] = useState(600); // Pixels
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingHorz = useRef(false);
  const isDraggingVert = useRef(false);

  // Resize Handlers
  const startDragHorz = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingHorz.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startDragVert = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingVert.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingHorz.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        if (newLeftWidth > 20 && newLeftWidth < 80) {
          setLeftWidth(newLeftWidth);
        }
      }
      if (isDraggingVert.current) {
        // We track vertical movement relative to where the script block is
        // Ideally we just add delta, but simple absolute tracking works if we assume top layout is static-ish
        // Better: calculate based on previous height + movement.
        // Simplified: Just use raw movement but clamp it.
        // Actually, let's just use the movementY
        setScriptHeight(prev => {
           const newHeight = prev + e.movementY;
           return Math.max(200, Math.min(newHeight, 1000));
        });
      }
    };

    const handleMouseUp = () => {
      isDraggingHorz.current = false;
      isDraggingVert.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const generated = await generateContentKit(newsItem);
      
      let images: GroundingImage[] = [];
      if (generated.imageQueries && generated.imageQueries.length > 0) {
          images = await searchRelatedImages(generated.imageQueries);
      }

      setContent(generated);
      setGroundingImages(images);

      const project: SavedProject = {
        id: existingProject?.id || `proj-${Date.now()}`,
        newsItem,
        generatedContent: generated,
        savedAt: new Date().toISOString(),
        groundingImages: images
      };
      onSave(project);

    } catch (err) {
      setError("Failed to generate content. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLocalSave = () => {
    if (!content) return;
    const project: SavedProject = {
      id: existingProject?.id || `proj-${Date.now()}`,
      newsItem,
      generatedContent: content,
      savedAt: new Date().toISOString(),
      groundingImages
    };
    onSave(project);
    alert("Project saved to your local list!");
  };

  const downloadProjectData = () => {
     if (!content) return;
     const dataStr = JSON.stringify({ newsItem, generatedContent: content, groundingImages }, null, 2);
     const blob = new Blob([dataStr], { type: "application/json" });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `policast-${newsItem.id}.json`;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const copyScript = () => {
    if (content?.scriptBurmese) {
        navigator.clipboard.writeText(content.scriptBurmese);
        alert("Script copied to clipboard");
    }
  };
  
  const copyFacebook = () => {
    if (content?.facebookPostBurmese) {
        navigator.clipboard.writeText(content.facebookPostBurmese);
        alert("Facebook post copied");
    }
  }

  // Script Rendering Logic
  const renderScript = (text: string) => {
    // Split by newlines first to maintain paragraph structure
    const lines = text.split('\n');
    return lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-4"></div>;
        
        // Check if line contains brackets [ ]
        // We assume visual instructions are wrapped in brackets, often entirely
        // or embedded. For simplicity, if a line starts with [, treat as visual block
        // If embedded, we can split string.
        
        const parts = line.split(/(\[.*?\])/g);
        
        return (
            <div key={i} className="mb-4">
                {parts.map((part, idx) => {
                    if (part.startsWith('[') && part.endsWith(']')) {
                        // Visual Instruction Block
                        return (
                            <div key={idx} className="block my-2 p-2 bg-blue-900/30 border border-blue-800/50 rounded text-yellow-200 font-mono text-sm tracking-wide">
                                <span className="text-blue-400 font-bold uppercase text-xs mr-2">Visual:</span>
                                {part.replace(/[\[\]]/g, '')}
                            </div>
                        );
                    } else if (part.trim()) {
                         // Dialog Block
                         return (
                            <span key={idx} className="text-xl leading-[3rem] text-slate-100 font-medium">
                                {part}
                            </span>
                         );
                    }
                    return null;
                })}
            </div>
        );
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex-none flex items-center gap-4 border-b border-slate-800 pb-4 mb-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-800 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white leading-tight truncate">{newsItem.title}</h2>
          <a href={newsItem.url} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline flex items-center gap-1 mt-1">
            {newsItem.source} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {content && (
            <div className="flex gap-2">
                <button onClick={handleLocalSave} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                    <Save className="w-4 h-4" /> Save
                </button>
                <button onClick={downloadProjectData} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                    <Download className="w-4 h-4" /> JSON
                </button>
            </div>
        )}
      </div>

      {/* Main Content Area */}
      {!content && !loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed m-4">
          <p className="text-slate-400 mb-6 text-center max-w-md">
            Ready to process this news?
          </p>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-lg shadow-blue-900/20"
          >
            <RefreshCw className="w-5 h-5" />
            Generate Content Kit
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-slate-400 animate-pulse">Analyzing geopolitical context...</p>
        </div>
      )}

      {content && (
        <div ref={containerRef} className="flex-1 flex overflow-hidden relative border border-slate-800 rounded-xl bg-slate-950">
            
            {/* Left Column (Resizable) */}
            <div style={{ width: `${leftWidth}%` }} className="flex flex-col h-full border-r border-slate-800 min-w-[300px]">
                
                {/* Script Section (Resizable Height) */}
                <div style={{ height: `${scriptHeight}px` }} className="flex flex-col bg-slate-900/50 min-h-[200px]">
                    <div className="flex-none p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                            Burmese Script (1.5m)
                        </h3>
                         <button onClick={copyScript} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white" title="Copy Script">
                            <Copy className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 font-sans">
                         {renderScript(content.scriptBurmese)}
                    </div>
                </div>

                {/* Vertical Resizer Handle */}
                <div 
                    onMouseDown={startDragVert}
                    className="h-2 bg-slate-800 hover:bg-blue-500 cursor-row-resize flex items-center justify-center shrink-0 z-10 transition-colors"
                >
                    <GripHorizontal className="w-4 h-4 text-slate-500" />
                </div>

                {/* Bottom Left Section (Summaries & Facebook) */}
                <div className="flex-1 overflow-y-auto bg-slate-950 p-6 space-y-6">
                    {/* Facebook Post */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                             <h3 className="font-bold text-white flex items-center gap-2">
                                <Facebook className="w-5 h-5 text-blue-500" />
                                Facebook Post
                             </h3>
                             <button onClick={copyFacebook} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                                <Copy className="w-3 h-3" />
                             </button>
                        </div>
                        <div className="bg-slate-950 p-4 rounded border border-slate-800 text-slate-200 whitespace-pre-wrap text-lg leading-loose">
                            {content.facebookPostBurmese}
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                        <div>
                            <h4 className="text-sm font-semibold text-slate-500 uppercase mb-2">English Summary</h4>
                            <p className="text-slate-300 text-sm">{content.summaryEnglish}</p>
                        </div>
                        <div className="border-t border-slate-800 pt-4">
                            <h4 className="text-sm font-semibold text-slate-500 uppercase mb-2">Burmese Summary</h4>
                            <p className="text-slate-300 text-sm font-medium leading-relaxed">{content.summaryBurmese}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Horizontal Resizer Handle */}
             <div 
                onMouseDown={startDragHorz}
                className="w-2 bg-slate-800 hover:bg-blue-500 cursor-col-resize flex items-center justify-center shrink-0 z-10 transition-colors h-full"
            >
                <GripVertical className="w-4 h-4 text-slate-500" />
            </div>

            {/* Right Column (Visuals) */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-950 min-w-[300px]">
                
                 {/* Burmese Titles */}
                {content.burmeseTitles && content.burmeseTitles.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                        <h3 className="text-lg font-bold text-white mb-4">Suggested Titles</h3>
                        <div className="space-y-2">
                            {content.burmeseTitles.map((title, idx) => (
                                <div key={idx} className="p-3 bg-slate-950 rounded border border-slate-800 text-blue-400 font-bold text-lg">
                                    {title}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Visual Prompts */}
                 <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-bold text-white mb-4">AI Visual Prompts</h3>
                    <ul className="list-disc list-inside space-y-2">
                        {content.visualPrompts.map((prompt, idx) => (
                            <li key={idx} className="text-sm text-slate-300">
                                {prompt}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Grounding Results */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-purple-500" />
                        Media Search
                    </h3>
                    <div className="space-y-3">
                        {groundingImages.length > 0 ? groundingImages.map((img, idx) => (
                            <a 
                                key={idx} 
                                href={img.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="block p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
                            >
                                <p className="text-sm text-blue-400 font-medium truncate">{img.title}</p>
                                <p className="text-xs text-slate-500 truncate">{img.url}</p>
                            </a>
                        )) : (
                            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 border-dashed">
                                 <p className="text-slate-400 italic text-sm mb-3">Suggested keywords for manual search:</p>
                                 <div className="flex flex-wrap gap-2">
                                    {content.imageQueries.map((query, idx) => (
                                        <a 
                                            key={idx}
                                            href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 text-sm rounded-full transition-colors"
                                        >
                                            <Search className="w-3 h-3" />
                                            {query}
                                        </a>
                                    ))}
                                 </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
      )}
    </div>
  );
};