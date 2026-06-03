-- 简体中文：AI 助手核心运行时、知识库与审计日志相关数据库表结构
-- 遵守 AGENTS 项目规范：所有代码和迁移文件必须使用中文注释说明用途。

-- 1. Agent 运行计划表：存储每次用户自然语言指令的意图、规划与状态
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id VARCHAR(255) PRIMARY KEY, -- 运行唯一 ID
  user_message TEXT NOT NULL, -- 用户输入的指令内容
  intent VARCHAR(100) NOT NULL, -- 识别的意图类型
  plan JSONB NOT NULL, -- 结构化的执行计划
  status VARCHAR(50) NOT NULL, -- 运行状态 (planning, waiting_confirmation, running, completed, failed, cancelled)
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 2. Agent 工具审计表：记录工具调用的脱敏参数与状态
CREATE TABLE IF NOT EXISTS public.agent_tool_calls (
  id VARCHAR(255) PRIMARY KEY, -- 调用的唯一 ID
  run_id VARCHAR(255) REFERENCES public.agent_runs(id) ON DELETE CASCADE, -- 关联的运行记录 ID
  tool_name VARCHAR(255) NOT NULL, -- 工具名称
  input_summary TEXT NOT NULL, -- 脱敏输入参数摘要
  output_summary TEXT, -- 脱敏输出参数摘要
  status VARCHAR(50) NOT NULL, -- 执行状态 (success, failed, blocked)
  error TEXT, -- 错误详情信息
  started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, -- 工具开始时间
  completed_at TIMESTAMP WITHOUT TIME ZONE, -- 工具完成时间
  idempotency_key VARCHAR(255) -- 幂等性校验密钥
);

-- 3. Agent 记忆表：记录会话的长短期记忆
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255), -- 关联的用户 ID
  key VARCHAR(255) NOT NULL, -- 记忆的键名
  value TEXT NOT NULL, -- 记忆的值
  is_long_term BOOLEAN DEFAULT FALSE, -- 是否是长期记忆
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 4. 知识文档表：存放 AI 助手的权威静态与动态知识文档
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL, -- 来源 (code, doc, test, runtime, skill, handoff, ui)
  path VARCHAR(500) NOT NULL, -- 文档物理路径
  title VARCHAR(255) NOT NULL, -- 文档标题
  summary TEXT NOT NULL, -- 文档摘要
  content_hash VARCHAR(255) NOT NULL, -- 内容哈希
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 5. 知识分块表：对于大文档做 RAG 或内容切分时的分块数据
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id VARCHAR(255) PRIMARY KEY,
  document_id VARCHAR(255) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- 分块文本
  chunk_index INTEGER NOT NULL, -- 分块索引
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 6. 画布运行态快照表：记录画布的历史和当前快照，用于任务中断恢复
CREATE TABLE IF NOT EXISTS public.canvas_runtime_snapshots (
  id VARCHAR(255) PRIMARY KEY,
  canvas_id VARCHAR(255) NOT NULL, -- 画布 ID
  snapshot_data JSONB NOT NULL, -- 画布快照 JSON 报文
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 7. Agent 技能手册表：收录的可执行 Skills
CREATE TABLE IF NOT EXISTS public.agent_skills (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL, -- 技能名称
  trigger_text TEXT NOT NULL, -- 触发场景自然语言说明
  tools TEXT[] NOT NULL, -- 调用的工具数组列表
  steps TEXT[] NOT NULL, -- 严格执行步骤
  safety TEXT[], -- 安全规约要求
  validation TEXT[], -- 校验方式
  knowledge_updates TEXT[], -- 结束后同步更新的知识模块
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
