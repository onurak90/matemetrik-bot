'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ContentStudio() {
  // Fikir Jeneratörü & Trend State'leri
  const [ideationTopic, setIdeationTopic] = useState('');
  const [isIdeating, setIsIdeating] = useState(false);
  const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>([]);
  const [selectedIdeas, setSelectedIdeas] = useState<string[]>([]);

  // Form State'leri
  const [topicsInput, setTopicsInput] = useState('');
  const [url, setUrl] = useState('');
  const [tone, setTone] = useState('Profesyonel ve Bilgi Verici');
  const [length, setLength] = useState('Orta (500-800 Kelime)');
  const [customInstructions, setCustomInstructions] = useState('');
  
  // Uygulama State'leri
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentTopic: '' });
  
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'favorites'>('history');
  
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('matemetrik_history');
    const savedFavorites = localStorage.getItem('matemetrik_favorites');
    if (savedHistory) try { setHistory(JSON.parse(savedHistory)); } catch (e) {}
    if (savedFavorites) try { setFavorites(JSON.parse(savedFavorites)); } catch (e) {}
  }, []);

  const handleIdeate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideationTopic) return alert("Lütfen bir ana konu girin!");
    
    setIsIdeating(true);
    try {
      const res = await fetch('/api/ideation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: ideationTopic })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setSuggestedIdeas(data.ideas || []);
      setSelectedIdeas([]);
    } catch (err: any) {
      alert("Trend aranırken hata: " + err.message);
    } finally {
      setIsIdeating(false);
    }
  };

  const toggleIdeaSelection = (idea: string) => {
    if (selectedIdeas.includes(idea)) {
      setSelectedIdeas(selectedIdeas.filter(i => i !== idea));
    } else {
      setSelectedIdeas([...selectedIdeas, idea]);
    }
  };

  const addIdeasToQueue = () => {
    if (selectedIdeas.length === 0) return;
    const currentInput = topicsInput.trim();
    // Hacim emojilerini temizleyerek kuyruğa ekle
    const newLines = selectedIdeas.map(idea => idea.replace(/🔥 Yüksek Hacim:|📊 Orta Hacim:|📉 Düşük Hacim:/g, '').trim()).join('\n');
    
    setTopicsInput(currentInput ? `${currentInput}\n${newLines}` : newLines);
    
    setSelectedIdeas([]);
    setSuggestedIdeas([]);
    setIdeationTopic('');
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const topicsList = topicsInput.split('\n').map(t => t.trim()).filter(t => t !== '');
    if (topicsList.length === 0) return alert("Lütfen en az bir konu girin!");
    
    setIsGenerating(true);
    setProgress({ current: 0, total: topicsList.length, currentTopic: '' });

    let currentHistory = [...history];

    for (let i = 0; i < topicsList.length; i++) {
      const currentTopic = topicsList[i];
      setProgress({ current: i + 1, total: topicsList.length, currentTopic });

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: currentTopic, url, tone, length, customInstructions })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        const contentWithData = { ...data, originalTopic: currentTopic, id: Date.now() + i };
        
        currentHistory = [contentWithData, ...currentHistory];
        setHistory(currentHistory);
        localStorage.setItem('matemetrik_history', JSON.stringify(currentHistory));
        setGeneratedContent(contentWithData);

        if (i < topicsList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      } catch (error: any) {
        alert(`'${currentTopic}' üretilirken hata oluştu: ` + error.message);
      }
    }

    setIsGenerating(false);
    setProgress({ current: 0, total: 0, currentTopic: '' });
  };

  const toggleFavorite = (item: any) => {
    const isFav = favorites.some(f => f.id === item.id);
    let newFavs;
    if (isFav) {
      newFavs = favorites.filter(f => f.id !== item.id);
    } else {
      newFavs = [item, ...favorites];
    }
    setFavorites(newFavs);
    localStorage.setItem('matemetrik_favorites', JSON.stringify(newFavs));
  };

  const handleCopyMini = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const isCurrentFavorite = generatedContent ? favorites.some(f => f.id === generatedContent.id) : false;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Matemetrik Pro Stüdyo</h1>
            <p className="text-gray-500 mt-1">LaTeX Matematik Desteği + Sosyal Medya Motoru + Trend Analizi 🚀</p>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* SOL PANEL */}
          <div className="w-full lg:w-1/3 flex flex-col gap-6">
            
            {/* TREND VE HACİM BULUCU */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl shadow-sm border border-blue-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl">📈</div>
              <h2 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
                <span>📈</span> Trend & Anahtar Kelime Analizi
              </h2>
              <form onSubmit={handleIdeate} className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  className="flex-1 border border-blue-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                  placeholder="Aranacak konu (Örn: Logaritma)" 
                  value={ideationTopic} 
                  onChange={(e) => setIdeationTopic(e.target.value)} 
                />
                <button type="submit" disabled={isIdeating} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 rounded-lg text-sm transition-colors">
                  {isIdeating ? 'Tarama...' : 'Analiz Et'}
                </button>
              </form>

              {suggestedIdeas.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">Önerilen Konular (Seçiniz):</p>
                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                    {suggestedIdeas.map((idea, idx) => (
                      <label key={idx} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors border ${selectedIdeas.includes(idea) ? 'bg-blue-100 border-blue-300' : 'bg-white border-transparent hover:border-blue-200'}`}>
                        <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500" checked={selectedIdeas.includes(idea)} onChange={() => toggleIdeaSelection(idea)} />
                        <span className="text-sm text-gray-800 leading-tight">
                           {idx === 0 || idx === 1 ? '🔥 Yüksek Hacim: ' : '📊 Orta Hacim: '} {idea}
                        </span>
                      </label>
                    ))}
                  </div>
                  <button onClick={addIdeasToQueue} disabled={selectedIdeas.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                    Seçilenleri Üretim Kuyruğuna Ekle ⬇️
                  </button>
                </div>
              )}
            </div>

            {/* TOPLU ÜRETİM MODU */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-2">🏭</span>
                Üretim Kuyruğu
              </h2>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Konular (Yukarıdan aktarın veya yazın)</label>
                  <textarea className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm leading-relaxed" rows={4} value={topicsInput} onChange={(e) => setTopicsInput(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rakip URL (Opsiyonel)</label>
                  <input type="url" className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={url} onChange={(e) => setUrl(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dil & Ton</label>
                    <select className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none" value={tone} onChange={(e) => setTone(e.target.value)}>
                      <option>Profesyonel ve Bilgi Verici</option>
                      <option>Samimi ve Eğlenceli</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Uzunluk</label>
                    <select className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none" value={length} onChange={(e) => setLength(e.target.value)}>
                      <option>Orta (500-800 Kelime)</option>
                      <option>Uzun (800-1200 Kelime)</option>
                    </select>
                  </div>
                </div>
                
                <button type="submit" disabled={isGenerating} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex justify-center">
                  {isGenerating ? <span className="animate-pulse">Üretiliyor ({progress.current}/{progress.total})... ⏳</span> : <span>Kuyruktakileri Üret 🚀</span>}
                </button>
              </form>
            </div>

            {/* GEÇMİŞ VE FAVORİLER */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden min-h-[300px]">
              <div className="flex border-b border-gray-200">
                <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'history' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>🕒 Geçmiş</button>
                <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'favorites' ? 'bg-yellow-50 text-yellow-700 border-b-2 border-yellow-500' : 'text-gray-500 hover:bg-gray-50'}`}>⭐ Favoriler</button>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto">
                {activeTab === 'history' && history.map((item, i) => (
                  <div key={i} onClick={() => setGeneratedContent(item)} className="p-3 mb-2 border border-gray-100 rounded-lg hover:bg-blue-50 cursor-pointer">
                    <p className="font-semibold text-gray-800 text-sm line-clamp-1">{item.newTitle}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(item.id).toLocaleDateString()} - {item.focusKeyword}</p>
                  </div>
                ))}
                
                {activeTab === 'favorites' && favorites.length === 0 && <p className="text-sm text-gray-500 text-center mt-4">Henüz favorilere eklenmiş bir yazı yok.</p>}
                {activeTab === 'favorites' && favorites.map((item, i) => (
                  <div key={i} onClick={() => setGeneratedContent(item)} className="p-3 mb-2 border border-yellow-100 bg-yellow-50 rounded-lg hover:bg-yellow-100 cursor-pointer">
                    <p className="font-semibold text-gray-800 text-sm line-clamp-1">⭐ {item.newTitle}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SAĞ PANEL */}
          <div className="w-full lg:w-2/3">
            {generatedContent ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center">
                   <div className="flex items-center gap-3">
                      <button onClick={() => toggleFavorite(generatedContent)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium text-sm transition-colors ${isCurrentFavorite ? 'bg-yellow-100 border-yellow-300 text-yellow-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                        {isCurrentFavorite ? '⭐ Favorilerde' : '☆ Favoriye Ekle'}
                      </button>
                   </div>
                  <button onClick={() => handleCopyMini(generatedContent.blogPost, 'makale')} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center gap-2">
                    {copiedField === 'makale' ? '✅ Kopyalandı' : '📝 Tamamını Kopyala'}
                  </button>
                </div>

                <div className="p-6 md:p-8">
                  <div className="mb-8">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">🎯 SEO Meta Verileri</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-start shadow-sm group hover:border-blue-300 transition-colors">
                        <div className="pr-2">
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Odak Kelime</span>
                          <p className="text-gray-900 font-semibold">{generatedContent.focusKeyword}</p>
                        </div>
                        <button onClick={() => handleCopyMini(generatedContent.focusKeyword, 'keyword')} className="text-gray-400 hover:text-blue-600 p-1" title="Kopyala">
                          {copiedField === 'keyword' ? '✅' : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>}
                        </button>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-start shadow-sm group hover:border-blue-300 transition-colors">
                        <div className="pr-2">
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Kısa URL (Slug)</span>
                          <p className="text-blue-600 font-medium font-mono text-sm">/{generatedContent.slug}</p>
                        </div>
                        <button onClick={() => handleCopyMini(generatedContent.slug, 'slug')} className="text-gray-400 hover:text-blue-600 p-1" title="Kopyala">
                           {copiedField === 'slug' ? '✅' : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>}
                        </button>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-start shadow-sm group hover:border-blue-300 transition-colors md:col-span-2">
                        <div className="pr-2">
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Makale Başlığı (H1)</span>
                          <p className="text-gray-900 font-medium">{generatedContent.newTitle}</p>
                        </div>
                        <button onClick={() => handleCopyMini(generatedContent.newTitle, 'title')} className="text-gray-400 hover:text-blue-600 p-1 flex-shrink-0" title="Kopyala">
                           {copiedField === 'title' ? '✅' : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>}
                        </button>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-start shadow-sm group hover:border-blue-300 transition-colors md:col-span-2">
                        <div className="pr-2">
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Meta Açıklama (Description)</span>
                          <p className="text-gray-600 text-sm leading-relaxed">{generatedContent.metaDescription}</p>
                        </div>
                        <button onClick={() => handleCopyMini(generatedContent.metaDescription, 'meta')} className="text-gray-400 hover:text-blue-600 p-1 flex-shrink-0" title="Kopyala">
                           {copiedField === 'meta' ? '✅' : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>}
                        </button>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-start shadow-sm group hover:border-blue-300 transition-colors md:col-span-2">
                        <div className="pr-2 w-full">
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Etiketler (Tags)</span>
                          <div className="flex gap-2 flex-wrap">
                            {generatedContent.tags?.map((tag: string, i: number) => (
                              <span key={i} className="bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">#{tag}</span>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => handleCopyMini(generatedContent.tags?.join(', '), 'tags')} className="text-gray-400 hover:text-blue-600 p-1 flex-shrink-0" title="Kopyala">
                           {copiedField === 'tags' ? '✅' : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Kapak Görseli */}
                  {generatedContent.imagePrompts && generatedContent.imagePrompts.length > 0 && (
                     <div className="mb-8 relative rounded-xl overflow-hidden shadow-md bg-gray-900 group">
                        <img 
                          src={`https://image.pollinations.ai/prompt/${encodeURIComponent(generatedContent.imagePrompts[0])}?width=1024&height=512&nologo=true`} 
                          alt="AI Makale Kapağı"
                          className="w-full h-64 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                     </div>
                  )}

                  {/* YENİ: Makale İçeriği (LaTeX Destekli) */}
                  <div className="mb-8">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">📝 Makale İçeriği (LaTeX Uyumlu)</h3>
                    <div className="prose prose-blue max-w-none text-gray-800 bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-inner">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {generatedContent.blogPost}
                      </ReactMarkdown>
                    </div>
                  </div>
                  
                  {/* YENİ: Sosyal Medya Paylaşımları */}
                  {generatedContent.socialMedia && (
                    <div className="mt-8">
                       <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">📱 Sosyal Medya Çıktıları</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          {/* Twitter */}
                          <div className="border border-blue-200 rounded-xl bg-blue-50/50 p-5 relative">
                             <h4 className="font-bold text-blue-600 mb-2 flex items-center gap-2">🐦 X (Twitter) Flood</h4>
                             <p className="text-sm text-gray-700 whitespace-pre-wrap">{generatedContent.socialMedia.twitter}</p>
                             <button onClick={() => handleCopyMini(generatedContent.socialMedia.twitter, 'twitter')} className="mt-3 text-xs bg-white border border-blue-200 px-3 py-1 rounded shadow-sm hover:bg-blue-50 text-blue-700 font-medium">Kopyala</button>
                          </div>

                          {/* Instagram */}
                          <div className="border border-pink-200 rounded-xl bg-pink-50/50 p-5 relative">
                             <h4 className="font-bold text-pink-600 mb-2 flex items-center gap-2">📸 Instagram Post</h4>
                             <p className="text-sm text-gray-700 whitespace-pre-wrap">{generatedContent.socialMedia.instagram}</p>
                             <button onClick={() => handleCopyMini(generatedContent.socialMedia.instagram, 'instagram')} className="mt-3 text-xs bg-white border border-pink-200 px-3 py-1 rounded shadow-sm hover:bg-pink-50 text-pink-700 font-medium">Kopyala</button>
                          </div>

                       </div>
                    </div>
                  )}

                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] bg-white rounded-2xl border flex flex-col items-center justify-center text-gray-400 p-8">
                <span className="text-5xl mb-4">⚙️</span>
                <h3 className="text-xl font-bold text-gray-600 mb-2">Makale Motoru Beklemede</h3>
                <p className="text-center text-sm mt-2 max-w-md">Sol taraftaki panelden "Limit", "Türev" gibi konular aratarak trendleri görebilir, seçtiklerini LaTeX ve Sosyal Medya destekli üretime sokabilirsin.</p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}