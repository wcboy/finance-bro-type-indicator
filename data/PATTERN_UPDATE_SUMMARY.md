# Pattern 更新汇总

## 更新日期
2026-04-15

## 更新内容

已完成所有人格类型的 pattern 字段更新，适配新的12维度系统。

## 新维度顺序
```
1. STRATEGY    - 策略思维
2. LEARN       - 学习力
3. CYNICISM    - 圈层洞察
4. RISK        - 风险偏好
5. DECISION    - 决策风格
6. EXECUTE     - 执行模式
7. PATIENCE    - 耐心程度
8. SURVIVAL    - 职场生存
9. SOCIAL      - 社交能量
10. CONFLICT   - 冲突风格
11. BOUNDARY   - 边界意识
12. NETWORK    - 人脉经营
```

## 更新统计

- 标准类型：16种（已更新）
- 特殊类型：3种（已新增 pattern 字段）
- 总计：19种人格类型

## Pattern 汇总表

| Code | Pattern | 核心特征 |
|------|---------|---------|
| POSER | M-M-L-M-H-H-L-M-H-M-L-H | 精英表演者，社交达人，人脉大师 |
| SNOOP | M-M-H-M-L-L-M-H-L-H-H-L | 解构师，看透本质，独行侠 |
| CRAM | H-H-M-M-H-H-H-M-L-M-L-L | 考证专家，方法论强，延迟满足 |
| NEPOT | L-L-M-M-M-H-H-H-H-M-L-H | 关系户，资源变现，人脉大师 |
| TOXIC | H-M-M-H-H-M-M-M-H-H-M-M | PUA大师，高压施策，社交达人 |
| GRINDER | M-M-M-M-M-H-M-M-L-M-L-L | 加班战神，执行机器，独行侠 |
| QUANT | H-H-H-H-H-M-M-L-L-M-L-L | 金融思维，模型化一切，独行侠 |
| BEAN | M-M-L-L-M-M-M-L-L-M-L-L | 财务背锅，风险保守，天真羔羊 |
| BUTTERFLY | L-M-L-M-M-M-H-H-H-H-M-H | 社交收割机，人脉大师，生存大师 |
| HOPPER | M-M-H-M-H-M-M-H-M-M-M-L | 跳槽套利，生存智慧，及时止损 |
| FLEX | L-M-L-H-M-M-H-H-M-M-L-M | 炫富表演，社交达人，生存大师 |
| SLACKER | L-M-M-M-L-L-M-M-L-M-H-H | 躺平哲学，护城河强，人脉大师 |
| FOMO | H-H-M-M-H-H-M-L-L-M-L-M | 焦虑驱动，学习力强，执行机器 |
| PUFFER | M-M-L-M-H-M-M-M-M-M-L-M | 简历整容，包装专家，网络者 |
| ROO | L-L-M-M-M-M-M-H-M-M-L-M | 海归代言，生存适应，校友网络 |
| SNEAK | M-M-H-M-M-M-M-H-M-M-M-L | 职场老六，生存大师，独行侠 |
| NPC | M-M-M-M-M-M-M-M-M-M-M-M | 无法归类，所有维度中等 |
| CHOSEN | L-L-M-L-M-M-M-H-M-M-H-H | 天选关系户，资源保护，人脉大师 |
| UNCERT | M-H-H-M-L-H-M-M-L-M-L-L | 证书无效论，方法论强，独行侠 |

## 关键设计原则

1. **维度匹配**：pattern 严格按照新维度顺序排列
2. **人格一致性**：每个维度值都符合人格类型描述
3. **可被选出**：确保 pattern 可通过答题选出
4. **差异化**：每个人格类型的 pattern 有明显差异
5. **真实性**：pattern 符合真实职场人群特征

## 典型对比案例

### CRAM vs QUANT
- **相同点**：STRATEGY-H, LEARN-H（策略思维和学习力都强）
- **不同点**：
  - CRAM: NETWORK-L（证书是个人战斗）
  - QUANT: CYNICISM-H（模型化一切，解构情感）

### NEPOT vs BUTTERFLY
- **相同点**：NETWORK-H（人脉大师）
- **不同点**：
  - NEPOT: STRATEGY-L（靠资源而非策略）
  - BUTTERFLY: SOCIAL-H（主动经营社交）

### GRINDER vs SLACKER
- **对比点**：
  - GRINDER: EXECUTE-H（执行机器）
  - SLACKER: EXECUTE-L（死线战士）
  - GRINDER: BOUNDARY-L（工作侵占生活）
  - SLACKER: BOUNDARY-H（下班是底线）

## 文件位置

- 主文件：`/Volumes/LamarHD/FITI/fiti-stereotype/data/types.json`
- 设计文档：`/Volumes/LamarHD/FITI/fiti-stereotype/data/pattern_redesign.json`
- 维度定义：`/Volumes/LamarHD/FITI/fiti-stereotype/data/dimensions.json`

## 验证建议

建议检查以下内容：
1. 所有人格类型的 pattern 是否符合描述
2. 是否存在两个完全相同的 pattern
3. pattern 是否能够通过答题选出
4. 特殊类型的 pattern 是否合理

## 下一步

1. 测试答题系统能否正确选出这些 pattern
2. 检查是否有其他文件依赖旧的维度顺序
3. 更新相关文档和测试用例
