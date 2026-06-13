# 塔防小游戏 - 项目记忆

## 路径
`E:/workbuddy/tower-defense`

## 技术栈
- 抖音小游戏 Canvas 2D 纯渲染
- ES Module 模块化
- tt.Storage 本地持久化
- 独立浏览器版 index.html（单文件全内联）

## 核心架构
- game.js 入口 → SceneManager → 4个场景页面
- GameEngine 主循环：update（WaveManager + CombatSystem）→ render（网格/塔/怪物）→ HUD
- 页面：HomePage / LevelSelectPage / GamePage / AdminPage

## 设计规则（已确认）
- 抽卡递增费用、战斗中可抽、手牌4张（v1.4.0改为4）、保底10连稀有+且出稀有重置
- 终点血量10，普通1伤精英3伤BOSS4伤
- 每关15波，5/10精英15BOSS
- 后台配置需开发者密码 admin888

## v1.9.3 修复（2026-06-11）
1. index.html 独立浏览器版同步修复：后台配置按钮去掉 isDeveloper 保护、AdminPage onEnter 改用 _pendingAuth 旗标模式避免被 render() 覆盖

## v1.9.2 修复（2026-06-11）
1. AdminPage 修复：SceneManager.goto() 在 onEnter() 后无条件调用 render()，导致授权提示框被后台主界面覆盖
   - onEnter(): 未授权时仅设置 _pendingAuth = true，不直接调用 _showAuthPrompt()
   - render(): 开局检查 _pendingAuth，若为 true 则调用 _showAuthPrompt() 并 return，避免被正常内容覆盖

## v1.9.1 修复（2026-06-11）
1. HomePage：后台配置按钮始终显示（去掉 isDeveloper 前置判断），AdminPage 自带密码验证
2. GamePage：触摸事件重构 —— onTouchStart 不再选中塔；onTouchEnd 先检查 × 删除按钮，再处理塔体短按选中；空地点击取消选中

## v1.9.0 UI 规范化（2026-06-11）
1. 新建 src/ui/theme.js：统一设计令牌（色板 Color / 字阶 Font / 间距 Spacing / 圆角 Radius）
2. 扩展 src/utils/DrawUtil.js：新增 drawButton、drawCard、drawHeader、drawTab、roundRect 公共绘制函数
3. HomePage → 使用 Color/Font/drawButton 替代写死色值和 _drawButton/_roundRect
4. LevelSelectPage → 使用 Color/Font 替代写死色值和泛型 sans-serif
5. AdminPage → 深蓝(#1a1a2e) → 暗绿(#0F1A0F) 统一色板，按钮/卡片/头部均使用 DrawUtil
6. GamePage → HUD 颜色/字体全部走 theme token，零逻辑改动

## v1.8.2 改动（2026-06-11）
1. 恢复拖拽逻辑（回退v1.8.1第1项改动）：短按选塔显示删除+攻击范围，长按拖拽（超过10px阈值）
2. 拖拽松手只做合并升级（同ID同等级塔），不能移动到空地
3. GameEngine新增 canMovePlacedTower（只检查合并条件）、movePlacedTower（执行合并升级）
4. Tower新增 upgrade() 方法（等级+1+applyLevelStats）
5. 拖拽幽灵渲染：半透明塔色方块+金边+目标格绿/红高亮

## v1.8.1 改动（2026-06-11）
1. 移除拖拽逻辑，点击已放置塔只做选中（显示删除按钮+攻击范围）
2. 多格塔部分重叠判定为失败，只有完全重叠（同col/row/gridCols/gridRows）才允许合并升级

## v1.8.0 改动（2026-06-11）
1. 手牌锁定时机：选中牌不锁定其他牌，放置/使用成功后才调用 disableAllCards()
2. HOME确认弹窗取消按钮改绿色 #4CAF50
3. HOME按钮改小房子图标（三角屋顶+矩形屋身）
4. 多格塔系统：archer 1×2、dragon 2×2，全链路适配（数据/放置/渲染/选中/删除）

## v1.5.0 改动（2026-06-11）
1. 修复范围预览颜色BUG：可放置时绿色、不可放置时红色（原因为 selectedHandIndex 未同步到 GameEngine）
2. 拖拽合并功能：已放置塔可拖拽到同类型+同等级塔上合并升级，位置=被拖放目标位置，其他情况回原位
3. 终点血量显示在终点格子上方（血条+数字），取代HUD中的HP条
4. 终点贴图可配置：关卡数据新增 goalImage 字段，后台可上传终点图片
5. 后台AdminPage关卡Tab新增"上传终点图"按钮
6. GameEngine新增：hoverCol/hoverRow/selectedHandIndex/selectedPlacedTowerIdx 交互状态
7. ConfigManager支持 _goalDataUrl/_goalImage 持久化与恢复

## v1.4.0 改动（2026-06-11）
1. 手牌4张制（MAX_HAND_SIZE 5→4），刷新4张牌替换原单抽
2. 塔等级1-5系统：levelStats数组定义每级atk/range/cd递增
3. 同类型+同等级塔可合并升级（5级最终形态不可再合并）
4. 每等级不同素材：后台AdminPage塔Tab展示levelStats
5. 放置范围预览：绿色=可放置（含合并），红色=不可放置
6. 新增：handDisabled手牌禁用、draw4()刷新4牌、Tower.upgrade()升级、CombatSystem.canPlace合并判断
7. 塔上方渲染 Lv.N 等级标签，颜色按等级区分
8. 刷新按钮替代抽卡按钮

## 已修复BUG（v0.1.1）
- 页面触摸崩溃 / 塔冷却失效 / 怪物位置偏移 / 第二局卡死 / 波次节奏 / 多组出怪异常
