/**
 * Frontend metadata for planned AgriRent SOA microservices not yet implemented.
 * Strictly performs NO HTTP calls to nonexistent backends.
 */
export const placeholderServices = [
  {
    id: 'payments',
    aliases: ['payment', 'payments'],
    title: 'Payment & Escrow Service',
    status: 'Coming Soon',
    badge: 'Under Design',
    description:
      'Online payment gateway integration with escrow holding, safe UPI/card checkouts, automated deposit holds, and split settlements.',
    features: [
      'Automated rental payment capture on owner approval',
      'Security deposit hold and release logic',
      'Idempotent refunds for eligible cancellations',
    ],
  },
  {
    id: 'security-deposit',
    aliases: ['security-deposit', 'deposit'],
    title: 'Security Deposit Management Service',
    status: 'Coming Soon',
    badge: 'Under Design',
    description:
      'Dedicated escrow vault holding refundable security deposits safely during the duration of active machinery rentals.',
    features: [
      'Automated deposit release upon clean equipment return',
      'Partial deductions for approved damage claims',
      'Transparent escrow transaction receipts',
    ],
  },
  {
    id: 'handover',
    aliases: ['handover', 'return-pin'],
    title: 'Handover & Return PIN Service',
    status: 'Planned',
    badge: 'In Roadmap',
    description:
      'Cryptographically generated single-use time-limited PINs for equipment physical handover and return inspection verification.',
    features: [
      'Single-use pickup PIN exchange upon physical inspection',
      'Machine return verification PIN',
      'Automated late-fine calculation for overdue equipment',
    ],
  },
  {
    id: 'claims',
    aliases: ['claims', 'damage-claims'],
    title: 'Damage Claims & Protection Service',
    status: 'Planned',
    badge: 'In Roadmap',
    description:
      'Formal damage evidence filing, photographic proofs, dispute triage, and security deposit deduction settlements.',
    features: [
      'Submit damage reports with geo-tagged photos',
      'Third-party agricultural adjuster triage',
      'Deposit deduction resolution workflows',
    ],
  },
  {
    id: 'disputes',
    aliases: ['disputes', 'dispute-resolution'],
    title: 'Dispute Resolution Service',
    status: 'Planned',
    badge: 'In Roadmap',
    description:
      'Neutral arbitration process for resolving conflicts between equipment owners and renters regarding equipment condition or schedule mismatches.',
    features: [
      'Structured mediation for disputed returns or cancellations',
      'Arbitration officer review portal',
      'Auditable resolution audit logs',
    ],
  },
  {
    id: 'reviews',
    aliases: ['reviews', 'ratings'],
    title: 'Reviews & Farmer Ratings Service',
    status: 'Planned',
    badge: 'In Roadmap',
    description:
      'Two-sided peer reviews evaluating equipment working condition, tractor maintenance, and renter punctuality.',
    features: [
      'Verified rental completion rating gates',
      'Equipment performance and reliability scores',
      'Community trust badges for equipment owners',
    ],
  },
  {
    id: 'notifications',
    aliases: ['notifications', 'sms'],
    title: 'SMS & WhatsApp Notification Service',
    status: 'Planned',
    badge: 'In Roadmap',
    description:
      'Real-time notifications keeping farmers updated on pending booking requests, 24-hour expiry reminders, and approval status.',
    features: [
      'Urgent SMS alerts for owner request approvals',
      'WhatsApp delivery for booking vouchers and pickup addresses',
      'Automated reminders 2 hours before 24-hour request expiry',
    ],
  },
  {
    id: 'analytics',
    aliases: ['analytics', 'admin-analytics'],
    title: 'Admin Market Analytics Service',
    status: 'Planned',
    badge: 'In Roadmap',
    description:
      'Platform-wide metrics on machinery demand, regional agricultural machinery utilization rates, seasonal peak pricing, and rental completion velocity.',
    features: [
      'State-wise tractor and harvester utilization heatmaps',
      'Seasonal demand forecasting algorithms',
      'Real-time platform transaction volume monitoring',
    ],
  },
];

export const placeholderService = {
  getAll() {
    return placeholderServices;
  },

  getPlaceholder(id) {
    if (!id) {
      return placeholderServices[0];
    }
    const cleanId = id.toLowerCase().trim();
    const found = placeholderServices.find(
      (s) => s.id === cleanId || (s.aliases && s.aliases.includes(cleanId))
    );
    return (
      found || {
        id: cleanId,
        title: `${cleanId.charAt(0).toUpperCase() + cleanId.slice(1)} Service`,
        status: 'Planned',
        badge: 'In Roadmap',
        description: `The ${cleanId} microservice is currently scheduled for future release in the AgriRent architecture roadmap.`,
        features: ['Planned microservice integration', 'Dedicated independent REST API'],
      }
    );
  },
};
