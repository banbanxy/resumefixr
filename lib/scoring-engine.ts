// 生产级 ATS 评分引擎 v2 - 加入词形归一和业务级同义词

interface KeywordEntry {
  key: string;
  synonyms: string[];
  weight: number;
  category: 'core' | 'tool' | 'business';
}

interface ScoringResult {
  totalScore: number;
  breakdown: {
    skillMatch: { score: number; weight: 0.4; details: any };
    keywordCoverage: { score: number; weight: 0.25; details: any };
    experienceRelevance: { score: number; weight: 0.2; details: any };
    expressionQuality: { score: number; weight: 0.15; details: any };
  };
  keywordGap: {
    required: string[];
    found: string[];
    missing: string[];
    partial: string[];
  };
  riskLevel: 'low' | 'moderate' | 'high';
}

// 简单词形归一（lemmatization）
function lemmatize(word: string): string {
  const rules: [RegExp, string][] = [
    [/ing$/, ''],
    [/ed$/, ''],
    [/s$/, ''],
  ];
  
  let result = word.toLowerCase();
  for (const [pattern, replacement] of rules) {
    const lemma = result.replace(pattern, replacement);
    if (lemma.length >= 3) result = lemma;
  }
  return result;
}

function normalizeText(text: string): string {
  return text.toLowerCase()
    .split(/\s+/)
    .map(w => lemmatize(w))
    .join(' ');
}

// 核心技能（权重 1.0）
const CORE_SKILLS: KeywordEntry[] = [
  { key: "sql", synonyms: ["mysql", "postgresql", "database", "query"], weight: 1.0, category: 'core' },
  { key: "python", synonyms: ["pandas", "numpy", "py"], weight: 1.0, category: 'core' },
  { key: "data analysis", synonyms: ["analyze", "analytics", "analytical"], weight: 1.0, category: 'core' },
];

// 工具/技术（权重 0.7）
const TOOLS: KeywordEntry[] = [
  { key: "power bi", synonyms: ["powerbi", "bi tool"], weight: 0.7, category: 'tool' },
  { key: "tableau", synonyms: ["visualization"], weight: 0.7, category: 'tool' },
  { key: "excel", synonyms: ["spreadsheet"], weight: 0.7, category: 'tool' },
];

// 业务关键词（权重 0.4）- 加强同义词
const BUSINESS: KeywordEntry[] = [
  { key: "dashboard", synonyms: ["report", "reporting", "visualization"], weight: 0.4, category: 'business' },
  { key: "reports", synonyms: ["dashboard", "reporting"], weight: 0.4, category: 'business' },
  { key: "business data", synonyms: ["dataset", "data source"], weight: 0.4, category: 'business' },
  { key: "analytical thinking", synonyms: ["analytical skill", "analysis"], weight: 0.4, category: 'business' },
];

const KEYWORD_DB = [...CORE_SKILLS, ...TOOLS, ...BUSINESS];

function matchKeyword(kw: KeywordEntry, text: string): { matched: boolean; score: number; matchType: 'exact' | 'synonym' | 'none' } {
  const normalizedText = normalizeText(text);
  const normalizedKey = normalizeText(kw.key);
  
  if (normalizedText.includes(normalizedKey)) {
    return { matched: true, score: kw.weight, matchType: 'exact' };
  }
  
  for (const syn of kw.synonyms) {
    if (normalizedText.includes(normalizeText(syn))) {
      return { matched: true, score: kw.weight * 0.85, matchType: 'synonym' };
    }
  }
  
  return { matched: false, score: 0, matchType: 'none' };
}

function extractRelevantKeywords(jd: string): KeywordEntry[] {
  const normalizedJD = normalizeText(jd);
  const relevant = KEYWORD_DB.filter(kw => {
    const match = matchKeyword(kw, normalizedJD);
    return match.matched;
  });
  return relevant.length > 0 ? relevant : CORE_SKILLS.slice(0, 3);
}

export function calculateScore(resume: string, jd: string): ScoringResult {
  const relevantKeywords = extractRelevantKeywords(jd);
  
  let totalWeight = 0;
  let matchedWeight = 0;
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const partialSkills: string[] = [];
  
  for (const kw of relevantKeywords) {
    totalWeight += kw.weight;
    const match = matchKeyword(kw, resume);
    
    if (match.matched) {
      matchedWeight += match.score;
      if (match.matchType === 'exact') {
        matchedSkills.push(kw.key);
      } else {
        partialSkills.push(kw.key);
      }
    } else {
      missingSkills.push(kw.key);
    }
  }
  
  const skillMatchScore = totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 0;
  const keywordCoverageScore = relevantKeywords.length > 0
    ? ((matchedSkills.length + partialSkills.length) / relevantKeywords.length) * 100
    : 0;
  
  const hasRelevantTitle = /analyst|engineer|developer|scientist|manager/i.test(resume);
  const hasYearsExp = /\d+\s*(?:years?|yrs?)/i.test(resume);
  const experienceScore = (hasRelevantTitle ? 50 : 0) + (hasYearsExp ? 50 : 0);
  
  const hasNumbers = /\d+%|\d+k|\d+\+|\d+x/i.test(resume);
  const hasStrongVerbs = /(built|developed|led|managed|improved|increased|reduced|created|designed)/i.test(resume);
  const hasBulletPoints = resume.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•')).length > 2;
  const expressionScore = (hasNumbers ? 40 : 0) + (hasStrongVerbs ? 40 : 0) + (hasBulletPoints ? 20 : 0);
  
  const totalScore = Math.round(
    skillMatchScore * 0.4 +
    keywordCoverageScore * 0.25 +
    experienceScore * 0.2 +
    expressionScore * 0.15
  );
  
  // Risk level 基于分数
  let riskLevel: 'low' | 'moderate' | 'high';
  if (totalScore >= 75) riskLevel = 'low';
  else if (totalScore >= 50) riskLevel = 'moderate';
  else riskLevel = 'high';
  
  return {
    totalScore,
    breakdown: {
      skillMatch: {
        score: Math.round(skillMatchScore),
        weight: 0.4,
        details: { totalWeight, matchedWeight, matchedSkills, partialSkills },
      },
      keywordCoverage: {
        score: Math.round(keywordCoverageScore),
        weight: 0.25,
        details: { total: relevantKeywords.length, found: matchedSkills.length + partialSkills.length },
      },
      experienceRelevance: {
        score: Math.round(experienceScore),
        weight: 0.2,
        details: { hasRelevantTitle, hasYearsExp },
      },
      expressionQuality: {
        score: Math.round(expressionScore),
        weight: 0.15,
        details: { hasNumbers, hasStrongVerbs, hasBulletPoints },
      },
    },
    keywordGap: {
      required: relevantKeywords.map(kw => kw.key),
      found: matchedSkills,
      missing: missingSkills,
      partial: partialSkills,
    },
    riskLevel,
  };
}
