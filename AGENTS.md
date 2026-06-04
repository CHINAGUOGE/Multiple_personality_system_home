# AGENTS.md

本仓库允许使用 AI Agent / Codex 辅助开发。请遵守以下规则，避免影响主站、Lab 子站及线上部署。

## 仓库结构与构建

- 当前仓库是 Astro 主站项目：
  - 主站入口：`src/`
  - 主站静态资源：`public/`
  - 主站配置：`astro.config.mjs`
  - 主站构建命令：`npm run build`
- Lab 子站使用独立配置：`astro.config.lab.mjs`。
- Lab 构建命令：`npm run build:lab`。
- Lab 输出目录：`dist-lab`。
- `lab-public/race/` 对应线上路径：`https://lab.mpsteam.cn/race/`。

## 基本原则

- 一次只处理一个明确问题。
- 不要把无关修改混在一起。
- 不要大范围重构，除非任务明确要求。
- 不要删除现有功能、文件、配置，除非任务明确要求。
- 修改前先阅读相关 README、配置文件和现有代码风格。
- 不要破坏主站现有构建流程；主站继续使用 `astro.config.mjs` 和原有 `npm run build`。

## 提交前检查

提交前请确认：

- 修改范围符合任务目标。
- 没有提交临时文件、缓存文件、日志文件。
- 没有提交 `.env`、Token、密钥、账号密码等敏感信息。
- 如项目支持，请执行构建或检查命令，例如：

```bash
npm run build
npm run lint
```

如果检查失败，需要说明原因。

## Commit Message

提交信息使用中文，格式：

```text
类型: 简要说明
```

常用类型：

```text
feat: 新增功能
fix: 修复问题
docs: 文档修改
style: 样式调整
refactor: 代码重构
chore: 配置或杂项
revert: 回退修改
```

示例：

```text
fix: 修复移动端启动按钮无法点击问题
feat: 增加赛车游戏道具系统
docs: 补充部署说明
```

## 禁止行为

除非用户明确要求，Agent 不得：

- 使用 `git push --force`
- 使用 `git reset --hard`
- 删除大量文件或重要目录
- 自动升级大量依赖
- 自动合并不理解的冲突
- 修改生产环境密钥、域名、部署账号
- 为了“优化”而重写整个项目

## 部署配置

- 修改部署配置时，必须说明影响范围。
- 不要修改生产环境密钥、域名、部署账号，除非用户明确要求。
- 涉及主站与 Lab 子站构建配置时，需要分别说明对 `npm run build` 和 `npm run build:lab` 的影响。

## 输出要求

每次修改完成后，请说明：

```text
本次修改：
- 修改了什么
- 为什么这样改

检查情况：
- 是否执行 build / lint
- 如果未执行，说明原因

遗留问题：
- 如有请列出
```
