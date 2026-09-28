# dsh-mobile-ux

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的 Web 界面加一层**移动端体验增强**的客户端插件。

不改动 DSH 本体任何文件：整个改造以「客户端插件 + 少量 CSS 覆盖」实现，装进 profile 即可用，随时可卸载。

## 功能

全部只在窄视口（≤ 1023px，与 DSH 自身的侧栏折叠断点一致）生效，桌面端行为完全不变。

### 1. 侧边栏 → 侧滑卡片抽屉

- 折叠后那条 56px 图标栏**不再占用聊天宽度**（列宽压到 0）；
- 从屏幕**左边缘向右滑**，侧栏以浮层卡片滑出：宽度 `min(320px, 86vw)`、右侧圆角 + 阴影、避开刘海与底部安全区；
- 卡片之上盖一层淡遮罩；**点任意处 / 点会话 / 向左滑**收起；
- 聊天区域**完全不动**（不位移、不缩放）。

### 2. 回车换行（触摸设备）

手机软键盘没有 Shift 键，而 DSH 的回车默认等于发送（Shift+Enter 才是换行）。
本插件把回车**重放成一次 Shift+Enter**，交给 DSH/Lexical 自己的换行路径处理，因此不会出现绕过编辑器模型导致的文本错乱；发送请使用输入框自带的发送按钮。

### 3. 设置页全屏（移动端）

设置面板在手机上铺满全屏，原来的左侧标题栏变成**顶部标题栏**，分类列表变成一行**可横向滑动的胶囊**，下方是当前分类的设置内容；关闭与操作按钮固定在标题栏右上角。

## 安装

把本目录作为一个 bundle 安装到当前 DSH profile：

```
plugin_manager  install_bundle  target = <本目录绝对路径>
```

安装后刷新页面即可生效。卸载：

```
plugin_manager  remove_bundle  target = @local/dsh-mobile-ux
```

## 实现要点

- **不改 DSH 源码**：样式通过注入 `<style>` 覆盖，行为通过内容元素上的 `data-*` 标记驱动。
- **列宽 0 而不是脱离 grid 流**：侧栏列保持为 grid item（只是 0 宽），避免自动放置把聊天列顶进 0px 轨道。
- **卡片 = 列的溢出内容**：`overflow: visible` 让 0 宽列的内容浮出来，再用 `z-index` 抬到聊天之上、用列自身的 `transform` 做滑动、用 `visibility`（继承属性）控制显隐 —— 这样即使 slot 渲染在外面包了一层 `display: contents`，也依然有效。
- **选择器优先使用语义锚点**：`data-shortcut-modal="settings"`、`data-sidebar-collapsed`、`data-shell-overlay` 等，尽量避免依赖构建后的 hash 类名。
- **自检安全网**：标记完成后会实测聊天列宽度/高度/可见性，一旦异常就**撤下全部标记与样式**、恢复 DSH 原始布局 —— 功能失效可以接受，弄坏界面不行。

## 注意事项

- 依赖 DSH 客户端当前的 DOM 结构与部分语义属性（`data-sidebar-collapsed`、`data-shortcut-modal`、列类名后缀 `…sidebarCol` / `…centerCol` / `…rightbarCol`）。**DSH 升级后可能需要小幅适配。**
- 在中文输入法仍处于选词状态时按回车仍是「确认选词」，需要再按一次才是换行（这是输入法的行为）。
- 开发验证于 DSH `0.1.7-rc.2` / 手机端浏览器。
