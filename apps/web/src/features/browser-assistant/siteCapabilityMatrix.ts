import type { SiteCapability } from './browserAssistantTypes';

// 简体中文：定义多站点的能力与安全等级矩阵 (Site Capability Matrix)
export const SITE_CAPABILITY_MATRIX: Record<string, SiteCapability> = {
  generic_web: {
    siteId: 'generic_web',
    name: '通用网页模式',
    domains: ['*'],
    authMode: 'public',
    executionMode: 'local-browser',
    actions: ['read', 'extract'],
    quotaSource: 'none',
    riskLevel: 'low',
    requiresConfirmation: false
  },
  google: {
    siteId: 'google',
    name: 'Google 搜索',
    domains: ['google.com', 'google.com.hk'],
    authMode: 'public',
    executionMode: 'local-browser',
    actions: ['search', 'read', 'extract'],
    quotaSource: 'none',
    riskLevel: 'low',
    requiresConfirmation: false
  },
  youtube: {
    siteId: 'youtube',
    name: 'YouTube 视频助手',
    domains: ['youtube.com'],
    authMode: 'public',
    executionMode: 'local-browser',
    actions: ['search', 'read', 'extract', 'download'],
    quotaSource: 'none',
    riskLevel: 'low',
    requiresConfirmation: false
  },
  amazon: {
    siteId: 'amazon',
    name: 'Amazon 电商助手',
    domains: ['amazon.com', 'amazon.cn'],
    authMode: 'public',
    executionMode: 'local-browser',
    actions: ['search', 'read', 'extract'],
    quotaSource: 'none',
    riskLevel: 'low',
    requiresConfirmation: false
  },
  behance: {
    siteId: 'behance',
    name: 'Behance 设计素材站',
    domains: ['behance.net'],
    authMode: 'public',
    executionMode: 'local-browser',
    actions: ['search', 'extract', 'download'],
    quotaSource: 'none',
    riskLevel: 'low',
    requiresConfirmation: true
  },
  xiaohongshu: {
    siteId: 'xiaohongshu',
    name: '小红书社交助手',
    domains: ['xiaohongshu.com', 'xhslink.com'],
    authMode: 'user-browser-session',
    executionMode: 'local-runner',
    actions: ['read', 'extract', 'upload', 'publish'],
    quotaSource: 'user-membership',
    riskLevel: 'high',
    requiresConfirmation: true
  },
  zhihu: {
    siteId: 'zhihu',
    name: '知乎问答助手',
    domains: ['zhihu.com'],
    authMode: 'user-browser-session',
    executionMode: 'local-runner',
    actions: ['search', 'read', 'extract', 'publish'],
    quotaSource: 'user-membership',
    riskLevel: 'medium',
    requiresConfirmation: true
  },
  chatgpt: {
    siteId: 'chatgpt',
    name: 'ChatGPT (Experimental)',
    domains: ['chatgpt.com'],
    authMode: 'user-browser-session',
    executionMode: 'local-runner',
    actions: ['generate-text', 'generate-image'],
    quotaSource: 'user-membership',
    riskLevel: 'medium',
    requiresConfirmation: true
  },
  gemini: {
    siteId: 'gemini',
    name: 'Gemini (Experimental)',
    domains: ['gemini.google.com'],
    authMode: 'user-browser-session',
    executionMode: 'local-runner',
    actions: ['generate-text', 'generate-image'],
    quotaSource: 'user-membership',
    riskLevel: 'medium',
    requiresConfirmation: true
  },
  custom: {
    siteId: 'custom',
    name: '自定义域名适配',
    domains: [],
    authMode: 'manual',
    executionMode: 'local-browser',
    actions: ['read', 'extract'],
    quotaSource: 'none',
    riskLevel: 'medium',
    requiresConfirmation: true
  }
};
