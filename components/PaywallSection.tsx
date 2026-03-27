"use client";

import { useRouter } from "next/navigation";

export function PaywallSection({
  submissionId,
  riskLevel = "high",
}: {
  submissionId: string;
  riskLevel?: "low" | "moderate" | "high";
}) {
  const router = useRouter();
  const paypalEmail = process.env.NEXT_PUBLIC_PAYPAL_EMAIL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const TEST_MODE = process.env.NEXT_PUBLIC_ENABLE_TEST_UNLOCK === "true";

  const tierConfig = {
    low: {
      badge: null,
      icon: "📈",
      title: "Maximize your interview chances",
      subtitle: "You're scoring well — get personalized suggestions to push even further",
      urgency: null,
      cta: "Get Optimization Report — $4.99",
    },
    moderate: {
      badge: "⚠️ YOUR SCORE HAS ROOM TO IMPROVE",
      icon: "🔒",
      title: "Unlock your full optimization report",
      subtitle: "Get targeted rewrites to fix the gaps and boost your ATS score",
      urgency: "⏰ Every missed keyword is a missed interview. Fix it before your next application.",
      cta: "Get More Interviews — $4.99",
    },
    high: {
      badge: "⚠️ YOUR RESUME IS LIKELY BEING AUTO-REJECTED RIGHT NOW",
      icon: "🔒",
      title: "Fix critical issues in your resume",
      subtitle: "Get line-by-line rewrites to stop ATS rejection and reach human recruiters",
      urgency: "⏰ Every day you wait is another application rejected. Fix it now.",
      cta: "Fix Critical Issues — $4.99",
    },
  };

  const tier = tierConfig[riskLevel];

  return (
    <div className="mt-8 rounded-2xl border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-white p-8 text-center shadow-sm">
      {tier.badge && (
        <div className="mb-3 text-sm font-semibold text-red-500 uppercase tracking-wide">
          {tier.badge}
        </div>
      )}
      <div className="mb-4 text-4xl">{tier.icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        {tier.title}
      </h3>
      <p className="text-gray-500 text-sm mb-6">
        {tier.subtitle}
      </p>

      <ul className="text-left text-sm text-gray-600 mb-6 space-y-2 inline-block">
        <li>✅ Specific rewrites based on your actual resume text</li>
        <li>✅ Keyword injection plan matched to the job description</li>
        <li>✅ ATS-optimized bullet structure with action + result</li>
        <li>✅ Instant email delivery</li>
        <li>✅ Lifetime access to your report</li>
      </ul>

      {tier.urgency && (
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium">
          {tier.urgency}
        </div>
      )}

      <form
        action="https://www.paypal.com/cgi-bin/webscr"
        method="post"
        onSubmit={(e) => {
          if (TEST_MODE) {
            e.preventDefault();
            router.push(`/success/${submissionId}?test=1`);
          }
        }}
      >
        <input type="hidden" name="cmd" value="_xclick" />
        <input type="hidden" name="business" value={paypalEmail} />
        <input type="hidden" name="item_name" value="ATS Resume Optimization Report" />
        <input type="hidden" name="amount" value="4.99" />
        <input type="hidden" name="currency_code" value="USD" />
        <input type="hidden" name="custom" value={submissionId} />
        <input type="hidden" name="return" value={`${siteUrl}/success/${submissionId}`} />
        <input type="hidden" name="cancel_return" value={`${siteUrl}/result/${submissionId}`} />
        <input type="hidden" name="notify_url" value={`${siteUrl}/api/ipn`} />
        <input type="hidden" name="no_shipping" value="1" />

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-600 px-8 py-4 text-lg font-bold text-white
                     hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md"
        >
          {tier.cta}
        </button>
      </form>

      <p className="mt-4 text-xs text-gray-400">
        🔒 Secure payment via PayPal · One-time fee · No subscription
      </p>
    </div>
  );
}
