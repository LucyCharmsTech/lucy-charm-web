import { BROKERAGE } from '@/content/siteContent';
import { siteUrl } from '@/lib/siteUrl';

/**
 * schema.org structured data for the brokerage — the business information
 * search engines read. Built from the client-approved BROKERAGE details.
 * Telephone and opening hours are omitted until confirmed.
 */
export function BrokerageStructuredData() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: BROKERAGE.publicName,
    legalName: BROKERAGE.legalName,
    email: BROKERAGE.email,
    url: siteUrl(),
    address: BROKERAGE.offices.map((office) => ({
      '@type': 'PostalAddress',
      streetAddress: office.streetAddress,
      addressLocality: office.locality,
      addressRegion: office.region,
      postalCode: office.postalCode,
      addressCountry: office.country,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
