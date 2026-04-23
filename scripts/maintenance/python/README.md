# scripts/maintenance/python/

本目录存放历史维护阶段使用的 Python 脚本。

## 文件说明

- `patch_canvas.py` — 早期 Canvas 组件结构补丁脚本（已合入主代码，仅作参考）
- `patch_canvas_v2.py` — Canvas 补丁 v2（同上）
- `cloudflare_manager.py` — Cloudflare DNS/WAF 管理工具脚本
- `requirements-cloudflare.txt` — cloudflare_manager.py 的 Python 依赖

## 使用说明

这些脚本不属于主应用构建流程，需要独立的 Python 环境。
如需运行 cloudflare_manager.py，请先安装依赖：

```
pip install -r requirements-cloudflare.txt
```
