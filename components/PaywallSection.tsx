"use client";

export function PaywallSection({
  submissionId,
  remainingCount = 21,
}: {
  submissionId: string;
  remainingCount?: number;
}) {
  const paypalEmail = process.env.NEXT_PUBLIC_PAYPAL_EMAIL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  return (
    <div className="mt-8 rounded-2xl border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-white p-8 text-center shadow-sm">
      <div className="mb-3 text-sm font-semibold text-red-500 uppercase tracking-wide">
        ⚠️ Your resume is likely being auto-rejected right now.
      </div>
      <div className="mb-4 text-4xl">🔒</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        {remainingCount} more issues to fix
      </h3>
      <p className="text-gray-500 text-sm mb-6">
        Unlock your complete resume optimization report
      </p>

      <ul className="text-left text-sm text-gray-600 mb-6 space-y-2 inline-block">
        <li>✅ 23+ line-by-line rewrite suggestions</li>
        <li>✅ 3 style versions per suggestion (Professional / Creative / Conservative)</li>
        <li>✅ Keyword injection plan</li>
        <li>✅ Instant email delivery</li>
        <li>✅ Lifetime access to your report</li>
      </ul>

      <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium">
        ⏰ Every day you wait is another application rejected. Fix it now before your next submission.
      </div>

      {/* PayPal Buy Now 表单 — custom 字段传递 submissionId，IPN 用它关联记录 */}
      <form action="https://www.paypal.com/cgi-bin/webscr" method="post">
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
          Fix All {remainingCount} Issues & Improve Your ATS Score — $4.99
        </button>
      </form>

      <p className="mt-4 text-xs text-gray-400">
        🔒 Secure payment via PayPal · One-time fee · No subscription
      </p>
    </div>
  );
}
