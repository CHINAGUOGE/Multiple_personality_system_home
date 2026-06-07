# 小旅猫

原创低压力放置旅行小游戏。v0.1 的目标很窄：收集露珠，给猫准备行李，让猫自己出门，等它回来后带回明信片和纪念品。

## 当前版本

- 版本：v0.1
- 路径：`/little-travel-cat/`
- 入口文件：`index.html`
- 存档：浏览器 `localStorage`
- 默认节奏：旅行按真实小时计算
- 新存档开局：`25` 个露珠
- 主题：默认跟随系统，支持浅色 / 夜间切换

## v0.1 玩法

- 新存档会先送 25 个露珠，方便立刻购买基础食物试玩。
- 庭院约每 1 分钟生成 1 个露珠，最多暂存 20 个。
- 玩家可以收集露珠，用露珠购买食物和旅行道具。
- 每次旅行必须携带 1 个食物，最多携带 2 个道具。
- 食物会消耗，道具购买后永久拥有。
- 猫出门后会根据食物和道具生成路线与归来时间。
- 猫回来后至少带回 1 张明信片，并有概率带回 1 件纪念品。
- 明信片和纪念品进入收藏册。
- 支持 3 个本地存档槽，切换槽位前会自动保存当前槽。

## 存档说明

当前版本使用 3 个本地存档槽：

- 当前槽位：`littleTravelCatActiveSlot:v1`
- 槽位存档：`littleTravelCatSave:v1:slot:1`
- 槽位存档：`littleTravelCatSave:v1:slot:2`
- 槽位存档：`littleTravelCatSave:v1:slot:3`
- 全局主题：`littleTravelCatTheme:v1`

重置按钮只会重置当前槽位，并且必须二次确认。

主题设置是全局偏好，不跟随存档槽位切换。可选值为 `system`、`light`、`dark`。

## 开发说明

线上默认使用真实旅行时长。需要快速验收旅行流程时，在地址后加 `?dev`：

```text
/little-travel-cat/?dev
```

带 `?dev` 时旅行测试节奏为 `1 小时 = 1 分钟`；不带参数时按真实小时计算。

验收时也可以在地址后加 `?debug=1`，页面会挂载 `window.littleTravelCatDebug.forceReturn()`，用于强制当前旅行立刻结算。普通访问不会暴露这个调试入口。

页面内置轻量日志钩子：

- 生产环境会把白名单事件发送到 `/api/log`，包括启动、出门、归来、收集露珠、购买、切换槽位、重置存档、切换主题和前端错误。
- 日志 payload 只包含槽位、物品 / 路线 id、数量、状态等摘要，不上传完整 localStorage 存档。
- 所有日志事件都会同步派发 `window` 级 `CustomEvent`，事件名为 `little-travel-cat:event`。
- 在地址后加 `?log=1` 或 `?debug=1` 时，日志事件也会输出到浏览器控制台。

监听钩子示例：

```js
const unsubscribe = window.littleTravelCatHooks.on((event) => {
  console.log(event.detail.eventName, event.detail.payload);
});

// 不再监听时：
unsubscribe();
```

## 不在 v0.1 范围

- 天气系统
- 节日事件
- 猫朋友
- 地图探索
- 稀有动画
- 成就系统
- 云存档
- 好感度
- 每日任务
- 复杂剧情
