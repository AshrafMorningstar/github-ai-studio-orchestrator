
import { GitHubConfig, ProjectFile } from "../types";

export const createRepository = async (config: GitHubConfig, name: string, description: string) => {
  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      description,
      private: config.visibility === 'private',
      auto_init: false
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create repository');
  }

  return response.json();
};

export const createRelease = async (config: GitHubConfig, repoName: string, version: string, notes: string, zipBlob: Blob) => {
  // 1. Create Release
  const releaseRes = await fetch(`https://api.github.com/repos/${config.username}/${repoName}/releases`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tag_name: version,
      name: `Release ${version}`,
      body: notes,
      draft: false,
      prerelease: false
    })
  });

  if (!releaseRes.ok) throw new Error("Failed to create release");
  const release = await releaseRes.json();

  // 2. Upload Zip Asset
  const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${repoName}-${version}.zip`);
  const assetRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${config.token}`,
      'Content-Type': 'application/zip'
    },
    body: zipBlob
  });

  return assetRes.ok;
};

export const fetchRemoteRepo = async (token: string, owner: string, repo: string): Promise<ProjectFile[]> => {
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
    headers: { 'Authorization': `token ${token}` }
  });
  const data = await treeRes.json();
  const files: ProjectFile[] = [];

  for (const item of data.tree.slice(0, 50)) {
    if (item.type === 'blob') {
      const blobRes = await fetch(item.url, { headers: { 'Authorization': `token ${token}` } });
      const blobData = await blobRes.json();
      const content = atob(blobData.content);
      files.push({
        name: item.path.split('/').pop() || '',
        path: item.path,
        content: content,
        size: item.size,
        type: 'text/plain'
      });
    }
  }
  return files;
};

export const uploadFiles = async (config: GitHubConfig, repoName: string, files: ProjectFile[]) => {
  for (const file of files.slice(0, 30)) {
    const content = btoa(unescape(encodeURIComponent(file.content)));
    await fetch(`https://api.github.com/repos/${config.username}/${repoName}/contents/${file.path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `ARM Deploy: ${file.name}`,
        content
      })
    });
  }
  return true;
};

export const setRepoTopics = async (config: GitHubConfig, repoName: string, topics: string[]) => {
  await fetch(`https://api.github.com/repos/${config.username}/${repoName}/topics`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.mercy-preview+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ names: topics.map(t => t.toLowerCase().replace(/\s+/g, '-')) })
  });
  return true;
};
