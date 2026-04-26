const DEFAULT_AFFILIATE_CAREER_TIERS = [
  { level: 1, name: 'Iniciante', activeLeads: 0, commissionCents: 0, reward: 'Comece validando seus primeiros indicados ativos.' },
  { level: 2, name: 'Bronze', activeLeads: 3, commissionCents: 35000, reward: 'Meta inicial: 3 ativos e R$ 350,00 em comissoes pagas.' },
  { level: 3, name: 'Prata', activeLeads: 10, commissionCents: 150000, reward: 'Construa recorrencia com 10 ativos e R$ 1.500,00 pagos.' },
  { level: 4, name: 'Ouro', activeLeads: 25, commissionCents: 500000, reward: 'Escala forte: 25 ativos e R$ 5.000,00 pagos.' },
  { level: 5, name: 'Diamante', activeLeads: 50, commissionCents: 1500000, reward: 'Topo do plano: 50 ativos e R$ 15.000,00 pagos.' }
];

function normalizeAffiliateCareerTiers(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch (_) { data = null; }
  }
  if (!Array.isArray(data)) return DEFAULT_AFFILIATE_CAREER_TIERS.slice();

  const tiers = data
    .map((tier, idx) => {
      const level = Math.max(1, parseInt(tier.level || idx + 1, 10) || idx + 1);
      const name = String(tier.name || `Nivel ${level}`).trim().slice(0, 40);
      const activeLeads = Math.max(0, parseInt(tier.activeLeads ?? tier.active_leads ?? 0, 10) || 0);
      const commissionCents = Math.max(0, parseInt(tier.commissionCents ?? tier.commission_cents ?? 0, 10) || 0);
      const reward = String(tier.reward || '').trim().slice(0, 180);
      return { level, name, activeLeads, commissionCents, reward };
    })
    .filter(tier => tier.name)
    .sort((a, b) => a.level - b.level)
    .slice(0, 8);

  if (!tiers.length) return DEFAULT_AFFILIATE_CAREER_TIERS.slice();
  tiers[0].activeLeads = Math.min(tiers[0].activeLeads, 0);
  tiers[0].commissionCents = Math.min(tiers[0].commissionCents, 0);
  return tiers;
}

module.exports = {
  DEFAULT_AFFILIATE_CAREER_TIERS,
  normalizeAffiliateCareerTiers
};