import { Resend } from "resend";

// 懒加载，避免 build 时因缺少 API key 报错
let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export async function sendResultEmail(email: string, submissionId: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const resultUrl = `${siteUrl}/success/${submissionId}`;

  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: "Your resume optimization report is ready! 🎉",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fff">
        <h2 style="color:#1d4ed8;margin-bottom:8px">Your report is ready! 🎉</h2>
        <p style="color:#374151;margin-bottom:16px">
          We've generated <strong>23+ personalized rewrite suggestions</strong> for your resume,
          tailored to your target job.
        </p>
        <p style="color:#6b7280;margin-bottom:8px">Here's what's included:</p>
        <ul style="color:#374151;line-height:2;margin-bottom:32px;padding-left:20px">
          <li>✓ Keyword optimization (matched to job requirements)</li>
          <li>✓ Quantified achievements (added metrics & numbers)</li>
          <li>✓ Stronger action verbs</li>
          <li>✓ 3 rewrite versions per suggestion</li>
        </ul>
        <p style="text-align:center;margin-bottom:32px">
          <a href="${resultUrl}"
             style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;
                    text-decoration:none;font-weight:600;font-size:16px;display:inline-block">
            View Full Report →
          </a>
        </p>
        <p style="color:#9ca3af;font-size:13px;text-align:center">
          Bookmark this link — you can access your report anytime.<br>
          Questions? Reply to this email.
        </p>
      </div>
    `,
  });
}
