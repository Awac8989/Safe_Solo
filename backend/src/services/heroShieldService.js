const crypto = require('crypto');
const HeroInsurancePolicy = require('../models/HeroInsurancePolicy');

class HeroShieldService {
  /**
   * Tự động kích hoạt hợp đồng bảo hiểm vi mô Good Samaritan khi Hiệp sĩ nhận ca
   */
  async issuePolicyOnDispatch(incidentId, volunteerId) {
    const policyNumber = `POL-HERO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date();
    const effectiveTo = new Date(now.getTime() + 4 * 3600 * 1000); // Có hiệu lực trong 4 giờ cứu hộ

    const policy = await HeroInsurancePolicy.create({
      incidentId,
      volunteerId,
      policyNumber,
      effectiveFrom: now,
      effectiveTo,
      coverageDetails: {
        postExposureProphylaxisPEP: true,
        accidentalInjuryMaxLimitVND: 20000000,
        vehicleDamageMaxLimitVND: 5000000,
      },
    });

    return policy;
  }

  /**
   * Tự động phân tích thao tác sơ cứu trong SBAR và cấp Voucher bù đắp vật tư y tế
   */
  async issueConsumableRestockVoucher(incidentId, volunteerId, firstAidActions = []) {
    let policy = await HeroInsurancePolicy.findOne({ incidentId, volunteerId });
    if (!policy) {
      policy = await this.issuePolicyOnDispatch(incidentId, volunteerId);
    }

    const itemsToRestock = [];

    // Luôn cấp bù 2 đôi găng tay vô khuẩn sau mỗi ca tiếp xúc máu
    itemsToRestock.push({ itemType: 'NITRILE_GLOVES', quantity: 2 });

    for (const fa of firstAidActions) {
      const type = fa.actionType || fa;
      if (type === 'TOURNIQUET_HEMOSTASIS') {
        itemsToRestock.push({ itemType: 'CAT_TOURNIQUET_GEN7', quantity: 1 });
        itemsToRestock.push({ itemType: 'STERILE_COMPRESS_GAUZE', quantity: 2 });
      }
      if (type === 'CPR') {
        itemsToRestock.push({ itemType: 'CPR_POCKET_FACE_SHIELD', quantity: 1 });
      }
      if (type === 'FRACTURE_SPLINT') {
        itemsToRestock.push({ itemType: 'SAM_SPLINT_UNIVERSAL', quantity: 1 });
        itemsToRestock.push({ itemType: 'ELASTIC_BANDAGE_10CM', quantity: 2 });
      }
    }

    const voucherCode = `RESTOCK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    policy.restockVoucher = {
      voucherCode,
      itemsIssued: itemsToRestock,
      issuedAt: new Date(),
      status: 'ISSUED',
    };

    await policy.save();

    return {
      success: true,
      voucherCode,
      itemsToRestock,
      message: 'Hệ thống đã tự động xuất phiếu bù đắp vật tư y tế miễn phí về địa chỉ của Hiệp sĩ.',
    };
  }

  /**
   * Nộp hồ sơ yêu cầu bồi thường bảo hiểm vi mô khi xảy ra rủi ro
   */
  async fileInsuranceClaim(policyId, claimData) {
    const policy = await HeroInsurancePolicy.findById(policyId);
    if (!policy) throw new Error('Không tìm thấy hợp đồng bảo hiểm');

    policy.claimStatus = 'FILED';
    policy.claimDetails = {
      claimType: claimData.claimType,
      hospitalReportUrl: claimData.hospitalReportUrl || null,
      policeReportUrl: claimData.policeReportUrl || null,
      estimatedLossVND: claimData.estimatedLossVND || 0,
    };

    await policy.save();
    return policy;
  }

  /**
   * Thẩm định và chi trả bồi thường cho Hiệp sĩ
   */
  async settleInsuranceClaim(policyId, payoutAmountVND) {
    const policy = await HeroInsurancePolicy.findById(policyId);
    if (!policy) throw new Error('Không tìm thấy hợp đồng');

    policy.claimStatus = 'PAID_OUT';
    policy.claimDetails.payoutAmountVND = payoutAmountVND;
    policy.claimDetails.settledAt = new Date();

    await policy.save();
    return policy;
  }
}

module.exports = new HeroShieldService();
