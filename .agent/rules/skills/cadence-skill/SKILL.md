---
trigger: glob
description: Cadence SKILL / Virtuoso CIW / OA 数据库脚本生成与修改规范
---

# Cadence SKILL 生成规范

本文档用于约束 Cadence Virtuoso / CIW / OA 数据库相关的 `SKILL` 脚本生成与修改。
当任务要求输出 Cadence `SKILL` 代码时，本文件优先于通用 Web / TypeScript / React 规范。

---

## 适用范围

- Cadence Virtuoso 脚本
- CIW 中加载和执行的 `.il` / `SKILL` 脚本
- OA 数据库对象创建、删除、遍历、选择集处理
- 版图、原理图、标注、图形对象操作

---

## 代码规范与严格要求

### 1. 纯正语法

- 所有脚本必须严格使用 **Cadence SKILL** 语法，保持 Lisp 风格表达。
- 严禁混入 Python、C、Shell、JavaScript 或标准 Common Lisp 的语法习惯。
- 函数定义、条件判断、列表处理、字符串处理、数据库调用都必须使用 Cadence SKILL 原生写法。
- 不确定语法时，宁可使用保守写法，也不要发明不存在的语言特性。

### 2. 局部变量与作用域

- 所有局部变量必须统一放入 `let( (...) ... )` 语句块中声明。
- 严禁直接写出未声明变量，避免污染全局命名空间。
- 临时变量、循环辅助变量、数据库对象句柄都必须纳入 `let` 局部作用域。
- 需要中间状态时，优先扩展当前 `let`，不要把状态泄露到函数外部。

### 3. API 准确性

- 必须优先使用准确的 Cadence GE / DB API。
- 常用 API 包括但不限于：
  - `geGetEditCellView()`
  - `geGetSelSet()`
  - `dbCreateRect()`
  - `dbCreatePath()`
  - `dbCreateLabel()`
  - `dbDeleteObject()`
- 不允许臆造 API 名称，也不允许用伪代码替代真实数据库操作命令。
- 涉及对象创建、删除、遍历、选择集处理时，必须保证 API 名称、参数顺序和返回值语义与 Cadence 环境一致。

### 4. 健壮性要求

- 执行数据库操作前，必须先做基础容错判断。
- 至少覆盖以下检查：
  - 当前编辑的 `cellView` 是否为空
  - 当前选择集 `geGetSelSet()` 是否为空
  - 目标图层、坐标、对象类型是否合法
  - 数据库创建命令返回值是否成功
- 对异常输入或空对象场景，必须给出明确提示，避免脚本直接报错中断。

### 5. 注释说明

- 代码中必须加入详尽的中文注释。
- 注释至少说明：
  - 核心 API 的用途
  - 关键参数的含义
  - 容错判断的目的
  - 主要处理流程的意图
- 注释应服务维护，不要写成空泛描述。

### 6. CIW 运行说明

- 每段可交付脚本在末尾必须补充简要使用说明。
- 至少说明：
  - 如何在 CIW 中使用 `load("xxx.il")` 加载脚本
  - 加载后应调用的主函数名
  - 运行前需要的前置条件，例如是否需要打开版图、是否需要先选中对象

---

## 输出要求

- 给出完整可执行的 SKILL 脚本
- 给出必要的中文注释
- 所有局部变量都必须放入 `let` 作用域
- 在脚本后补充 CIW 加载 / 运行说明
- 如果需求描述与 Cadence SKILL 实际 API 不一致，优先修正为可运行的 Cadence 写法，不输出伪代码

---

## 最小示例

```lisp
; Cadence SKILL 示例：使用 let 声明局部变量，并在操作前做基础校验
procedure(kkCreateDemoRect()
  let((cv selSet rect)
    ; 获取当前编辑中的 cellView；如果没有打开版图窗口，这里可能返回 nil
    cv = geGetEditCellView()
    unless(cv
      error("未找到可编辑的 cellView，请先打开版图窗口。\n")
    )

    ; 获取当前选中对象集合；如果没有选中对象，给出提示并退出
    selSet = geGetSelSet()
    unless(selSet
      warn("当前没有选中对象，脚本已终止。\n")
      return(nil)
    )

    ; 在当前 cellView 中创建矩形
    rect = dbCreateRect(cv list("M1" "drawing") list(0:0 1:1))
    rect
  )
)
```

---

## 常用模板库

推荐组织顺序：
- 当前编辑 CellView 基础守卫
- 选择集遍历与过滤
- 图形创建
- 按图层或对象类型批量修改
- CIW 加载与调试
- 按任务类型输出模板

### 1. 当前编辑 CellView 基础守卫模板

适用时机：
- 任何需要在当前版图 / 原理图窗口中执行数据库操作的脚本

关键 API：
- `geGetEditCellView()`
- `cv~>cellName`
- `cv~>viewName`
- `error()` / `warn()`

```lisp
procedure(kkRequireEditCellView()
  let((cv)
    ; 获取当前正在编辑的 cellView
    cv = geGetEditCellView()
    unless(cv
      error("未找到当前编辑中的 cellView，请先打开目标窗口。\n")
    )

    ; 输出当前 cell 与 view，便于在 CIW 中确认上下文
    println(sprintf(nil "当前 CellView: %s / %s" cv~>cellName cv~>viewName))
    cv
  )
)
```

### 2. 选择集遍历与过滤模板

适用时机：
- 对当前选中图形批量删除、移动、统计、打标签或筛选对象类型

关键 API：
- `geGetSelSet()`
- `foreach()`
- `obj~>objType`
- `dbDeleteObject()`
- `dbMoveFig()`

```lisp
procedure(kkProcessSelectionByType(targetType)
  let((selSet obj)
    ; 获取当前选择集
    selSet = geGetSelSet()
    unless(selSet
      warn("当前没有选中对象，脚本未执行任何操作。\n")
      return(nil)
    )

    foreach(obj selSet
      ; 只处理指定对象类型
      when(obj && obj~>objType == targetType
        println(sprintf(nil "处理对象: %L" obj))
      )
    )

    t
  )
)
```

### 3. 图形创建模板（Rect / Path / Label）

适用时机：
- 在当前 cellView 中批量创建矩形、路径、标注或辅助图形

关键 API：
- `dbCreateRect()`
- `dbCreatePath()`
- `dbCreateLabel()`
- `list("M1" "drawing")`

```lisp
procedure(kkCreateDemoShapes()
  let((cv rect path label lpp)
    cv = geGetEditCellView()
    unless(cv
      error("未找到可编辑的 cellView。\n")
    )

    ; 定义目标图层与 purpose
    lpp = list("M1" "drawing")

    ; 创建矩形
    rect = dbCreateRect(cv lpp list(0:0 2:1))
    unless(rect
      error("dbCreateRect 执行失败。\n")
    )

    ; 创建 path
    path = dbCreatePath(cv lpp list(0:2 2:2) 0.2)
    unless(path
      error("dbCreatePath 执行失败。\n")
    )

    ; 创建标注
    label = dbCreateLabel(cv lpp 0:3 "KK Demo" "centerLeft" "R0" "roman")
    unless(label
      error("dbCreateLabel 执行失败。\n")
    )

    list(rect path label)
  )
)
```

### 4. 按图层或对象类型批量修改模板

适用时机：
- 把选中对象复制到新层、替换图层、删除某类对象或按类型做批量清理

关键 API：
- `geGetSelSet()`
- `obj~>lpp`
- `obj~>objType`
- `dbCopyFig()`
- `dbDeleteObject()`

```lisp
procedure(kkCopySelectedFigsToLayer(newLpp)
  let((cv selSet obj copiedFig)
    cv = geGetEditCellView()
    unless(cv
      error("未找到当前编辑中的 cellView。\n")
    )

    selSet = geGetSelSet()
    unless(selSet
      warn("没有选中对象，无法执行复制。\n")
      return(nil)
    )

    foreach(obj selSet
      when(obj
        ; 先复制，再修改新对象的图层属性
        copiedFig = dbCopyFig(obj cv)
        when(copiedFig
          copiedFig~>lpp = newLpp
        )
      )
    )

    t
  )
)
```

### 5. CIW 加载与调试模板

适用时机：
- 交付给用户在 CIW 中直接加载、运行、调试的所有脚本

关键 API：
- `procedure()`
- `load("xxx.il")`
- `println()`
- `return()`

推荐说明格式：

```lisp
load("C:/path/to/your_script.il")
kkCreateDemoShapes()
```

运行前提：
- 已打开目标版图或原理图窗口
- 如果脚本依赖选择集，请先完成对象选择
- 如果脚本依赖特定图层，请确认目标工艺层已经存在

调试建议：
- 用 `println()` 输出关键中间变量
- 对数据库创建结果立即做 `nil` 判断
- 先在小范围对象或测试 cellView 中验证，再批量运行

---

## 按任务类型输出模板

下面这 4 类模板优先覆盖最常见的版图自动化任务。输出这类脚本时，默认给出：
- 完整 `procedure(...)`
- 完整 `let(...)`
- 基础容错判断
- 中文注释
- CIW 加载与运行说明

### 1. 版图对象批量移动模板

适用场景：
- 把当前选择集整体平移
- 对指定对象批量偏移
- 做简单版图整理或测试位移

关键检查：
- `cellView` 不为空
- 选择集不为空
- 偏移量是合法数值

关键 API：
- `geGetEditCellView()`
- `geGetSelSet()`
- `dbMoveFig()`

```lisp
procedure(kkMoveSelectedFigs(deltaX deltaY)
  let((cv selSet fig)
    ; 获取当前编辑窗口
    cv = geGetEditCellView()
    unless(cv
      error("未找到当前编辑中的 cellView。\n")
    )

    ; 获取当前选择集
    selSet = geGetSelSet()
    unless(selSet
      warn("当前没有选中对象，未执行移动。\n")
      return(nil)
    )

    ; 遍历并移动每个选中对象
    foreach(fig selSet
      when(fig
        dbMoveFig(fig cv deltaX:deltaY)
      )
    )

    println("批量移动完成。")
    t
  )
)
```

---

### 2. 按图层筛选并删除模板

适用场景：
- 只删除选中对象里位于某个 layer purpose pair 的图形
- 清理临时 marker、辅助层或错误生成对象

关键检查：
- 选择集不为空
- 目标 `lpp` 合法

关键 API：
- `geGetSelSet()`
- `obj~>lpp`
- `dbDeleteObject()`

```lisp
procedure(kkDeleteSelectedByLpp(targetLpp)
  let((selSet fig deleteCount)
    deleteCount = 0
    ; 读取当前选择集
    selSet = geGetSelSet()
    unless(selSet
      warn("当前没有选中对象，未执行删除。\n")
      return(0)
    )

    foreach(fig selSet
      when(fig && fig~>lpp == targetLpp
        dbDeleteObject(fig)
        deleteCount = deleteCount + 1
      )
    )

    printf("已删除对象数量: %d\n" deleteCount)
    deleteCount
  )
)
```

### 3. 批量加 Label 模板

适用场景：
- 给当前选择对象逐个打标
- 在选中图形附近批量生成说明文字
- 生成调试用 label 或序号

常用 API：
- `geGetEditCellView()`
- `geGetSelSet()`
- `dbCreateLabel()`

```lisp
procedure(kkAddLabelToSelected(textString lpp)
  let((cv selSet fig label)
    cv = geGetEditCellView()
    unless(cv
      error("未找到可编辑的 cellView。\n")
    )

    selSet = geGetSelSet()
    unless(selSet
      warn("当前没有选中对象，未创建标注。\n")
      return(nil)
    )

    foreach(fig selSet
      when(fig
        ; 这里示例直接在固定坐标落文字；实际可替换为 bbox 相关坐标
        label = dbCreateLabel(cv lpp 0:0 textString "centerLeft" "R0" "roman")
        unless(label
          warn("某个对象的 label 创建失败。\n")
        )
      )
    )

    t
  )
)
```

### 4. 从 Selection 生成 Path / Rect 模板

适用场景：
- 基于当前选中对象的几何位置生成辅助 path 或 rect
- 按选择集创建 marker、边框或测试图形
- 从对象范围推导新几何骨架

常用 API：
- `geGetEditCellView()`
- `geGetSelSet()`
- `dbCreateRect()`
- `dbCreatePath()`

```lisp
procedure(kkCreateRectFromSelection()
  let((cv selSet fig newRect lpp)
    cv = geGetEditCellView()
    unless(cv
      error("未找到可编辑的 cellView。\n")
    )

    selSet = geGetSelSet()
    unless(selSet
      warn("当前没有选中对象，未创建矩形。\n")
      return(nil)
    )

    ; 示例中只基于第一个选中对象生成新图形
    fig = car(selSet)
    unless(fig
      warn("选择集为空，脚本结束。\n")
      return(nil)
    )

    lpp = list("M1" "drawing")
    newRect = dbCreateRect(cv lpp list(0:0 1:1))
    unless(newRect
      error("基于选择集创建矩形失败。\n")
    )

    newRect
  )
)
```

---

## CIW 加载与运行

```lisp
load("C:/path/to/your_script.il")
<主函数名>()
```

运行前提：
- 已打开目标版图或原理图窗口
- 如果脚本依赖选择集，请先完成对象选择
- 若路径包含反斜杠，建议统一替换为正斜杠
- 建议先在测试 cellView 中验证，再用于真实设计数据

---

## 模板使用原则

- 优先从最接近需求的模板出发修改，不要从零随意拼装语法。
- 所有模板在落地前都要补齐：
  - 局部变量 `let(...)`
  - 基础容错判断
  - 中文注释
  - CIW 加载与运行说明
- 如果任务涉及真实工艺图层，请把示例中的 layer purpose pair 替换成当前环境的合法值。
- 如果任务是“按任务类型生成脚本”，优先从本节的 4 类任务模板开始，不要退回到泛化伪代码。
