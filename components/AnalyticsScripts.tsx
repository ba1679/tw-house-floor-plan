import { GA_MEASUREMENT_ID, analyticsEnabledFor } from "@/lib/analytics/gtag";

const TEST_GA_MEASUREMENT_ID = "G-TEST12345";

export const shouldLoadGoogleTagManagerScript = (measurementId: string) =>
  analyticsEnabledFor(measurementId) && measurementId !== TEST_GA_MEASUREMENT_ID;

export function AnalyticsScripts() {
  if (!analyticsEnabledFor(GA_MEASUREMENT_ID)) return null;

  const bootstrap = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
});
gtag('consent', 'default', {
  analytics_storage: 'granted',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  region: ['TW']
});
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');
`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      {shouldLoadGoogleTagManagerScript(GA_MEASUREMENT_ID) && (
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
      )}
    </>
  );
}
