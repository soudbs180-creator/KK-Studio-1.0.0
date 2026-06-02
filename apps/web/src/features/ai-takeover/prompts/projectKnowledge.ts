// 简体中文：本地规则问答知识库

export interface KnowledgeItem {
  keywords: string[];
  title: string;
  content: string;
}

export const PROJECT_KNOWLEDGE: KnowledgeItem[] = [
  {
    keywords: ['新建', '创建', '画布', '项目', '怎么建', '加画布', '新增项目', '新项目'],
    title: '新建画布与项目',
    content: '在 KK-Studio 中，您可以在左侧项目管理器中轻松新建画布项目。请点击 [高亮新建画布按钮](action://highlight-#btn-create-canvas) 来创建一块全新的无限画布。'
  },
  {
    keywords: ['删除', '节点', '卡片', '清空', '删掉', '怎么删', '移除'],
    title: '删除画布节点或卡片',
    content: '如果您想删除画布上的任何内容：\n1. 选中要删除的提示词卡片或生成图片卡片。\n2. 点击卡片上方弹出的操作菜单中的垃圾桶图标。\n3. 您也可以直接按下键盘上的 `Delete` 或 `Backspace` 键来删除选中的节点。'
  },
  {
    keywords: ['连接', '连线', '关联', '画线', '拉线', '线怎么画', '箭头'],
    title: '节点之间的连线与关联',
    content: '在画布上，当您从已生成图片的底部向下拖拽时，会拉出一根绿色的连线。松手后将其与新建提示词卡片相连，就可以在它们之间建立绘图上下文关联，非常适合进行重绘、局部修改等追问操作。'
  },
  {
    keywords: ['放大', '缩小', '缩放', '看不清', '大小', '视野', '重置', '移动', '滚轮'],
    title: '画布缩放与重置视图',
    content: '1. 您可以使用鼠标滚轮在画布上进行自由缩放，或按住鼠标中键/空格键拖拽画布来移动视野。\n2. 您也可以点击左下角精致的 [高亮缩放控制面板](action://highlight-.desktop-zoom-rail) 按钮进行调整，双击缩放数值可重置为 100%。'
  },
  {
    keywords: ['充值', '积分', '不够', '没积分', '余额', '买积分', '充钱'],
    title: '关于积分与充值',
    content: '使用系统默认提供的模型会消耗积分。由于默认注册积分为 0，您可以直接点击 [立即去充值](action://open-recharge) 或是点击 [高亮充值按钮](action://highlight-#btn-desktop-recharge) 来获取积分。'
  },
  {
    keywords: ['设置', '配置', 'key', '密钥', 'api', '接ai', '连接ai', '接口', '专属key'],
    title: '如何配置 API 密钥',
    content: '如果您有自己的 Gemini 或 OpenAI API Key，可以将其填入本地设置中。这样，对话和生成将直接使用您的专属密钥，不再扣除系统积分！\n您可以点击 [跳转到API设置页面](action://open-settings-api) 进行配置，也可以 [高亮设置按钮](action://highlight-#btn-desktop-settings) 来打开面板。'
  },
  {
    keywords: ['报错', '错误', '不工作', '失败', '断开', '调试', '故障', '限流'],
    title: '常见错误与调试',
    content: '报错通常由于以下几种情况引起：\n1. **积分不足**：若使用默认模型，请点击 [去充值](action://open-recharge)。\n2. **API 密钥失效**：请检查您的 API Key 是否输入正确，点击 [去设置API](action://open-settings-api)。\n3. **网络超时**：请检查您的网络连接并刷新页面重试。'
  }
];

export const matchLocalKnowledge = (query: string): string | null => {
  const lowerQuery = (query || '').toLowerCase();
  for (const item of PROJECT_KNOWLEDGE) {
    if (item.keywords.some(kw => lowerQuery.includes(kw))) {
      return `### 💡 ${item.title}\n\n${item.content}`;
    }
  }
  return null;
};
