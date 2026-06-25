// @ts-nocheck
// 简体中文：AI接管单元测试用例

import { describe, it, expect } from 'vitest';
import { analyzeIntent } from '../core/intentGate';
import { matchPromptTemplates } from '../prompts/promptMatcher';
import { PROMPT_LIBRARY } from '../prompts/promptLibrary';
import { safetyPolicy } from '../core/safetyPolicy';
import { detectSensitiveFile } from '../../assets/sensitiveFileScanner';
import { AssistantAction } from '../types';

describe('AI 接管单元测试集', () => {
  
  // 1. 意图分析门控测试
  describe('Intent Gate - 意图门控解析测试', () => {
    it('优化提示词不应该触发图片生成与确认卡片', () => {
      const result = analyzeIntent('帮我优化提示词：一个女孩在森林里');
      expect(result.intent).toBe('optimize_prompt');
      expect(result.needsConfirmation).toBe(false);
    });

    it('生图指令或批量生成指令必须触发强确认', () => {
      const result = analyzeIntent('这个文件夹每张图都生成成机甲风格');
      expect(result.intent).toBe('batch_generate_from_folder');
      expect(result.needsConfirmation).toBe(true);
    });

    it('常规画图指令必须触发确认卡片', () => {
      const result = analyzeIntent('开始生成 2 张未来的猫咪图');
      expect(result.intent).toBe('generate_images');
      expect(result.needsConfirmation).toBe(true);
    });

    it('打开浏览器助手 / 网页直通 / 多端控制应映射到 open_settings_view 目标为 browser-assistant', () => {
      const result1 = analyzeIntent('帮我打开浏览器助手');
      expect(result1.intent).toBe('open_settings_view');
      expect(result1.extracted.settingsView).toBe('browser-assistant');

      const result2 = analyzeIntent('跳转到网页直通面板');
      expect(result2.intent).toBe('open_settings_view');
      expect(result2.extracted.settingsView).toBe('browser-assistant');

      const result3 = analyzeIntent('带我去多端控制设置页');
      expect(result3.intent).toBe('open_settings_view');
      expect(result3.extracted.settingsView).toBe('browser-assistant');
    });

    it('检查连接 / 守护进程状态 / Chrome 插件状态映射到 control_multidevice', () => {
      const result1 = analyzeIntent('检查浏览器助手连接状态');
      expect(result1.intent).toBe('control_multidevice');
      expect(result1.extracted.browserAction).toBe('status');

      const result2 = analyzeIntent('诊断守护进程和插件状态');
      expect(result2.intent).toBe('control_multidevice');
      expect(result2.extracted.browserAction).toBe('status');
    });

    it('抓取商品链接或提取网页价格映射为 extract_page_content', () => {
      const result = analyzeIntent('帮我抓取这个商品链接 https://item.jd.com/123.html');
      expect(result.intent).toBe('extract_page_content');
      expect(result.extracted.browserAction).toBe('extract_product');
      expect(result.extracted.url).toBe('https://item.jd.com/123.html');
      expect(result.needsConfirmation).toBe(true);
    });

    it('网页直通生图映射为 browser_generate_external', () => {
      const result = analyzeIntent('用网页直通代理多开 2 个号并发跑 3 张商品海报图');
      expect(result.intent).toBe('browser_generate_external');
      expect(result.extracted.browserAction).toBe('generate_external');
      expect(result.extracted.count).toBe(3);
      expect(result.extracted.sessionCount).toBe(2);
      expect(result.needsConfirmation).toBe(true);
    });

    it('分发到小红书草稿映射为 browser_publish_draft', () => {
      const result = analyzeIntent('分发到小红书草稿箱');
      expect(result.intent).toBe('browser_publish_draft');
      expect(result.extracted.browserAction).toBe('publish_draft');
      expect(result.needsConfirmation).toBe(true);
    });

    it('跳转顶级表面工作区、素材库、收藏夹或后台管理应映射到 navigate_to_surface', () => {
      const result1 = analyzeIntent('帮我打开素材库');
      expect(result1.intent).toBe('navigate_to_surface');
      expect(result1.extracted.surface).toBe('library');

      const result2 = analyzeIntent('带我去收藏夹');
      expect(result2.intent).toBe('navigate_to_surface');
      expect(result2.extracted.surface).toBe('favorites');

      const result3 = analyzeIntent('切换回主画布工作区');
      expect(result3.intent).toBe('navigate_to_surface');
      expect(result3.extracted.surface).toBe('workspace');

      const result4 = analyzeIntent('去管理员后台');
      expect(result4.intent).toBe('navigate_to_surface');
      expect(result4.extracted.surface).toBe('admin');
    });
  });

  // 2. 提示词预置模板匹配测试
  describe('Prompt Matcher - 模板匹配测试', () => {
    it('应根据 triggerWords 精确匹配到二次元动漫模板', () => {
      const matches = matchPromptTemplates('我想画一个二次元动漫少女机甲', PROMPT_LIBRARY);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].template.category).toBe('anime');
    });

    it('应根据 ecommerce 标签匹配电商产品模板', () => {
      const matches = matchPromptTemplates('摆拍一个高档产品瓶子，电商用', PROMPT_LIBRARY);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].template.category).toBe('ecommerce');
    });
  });

  // 3. 安全策略拦截测试
  describe('Safety Policy - API Key 安全拦截测试', () => {
    it('拦截 API Key 的代填或危险读取行为', () => {
      const mockAction: AssistantAction = {
        type: 'fillPrompt',
        payload: { prompt: '使用 sk-proj-12345678 作为专属密钥' }
      };
      
      const check = safetyPolicy.evaluate(mockAction);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('API 密钥');
    });

    it('直接拦截受限工具方法', () => {
      const dangerousAction = {
        type: 'fillApiKey',
        payload: { value: 'sk-xxxx' }
      } as any;

      const check = safetyPolicy.evaluate(dangerousAction);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('AI 接管系统永远不允许');
    });
  });

  // 4. 敏感文件拦截测试
  describe('Sensitive Scanner - 敏感文件扫描拦截测试', () => {
    it('识别敏感本地配置文件 .env', () => {
      const mockFile = new File(['PORT=3000'], '.env');
      const check = detectSensitiveFile(mockFile);
      expect(check.sensitive).toBe(true);
      expect(check.reason).toContain('env');
    });

    it('识别敏感 token 及密钥配置文件', () => {
      const mockFile = new File(['KEY'], 'my-api-key.txt');
      const check = detectSensitiveFile(mockFile);
      expect(check.sensitive).toBe(true);
      expect(check.reason).toContain('api-key');
    });

    it('放行常规设计文件', () => {
      const safeFile = new File(['image data'], 'avatar_design.png');
      const check = detectSensitiveFile(safeFile);
      expect(check.sensitive).toBe(false);
    });
  });

});
