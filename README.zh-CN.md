# Finance Bro Type Indicator (FBTI)

基于670个金融调侃类视频内容分析的金融人刻板印象人格测试项目。

[English Version](./README.md)

## 项目背景

本项目源自对670个金融调侃类视频的内容分析，提取了：
- 12个独立金融维度（认知/行为/社交）
- 16种金融刻板印象人格
- 1种彩蛋人格

将这些分析结果转化为可交互的人格测试工具。

## 技术栈

- Vite + 原生 JavaScript
- 无框架依赖，轻量级实现
- Canvas 绘制雷达图和分享海报

## 项目结构

```
finance-bro-type-indicator/
├── data/
│   ├── config.json          # 配置文件
│   ├── dimensions.json      # 12维度定义（认知/行为/社交）
│   ├── questions.json       # 19道主测试题 + 1道彩蛋
│   ├── types.json           # 16种人格类型 + 彩蛋
│   └── interpretations/     # 维度解读
├── src/
│   ├── main.js             # 入口
│   ├── engine.js           # 评分引擎
│   ├── quiz.js             # 答题逻辑
│   ├── result.js           # 结果渲染
│   ├── chart.js            # 雷达图
│   ├── poster.js           # 分享海报生成
│   ├── utils.js            # 工具函数
│   └── style.css           # 样式
└── index.html              # 入口页面
```

## 人格类型列表

### 标准类型 (16种)

| 代号 | 人格 | 副标题 |
|------|------|--------|
| POSER | 金融精英表演者 | 陆家嘴行走的PPT |
| SNOOP | 草根解构师 | 金融圈卧底记者 |
| CRAM | 证书收割机 | 考证界永动机 |
| NEPOT | 关系户收割者 | 资源变现大师 |
| TOXIC | 面试PUA大师 | 压力测试艺术家 |
| GRINDER | 加班战神 | 不眠不休永动机 |
| QUANT | 金融思维入侵者 | 万物皆可估值 |
| BEAN | 财务背锅侠 | 提篮桥预备役 |
| BUTTERFLY | 社交收割机 | 人脉资源兑换商 |
| HOPPER | 跳槽套利者 | 简历迭代专家 |
| FLEX | 炫富表演艺术家 | 朋友圈富豪 |
| SLACKER | 躺平哲学家 | 国企养老专业户 |
| FOMO | 焦虑加速器 | FOMO综合症患者 |
| PUFFER | 简历整容师 | 百万调研制造机 |
| ROO | 海归水学历代言人 | QS前50守门员 |
| SNEAK | 职场老六 | 潜规则猎人 |

### 特殊类型 (彩蛋)

| 代号 | 人格 | 副标题 |
|------|------|--------|
| CHOSEN | 天选关系户 | 金融宇宙终极赢家 |
| NPC | 金融路人甲 | 无法归类的隐藏变量 |

## 运行项目

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 数据来源

- 原始视频数据：670个金融调侃类视频

## 致谢

- 原始项目：https://github.com/niuniu-869/fiti
- SBTI项目：https://github.com/pingfanfan/SBTI

## 许可证

MIT