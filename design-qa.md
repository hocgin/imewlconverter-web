# DDUP 标题贴纸设计验收

- Source visual truth: `/Users/hocgin/.codex/generated_images/01a1d8b6-1871-78c0-841c-0c40b9c078a0/exec-bcc0571a-b002-4439-8b04-921290d39b25.png`（用户选择的第 1 张）。
- Implementation: `http://127.0.0.1:5173/zh-hans/`。
- Screenshot: `artifacts/verification/sticker/desktop.png`。
- Full-view comparison: `artifacts/verification/sticker/comparison.png`，左为方案，右为实现。
- Source 1632×964；按相同比例约缩放为 1100×650；实现视口与截图均为 1100×650 CSS/图片像素，无额外密度放大。
- State: 简体中文、浅色、引擎就绪，首屏无选中文件。
- Scope: 标题两行排列及 DDUP 小卡片，保留原站导航、插图、正文和工具功能。使用已有真实 App Store 图标，无新增素材。

## Comparison history

1. 首次对照发现标题沿用原字号时，贴纸相对标题过大（P2）。修复：桌面标题按视口放大至 66px（1100px 下），贴纸保留 34px 图标和 14px 名称。再次拍摄并放入同一对照图复核。
2. 最终对照：白色小卡片、黑色描边、实色偏移阴影、约 -5° 倾斜均符合选中方向；卡片靠近标题第二行，未遮挡文字或下划线。标题的 H1 语义仍在浏览器辅助功能树中保留。桌面与 375px 手机上无页面横向溢出；英语手机标题与卡片也在视口内。

## Findings

无待修复的 P0/P1/P2 问题。局部内容在 1100px 对照中清晰可读，不另制作重复局部裁剪。

## Validation

- TypeScript 检查通过。
- 浏览器检查了标题及卡片布局、App Store 链接实际 href、语言切换和移动宽度。未点击 App Store 链接离开本地页面。
- 浏览器错误日志为空。
- 临时视口已恢复，页面保留供用户查看。

## Follow-up polish

原站系统字体和示意图的字形、非本次调整范围的正文密度，与生成效果图有细微差别。未为局部贴纸修改其余页面。

final result: passed
