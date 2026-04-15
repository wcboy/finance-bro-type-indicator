# Finance Bro Type Indicator (FBTI)

A personality test based on stereotypes in the finance industry, developed from content analysis of 670 finance-related satire videos.

[中文版](./README.zh-CN.md)

## Background

This project is derived from content analysis of 670 finance satire videos, extracting:
- 12 independent finance dimensions (Cognitive/Behavioral/Social)
- 16 personality stereotypes
- 1 easter egg personality

Transformed into an interactive personality assessment tool.

## Tech Stack

- Vite + Vanilla JavaScript
- No framework dependencies, lightweight implementation
- Canvas-based radar chart and poster generation

## Project Structure

```
finance-bro-type-indicator/
├── data/
│   ├── config.json          # Configuration
│   ├── dimensions.json      # 12 dimensions (Cognitive/Behavioral/Social)
│   ├── questions.json       # 19 main questions + 1 easter egg
│   ├── types.json           # 16 personality types + Easter eggs
│   └── interpretations/     # Dimension interpretations
├── src/
│   ├── main.js             # Entry point
│   ├── engine.js           # Scoring engine
│   ├── quiz.js             # Quiz logic
│   ├── result.js           # Result rendering
│   ├── chart.js            # Radar chart
│   ├── poster.js           # Share poster generator
│   ├── utils.js            # Utilities
│   └── style.css           # Styles
└── index.html              # Entry page
```

## Personality Types

### Standard Types (16)

| Code | Personality | Subtitle |
|------|-------------|----------|
| POSER | Elite Performer | Walking PPT of Lujiazui |
| SNOOP | Grassroots Deconstructor | Undercover journalist in finance |
| CRAM | Certificate Collector | Perpetual motion machine of exams |
| NEPOT | Nepotism Harvester | Master of resource monetization |
| TOXIC | Interview PUA Master | Artist of stress testing |
| GRINDER | Workaholic Warrior | Sleepless perpetual machine |
| QUANT | Finance Mind Invader | Everything is quantifiable |
| BEAN | Accounting Scapegoat | Reserve inmate of Tilanqiao Prison |
| BUTTERFLY | Social Network Harvester | Coffee chat professional |
| HOPPER | Job-Hopping Arbitrageur | Resume iteration expert |
| FLEX | Wealth Flex Artist | Millionaire on social media |
| SLACKER | Chill Philosopher | SOE retirement specialist |
| FOMO | Anxiety Accelerator | FOMO syndrome patient |
| PUFFER | Resume Plastic Surgeon | Maker of million-user surveys |
| ROO | Overseas Degree Defender | QS Top 50 gatekeeper |
| SNEAK | Corporate Lurker | Hunter of unwritten rules |

### Special Types (Easter Eggs)

| Code | Personality | Subtitle |
|------|-------------|----------|
| CHOSEN | Chosen Nepotist | Ultimate winner of finance universe |
| NPC | Finance NPC | Unclassifiable hidden variable |

## Getting Started

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build
```

## Data Source

- Original video data: 670 finance satire videos

## Acknowledgments

- Original project: https://github.com/niuniu-869/fiti
- SBTI project: https://github.com/pingfanfan/SBTI

## License

MIT