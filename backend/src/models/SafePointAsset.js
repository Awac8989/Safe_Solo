const crypto = require('crypto');
const mongoose = require('mongoose');

const safePointAssetSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    assetType: {
      type: String,
      enum: ['AED', 'FIRST_AID_KIT', 'OXYGEN_CONCENTRATOR', 'STRETCHER_WHEELCHAIR', 'PHARMACY_247'],
      default: 'AED',
      index: true,
    },
    serialNumber: { type: String, required: true, trim: true },
    brandModel: { type: String, default: 'Philips HeartStart FRx / Zoll AED Plus' },

    // Tọa độ địa lý GeoJSON chuẩn MongoDB 2dsphere
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    addressDetails: {
      buildingName: { type: String, required: true },
      floorRoom: { type: String, required: true },
      fullAddress: { type: String, required: true },
      accessNote: { type: String, default: 'Mở cửa 24/7 hoặc liên hệ bảo vệ' },
    },

    // Cơ chế mở tủ thiết bị khẩn cấp
    accessMechanism: {
      type: String,
      enum: ['OPEN_ACCESS', 'BREAK_GLASS', 'DIGITAL_KEYPAD', 'IOT_BLE_UNLOCK'],
      default: 'OPEN_ACCESS',
    },
    iotDeviceId: { type: String, default: null },
    keypadPin: { type: String, default: null },

    // Tình trạng kiểm định & kỹ thuật
    status: {
      type: String,
      enum: ['READY', 'IN_USE', 'MAINTENANCE_REQUIRED', 'EXPIRED_CONSUMABLES', 'DECOMMISSIONED'],
      default: 'READY',
      index: true,
    },
    batteryExpiryDate: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 3600 * 1000 * 2) },
    padsExpiryDate: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 3600 * 1000 * 2) },
    lastInspectionAt: { type: Date, default: Date.now },
    verifiedByUserId: { type: String, default: null },

    // Thông tin cơ quan / tòa nhà quản lý
    custodianContact: {
      organizationName: { type: String, required: true },
      contactPerson: { type: String, default: 'Ban Quản Lý Tòa Nhà' },
      phone: { type: String, required: true },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

safePointAssetSchema.index({ location: '2dsphere' });

module.exports = mongoose.models.SafePointAsset || mongoose.model('SafePointAsset', safePointAssetSchema);
