/**
 * 生成标签颜色 - 基于 Design System v2.0
 * 8种固定颜色，相同名称的标签颜色一致
 * 
 * @param tagName 标签名称
 * @returns 包含内联样式的颜色对象
 */

export interface TagColor {
    bg: string;      // 背景色（inline style）
    text: string;    // 文本色（inline style）
    border: string;  // 边框色（inline style）
}

/**
 * Design System v2.0 - 8色标签系统
 * 颜色顺序：红/橙/黄/绿/青/蓝/紫/粉
 */
const TAG_COLORS: TagColor[] = [
    { bg: 'rgba(255, 107, 90, 0.12)', text: '#ff6b5a', border: 'rgba(255, 107, 90, 0.25)' }, // 珊瑚红 - 红
    { bg: 'rgba(255, 176, 132, 0.12)', text: '#ffb084', border: 'rgba(255, 176, 132, 0.25)' }, // 蜜桃金 - 橙
    { bg: 'rgba(232, 185, 74, 0.12)', text: '#e8b94a', border: 'rgba(232, 185, 74, 0.25)' }, // 赭石黄 - 黄
    { bg: 'rgba(164, 212, 197, 0.12)', text: '#a4d4c5', border: 'rgba(164, 212, 197, 0.25)' }, // 薄荷绿 - 绿
    { bg: 'rgba(100, 195, 195, 0.12)', text: '#64c3c3', border: 'rgba(100, 195, 195, 0.25)' }, // 雅致青 - 青
    { bg: 'rgba(184, 164, 237, 0.12)', text: '#b8a4ed', border: 'rgba(184, 164, 237, 0.25)' }, // 薰衣草 - 蓝/紫
    { bg: 'rgba(138, 18, 63, 0.12)', text: '#8a123f', border: 'rgba(138, 18, 63, 0.25)' }, // 覆盆紫 - 深紫
    { bg: 'rgba(255, 77, 139, 0.12)', text: '#ff4d8b', border: 'rgba(255, 77, 139, 0.25)' }, // 樱花粉 - 粉
];

/**
 * 根据标签名生成稳定颜色
 * 相同名称永远返回相同颜色
 */
export const generateTagColor = (tagName: string): TagColor => {
    // 使用字符码相加的哈希算法
    const hash = tagName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return TAG_COLORS[hash % TAG_COLORS.length];
};

/**
 * 获取所有可用的标签颜色（用于预览/选择）
 */
export const getAllTagColors = (): TagColor[] => {
    return TAG_COLORS;
};
