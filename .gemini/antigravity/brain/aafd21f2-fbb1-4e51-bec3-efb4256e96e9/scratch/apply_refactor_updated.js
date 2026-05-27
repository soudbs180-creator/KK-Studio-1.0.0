const fs = require('fs');
const path = require('path');

const projectRoot = 'c:/Users/Administrator/Downloads/KK-Studio-1.0.0';
const cssPath = path.join(projectRoot, 'apps/web/src/index.css');
const webSrc = path.join(projectRoot, 'apps/web/src');
const mobileSrc = path.join(projectRoot, 'apps/mobile/src');

const BLACKLIST_FILES = new Set([
  path.normalize(path.join(webSrc, 'app/buildPptSlidesPreviewHtml.ts')),
  path.normalize(path.join(webSrc, 'services/image/partialRedraw.ts')),
]);

// 核心判断：如果值是带小数的，或者是微小像素/小数点（如渐变网格点 0.78, 1.42, 1.2 等），我们不予转换
function shouldSkipVal(val) {
  const absVal = Math.abs(val);
  
  // 如果是小数，直接跳过（不改变）
  if (absVal % 1 !== 0) {
    return true;
  }
  
  return false;
}

// 调整像素值到偶数
function adjustPx(val, propContext = '') {
  if (val === 0) return 0;
  
  if (shouldSkipVal(val)) {
    return val; // 保持原样不变
  }
  
  const sign = val < 0 ? -1 : 1;
  const absVal = Math.abs(val);

  // 已经是偶数，保持原样
  if (absVal % 2 === 0 && Number.isInteger(absVal)) {
    return val;
  }

  // 针对 Feature 探测中的 blur(1px) 或类似的进行豁免
  if (propContext.includes('blur(1px)') || propContext.includes('backdrop-filter: blur(1px)')) {
    return val;
  }

  if (absVal < 1.5) {
    // 奇数 1px 升级为 2px
    return 2 * sign;
  }

  let rounded = Math.round(absVal / 2) * 2;
  if (rounded === 0) rounded = 2;
  return rounded * sign;
}

// 1. 处理 index.css
function refactorCss() {
  if (!fs.existsSync(cssPath)) {
    console.error('index.css not found!');
    return;
  }

  let content = fs.readFileSync(cssPath, 'utf8');

  // 正则匹配: (-?\d+(?:\.\d+)?)px 
  content = content.replace(/(-?\d+(?:\.\d+)?)px\b/g, (match, valStr, offset, fullText) => {
    const val = parseFloat(valStr);
    
    // 检查这个 px 所在的上下文，是否属于 Feature 检测 @supports not ((backdrop-filter: blur(1px))
    const startIdx = Math.max(0, offset - 50);
    const endIdx = Math.min(fullText.length, offset + 50);
    const contextStr = fullText.substring(startIdx, endIdx);
    
    if (contextStr.includes('backdrop-filter: blur(') || contextStr.includes('webkit-backdrop-filter: blur(')) {
      return match; // 保持 blur(1px) 不变
    }

    if (shouldSkipVal(val)) {
      return match; // 保持 0.78px, 1.42px, 2.1px 等小数像素不变
    }

    // 针对 9999px / 999px 圆角进行 2 的倍数转换
    if (val === 9999) return '10000px';
    if (val === 999) return '1000px';

    const newVal = adjustPx(val);
    return newVal + 'px';
  });

  fs.writeFileSync(cssPath, content, 'utf8');
  console.log('Successfully refactored index.css');
}

// 遍历文件
function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, files);
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

// 2. 处理 React 组件
function refactorComponents() {
  const allWebFiles = getFiles(webSrc).filter(f => !f.endsWith('index.css'));
  const allMobileFiles = getFiles(mobileSrc);
  const allFiles = [...allWebFiles, ...allMobileFiles];

  let totalReplacements = 0;

  allFiles.forEach(file => {
    const normalizedPath = path.normalize(file);
    if (BLACKLIST_FILES.has(normalizedPath)) {
      return;
    }

    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // A. 替换 Tailwind 自定义 px 表达式
    content = content.replace(/-\[(\d+(?:\.\d+)?)px\]/g, (match, valStr) => {
      const val = parseFloat(valStr);
      if (shouldSkipVal(val)) {
        return match;
      }
      
      let newVal;
      if (val === 639) newVal = 638;
      else if (val === 767) newVal = 766;
      else if (val === 1023) newVal = 1022;
      else if (val === 999) newVal = 1000;
      else if (val === 9999) newVal = 10000;
      else newVal = adjustPx(val);
      
      return `-[${newVal}px]`;
    });

    // B. 替换 React 内联样式字符串格式
    content = content.replace(/\b(fontSize|padding|margin|width|height|top|bottom|left|right|borderRadius|gap|borderWidth|borderRightWidth|borderLeftWidth|borderTopWidth|borderBottomWidth|paddingTop|paddingBottom|paddingLeft|paddingRight|marginTop|marginBottom|marginLeft|marginRight)\s*:\s*['"`](-?\d+(?:\.\d+)?)px['"`]/g, (match, prop, valStr) => {
      const val = parseFloat(valStr);
      if (shouldSkipVal(val)) {
        return match;
      }
      const newVal = adjustPx(val, prop);
      return `${prop}: '${newVal}px'`;
    });

    // C. 替换 React 内联样式/RN StyleSheet数字格式
    content = content.replace(/\b(fontSize|padding|margin|width|height|top|bottom|left|right|borderRadius|gap|borderWidth|borderRightWidth|borderLeftWidth|borderTopWidth|borderBottomWidth|paddingTop|paddingBottom|paddingLeft|paddingRight|marginTop|marginBottom|marginLeft|marginRight)\s*:\s*(\d+(?:\.\d+)?)\b/g, (match, prop, valStr) => {
      const val = parseFloat(valStr);
      if (val === 0) return match;
      if (val % 2 === 0 && Number.isInteger(val)) {
        return match;
      }
      if (shouldSkipVal(val)) {
        return match;
      }
      
      if (!Number.isInteger(val) && (val % 1 !== 0.5)) {
        if (val < 2) return match; 
      }

      const newVal = adjustPx(val, prop);
      return `${prop}: ${newVal}`;
    });

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      totalReplacements++;
    }
  });

  console.log(`Successfully refactored ${totalReplacements} components/source files.`);
}

refactorCss();
refactorComponents();
console.log('All refactoring completed successfully.');
