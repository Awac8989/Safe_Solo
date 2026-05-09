const { readState } = require('../data/store');

function buildAchievements(user, guardiansCount, hasVault, hasMedical, notesCount) {
  return [
    {
      id: 'careful-person',
      title: 'Nguoi Can Than',
      description: 'Check-in deu dan trong 7 ngay',
      unlocked: Boolean(user.lastCheckInAt),
      progress: Math.min(user.graceHours >= 1 ? 70 : 0, 100),
    },
    {
      id: 'guardian-captain',
      title: 'Doi Truong Bao Ve',
      description: 'Ket noi voi it nhat 3 guardians',
      unlocked: guardiansCount >= 3,
      progress: Math.min(Math.round((guardiansCount / 3) * 100), 100),
    },
    {
      id: 'hundred-days',
      title: 'Kien Tri 100 Ngay',
      description: 'Duy tri nhat quan check-in',
      unlocked: false,
      progress: 12,
    },
    {
      id: 'medical-ready',
      title: 'Ho So San Sang',
      description: 'Hoan thien Medical ID va QR khan cap',
      unlocked: hasMedical,
      progress: hasMedical ? 100 : 30,
    },
    {
      id: 'vault-keeper',
      title: 'Nguoi Giu Ket',
      description: 'Da kich hoat Vault ma hoa',
      unlocked: hasVault,
      progress: hasVault ? 100 : 0,
    },
    {
      id: 'community-heart',
      title: 'Trai Tim Cong Dong',
      description: 'Nhan duoc loi cam on tu cong dong',
      unlocked: notesCount >= 1,
      progress: Math.min(notesCount * 40, 100),
    },
  ];
}

class AchievementService {
  async listAchievements(userId) {
    const state = readState();
    const user = state.users.find((item) => item.id === userId);
    if (!user) {
      throw new Error('User not found');
    }

    const guardiansCount = state.guardianRelationships.filter(
      (item) => item.requesterId === userId && item.status === 'ACCEPTED',
    ).length;
    const hasVault = state.vaults.some((item) => item.userId === userId && !item.shreddedAt);
    const hasMedical = state.medicalProfiles.some((item) => item.userId === userId);
    const notesCount = state.thankYouNotes.filter((item) => item.volunteerId === userId).length;

    return buildAchievements(user, guardiansCount, hasVault, hasMedical, notesCount);
  }
}

module.exports = new AchievementService();
