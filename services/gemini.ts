
import { GoogleGenAI, Type } from "@google/genai";
import { ProjectAnalysis, RepoOptimization, ProjectFile, Boilerplate, ProjectReview, AIDocumentation, CICDConfig } from "../types";

const MODELS = {
  analysis: 'gemini-3-flash-preview',
  creative: 'gemini-3-pro-preview',
  image: 'gemini-2.5-flash-image'
};

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeProjectGemini = async (files: ProjectFile[]): Promise<ProjectAnalysis> => {
  const ai = getAI();
  const fileContext = files
    .slice(0, 40)
    .map(f => `Path: ${f.path}\nSnippet: ${f.content.substring(0, 300)}`)
    .join('\n---\n');

  const response = await ai.models.generateContent({
    model: MODELS.analysis,
    contents: `Deeply analyze this codebase. Identify architecture, tech stack, modules, and purpose. Return JSON.\n\n${fileContext}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
          features: { type: Type.ARRAY, items: { type: Type.STRING } },
          complexity: { type: Type.STRING },
          purpose: { type: Type.STRING },
          fileCount: { type: Type.NUMBER },
          lineCount: { type: Type.NUMBER },
          primaryLanguage: { type: Type.STRING },
          modulesDetected: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['techStack', 'features', 'complexity', 'purpose', 'fileCount', 'lineCount', 'primaryLanguage', 'modulesDetected']
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateDetailedDocs = async (analysis: ProjectAnalysis, files: ProjectFile[]): Promise<AIDocumentation> => {
  const ai = getAI();
  const codeSample = files.slice(0, 15).map(f => `File: ${f.path}\nContent:\n${f.content.substring(0, 500)}`).join('\n\n');
  
  const response = await ai.models.generateContent({
    model: MODELS.creative,
    contents: `Write professional technical documentation for this ${analysis.primaryLanguage} project.
    Provide:
    1. A detailed API Reference (classes, methods, endpoints).
    2. Real-world Usage Examples.
    Return JSON.
    
    Context:
    ${codeSample}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          apiReference: { type: Type.STRING },
          usageExamples: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const generateCICDWorkflow = async (analysis: ProjectAnalysis): Promise<CICDConfig> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: MODELS.analysis,
    contents: `Generate a production-grade GitHub Actions YAML for a ${analysis.techStack.join(', ')} project. Include CI (test/lint) and CD (deploy) steps. Return JSON with 'workflowYaml'.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          workflowYaml: { type: Type.STRING }
        }
      }
    }
  });
  return { ...JSON.parse(response.text || '{}'), platform: 'github-actions' };
};

export const generateReview = async (analysis: ProjectAnalysis): Promise<ProjectReview> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: MODELS.analysis,
    contents: `Perform a brutal but helpful technical audit for: ${JSON.stringify(analysis)}. Focus on viral potential and security. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          qualityScore: { type: Type.NUMBER },
          securityNotes: { type: Type.STRING },
          performanceTips: { type: Type.STRING },
          summary: { type: Type.STRING },
          viralTweakRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['qualityScore', 'securityNotes', 'performanceTips', 'summary', 'viralTweakRecommendations']
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const optimizeViralMetadata = async (analysis: ProjectAnalysis): Promise<RepoOptimization> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: MODELS.creative,
    contents: `Generate HYPER-VIRAL GitHub metadata. Use aggressive SEO strategies for top rankings. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedNames: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                score: { type: Type.NUMBER },
                reasoning: { type: Type.STRING }
              }
            }
          },
          description: {
            type: Type.OBJECT,
            properties: {
              short: { type: Type.STRING },
              extended: { type: Type.STRING },
              seoKeywords: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          logoPrompt: { type: Type.STRING },
          viralScore: { type: Type.NUMBER },
          viralTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          versioningStrategy: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateLogoGemini = async (prompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: MODELS.image,
    contents: { parts: [{ text: `Minimalist software logo: ${prompt}. Vector, cinematic.` }] },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });
  for (const part of response.candidates?.[0]?.content.parts || []) {
    if (part.inlineData) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
  }
  throw new Error("Logo generation failed.");
};

export const generatePreviewImage = async (prompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: MODELS.image,
    contents: { parts: [{ text: `High-impact project preview: ${prompt}. Ultra-modern UI mockup.` }] },
    config: { imageConfig: { aspectRatio: "16:9" } }
  });
  for (const part of response.candidates?.[0]?.content.parts || []) {
    if (part.inlineData) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
  }
  throw new Error("Preview generation failed.");
};

export const generateBoilerplateGemini = async (analysis: ProjectAnalysis): Promise<Boilerplate> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: MODELS.analysis,
    contents: `Generate professional .gitignore and MIT License for: ${JSON.stringify(analysis)}. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          gitignore: { type: Type.STRING },
          license: { type: Type.STRING }
        },
        required: ['gitignore', 'license']
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const generateReadmeGemini = async (analysis: ProjectAnalysis, optimization: RepoOptimization, review: ProjectReview, previewUrl?: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: MODELS.creative,
    contents: `Compose an elite GitHub README.md for ${optimization.suggestedNames[0].name}. Use viral SEO and audit data: ${review.summary}.`,
  });
  return response.text || '';
};
