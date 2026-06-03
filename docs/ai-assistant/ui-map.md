# UI 映射表 (UI Map)

本文件维护 KK Studio v1.5.3 各界面入口、面板及其对应的 CSS 选择器或高亮标记，供 AI 助手进行组件聚焦与定位。

---

## 1. 核心面板选择器

| 功能组件 | CSS 选择器 / 标识符 | 描述 |
| :--- | :--- | :--- |
| **API 设置面板** | `.settings-api-management` / `#settings-panel` | 系统设置中的 API 密钥管理面板 |
| **大卡片输入区** | `.input-bar` / `textarea` | 底部生图与聊天输入框 |
| **项目列表侧边栏** | `.project-manager-sidebar` | 左侧项目与画布切换面板 |
| **AI 接管激活按钮** | `#btn-ai-takeover-toggle` | 底部输入区旁的 AI 接管按钮 |
| **资源管理器 Plus 按钮**| `#btn-takeover-plus-button` | 接管模式下的资源连结加号按钮 |
| **AI 助手选项菜单** | `#btn-takeover-menu-container` | Plus 按钮弹出的文件/文件夹导入菜单 |
| **无限画布容器** | `#canvas-container` | 主无限画布 DOM 容器 |
| **缩放控制卡片** | `.desktop-zoom-rail` | 左下角毛玻璃缩放与版本展示面板 |

---

## 2. UI 变更通知原则

当开发人员修改或重构上述 DOM 的 id、class 或相对位置时，**必须**在此文件中同步更新，防止 AI 助手的 `highlightElement` 与聚焦指令失效。
