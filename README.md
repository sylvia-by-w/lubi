# Lubi

> A personal time-management and reflection system inspired by Alexander Lyubishchev's method of time accounting.  
> 一个以柳比歇夫时间统计法为灵感，连接计划、实际记录与复盘的个人时间管理系统。

[Live Demo](https://lubi-iota.vercel.app/) · [中文介绍](#中文介绍)

---

## Overview

Lubi is a browser-based personal productivity tool designed around one core idea:

> Planning matters, but understanding how time was actually spent matters more.

Instead of treating a to-do list as the final result, Lubi places planned time and actual time side by side. It helps users record what they intended to do, what they really did, and where meaningful differences appeared.

The project combines weekly time logging, task and project management, visual analytics, and AI-assisted daily and weekly reviews in one system.

## Features

### Time Log

- Weekly calendar with a time-grid layout
- Separate planned and actual task records
- Clear comparison between intended and completed work
- Category and project assignment
- Optional value and energy-level information
- Weekly navigation and configurable date ranges

### Task Board

- Organize tasks beyond the calendar view
- Track task status and execution
- Connect tasks with categories and projects
- Keep project-based and non-project work in one system

### Monthly Planning

- Create a higher-level monthly overview
- Connect long-term priorities with weekly execution
- Review progress without relying only on daily task lists

### Project Management

- Create and manage multiple projects
- Track planned and actual time by project
- Identify the projects receiving the most attention
- Compare project priorities with real time allocation

### Analytics

- Category-based time distribution
- Project-based time analysis
- Planned-versus-actual comparisons
- Visual charts for weekly and monthly reflection
- Identification of the largest time deviations

### AI Reviews

Lubi supports AI-generated daily and weekly reviews based on the user's own time records.

The AI can summarize:

- overall time allocation
- the largest differences between plans and execution
- possible reasons behind those differences
- practical adjustments for the next day or week

Users provide their own API key in the browser. Lubi supports OpenAI-compatible endpoints and configurable providers. Without an API key, the app can still generate a local rule-based review.

> API keys are stored only in the current browser and are sent directly to the selected AI provider. Do not save API keys on public or shared devices.

### Local Data and Export

- Data is stored locally in the browser
- No account is required
- Backup and restore supported
- Export records for further analysis

## Why Lubi?

Many productivity tools focus on what should be done. Lubi focuses equally on what actually happened.

It is designed for questions such as:

- Where did my time really go?
- Which plans do I repeatedly overestimate?
- Which projects receive less attention than I intended?
- When do interruptions or unplanned tasks usually appear?
- How can I adjust the next plan based on evidence rather than feeling?

The goal is not to create a perfect schedule. The goal is to build a more accurate understanding of one's own behavior over time.

## Tech Stack

- **React**
- **TypeScript**
- **Vite**
- **Recharts**
- **date-fns**
- **ExcelJS**
- **LocalStorage**
- **Vercel**

## Getting Started

### Prerequisites

Install a recent version of [Node.js](https://nodejs.org/).

### Installation

```bash
git clone https://github.com/sylvia-by-w/lubi.git
cd lubi
npm install
```

### Run locally

```bash
npm run dev
```

Open the local address shown in the terminal, usually:

```text
http://localhost:5173
```

### Build

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

## AI Configuration

Open:

```text
Settings → AI Review
```

Then choose a provider or use a custom OpenAI-compatible endpoint.

Example Gemini configuration:

```text
Base URL:
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions

Model:
gemini-3-flash-preview
```

Each user must enter their own API key. API keys must never be committed to this repository.

## Data and Privacy

Lubi is currently a client-side application.

- Task and configuration data are stored in the user's browser.
- Clearing browser storage may remove local data unless a backup has been exported.
- AI review data is sent directly from the browser to the provider selected by the user.
- The project does not include a shared public API key.
- Users should avoid sending highly sensitive information to third-party AI services.

## Roadmap

- [ ] Chinese and English interface switching
- [ ] Improved responsive design
- [ ] Natural-language task creation
- [ ] More configurable AI review styles
- [ ] Additional weekly and monthly insights
- [ ] Optional cross-device synchronization
- [ ] Improved accessibility and keyboard controls

## Project Status

Lubi is an actively developed personal project. The current version is primarily designed for individual use and local-first data management.

Feedback, suggestions, and issue reports are welcome.

## Author

Created by [Sylvia / Bingying Wu](https://github.com/sylvia-by-w).

---

# 中文介绍

## Lubi 是什么？

Lubi 是一个受到**柳比歇夫时间统计法**启发的个人时间管理与复盘系统。

它不只记录“我打算做什么”，也把“我实际上做了什么”放在同等重要的位置。通过对比计划时间与实际时间，用户可以逐渐发现自己的时间分配规律、计划偏差和真实的项目投入。

Lubi 希望解决的不是“怎样把每一分钟安排得完美”，而是：

> 怎样更准确地认识自己的时间究竟去了哪里，并让下一次计划建立在真实记录之上。

## 主要功能

### 时间日志

- 按周查看的时间网格
- 分别记录计划任务与实际任务
- 对比计划时间和实际执行时间
- 为任务设置分类与关联项目
- 记录价值等级和精力等级等附加信息
- 切换不同周次与日期范围

### 任务看板

- 集中管理不适合直接放进日历的任务
- 跟踪任务执行状态
- 同时支持项目任务与非项目任务
- 将任务与分类、项目连接起来

### 月度计划

- 从月度层面安排阶段性重点
- 将长期目标与每周执行联系起来
- 避免只依赖零散的每日待办事项

### 项目管理

- 创建和管理多个项目
- 统计各项目的计划与实际投入
- 查看当前投入时间最多的项目
- 判断现实投入是否符合原本的优先级

### 统计分析

- 分类时间分布
- 项目时间分布
- 计划与实际对比
- 周度和月度可视化
- 自动识别偏差最大的分类或项目

### AI 日报与周报

Lubi 可以根据用户的真实时间记录生成每日与每周 AI 回顾，包括：

- 整体时间分配
- 计划与实际之间的主要偏差
- 可能产生偏差的原因
- 下一天或下一周的具体调整建议

用户需要在自己的浏览器中填写 API Key。系统支持可配置的 OpenAI-compatible 接口；未填写 API Key 时，也可以使用本地规则生成基础回顾。

> API Key 仅保存在当前浏览器，并直接发送给用户选择的 AI 服务商。请勿在公共或共享设备上保存 API Key。

### 本地数据与导出

- 数据默认保存在浏览器本地
- 无需注册账号
- 支持备份与恢复
- 支持导出记录用于进一步分析

## 本地运行

```bash
git clone https://github.com/sylvia-by-w/lubi.git
cd lubi
npm install
npm run dev
```

## 后续计划

- [ ] 中英文界面自由切换
- [ ] 优化移动端与不同屏幕尺寸的适配
- [ ] 通过自然语言创建任务
- [ ] 支持更多 AI 回顾风格
- [ ] 增加更深入的周度与月度洞察
- [ ] 可选的跨设备同步
- [ ] 完善无障碍体验与键盘操作

## 项目说明

Lubi 目前是持续开发中的个人项目，现阶段以个人使用和本地优先的数据管理方式为主。
