import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

// Mock 数据用于本地预览
const MOCK_RESULT = {
  id: "demo",
  isPaid: false,
  diagnostics: {
    totalIssues: 23,
    keywordMatch: 62,
    problems: [
      {
        title: "Missing Keywords",
        description: "Your resume is missing 8 key skills required for this role",
        severity: "high",
        details: ["React", "AWS", "Docker", "Kubernetes", "TypeScript"],
      },
      {
        title: "Weak Quantification",
        description: "Only 1 metric found. Top candidates include 3–5 quantified achievements",
        severity: "medium",
        details: [],
      },
      {
        title: "Passive Language",
        description: "Weak verbs reduce your resume's impact on ATS and recruiters",
        severity: "medium",
        details: ["Responsible for", "Worked on", "Helped with"],
      },
    ],
  },
  previewExamples: {
    examples: [
      {
        original: "Built web applications using Python",
        improved:
          "Architected microservices platform handling 2M+ daily requests, reducing API latency 40% via AWS Lambda and Redis caching",
      },
      {
        original: "5 years of software development experience",
        improved:
          "Led full-stack development for 3 SaaS products serving 50K+ enterprise users, driving $2M ARR growth across fintech and healthcare sectors",
      },
    ],
  },
};

const MOCK_PAID_RESULT = {
  ...MOCK_RESULT,
  isPaid: true,
  fullSuggestions: {
    summary: {
      totalSuggestions: 23,
      estimatedImpact: "40% more interview callbacks",
    },
    categories: [
      {
        name: "Keyword Optimization",
        count: 8,
        items: [
          {
            original: "Built web applications using Python",
            rewrites: {
              professional:
                "Engineered React/Node.js applications serving 100K+ monthly users, reducing load time 35% through code splitting and CDN optimization",
              creative:
                "Crafted blazing-fast React applications that delighted 100K+ users monthly, slashing load times in half with smart caching strategies",
              conservative:
                "Developed React web applications (100K+ users, Node.js backend, 35% performance improvement via optimization)",
            },
            reason: "Added React/Node.js keywords and quantified user impact",
            impact: "high",
          },
          {
            original: "Worked on database optimization",
            rewrites: {
              professional:
                "Optimized PostgreSQL query performance by 60%, reducing p99 latency from 800ms to 320ms for 500K+ daily active users",
              creative:
                "Transformed sluggish database queries into lightning-fast responses — 60% faster, serving 500K+ users without breaking a sweat",
              conservative:
                "Improved PostgreSQL database performance by 60% (800ms → 320ms p99 latency, 500K+ DAU)",
            },
            reason: "Replaced passive 'worked on' with strong verb, added metrics",
            impact: "high",
          },
        ],
      },
      {
        name: "Quantified Achievements",
        count: 7,
        items: [
          {
            original: "Helped reduce system downtime",
            rewrites: {
              professional:
                "Reduced system downtime by 85% (from 4h/month to 36min) by implementing automated failover and proactive monitoring with PagerDuty",
              creative:
                "Virtually eliminated system downtime — from 4 painful hours per month down to just 36 minutes — through smart automation and monitoring",
              conservative:
                "Reduced system downtime 85% (4h → 36min/month) via automated failover implementation",
            },
            reason: "Added specific before/after metrics and named the solution",
            impact: "high",
          },
        ],
      },
      {
        name: "Action Verbs",
        count: 5,
        items: [
          {
            original: "Responsible for leading the team",
            rewrites: {
              professional:
                "Led cross-functional team of 8 engineers across 3 time zones, delivering 4 major product releases on schedule with zero critical bugs",
              creative:
                "Captained a global team of 8 engineers, shipping 4 major releases on time while keeping the bug count at zero",
              conservative:
                "Led team of 8 engineers, delivered 4 product releases on schedule",
            },
            reason: "Replaced 'Responsible for' with 'Led', added team size and outcomes",
            impact: "medium",
          },
        ],
      },
      {
        name: "Structure & Clarity",
        count: 3,
        items: [
          {
            original: "5 years of experience in software development",
            rewrites: {
              professional:
                "Senior Software Engineer with 5 years building scalable systems — specializing in React, Node.js, and AWS cloud architecture",
              creative:
                "5-year software engineering veteran who turns complex problems into elegant, scalable solutions using React, Node.js, and AWS",
              conservative:
                "Software Engineer (5 years) — React, Node.js, AWS | Scalable systems specialist",
            },
            reason: "Added specialization keywords and value proposition",
            impact: "medium",
          },
        ],
      },
    ],
  },
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  // 本地 mock 模式
  if (params.id === "demo") return NextResponse.json(MOCK_RESULT);
  if (params.id === "demo-paid") return NextResponse.json(MOCK_PAID_RESULT);

  // 生产环境：查本地 SQLite
  try {
    const db = getDB();
    const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(params.id) as any;

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!row.is_paid) {
      return NextResponse.json({
        id: row.id,
        diagnostics: JSON.parse(row.diagnostics),
        previewExamples: JSON.parse(row.preview_examples),
        isPaid: false,
      });
    }

    return NextResponse.json({
      id: row.id,
      diagnostics: JSON.parse(row.diagnostics),
      previewExamples: JSON.parse(row.preview_examples),
      fullSuggestions: JSON.parse(row.full_suggestions),
      isPaid: true,
    });
  } catch (e) {
    console.error("Result error:", e);
    return NextResponse.json({ error: "DB not available" }, { status: 500 });
  }
}
