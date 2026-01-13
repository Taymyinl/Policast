import React, { useState, useEffect } from 'react';
import { ViewState, NewsItem, SavedProject } from './types';
import { fetchPoliticalNews } from './services/geminiService';
import { NewsCard } from './components/NewsCard';
import { DetailView } from './components/DetailView';
import { Newspaper, Save, Upload, Plus, List, Loader2, Trash2, FileJson, AlertTriangle } from 'lucide-react';

const App = () => {
  const [view, setView] = useState<ViewState>(ViewState.DISCOVER);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [selectedSavedProject, setSelectedSavedProject] = useState<SavedProject | null>(null);
  
  // Initialize saved projects from localStorage if available, else empty array
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(() => {
    const local = localStorage.getItem('policast_saved');
    return local ? JSON.parse(local) : [];
  });

  // Sync with local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('policast_saved', JSON.stringify(savedProjects));
  }, [savedProjects]);

  const handleFetchNews = async () => {
    setLoadingNews(true);
    setErrorMsg(null);
    try {
      const items = await fetchPoliticalNews();
      setNews(prevNews => {
          // Create a Set of existing titles to avoid duplicates
          const existingTitles = new Set(prevNews.map(n => n.title));
          const uniqueNewItems = items.filter(item => !existingTitles.has(item.title));
          // Prepend new items
          return [...uniqueNewItems, ...prevNews];
      });
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('429') || e.message?.includes('Too Many Requests')) {
         setErrorMsg("High traffic detected. The AI is busy. Please wait a minute and try again.");
      } else {
         setErrorMsg("Failed to load news. Please check your internet connection.");
      }
    } finally {
      setLoadingNews(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (view === ViewState.DISCOVER && news.length === 0) {
      handleFetchNews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProjectSave = (project: SavedProject) => {
    setSavedProjects(prev => {
      const exists = prev.findIndex(p => p.id === project.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = project;
        return updated;
      }
      return [project, ...prev];
    });
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm("Are you sure you want to delete this saved project?")) {
        setSavedProjects(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleGlobalExport = async () => {
    const dataStr = JSON.stringify(savedProjects, null, 2);
    
    try {
      // @ts-ignore
      if (window.showSaveFilePicker) {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: `policast-backup-${new Date().toISOString().split('T')[0]}.json`,
          types: [{
            description: 'JSON Database',
            accept: { 'application/json': ['.json'] },
          }],
        });
        
        const writable = await handle.createWritable();
        await writable.write(dataStr);
        await writable.close();
        
        alert("Saved successfully! The browser will remember this location for next time.");
      } else {
        // Fallback for browsers without File System Access API
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `policast-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Export cancelled or failed:", err);
    }
  };

  const handleGlobalImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
            // Merge strategy: Append distinct IDs
            setSavedProjects(prev => {
                const newItems = (json as SavedProject[]).filter(j => !prev.some(p => p.id === j.id));
                return [...newItems, ...prev];
            });
            alert(`Imported ${json.length} projects.`);
        } else {
            alert("Invalid JSON format. Expected an array of projects.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
                setView(ViewState.DISCOVER);
                setSelectedItem(null);
                setSelectedSavedProject(null);
            }}>
              <div className="bg-blue-600 p-2 rounded-lg">
                <Newspaper className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">PoliCast</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                    setView(ViewState.DISCOVER);
                    setSelectedItem(null);
                    setSelectedSavedProject(null);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${view === ViewState.DISCOVER ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Discover</span>
              </button>
              
              <button 
                onClick={() => {
                    setView(ViewState.SAVED);
                    setSelectedItem(null);
                    setSelectedSavedProject(null);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${view === ViewState.SAVED ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Saved ({savedProjects.length})</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* VIEW: DISCOVER (LIST) */}
        {view === ViewState.DISCOVER && !selectedItem && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Latest Political Headlines</h1>
                <p className="text-slate-400">Curated hot topics ready for content creation.</p>
              </div>
              <button 
                onClick={handleFetchNews} 
                disabled={loadingNews}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                 {loadingNews ? <Loader2 className="w-4 h-4 animate-spin" /> : <Newspaper className="w-4 h-4" />}
                 {news.length > 0 ? "Load More News" : "Refresh News"}
              </button>
            </div>
            
            {/* Error Banner */}
            {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3 text-red-200 animate-in fade-in">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{errorMsg}</span>
                    <button onClick={handleFetchNews} className="ml-auto text-sm bg-red-500/20 hover:bg-red-500/30 px-3 py-1 rounded transition-colors">
                        Try Again
                    </button>
                </div>
            )}

            {loadingNews && news.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  <p className="text-slate-500">Scouring the web for political news...</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {news.map((item) => (
                  <NewsCard 
                    key={item.id} 
                    item={item} 
                    onClick={(i) => {
                      setSelectedItem(i);
                      setSelectedSavedProject(null);
                      setView(ViewState.DETAIL);
                    }} 
                  />
                ))}
              </div>
            )}

            {loadingNews && news.length > 0 && (
                <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            )}
            
            {!loadingNews && !errorMsg && news.length === 0 && (
                <div className="text-center py-20 text-slate-500">
                    No news found. Try refreshing.
                </div>
            )}
          </div>
        )}

        {/* VIEW: SAVED LIST */}
        {view === ViewState.SAVED && !selectedSavedProject && (
             <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Project Library</h1>
                        <p className="text-slate-400 text-sm">
                            Manage your scripts and research. 
                            <span className="text-blue-500 ml-1">(Auto-saved to browser)</span>
                        </p>
                    </div>
                    <div className="flex gap-3">
                         <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors border border-slate-700">
                            <Upload className="w-4 h-4" />
                            Import JSON
                            <input type="file" accept=".json" onChange={handleGlobalImport} className="hidden" />
                        </label>
                        <button 
                            onClick={handleGlobalExport}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
                        >
                            <FileJson className="w-4 h-4" />
                            Export / Save As...
                        </button>
                    </div>
                </div>

                {savedProjects.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl">
                        <p className="text-slate-500 mb-4">No saved projects yet.</p>
                        <button 
                            onClick={() => setView(ViewState.DISCOVER)}
                            className="text-blue-400 hover:underline"
                        >
                            Go Discover News
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {savedProjects.map((proj) => (
                             <div 
                                key={proj.id}
                                onClick={() => {
                                    setSelectedSavedProject(proj);
                                    setSelectedItem(proj.newsItem);
                                    setView(ViewState.DETAIL);
                                }}
                                className="group bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center cursor-pointer hover:border-blue-500 transition-colors"
                             >
                                <div>
                                    <h3 className="font-bold text-slate-200 group-hover:text-blue-400">{proj.newsItem.title}</h3>
                                    <p className="text-xs text-slate-500 mt-1">Saved: {new Date(proj.savedAt).toLocaleString()}</p>
                                </div>
                                <button 
                                    onClick={(e) => deleteProject(proj.id, e)}
                                    className="p-2 text-slate-600 hover:text-red-400 hover:bg-slate-800 rounded-full transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                        ))}
                    </div>
                )}
             </div>
        )}

        {/* VIEW: DETAIL */}
        {view === ViewState.DETAIL && selectedItem && (
          <DetailView 
            newsItem={selectedItem}
            existingProject={selectedSavedProject}
            onBack={() => {
               if (selectedSavedProject) {
                   setView(ViewState.SAVED);
                   setSelectedSavedProject(null);
               } else {
                   setView(ViewState.DISCOVER);
               }
               setSelectedItem(null);
            }}
            onSave={handleProjectSave}
          />
        )}

      </main>
    </div>
  );
};

export default App;