'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ContentStudio() {
  const [ideationTopic, setIdeationTopic] = useState('');
  const [isIdeating, setIsIdeating] = useState(false);
  const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>([]);
  const [selectedIdeas, setSelectedIdeas] = useState<string[]>([]);

  const [topicsInput, setTopicsInput] = useState('');
  const [url, setUrl] = useState('');
  const [tone, setTone] = useState('Bilgilendirme');
  const [length, setLength] = useState('Orta (600 kelime)');
  const [customInstructions, setCustomInstructions] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentTopic: '' });
  
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'favorites'>('history');

  const [selectedExportIds, setSelectedExportIds] = useState<number[]>([]);
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
    const newLines = selectedIdeas.map(idea => idea.replace(/🔥 Yüksek Hacim:|📊 Orta Hacim:|📉 Düşük Hacim:/g, '').trim()).join('\n');
    setTopicsInput(currentInput ? `${currentInput}\n${newLines}` : newLines);
    setSelectedIdeas([]);
    setSuggestedIdeas([]);
    setIdeationTopic('');
  };

  const handleGenerate = async (e: React.FormEvent, isBulk: boolean = false) => {
    e.preventDefault();
    const topicsList = topicsInput.split('\n').map(t => t.trim()).filter(t => t !== '');
    if (topicsList.length === 0) return alert("Lütfen en az bir konu girin!");
    
    setIsGenerating(true);
    setProgress({ current: 0, total: topicsList.length, currentTopic: '' });

    let currentHistory = [...history];

    if (isBulk) {
      setProgress({ current: topicsList.length, total: topicsList.length, currentTopic: 'Toplu İşleniyor...' });
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'bulk', bulkTopics: topicsList, tone, length, customInstructions })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const itemsArray = data.items || data;
        if (Array.isArray(itemsArray)) {
          currentHistory = [...itemsArray, ...currentHistory];
          setHistory(currentHistory);
          localStorage.setItem('matemetrik_history', JSON.stringify(currentHistory));
          setGeneratedContent(itemsArray[0]);
        }
      } catch (error: any) {
        alert("Toplu üretim hatası: " + error.message);
      }
    } else {
      for (let i = 0; i < topicsList.length; i++) {
        const currentTopic = topicsList[i];
        setProgress({ current: i + 1, total: topicsList.length, currentTopic });

        try {
          const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: currentTopic, url, tone, length, customInstructions, mode: 'single' })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          
          const contentWithData = { ...data, originalTopic: currentTopic, id: Date.now() + i };
          
          currentHistory = [contentWithData, ...currentHistory];
          setHistory(currentHistory);
          localStorage.setItem('matemetrik_history', JSON.stringify(currentHistory));
          setGeneratedContent(contentWithData);

          if (i < topicsList.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error: any) {
          alert(`'${currentTopic}' üretilirken hata oluştu: ` + error.message);
        }
      }
    }

    setIsGenerating(false);
    setProgress({ current: 0, total: 0, currentTopic: '' });
  };

  const toggleExportSelection = (id: number) => {
    if (selectedExportIds.includes(id)) {
      setSelectedExportIds(selectedExportIds.filter(itemid => itemid !== id));
    } else {
      setSelectedExportIds([...selectedExportIds, id]);
    }
  };

  const exportSelectedToWordPressXml = async () => {
    const targetList = activeTab === 'history' ? history : favorites;
    const itemsToExport = targetList.filter(item => selectedExportIds.includes(item.id));

    if (itemsToExport.length === 0) {
      return alert("Lütfen dışa aktarmak için listeden en az bir makale seçin!");
    }

    try {
      const res = await fetch('/api/export-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToExport })
      });

      if (!res.ok) throw new Error("XML oluşturulamadı.");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `matemetrik-export-${Date.now()}.xml`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert("Dışa aktarma hatası: " + err.message);
    }
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
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <header className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between border-b border-gray-200 pb-6 gap-4 bg-white p-6 rounded-2xl shadow-sm border">
          <div>
            <div className="flex items-center gap-3">
              <span className="bg-blue-600 text-white p-2.5 rounded-xl shadow-md text-lg">⚡</span>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900">
                Matemetrik Pro Stüdyo
              </h1>
            </div>
            <p className="text-gray-500 text-xs md:text-sm mt-1 ml-11">Yapay Zeka Destekli Modern SEO & Seçmeli WordPress XML Fabrikası</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sistem Aktif & Hazır
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* SOL PANEL */}
          <div className="w-full lg:w-1/3 flex flex-col gap-6">
            
            {/* TREND & KELİME ANALİZİ */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
              <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-blue-600">📈</span> Trend & Anahtar Kelime
              </h2>
              <form onSubmit={handleIdeate} className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all" 
                  placeholder="Örn: 1. Sınıf Matematik..." 
                  value={ideationTopic} 
                  onChange={(e) => setIdeationTopic(e.target.value)} 
                />
                <button type="submit" disabled={isIdeating} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 rounded-xl text-sm transition-all shadow-sm disabled:opacity-50">
                  {isIdeating ? 'Arıyor...' : 'Analiz'}
                </button>
              </form>

              {suggestedIdeas.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {suggestedIdeas.map((idea, idx) => (
                      <label key={idx} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedIdeas.includes(idea) ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                        <input type="checkbox" className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={selectedIdeas.includes(idea)} onChange={() => toggleIdeaSelection(idea)} />
                        <span className="text-xs leading-relaxed font-medium">
                           {idx === 0 || idx === 1 ? '🔥 ' : '📊 '} {idea}
                        </span>
                      </label>
                    ))}
                  </div>
                  <button onClick={addIdeasToQueue} disabled={selectedIdeas.length === 0} className="w-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-semibold py-2.5 rounded-xl text-xs transition-all border border-gray-200">
                    Seçilenleri Kuyruğa Ekle ⬇️
                  </button>
                </div>
              )}
            </div>

            {/* ÜRETİM KUYRUĞU */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-indigo-600">🏭</span> Üretim Kuyruğu
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Konular (Her satıra bir tane)</label>
                  <textarea className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-sm text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all resize-none" rows={4} value={topicsInput} onChange={(e) => setTopicsInput(e.target.value)} placeholder="Konu 1&#10;Konu 2&#10;Konu 3" required />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Rakip URL (Opsiyonel)</label>
                  <input type="url" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-600 focus:bg-white" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Yazım Tarzı</label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 outline-none focus:border-blue-600" value={tone} onChange={(e) => setTone(e.target.value)}>
                      <option value="Bilgilendirme">Bilgilendirme</option>
                      <option value="Rehber">Rehber</option>
                      <option value="Eğlenceli">Eğlenceli</option>
                      <option value="Resmi Dil">Resmi Dil</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Uzunluk</label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 outline-none focus:border-blue-600" value={length} onChange={(e) => setLength(e.target.value)}>
                      <option value="Kısa (300 kelime)">Kısa (~300 k.)</option>
                      <option value="Orta (600 kelime)">Orta (~600 k.)</option>
                      <option value="Uzun (800 ve üzeri kelime)">Uzun (800+ k.)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Özel Talimatlar</label>
                  <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none focus:border-blue-600 focus:bg-white" value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Örn: Şuna odaklan..." />
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button onClick={(e) => handleGenerate(e, false)} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-2 rounded-xl transition-all shadow-md text-xs disabled:opacity-50">
                    {isGenerating ? `Üretiliyor...` : 'Sıralı Üret 🚀'}
                  </button>
                  <button onClick={(e) => handleGenerate(e, true)} disabled={isGenerating} className="bg-gray-900 hover:bg-black text-white font-bold py-3 px-2 rounded-xl transition-all shadow-md text-xs disabled:opacity-50">
                    {isGenerating ? `İşleniyor...` : 'Toplu Üret ⚡'}
                  </button>
                </div>
              </div>
            </div>

            {/* GEÇMİŞ VE SEÇMELİ XML DIŞA AKTARIM */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden min-h-[320px]">
              <div className="flex border-b border-gray-200">
                <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-all ${activeTab === 'history' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>🕒 Geçmiş</button>
                <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-all ${activeTab === 'favorites' ? 'bg-amber-50 text-amber-600 border-b-2 border-amber-500' : 'text-gray-500 hover:bg-gray-50'}`}>⭐ Favoriler</button>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto space-y-2">
                {(activeTab === 'history' ? history : favorites).map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-2 hover:border-blue-400 transition-all">
                    <label className="flex items-center gap-2.5 flex-1 cursor-pointer overflow-hidden">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedExportIds.includes(item.id)}
                        onChange={() => toggleExportSelection(item.id)}
                      />
                      <span onClick={() => setGeneratedContent(item)} className="font-semibold text-gray-800 text-xs line-clamp-1 hover:text-blue-600">
                        {item.newTitle}
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              {/* SEÇİLENLERİ XML İNDİR BUTONU */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <button 
                  onClick={exportSelectedToWordPressXml}
                  disabled={selectedExportIds.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <span>📥</span> Seçilenleri WordPress XML İndir ({selectedExportIds.length})
                </button>
              </div>
            </div>
          </div>

          {/* SAĞ PANEL */}
          <div className="w-full lg:w-2/3">
            {generatedContent ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center">
                   <button onClick={() => toggleFavorite(generatedContent)} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${isCurrentFavorite ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'}`}>
                     {isCurrentFavorite ? '⭐ Favorilerde' : '☆ Favoriye Ekle'}
                   </button>
                  <button onClick={() => handleCopyMini(generatedContent.blogPost, 'makale')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-all shadow-sm">
                    {copiedField === 'makale' ? '✅ Kopyalandı' : '📝 Makaleyi Kopyala'}
                  </button>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                  
                  {/* BAŞLIK, META, SLUG VE ETİKETLER KARTI (EKLENDİ) */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                      <span>📌</span> SEO Bilgileri & Meta Alanları
                    </h3>

                    {/* Başlık */}
                    <div className="relative">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-bold text-gray-600">Makale Başlığı (H1)</label>
                        <button onClick={() => handleCopyMini(generatedContent.newTitle, 'title')} className="text-[10px] text-blue-600 font-bold hover:underline">
                          {copiedField === 'title' ? '✅ Kopyalandı' : 'Kopyala'}
                        </button>
                      </div>
                      <input 
                        type="text" 
                        readOnly 
                        value={generatedContent.newTitle || ''} 
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 outline-none select-all"
                      />
                    </div>

                    {/* URL Slug */}
                    <div className="relative">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-bold text-gray-600">URL Slug</label>
                        <button onClick={() => handleCopyMini(generatedContent.slug, 'slug')} className="text-[10px] text-blue-600 font-bold hover:underline">
                          {copiedField === 'slug' ? '✅ Kopyalandı' : 'Kopyala'}
                        </button>
                      </div>
                      <input 
                        type="text" 
                        readOnly 
                        value={generatedContent.slug || ''} 
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-700 outline-none select-all"
                      />
                    </div>

                    {/* Meta Açıklama */}
                    <div className="relative">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-bold text-gray-600">Meta Açıklama (130-155 Karakter)</label>
                        <button onClick={() => handleCopyMini(generatedContent.metaDescription, 'meta')} className="text-[10px] text-blue-600 font-bold hover:underline">
                          {copiedField === 'meta' ? '✅ Kopyalandı' : 'Kopyala'}
                        </button>
                      </div>
                      <textarea 
                        readOnly 
                        rows={2}
                        value={generatedContent.metaDescription || ''} 
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none select-all resize-none"
                      />
                    </div>

                    {/* Kategori / Etiketler */}
                    {generatedContent.tags && generatedContent.tags.length > 0 && (
                      <div>
                        <label className="text-[11px] font-bold text-gray-600 block mb-1.5">Etiketler</label>
                        <div className="flex flex-wrap gap-1.5">
                          {generatedContent.tags.map((tag: string, i: number) => (
                            <span key={i} className="bg-white border border-gray-200 text-gray-700 text-[10px] font-semibold px-2.5 py-1 rounded-lg">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SEO SKOR KARTI */}
                  {generatedContent.seoAnalytics && (
                    <div className="bg-gradient-to-br from-gray-900 to-blue-950 text-white p-6 rounded-2xl shadow-lg border border-gray-800 relative overflow-hidden">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 border-b border-gray-800">
                        <div>
                          <span className="text-[10px] uppercase tracking-widest text-blue-400 font-extrabold block mb-1">Optimizasyon Analizi</span>
                          <h3 className="text-xl font-black text-white">SEO Skor Kartı</h3>
                        </div>
                        <div className="flex items-center gap-3 bg-white/10 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md">
                          <span className="text-3xl font-black text-emerald-400">{generatedContent.seoAnalytics.score}</span>
                          <div className="text-[10px] text-gray-300 leading-tight">
                            <span className="font-bold text-white block">Genel Skor</span>
                            / 100 Puan
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                        {generatedContent.seoAnalytics.checks.map((check: any, idx: number) => (
                          <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{check.label}</span>
                              <span className="text-xs font-semibold text-gray-200">{check.desc}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                              check.status === 'Mükemmel' || check.status === 'İyi' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 
                              check.status === 'Uyarı' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}>
                              {check.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* KAPAK GÖRSELİ */}
                  {generatedContent.bakedImage && (
                     <div className="rounded-2xl overflow-hidden shadow-md bg-gray-100 border border-gray-200">
                        <img 
                          src={generatedContent.bakedImage} 
                          alt="Kapak Görseli"
                          className="w-full h-auto object-cover"
                        />
                     </div>
                  )}

                  {/* MAKALE İÇERİĞİ */}
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
                      <span>📝</span> Makale İçeriği (Markdown)
                    </h3>
                    <div className="prose max-w-none text-gray-800 bg-gray-50 p-6 rounded-2xl border border-gray-200 text-sm leading-relaxed shadow-inner">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {generatedContent.blogPost}
                      </ReactMarkdown>
                    </div>
                  </div>
                  
                  {/* SOSYAL MEDYA & PROMPTLAR */}
                  {generatedContent.socialMedia && (
                    <div className="space-y-6 pt-4 border-t border-gray-200">
                       <h3 className="text-base font-bold text-gray-800">📱 Sosyal Medya & Slayt Görsel Promptları</h3>
                       
                       {/* X / Twitter */}
                       <div className="border border-blue-200 rounded-2xl bg-blue-50/50 p-5 space-y-3">
                          <h4 className="font-bold text-blue-700 text-xs flex items-center gap-1.5 uppercase tracking-wider">🐦 X (Twitter) Uzun Flood</h4>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{generatedContent.socialMedia.twitter}</p>
                          <button onClick={() => handleCopyMini(generatedContent.socialMedia.twitter, 'tw')} className="text-xs bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 px-4 py-2 rounded-xl font-semibold transition-all shadow-sm">
                            {copiedField === 'tw' ? '✅ Kopyalandı' : 'Flood Metnini Kopyala'}
                          </button>
                       </div>

                       {/* Instagram Caption */}
                       <div className="border border-pink-200 rounded-2xl bg-pink-50/50 p-5 space-y-3">
                          <h4 className="font-bold text-pink-700 text-xs flex items-center gap-1.5 uppercase tracking-wider">💬 Instagram Caption & Hashtagler</h4>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{generatedContent.socialMedia.instagramCaption}</p>
                          <button onClick={() => handleCopyMini(generatedContent.socialMedia.instagramCaption, 'ig-caption')} className="text-xs bg-white border border-pink-200 hover:bg-pink-50 text-pink-700 px-4 py-2 rounded-xl font-semibold transition-all shadow-sm">
                            {copiedField === 'ig-caption' ? '✅ Kopyalandı' : 'Açıklamayı Kopyala'}
                          </button>
                       </div>

                       {/* İNSTAGRAM SLAYT GÖRSEL PROMPTLARI */}
                       {generatedContent.socialMedia.instagramPromptSlides && (
                          <div className="space-y-4">
                             <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">🖼️ Instagram Slayt Görsel Promptları (1:1 Kare)</h4>
                             <div className="space-y-3">
                                {generatedContent.socialMedia.instagramPromptSlides.map((slide: any, idx: number) => (
                                   <div key={idx} className="border border-gray-200 rounded-2xl bg-gray-50 p-4 space-y-2">
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-pink-600 block">Slayt #{slide.slideNo} Promptu:</span>
                                      <div className="relative bg-white border border-gray-200 rounded-xl p-3">
                                         <p className="text-xs font-mono text-gray-800 select-all pr-24">{slide.imageGenPrompt}</p>
                                         <button 
                                           onClick={() => handleCopyMini(slide.imageGenPrompt, `slide-${idx}`)} 
                                           className="absolute top-2.5 right-2.5 text-xs bg-pink-600 hover:bg-pink-700 text-white px-3 py-1.5 rounded-lg font-medium transition-all shadow-sm"
                                         >
                                           {copiedField === `slide-${idx}` ? '✅ Kopyalandı' : 'Promptu Kopyala'}
                                         </button>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}

                    </div>
                  )}

                </div>
              </div>
            ) : (
              <div className="h-full min-h-[500px] bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-center text-gray-400 p-8 text-center shadow-sm">
                <span className="text-5xl mb-4 animate-bounce">✨</span>
                <h3 className="text-xl font-bold text-gray-700 mb-2">Komuta Merkezi Beklemede</h3>
                <p className="text-xs text-gray-500 max-w-sm leading-relaxed">Sol panelden geçmişteki makalelerini seçip istediklerini WordPress XML olarak indirebilirsin.</p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}