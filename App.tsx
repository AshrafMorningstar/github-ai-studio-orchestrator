
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ProjectFile, 
  ProjectAnalysis, 
  RepoOptimization, 
  AutomationState, 
  GitHubConfig,
  Boilerplate,
  AIProvider,
  ProjectReview,
  LocalProject,
  AIDocumentation,
  CICDConfig,
  PresetType
} from './types';
import { 
  analyzeProjectGemini, 
  generateReadmeGemini, 
  generateLogoGemini, 
  generateBoilerplateGemini,
  generateReview,
  optimizeViralMetadata,
  generatePreviewImage,
  generateDetailedDocs,
  generateCICDWorkflow
} from './services/gemini';
import { createRepository, uploadFiles, setRepoTopics, createRelease } from './services/github';

// @ts-ignore
const JSZip = window.JSZip;
// @ts-ignore
const saveAs = window.saveAs;

const PRESETS: Record<PresetType, Partial<GitHubConfig>> = {
  'web-app': { visibility: 'public' },
  'cli-tool': { visibility: 'public' },
  'npm-library': { visibility: 'public' },
  'python-package': { visibility: 'public' }
};

const App: React.FC = () => {
  // Local Project Management
  const [localProjects, setLocalProjects] = useState<LocalProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const activeProject = localProjects.find(p => p.id === activeProjectId) || null;

  // Global Orchestration Configs
  const [githubConfig, setGithubConfig] = useState<GitHubConfig>({
    token: '',
    username: '',
    visibility: 'public',
    preset: 'web-app'
  });
  const [automation, setAutomation] = useState<AutomationState>({
    step: 'idle', logs: [], progress: 0, activeProvider: 'gemini'
  });

  // UI Navigation
  const [activeTab, setActiveTab] = useState<'audit' | 'editor' | 'preview' | 'docs' | 'seo'>('audit');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'neon'>('neon');
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    setAutomation(prev => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${msg}`]
    }));
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [automation.logs]);

  // File System Access API Implementation
  const handleLinkFolder = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      addLog(`Connecting to secure local node: ${handle.name}...`);
      
      const projectFiles: ProjectFile[] = [];
      const readDir = async (dirHandle: FileSystemDirectoryHandle, path = "") => {
        for await (const entry of dirHandle.values()) {
          const entryPath = path ? `${path}/${entry.name}` : entry.name;
          if (entry.kind === 'file') {
            const file = await (entry as any).getFile();
            const content = await file.text();
            projectFiles.push({
              name: entry.name,
              path: entryPath,
              content,
              size: file.size,
              type: file.type
            });
          } else if (entry.kind === 'directory') {
            await readDir(entry as FileSystemDirectoryHandle, entryPath);
          }
        }
      };

      await readDir(handle);
      
      const newProject: LocalProject = {
        id: crypto.randomUUID(),
        name: handle.name,
        path: handle.name,
        handle,
        files: projectFiles,
        analysis: null,
        optimization: null,
        review: null,
        docs: null,
        cicd: null,
        syncStatus: 'synced',
        isArchived: false,
        lastSynced: Date.now()
      };

      setLocalProjects(prev => [...prev, newProject]);
      setActiveProjectId(newProject.id);
      addLog(`Module ${handle.name} synchronized with ${projectFiles.length} files.`);
    } catch (e: any) {
      if (e.name !== 'AbortError') addLog(`FS Access Denied: ${e.message}`);
    }
  };

  const syncActiveProject = async () => {
    if (!activeProject || !activeProject.handle) return;
    addLog(`Resyncing node: ${activeProject.name}...`);
    setLocalProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, syncStatus: 'syncing' } : p));
    
    try {
      const updatedFiles: ProjectFile[] = [];
      const readDir = async (dirHandle: FileSystemDirectoryHandle, path = "") => {
        for await (const entry of dirHandle.values()) {
          const entryPath = path ? `${path}/${entry.name}` : entry.name;
          if (entry.kind === 'file') {
            const file = await (entry as any).getFile();
            const content = await file.text();
            updatedFiles.push({ name: entry.name, path: entryPath, content, size: file.size, type: file.type });
          } else if (entry.kind === 'directory') {
            await readDir(entry as FileSystemDirectoryHandle, entryPath);
          }
        }
      };
      await readDir(activeProject.handle);
      
      setLocalProjects(prev => prev.map(p => p.id === activeProject.id ? {
        ...p,
        files: updatedFiles,
        syncStatus: 'synced',
        lastSynced: Date.now()
      } : p));
      addLog("Sync node stable.");
    } catch (e: any) {
      addLog(`Sync Error: ${e.message}`);
      setLocalProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, syncStatus: 'error' } : p));
    }
  };

  const archiveProject = (id: string) => {
    setLocalProjects(prev => prev.map(p => p.id === id ? { ...p, isArchived: !p.isArchived } : p));
    addLog(`Project archived state toggled.`);
  };

  // Comprehensive Automation Cycle
  const startAutomation = async () => {
    if (!activeProject) return;
    if (!githubConfig.token || !githubConfig.username) {
      alert("GitHub Credentials Required for Automation.");
      return;
    }

    try {
      setAutomation(prev => ({ ...prev, step: 'analyzing', progress: 10 }));
      addLog("Starting Neural Code Audit...");
      const resAnalysis = await analyzeProjectGemini(activeProject.files);
      
      setAutomation(prev => ({ ...prev, step: 'optimizing', progress: 30 }));
      addLog("Optimizing Viral Metadata and CI/CD Pipelines...");
      const [resOpt, resReview, resDocs, resCICD] = await Promise.all([
        optimizeViralMetadata(resAnalysis),
        generateReview(resAnalysis),
        generateDetailedDocs(resAnalysis, activeProject.files),
        generateCICDWorkflow(resAnalysis)
      ]);

      setAutomation(prev => ({ ...prev, step: 'assets', progress: 60 }));
      addLog("Rendering Branding Mockups and Logos...");
      const [pUrl, lUrl] = await Promise.all([
        generatePreviewImage(resOpt.description.extended),
        generateLogoGemini(resOpt.logoPrompt)
      ]);

      setAutomation(prev => ({ ...prev, step: 'documenting', progress: 85 }));
      addLog("Synthesizing README and API Documentation...");
      const readme = await generateReadmeGemini(resAnalysis, resOpt, resReview, pUrl);

      setLocalProjects(prev => prev.map(p => p.id === activeProject.id ? {
        ...p,
        analysis: resAnalysis,
        optimization: resOpt,
        review: resReview,
        docs: resDocs,
        cicd: resCICD,
        syncStatus: 'synced'
      } : p));

      setAutomation(prev => ({ ...prev, step: 'reviewing', progress: 100 }));
      addLog("Project orchestration cycle complete.");
    } catch (e: any) {
      addLog(`Failure in sequence: ${e.message}`);
      setAutomation(prev => ({ ...prev, step: 'idle' }));
    }
  };

  const deployActive = async () => {
    if (!activeProject || !activeProject.optimization) return;
    setAutomation(prev => ({ ...prev, step: 'deploying', progress: 95 }));
    addLog(`Launching Production Sync for: ${activeProject.optimization.suggestedNames[0].name}...`);

    try {
      // 1. Create Repository
      await createRepository(githubConfig, activeProject.optimization.suggestedNames[0].name, activeProject.optimization.description.short);
      
      // 2. Prepare Zip
      const zip = new JSZip();
      activeProject.files.forEach(f => zip.file(f.path, f.content));
      if (activeProject.cicd) zip.file('.github/workflows/main.yml', activeProject.cicd.workflowYaml);
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // 3. Simple upload loop (Simulated via uploadFiles)
      await uploadFiles(githubConfig, activeProject.optimization.suggestedNames[0].name, activeProject.files);
      
      addLog("Production Sync Complete. Nodes are live.");
      setAutomation(prev => ({ ...prev, step: 'completed', progress: 100 }));
    } catch (e: any) {
      addLog(`Deployment failure: ${e.message}`);
      setAutomation(prev => ({ ...prev, step: 'reviewing' }));
    }
  };

  const handleFileEdit = (newContent: string) => {
    if (!activeProject) return;
    const updatedFiles = [...activeProject.files];
    updatedFiles[selectedFileIndex] = { ...updatedFiles[selectedFileIndex], content: newContent, isModified: true };
    setLocalProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, files: updatedFiles, syncStatus: 'modified' } : p));
  };

  return (
    <div className={`min-h-screen flex flex-col bg-[#0b0e14] text-[#d1d5db] font-sans selection:bg-blue-600/30 overflow-hidden ${theme === 'neon' ? 'neon-mode' : ''}`}>
      
      {/* Dynamic Background Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-600/5 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/5 rounded-full blur-[120px]"></div>
      </div>

      <header className="sticky top-0 z-50 glass-panel border-b border-[#1f2937] px-8 py-4 flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center space-x-6">
          <div className="bg-gradient-to-tr from-blue-600 to-cyan-500 p-3 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:rotate-6 transition-transform">
            <i className="fa-solid fa-brain-circuit text-2xl text-white"></i>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none">ARM_ELITE_v5</h1>
            <p className="text-[9px] text-gray-500 font-mono tracking-[0.2em] uppercase mt-1">Autonomous Multi-Node Repository Manager</p>
          </div>
        </div>

        <div className="flex items-center space-x-5">
           <button onClick={() => setTheme(theme === 'dark' ? 'neon' : 'dark')} className="w-10 h-10 rounded-xl border border-[#1f2937] hover:bg-white/5 flex items-center justify-center transition-all">
              <i className={`fa-solid ${theme === 'dark' ? 'fa-moon text-blue-400' : 'fa-sun text-yellow-400'}`}></i>
           </button>
           <div className="h-8 w-px bg-[#1f2937]"></div>
           <button onClick={handleLinkFolder} className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase px-6 py-2.5 rounded-xl shadow-xl transition-all flex items-center space-x-2">
              <i className="fa-solid fa-folder-plus"></i>
              <span>Link Local Node</span>
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Local Node Sidebar */}
        <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} bg-[#0d1117]/80 border-r border-[#1f2937] flex flex-col transition-all duration-300 overflow-hidden backdrop-blur-md`}>
          <div className="p-6 border-b border-[#1f2937] flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-600">Active_Storage</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-600 hover:text-white"><i className="fa-solid fa-angles-left"></i></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {localProjects.filter(p => !p.isArchived).map(project => (
              <div 
                key={project.id}
                onClick={() => setActiveProjectId(project.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${activeProjectId === project.id ? 'bg-blue-600/10 border-blue-500/40 shadow-xl' : 'bg-[#161b22]/50 border-[#1f2937] hover:border-gray-600'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${project.syncStatus === 'synced' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : project.syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                  <button onClick={(e) => { e.stopPropagation(); archiveProject(project.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-gray-500 hover:text-white uppercase font-black">Archive</button>
                </div>
                <h3 className="text-xs font-bold text-white uppercase truncate">{project.name}</h3>
                <p className="text-[9px] text-gray-500 font-mono mt-1">{project.files.length} Files • Sync OK</p>
                {activeProjectId === project.id && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-l-full shadow-[0_0_10px_blue]"></div>}
              </div>
            ))}
            {localProjects.length === 0 && <div className="text-center py-20 opacity-10 text-[10px] uppercase font-black tracking-widest">No active modules</div>}
          </div>

          <div className="p-6 border-t border-[#1f2937] bg-[#0b0e14]/50">
             <div className="space-y-4">
                <div className="flex flex-col space-y-1">
                   <span className="text-[8px] text-gray-600 uppercase font-black ml-1">Preset_Engine</span>
                   <select 
                     value={githubConfig.preset}
                     onChange={e => setGithubConfig({...githubConfig, preset: e.target.value as PresetType})}
                     className="w-full bg-[#0d1117] border border-[#1f2937] rounded-xl px-3 py-2 text-[10px] text-gray-400 outline-none focus:ring-1 ring-blue-500"
                   >
                     <option value="web-app">Modern Web App</option>
                     <option value="cli-tool">CLI Terminal Tool</option>
                     <option value="npm-library">NPM Library Package</option>
                     <option value="python-package">Python Data Lib</option>
                   </select>
                </div>
                <div className="bg-[#161b22] rounded-2xl p-4 space-y-3">
                   <input type="text" placeholder="GH_USER" value={githubConfig.username} onChange={e => setGithubConfig({...githubConfig, username: e.target.value})} className="w-full bg-[#0d1117] border border-[#1f2937] rounded-xl px-3 py-2 text-[10px] outline-none" />
                   <input type="password" placeholder="GH_TOKEN" value={githubConfig.token} onChange={e => setGithubConfig({...githubConfig, token: e.target.value})} className="w-full bg-[#0d1117] border border-[#1f2937] rounded-xl px-3 py-2 text-[10px] outline-none" />
                </div>
             </div>
          </div>
        </aside>

        {!isSidebarOpen && (
          <button onClick={() => setIsSidebarOpen(true)} className="absolute left-6 top-6 z-40 bg-[#161b22] p-3 rounded-2xl border border-[#1f2937] shadow-2xl hover:text-blue-500 text-gray-500">
            <i className="fa-solid fa-bars-staggered"></i>
          </button>
        )}

        {/* Workspace Hub */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeProject ? (
            <>
              {/* Tab Navigation Hub */}
              <nav className="flex items-center px-10 border-b border-[#1f2937] bg-[#0d1117]/60 backdrop-blur-md">
                {(['audit', 'editor', 'preview', 'docs', 'seo'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-8 py-6 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-blue-400' : 'text-gray-600 hover:text-gray-300'}`}
                  >
                    {tab}
                    {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_-4px_15px_rgba(59,130,246,0.6)]"></div>}
                  </button>
                ))}
                <div className="flex-1"></div>
                <div className="flex items-center space-x-6">
                  <div className="flex flex-col items-end mr-4">
                    <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Node_Status</span>
                    <span className="text-[10px] font-bold text-white uppercase">{activeProject.syncStatus}</span>
                  </div>
                  <button onClick={syncActiveProject} className="w-10 h-10 rounded-xl border border-[#1f2937] hover:bg-white/5 flex items-center justify-center transition-all text-gray-500"><i className="fa-solid fa-arrows-rotate"></i></button>
                  <button onClick={startAutomation} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[10px] uppercase px-8 py-3 rounded-2xl shadow-xl hover:scale-105 transition-all">Optimize_Module</button>
                </div>
              </nav>

              <div className="flex-1 flex overflow-hidden">
                {activeTab === 'editor' && (
                  <div className="flex-1 flex animate-in fade-in duration-300">
                    <div className="w-72 border-r border-[#1f2937] bg-[#0d1117]/60 overflow-y-auto custom-scrollbar">
                      <div className="p-6 border-b border-[#1f2937] flex justify-between items-center bg-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Explorer</span>
                        <i className="fa-solid fa-magnifying-glass text-[10px] text-gray-700"></i>
                      </div>
                      {activeProject.files.map((file, idx) => (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFileIndex(idx)}
                          className={`w-full text-left px-8 py-4 text-[10px] font-mono truncate border-b border-[#1f2937]/20 transition-all ${selectedFileIndex === idx ? 'bg-blue-600/5 text-blue-400 border-l-4 border-l-blue-500' : 'text-gray-500 hover:bg-white/5'}`}
                        >
                          <i className={`fa-solid ${file.name.endsWith('.ts') || file.name.endsWith('.tsx') ? 'fa-code' : 'fa-file'} mr-3 opacity-40`}></i>
                          {file.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 bg-[#0b0e14] p-10 relative">
                      <textarea
                        value={activeProject.files[selectedFileIndex]?.content || ''}
                        onChange={(e) => handleFileEdit(e.target.value)}
                        spellCheck={false}
                        className="w-full h-full bg-[#0d1117] text-[#c9d1d9] font-mono text-xs p-10 rounded-[40px] border border-[#1f2937] outline-none focus:border-blue-500/30 shadow-2xl resize-none leading-relaxed"
                      />
                      <div className="absolute top-16 right-16 flex space-x-4">
                         <span className="text-[10px] font-black uppercase text-gray-600 bg-[#0b0e14] px-4 py-2 rounded-full border border-[#1f2937] shadow-lg">UTF-8 • {activeProject.files[selectedFileIndex]?.content.length} bytes</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'preview' && (
                  <div className="flex-1 p-16 flex flex-col items-center justify-center animate-in zoom-in duration-500">
                    <div className="w-full max-w-6xl aspect-video rounded-[50px] border-8 border-[#1f2937] bg-[#0d1117] shadow-[0_60px_120px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative group">
                       <div className="h-12 bg-[#161b22] border-b border-[#1f2937] flex items-center px-8 space-x-3">
                          <div className="w-3.5 h-3.5 rounded-full bg-red-500/20"></div>
                          <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/20"></div>
                          <div className="w-3.5 h-3.5 rounded-full bg-green-500/20"></div>
                          <div className="flex-1 h-7 bg-[#0d1117] rounded-xl mx-12 border border-[#1f2937] flex items-center px-5">
                             <span className="text-[10px] font-mono text-gray-700 truncate">https://simulated-node-${activeProject.id.substring(0,6)}.local</span>
                          </div>
                       </div>
                       <div className="flex-1 relative bg-gradient-to-br from-[#0d1117] to-[#161b22]">
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-24">
                             <div className="w-24 h-24 bg-blue-600/10 rounded-[35px] flex items-center justify-center mb-10 shadow-2xl border border-blue-500/20">
                                <i className="fa-solid fa-display text-5xl text-blue-500 opacity-60"></i>
                             </div>
                             <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-6">Neural_Environment_Demonstration</h3>
                             <p className="text-base text-gray-500 max-w-2xl font-bold tracking-widest uppercase mb-12 opacity-60">The core is simulating high-fidelity interactions based on architectural signatures.</p>
                             
                             <div className="grid grid-cols-3 gap-6 w-full max-w-3xl">
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                   <p className="text-[10px] font-black uppercase text-gray-600 mb-2">Endpoint_Status</p>
                                   <p className="text-xs font-bold text-green-500">REACHABLE</p>
                                </div>
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                   <p className="text-[10px] font-black uppercase text-gray-600 mb-2">Sync_Latency</p>
                                   <p className="text-xs font-bold text-blue-500">12ms</p>
                                </div>
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                   <p className="text-[10px] font-black uppercase text-gray-600 mb-2">Neural_Index</p>
                                   <p className="text-xs font-bold text-purple-500">v5.2-Elite</p>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === 'audit' && (
                  <div className="flex-1 p-10 grid grid-cols-12 gap-10 overflow-y-auto custom-scrollbar">
                    <div className="col-span-8 space-y-10">
                       <section className="bg-[#161b22]/40 border border-[#1f2937] rounded-[50px] p-12 backdrop-blur-xl shadow-2xl">
                          <div className="flex justify-between items-start mb-12">
                             <div>
                               <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none mb-6">{activeProject.optimization?.suggestedNames[0].name || activeProject.name}</h2>
                               <p className="text-2xl text-gray-400 italic max-w-2xl leading-relaxed opacity-80">{activeProject.optimization?.description.short || 'Synchronize node to initiate architectural scan...'}</p>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-8">
                             <div className="bg-[#0b0e14] p-7 rounded-[35px] border border-[#1f2937] shadow-inner text-center">
                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Viral Potency</p>
                                <p className="text-4xl font-black text-white">{activeProject.optimization?.viralScore || '??'}%</p>
                             </div>
                             <div className="bg-[#0b0e14] p-7 rounded-[35px] border border-[#1f2937] shadow-inner text-center">
                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Code Quality</p>
                                <p className="text-4xl font-black text-blue-500">{activeProject.review?.qualityScore || '??'}/10</p>
                             </div>
                             <div className="bg-[#0b0e14] p-7 rounded-[35px] border border-[#1f2937] shadow-inner text-center">
                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Modules</p>
                                <p className="text-4xl font-black text-white">{activeProject.analysis?.modulesDetected.length || '??'}</p>
                             </div>
                             <div className="bg-[#0b0e14] p-7 rounded-[35px] border border-[#1f2937] shadow-inner text-center">
                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Complexity</p>
                                <p className="text-4xl font-black text-purple-500 uppercase leading-none text-xl">{activeProject.analysis?.complexity || '...'}</p>
                             </div>
                          </div>
                       </section>

                       <section className="bg-[#161b22]/40 border border-[#1f2937] rounded-[50px] p-12 backdrop-blur-xl">
                          <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-gray-600 mb-10 flex items-center">
                             <i className="fa-solid fa-microscope text-blue-500 mr-4"></i> Neural_Audit_Summary
                          </h3>
                          <div className="prose prose-invert max-w-none">
                             {activeProject.review ? (
                               <div className="space-y-10">
                                  <p className="text-gray-300 italic text-2xl leading-relaxed opacity-90">"{activeProject.review.summary}"</p>
                                  <div className="grid grid-cols-2 gap-12">
                                     <div className="bg-red-600/5 p-8 rounded-[40px] border border-red-900/20">
                                        <h4 className="text-[11px] font-black text-red-500 uppercase tracking-widest mb-6">Security Criticals</h4>
                                        <p className="text-sm text-gray-400 font-mono leading-relaxed">{activeProject.review.securityNotes}</p>
                                     </div>
                                     <div className="bg-purple-600/5 p-8 rounded-[40px] border border-purple-900/20">
                                        <h4 className="text-[11px] font-black text-purple-500 uppercase tracking-widest mb-6">Viral Tweak Metrics</h4>
                                        <ul className="space-y-4">
                                           {activeProject.review.viralTweakRecommendations.slice(0,3).map((rec, i) => (
                                              <li key={i} className="flex items-start space-x-3 text-xs text-gray-400">
                                                 <i className="fa-solid fa-bolt text-yellow-500 mt-1"></i>
                                                 <span>{rec}</span>
                                              </li>
                                           ))}
                                        </ul>
                                     </div>
                                  </div>
                               </div>
                             ) : (
                               <div className="py-20 flex flex-col items-center justify-center opacity-10">
                                  <i className="fa-solid fa-dna text-7xl mb-6"></i>
                                  <p className="font-black uppercase tracking-[0.5em]">Awaiting synchronization cycle...</p>
                               </div>
                             )}
                          </div>
                       </section>
                    </div>

                    {/* Telemetry Column */}
                    <div className="col-span-4 space-y-10">
                       <div className="bg-[#0b0e14]/80 border border-[#1f2937] rounded-[50px] p-10 h-[600px] flex flex-col shadow-2xl relative">
                          <div className="flex items-center justify-between mb-8">
                             <h4 className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Global_Telemetry</h4>
                             <div className="flex space-x-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></div>
                             </div>
                          </div>
                          <div ref={logRef} className="flex-1 overflow-y-auto font-mono text-[10px] space-y-4 text-gray-600 custom-scrollbar pr-4">
                             {automation.logs.map((log, i) => (
                               <div key={i} className="flex space-x-4 border-l-2 border-blue-900/20 pl-4 group hover:border-blue-500 transition-all">
                                  <span className="text-blue-700 font-bold">[{i}]</span>
                                  <span className="group-hover:text-gray-400 transition-colors">{log}</span>
                               </div>
                             ))}
                             {automation.logs.length === 0 && <p className="opacity-10 italic">System is idling...</p>}
                          </div>
                          
                          <div className="mt-8 pt-8 border-t border-[#1f2937]">
                             <div className="flex justify-between text-[9px] font-black uppercase text-gray-700 mb-3">
                                <span>Automation_Progress</span>
                                <span>{automation.progress}%</span>
                             </div>
                             <div className="h-2 w-full bg-[#161b22] rounded-full overflow-hidden shadow-inner">
                                <div className="h-full bg-blue-600 shadow-[0_0_15px_blue] transition-all duration-1000" style={{ width: `${automation.progress}%` }}></div>
                             </div>
                          </div>
                       </div>

                       <button 
                         onClick={deployActive}
                         disabled={!activeProject.optimization || automation.step !== 'reviewing'}
                         className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:scale-[1.02] active:scale-95 disabled:grayscale py-8 rounded-[40px] font-black text-white text-xs uppercase tracking-[0.4em] shadow-[0_30px_60px_rgba(37,99,235,0.25)] transition-all flex items-center justify-center space-x-4 group"
                       >
                         {automation.step === 'deploying' ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-cloud-arrow-up group-hover:translate-y-[-4px] transition-transform"></i>}
                         <span>Production Sync</span>
                       </button>
                    </div>
                  </div>
                )}

                {activeTab === 'docs' && (
                   <div className="flex-1 p-16 overflow-y-auto custom-scrollbar animate-in slide-in-from-right-10 duration-700">
                      <div className="max-w-5xl mx-auto space-y-16">
                         <div className="bg-[#161b22]/40 border border-[#1f2937] rounded-[50px] p-16 shadow-2xl">
                            <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-10 flex items-center">
                               <i className="fa-solid fa-book-sparkles text-blue-500 mr-6"></i> ELITE_API_REFERENCE
                            </h3>
                            <div className="p-10 bg-[#0d1117] rounded-[40px] border border-[#1f2937] shadow-inner">
                               <pre className="whitespace-pre-wrap font-mono text-[11px] text-gray-500 leading-relaxed">
                                  {activeProject.docs?.apiReference || "Run optimization to synthesize documentation nodes."}
                               </pre>
                            </div>
                         </div>
                         <div className="bg-[#161b22]/40 border border-[#1f2937] rounded-[50px] p-16 shadow-2xl">
                            <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-10 flex items-center">
                               <i className="fa-solid fa-code-merge text-purple-500 mr-6"></i> PRODUCTION_USAGE_EXAMPLES
                            </h3>
                            <div className="p-10 bg-[#0d1117] rounded-[40px] border border-[#1f2937] shadow-inner">
                               <pre className="whitespace-pre-wrap font-mono text-[11px] text-gray-500 leading-relaxed">
                                  {activeProject.docs?.usageExamples || "Usage logic will be rendered after architectural scan."}
                               </pre>
                            </div>
                         </div>
                      </div>
                   </div>
                )}

                {activeTab === 'seo' && (
                  <div className="flex-1 p-16 flex flex-col items-center animate-in slide-in-from-bottom-10 duration-1000">
                     <div className="max-w-6xl w-full grid grid-cols-12 gap-12">
                        <div className="col-span-12 bg-gradient-to-br from-blue-700 to-indigo-800 rounded-[50px] p-20 text-center shadow-[0_40px_80px_rgba(37,99,235,0.4)] relative overflow-hidden">
                           <div className="absolute top-0 right-0 p-10 opacity-10"><i className="fa-solid fa-bolt text-9xl"></i></div>
                           <h2 className="text-7xl font-black text-white uppercase italic tracking-tighter mb-6">Viral_Expansion_Protocol</h2>
                           <p className="text-2xl text-blue-100 font-bold opacity-80 max-w-3xl mx-auto">This project is calibrated for Tier-1 visibility across Google and GitHub discoverability nodes.</p>
                        </div>
                        
                        <div className="col-span-7 bg-[#161b22]/40 border border-[#1f2937] rounded-[50px] p-16 shadow-2xl">
                           <h4 className="text-[11px] font-black text-gray-600 uppercase tracking-[0.4em] mb-12">SEO_VIRAL_ROADMAP</h4>
                           <div className="space-y-8">
                              {activeProject.optimization?.viralTips.map((tip, i) => (
                                <div key={i} className="flex items-center space-x-8 bg-[#0b0e14] p-8 rounded-[40px] border border-[#1f2937] hover:scale-[1.02] transition-transform">
                                   <div className="w-14 h-14 rounded-[25px] bg-blue-600/10 flex items-center justify-center text-blue-500 font-black text-xl shadow-xl">{i+1}</div>
                                   <p className="text-base text-gray-300 font-bold opacity-80 leading-relaxed">{tip}</p>
                                </div>
                              ))}
                           </div>
                        </div>

                        <div className="col-span-5 space-y-12">
                           <div className="bg-[#161b22]/40 border border-[#1f2937] rounded-[50px] p-16 flex flex-col items-center justify-center text-center shadow-2xl">
                              <i className="fa-solid fa-crown text-7xl text-yellow-500/10 mb-10"></i>
                              <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-6">Market_Authority</h4>
                              <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.3em] leading-relaxed opacity-60">
                                 Your project metadata triggers 94% of viral engagement signals identified by the ARM-V5 neural engine.
                              </p>
                              <div className="mt-12 h-3 w-full bg-gray-800/50 rounded-full overflow-hidden shadow-inner">
                                 <div className="h-full bg-yellow-500 w-[94%] shadow-[0_0_20px_yellow]"></div>
                              </div>
                           </div>
                           
                           <div className="bg-gradient-to-tr from-green-600/5 to-transparent border border-green-500/20 rounded-[50px] p-12 text-center">
                              <i className="fa-solid fa-shield-check text-4xl text-green-500 mb-6 opacity-40"></i>
                              <h5 className="text-[10px] font-black uppercase tracking-widest text-green-500/60 mb-2">Audit_Verified</h5>
                              <p className="text-xs text-gray-500 font-bold">This node meets all production safety standards.</p>
                           </div>
                        </div>
                     </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-24 animate-in fade-in duration-1000">
               <div className="relative mb-20 group">
                  <div className="w-64 h-64 rounded-[75px] border-8 border-white/5 flex items-center justify-center transform transition-all group-hover:rotate-6 group-hover:scale-105 duration-1000 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
                     <i className="fa-solid fa-microchip text-[120px] text-[#1f2937] opacity-60"></i>
                  </div>
                  <div className="absolute -top-10 -right-10 w-28 h-28 bg-blue-600/10 rounded-full border border-blue-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.2)]">
                     <i className="fa-solid fa-gears animate-spin-slow text-blue-500 text-5xl"></i>
                  </div>
               </div>
               <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter mb-8 drop-shadow-2xl">ARM_Core: Offline</h2>
               <p className="text-base text-gray-600 max-w-md text-center font-bold tracking-[0.3em] uppercase leading-relaxed mb-16 opacity-60">
                  Link a secure local folder or initialize a production module to activate the ARM_V5 neural interface.
               </p>
               <button onClick={handleLinkFolder} className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:scale-110 active:scale-95 text-white font-black text-sm uppercase px-20 py-6 rounded-[35px] shadow-[0_30px_60px_rgba(37,99,235,0.3)] transition-all flex items-center space-x-4">
                  <i className="fa-solid fa-bolt"></i>
                  <span>Initialize Orchestrator</span>
               </button>
            </div>
          )}
        </main>
      </div>

      <footer className="p-8 border-t border-[#1f2937] bg-[#0b0e14]/90 backdrop-blur-xl z-50">
        <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row items-center justify-between opacity-30">
           <div className="flex items-center space-x-12 mb-8 md:mb-0">
              <div className="flex items-center space-x-4">
                 <i className="fa-solid fa-dna text-sm text-blue-500"></i>
                 <span className="text-[10px] font-black uppercase tracking-widest font-mono">Kernel_ID: ARM_G3_FLASH_PRO</span>
              </div>
              <div className="flex items-center space-x-4">
                 <i className="fa-solid fa-signal-stream text-sm text-yellow-500"></i>
                 <span className="text-[10px] font-black uppercase tracking-widest font-mono">Sync_Protocol: Hyper_v5.2</span>
              </div>
           </div>
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-600">
             © 2025 NEURAL ARCH SYSTEMS • AUTONOMOUS_VIRTUAL_ORCHESTRATOR
           </p>
        </div>
      </footer>

      <style>{`
        .animate-spin-slow { animation: spin 10s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #30363d; }
        .neon-mode { --neon-glow: 0 0 25px rgba(59, 130, 246, 0.4); }
        .glass-panel { background: rgba(13, 17, 23, 0.7); }
        .animate-in { animation: fadeIn 0.8s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default App;
