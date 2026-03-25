import OpenAI from "openai";

const ai = new OpenAI({
  apiKey: "sk-TQvGvxzcLqw6nwurBjFfycgGO5LMPschOfhplMj03DmSjxf4",
  baseURL: "https://breakout.wenwen-ai.com",
});

const resume = `
Software Engineer with 5 years of experience.
Responsible for building web applications.
Worked on backend systems using Python.
Helped with database optimization.
`;

const jd = `
We are looking for a Senior Software Engineer with:
- 5+ years experience in Python and React
- Experience with AWS, Docker, Kubernetes
- Strong background in microservices architecture
- Track record of improving system performance
`;

async function test() {
  console.log("🔍 Testing 问问 API...\n");

  try {
    const res = await ai.chat.completions.create({
      model: "claude-sonnet-4-5",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `You are an ATS resume coach. Analyze this resume and return JSON with 3 problems found.

Resume: ${resume}
Job Description: ${jd}

Return JSON: { "totalIssues": 23, "keywordMatch": 65, "problems": [{ "title": "...", "description": "...", "severity": "high" }] }`,
        },
      ],
    });

    console.log("Raw response:", JSON.stringify(res, null, 2));
    const result = JSON.parse(res.choices[0].message.content);
    console.log("✅ API 调用成功！\n");
    console.log("Keyword Match:", result.keywordMatch + "%");
    console.log("Total Issues:", result.totalIssues);
    console.log("\nProblems found:");
    result.problems.forEach((p, i) => {
      console.log(`  ${i + 1}. [${p.severity}] ${p.title}: ${p.description}`);
    });
  } catch (err) {
    console.error("❌ API 调用失败:", err.message);
  }
}

test();
