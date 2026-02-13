
export interface ProjectFile {
  name: string;
  path: string;
  content: string;
  size: number;
  type: string;
  moduleName?: string;
  isModified?: boolean;
}

export interface ProjectAnalysis {
  techStack: string[];
  features: string[];
  complexity: 'Low' | 'Medium' | 'High';
  purpose: string;
  fileCount: number;
  lineCount: number;
  primaryLanguage: string;
  modulesDetected: string[];
}

export interface RepoOptimization {
  suggestedNames: Array<{
    name: string;
    score: number;
    reasoning: string;
  }>;
  description: {
    short: string;
    extended: string;
    seoKeywords: string[];
  };
  tags: string[];
  logoPrompt: string;
  viralScore: number;
  viralTips: string[];
  versioningStrategy: string;
}

export interface ProjectReview {
  qualityScore: number;
  securityNotes: string;
  performanceTips: string;
  summary: string;
  viralTweakRecommendations: string[];
}

export interface AIDocumentation {
  apiReference: string;
  usageExamples: string;
  architectureDiagram?: string;
}

export interface CICDConfig {
  workflowYaml: string;
  platform: 'github-actions' | 'gitlab-ci' | 'none';
}

export interface LocalProject {
  id: string;
  name: string;
  path: string;
  handle?: FileSystemDirectoryHandle;
  files: ProjectFile[];
  analysis: ProjectAnalysis | null;
  optimization: RepoOptimization | null;
  review: ProjectReview | null;
  docs: AIDocumentation | null;
  cicd: CICDConfig | null;
  syncStatus: 'synced' | 'modified' | 'error' | 'syncing';
  isArchived: boolean;
  lastSynced: number;
}

export type AIProvider = 'gemini' | 'openai' | 'deepseek' | 'openrouter';

export interface AIKeys {
  gemini: string;
  openai: string;
  deepseek: string;
  openrouter: string;
}

export interface AutomationState {
  step: 'idle' | 'analyzing' | 'optimizing' | 'assets' | 'reviewing' | 'documenting' | 'zipping' | 'deploying' | 'completed';
  logs: string[];
  progress: number;
  activeProvider: AIProvider;
}

export interface GitHubConfig {
  token: string;
  username: string;
  visibility: 'public' | 'private';
  preset?: PresetType;
}

export interface Boilerplate {
  gitignore: string;
  license: string;
}

export type PresetType = 'web-app' | 'cli-tool' | 'npm-library' | 'python-package';
