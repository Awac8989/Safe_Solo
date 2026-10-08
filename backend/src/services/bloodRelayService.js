const crypto = require('crypto');
const BloodRelayRequest = require('../models/BloodRelayRequest');
const User = require('../models/User');
const MedicalProfile = require('../models/MedicalProfile');

class BloodRelayService {
  /**
   * Ma trận tương thích truyền máu ngoại viện (Compatibility Rules)
   */
  getCompatibleDonorBloodTypes(recipientType) {
    const rules = {
      'O-': ['O-'],
      'O+': ['O-', 'O+'],
      'A-': ['A-', 'O-'],
      'A+': ['A+', 'A-', 'O+', 'O-'],
      'B-': ['B-', 'O-'],
      'B+': ['B+', 'B-', 'O+', 'O-'],
      'AB-': ['AB-', 'A-', 'B-', 'O-'],
      'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
    };
    return rules[recipientType] || [recipientType];
  }

  /**
   * Bệnh viện hoặc Bác sĩ kích hoạt yêu cầu điều phối máu khẩn cấp
   */
  async createEmergencyBloodRequest(payload) {
    const {
      incidentId,
      hospitalId,
      hospitalName,
      departmentName,
      requestedBloodType,
      unitsRequired = 2,
      urgencyLevel = 'STAT_IMMEDIATE_30M',
      requestedByDoctorId,
    } = payload;

    const request = await BloodRelayRequest.create({
      incidentId,
      hospitalId,
      hospitalName,
      departmentName,
      requestedBloodType,
      unitsRequired,
      urgencyLevel,
      requestedByDoctorId,
      status: 'SEARCHING',
    });

    return request;
  }

  /**
   * Quét radar tìm tình nguyện viên có nhóm máu tương thích trong bán kính
   */
  async findMatchingDonors(requestId, hospitalLat, hospitalLng, maxDistanceMeters = 15000) {
    const request = await BloodRelayRequest.findById(requestId);
    if (!request) throw new Error('Không tìm thấy yêu cầu điều phối máu');

    const compatibleTypes = this.getCompatibleDonorBloodTypes(request.requestedBloodType);

    // Tìm hồ sơ y tế có nhóm máu phù hợp
    const matchingProfiles = await MedicalProfile.find({
      bloodType: { $in: compatibleTypes },
    }).select('userId bloodType');

    const eligibleUserIds = matchingProfiles.map(p => p.userId);

    // Lọc người dùng đang online hoặc sẵn sàng hiến máu
    const potentialDonors = await User.find({
      _id: { $in: eligibleUserIds },
      isVerified: true,
    }).select('fullName phoneNumber lastKnownLocation trustScore');

    function haversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371e3;
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const matchedList = [];
    for (const donor of potentialDonors) {
      const userProfile = matchingProfiles.find(p => p.userId === donor._id);
      let dist = 1000;
      if (donor.lastKnownLocation?.lat && donor.lastKnownLocation?.lng) {
        dist = haversineDistance(hospitalLat, hospitalLng, donor.lastKnownLocation.lat, donor.lastKnownLocation.lng);
      }

      if (dist <= maxDistanceMeters) {
        matchedList.push({
          donorUserId: donor._id,
          fullName: donor.fullName,
          phoneNumber: donor.phoneNumber,
          donorBloodType: userProfile.bloodType,
          distanceMeters: Math.round(dist),
          trustScore: donor.trustScore || 80,
        });
      }
    }

    // Sắp xếp ưu tiên: Người gần nhất + Điểm uy tín cao nhất
    matchedList.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return matchedList.slice(0, 5);
  }

  /**
   * Tình nguyện viên bấm đồng ý hiến máu khẩn cấp
   */
  async acceptBloodDonation(requestId, donorUserId, donorBloodType, distanceMeters = 500) {
    const request = await BloodRelayRequest.findById(requestId);
    if (!request) throw new Error('Yêu cầu không tồn tại');

    const qrFastTrackCode = `FAST-BLOOD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    request.matchedDonors.push({
      donorUserId,
      donorBloodType,
      distanceMeters,
      acceptedAt: new Date(),
      qrFastTrackCode,
    });
    request.status = 'DISPATCHED';
    await request.save();

    return {
      success: true,
      requestId: request._id,
      hospitalName: request.hospitalName,
      departmentName: request.departmentName,
      qrFastTrackCode,
      instructions: 'Đến thẳng sảnh Cấp cứu, xuất trình mã QR này để được hướng dẫn vào phòng lấy máu ưu tiên.',
    };
  }

  /**
   * Bệnh viện quét mã QR xác nhận tiếp nhận người hiến máu thành công
   */
  async confirmDonationFulfilled(requestId, donorUserId, unitsDonated = 1) {
    const request = await BloodRelayRequest.findById(requestId);
    if (!request) throw new Error('Yêu cầu không tồn tại');

    const donorRecord = request.matchedDonors.find(d => d.donorUserId === donorUserId);
    if (donorRecord) {
      donorRecord.bloodDonationCompleted = true;
      donorRecord.unitsDonated = unitsDonated;
      donorRecord.arrivedAtHospitalAt = new Date();
    }

    request.status = 'FULFILLED';
    request.closedAt = new Date();
    await request.save();

    // Tặng điểm uy tín cho người hiến máu
    await User.findByIdAndUpdate(donorUserId, {
      $inc: { trustScore: 25 },
    });

    return {
      success: true,
      message: 'Đã hoàn tất tiếp nhận máu cứu sống nạn nhân. Cảm ơn nghĩa cử cao đẹp của bạn!',
      unitsDonated,
    };
  }
}

module.exports = new BloodRelayService();
