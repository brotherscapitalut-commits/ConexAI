export default class GrowthCampaignAgent {
  constructor() {
    this.agentName = "Growth-Autonomous-Drip-Agent";
  }

  log(message) {
    console.log('[' + new Date().toISOString() + '] [' + this.agentName + '] ' + message);
  }

  async startDripCampaign(leads) {
    this.log("Iniciando campanha automatizada de Claim para " + (leads ? leads.length : 0) + " leads.");
    return {
      status: 'CAMPAIGN_ACTIVE',
      sequence: 'Day 0 Sent -> 48h Follow-up Scheduled',
      totalEnrolled: leads ? leads.length : 0
    };
  }

  async processTrialLifecycle(leads) {
    const now = new Date();
    if (!leads) return [];
    
    return leads.map(lead => {
      if (lead.status !== 'ACTIVE_TRIAL') return lead;

      const claimDate = new Date(lead.claimedAt);
      const elapsedDays = Math.floor((now - claimDate) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 7 - elapsedDays);

      let actionState = 'MONITORING';
      let visualAlert = 'NORMAL';

      if (daysRemaining === 2 || daysRemaining === 1) {
        actionState = 'WARNING_SENT';
        visualAlert = 'AMBER_URGENT';
      } else if (daysRemaining === 0 && !lead.paymentMethodAttached) {
        actionState = 'ACCOUNT_DROPPED';
        visualAlert = 'RED_EXPIRED';
      } else if (lead.paymentMethodAttached) {
        actionState = 'SUBSCRIPTION_ACTIVE';
        visualAlert = 'GREEN_SECURE';
      }

      return {
        ...lead,
        daysRemaining,
        actionState,
        visualAlert,
        status: actionState === 'ACCOUNT_DROPPED' ? 'EXPIRED_RELEASED' : lead.status
      };
    });
  }
}