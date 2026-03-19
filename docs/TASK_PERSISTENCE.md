# 异步任务持久化功能

## 功能说明

这个功能解决了**页面刷新后丢失进行中的生成任务**的问题。现在所有异步生成任务（图片、视频、音频）都会被保存到 Supabase 数据库，即使刷新页面或关闭浏览器，回来后也能自动恢复任务状态。

## 技术实现

### 1. 数据库表 (`generation_tasks`)

存储所有生成任务的信息：
- `task_id`: API 返回的任务 ID
- `task_type`: 任务类型 (image/video/audio)
- `status`: 任务状态 (pending/processing/completed/failed)
- `result_urls`: 生成的图片/视频 URL 数组
- `cost`, `tokens`: 计费信息
- `prompt`, `model`: 生成参数

### 2. 核心文件

- **`src/services/persistence/taskPersistence.ts`**: 数据库操作封装
- **`src/hooks/useTaskRecovery.ts`**: 任务恢复逻辑
- **`supabase/migrations/20260319142759_create_generation_tasks.sql`**: 数据库表结构
- **`supabase/migrations/20260319142950_harden_generation_tasks_security.sql`**: 任务表安全加固

### 3. 集成点

在 `useImageGeneration.ts` 中，以下时机会更新数据库：

1. **任务创建时** (`onTaskId` 回调)
   - 调用 `persistTask()` 保存任务到数据库

2. **任务完成时** (生成成功)
   - 调用 `markTaskCompleted()` 更新状态为 completed

3. **任务失败时** (生成失败)
   - 调用 `markTaskFailed()` 更新状态为 failed

4. **轮询成功时** (`pollTaskStatus`)
   - 调用 `markTaskCompleted()` 更新状态

5. **轮询失败时** (`pollTaskStatus`)
   - 调用 `markTaskFailed()` 更新状态

## 部署步骤

### 1. 应用数据库迁移

```bash
# 使用 Supabase CLI 应用迁移
supabase db push

# 或者在 Supabase Dashboard 中执行 SQL:
# 依次执行 20260319142759_create_generation_tasks.sql
# 和 20260319142950_harden_generation_tasks_security.sql 中的内容
```

### 2. 验证表创建

在 Supabase Dashboard -> Table Editor 中，确认 `generation_tasks` 表已创建。

### 3. 测试功能

1. 开始生成一张图片或视频
2. 在生成过程中刷新页面
3. 页面重新加载后，应该会自动恢复任务轮询
4. 完成后检查数据库，状态应该更新为 `completed`

## 工作原理

```
用户点击生成
    ↓
API 返回 taskId
    ↓
保存到数据库 (pending)
    ↓
开始轮询任务状态
    ↓
用户刷新页面 ←─┐
    ↓           │
页面重新加载   │
    ↓           │
查询数据库中    │
pending 任务   │
    ↓           │
恢复轮询 ──────┘
    ↓
任务完成
    ↓
更新数据库 (completed)
```

## 注意事项

1. **自动清理**: 数据库会保留最近 30 天的任务记录，旧任务会自动清理
2. **用户隔离**: 每个用户只能看到自己的任务（RLS 策略）
3. **重复任务**: 同一个 task_id 会被自动去重（UPSERT）
4. **离线支持**: 当网络恢复时，会自动恢复所有 pending 任务

## 故障排查

### 任务没有被保存

检查浏览器控制台是否有 Supabase 连接错误：
```javascript
// 检查 Supabase 配置
console.log(supabase);
```

### 任务恢复失败

检查用户是否已登录（匿名用户无法保存任务）：
```javascript
const { data: { user } } = await supabase.auth.getUser();
if (!user) console.log('用户未登录，任务不会持久化');
```

### 数据库权限错误

确保在 Supabase Dashboard -> Authentication -> Policies 中，已为 `generation_tasks` 表配置正确的 RLS 策略。

## 后续优化建议

1. **任务历史页面**: 可以创建一个页面展示所有历史生成任务
2. **批量重试**: 对于 failed 的任务，提供批量重试功能
3. **Webhook 支持**: 如果第三方 API 支持 webhook，可以实现服务器端自动更新
4. **任务统计**: 基于数据库数据进行生成统计和分析
