# AI_OUTPUT_RULE_FINAL

## 1. 核心原则

- 真实性 > 完整性
- 禁止编造
- 不为凑数生成建议
- 每条建议必须影响面试概率

---

## 2. 输出结构

### Free Tier

- quality_level
- top_issues（1–3）
- preview_examples（2）
- keyword_gap

---

### Paid Tier

- summary
- suggestions（动态数量）

---

## 3. 动态数量规则

- High：2–4
- Medium：3–6
- Low：5–10

禁止：

- 固定数量输出
- 重复建议

---

## 4. no_fabrication

禁止：

- 原文无数字 → 不允许新增
- JD未提及技能 → 不允许添加

允许：

- 重写表达
- 使用 JD关键词

---

## 5. 去重规则

重复定义：

- 同一问题
- 同一原句
- 语义相似 > 70%

---

## 6. Impact排序

- High（核心）
- Medium
- Low

输出必须按顺序排列

---

## 7. Top Issues规则

- 1–3条
- 必须有证据
- 必须解释影响

---

## 8. Preview规则

- 选最弱内容
- 改写必须明显提升

---

## 9. Summary模块

包含：

- core_problems（≤3）
- fix_strategy（≤3）

---

## 10. 中文支持

- 允许输入
- 输出英文
- 不允许报错

---

## 11. 验收

- 无重复
- 无编造
- 可执行
- 数量合理
