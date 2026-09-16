const HazardReport = require('../models/HazardReport');
const SafeMoment = require('../models/SafeMoment');
const User = require('../models/User');
const { ensure } = require('../lib/errors');
const { haversineKm } = require('../lib/utils');
const { getIo } = require('../sockets/socketServer');

class HazardService {
  async createHazard(userId, payload) {
    ensure(payload.title, 'Tiêu đề cảnh báo không được để trống', 400);
    ensure(payload.lat != null && payload.lng != null, 'Tọa độ GPS là bắt buộc', 400);

    const user = await User.findById(userId);
    const authorName = payload.isAnonymous ? 'Hiệp sĩ ẩn danh' : (user?.name || user?.fullName || 'Người dùng SafeSolo');

    const report = await HazardReport.create({
      userId,
      authorName,
      title: payload.title,
      description: payload.description || '',
      category: payload.category || 'DARK_ROAD',
      lat: Number(payload.lat),
      lng: Number(payload.lng),
      address: payload.address || '',
      isAnonymous: Boolean(payload.isAnonymous),
      confirmCount: 1,
      upvotedUserIds: [userId],
    });

    const io = getIo();
    if (io) {
      io.emit('community:hazard_created', {
        hazard: report.toObject(),
      });
    }

    return report;
  }

  async listHazards({ lat, lng, radiusKm = 10, category }) {
    const query = { status: 'ACTIVE' };
    if (category && category !== 'ALL') {
      query.category = category;
    }

    const list = await HazardReport.find(query).sort({ createdAt: -1 }).limit(50);

    if (lat != null && lng != null) {
      const originLat = Number(lat);
      const originLng = Number(lng);
      return list
        .map((doc) => {
          const item = doc.toObject();
          item.distanceKm = haversineKm(originLat, originLng, item.lat, item.lng);
          return item;
        })
        .filter((item) => item.distanceKm <= Number(radiusKm))
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return list.map((doc) => ({
      ...doc.toObject(),
      distanceKm: 0.5,
    }));
  }

  async verifyHazard(hazardId, userId, action) {
    const report = await HazardReport.findById(hazardId);
    ensure(report, 'Báo cáo cảnh báo không tồn tại', 404);

    if (action === 'RESOLVE') {
      report.resolvedCount += 1;
      if (report.resolvedCount >= 3) {
        report.status = 'RESOLVED';
      }
    } else {
      if (!report.upvotedUserIds.includes(userId)) {
        report.confirmCount += 1;
        report.upvotedUserIds.push(userId);
      }
    }

    await report.save();
    return report;
  }

  async createSafeMoment(userId, payload) {
    const user = await User.findById(userId);
    const authorName = user?.name || user?.fullName || 'Người thân';

    const moment = await SafeMoment.create({
      userId,
      authorName,
      mood: payload.mood || 'calm',
      voiceNoteUrl: payload.voiceNoteUrl || null,
      photoUrl: payload.photoUrl || null,
      caption: payload.caption || '',
    });

    return moment;
  }

  async listSafeMoments(userId) {
    const now = new Date();
    return SafeMoment.find({ expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(20);
  }
}

module.exports = new HazardService();
