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

    // Giám sát Từ xa Tủ AED Thông minh (IoT Smart Cabinet Telemetry)
    iotCabinet: {
      batteryPercent: { type: Number, default: 95 },
      internalTemperatureCelsius: { type: Number, default: 24.5 },
      doorState: { type: String, enum: ['CLOSED', 'OPEN'], default: 'CLOSED' },
      lastPingAt: { type: Date, default: Date.now },
      tamperAlertActive: { type: Boolean, default: false },
      tamperDetectedAt: { type: Date, default: null },
      tamperReason: { type: String, default: '' },
    },

    // Trang thiết bị y tế chuyên dụng ngoại viện (Oxy y tế & Bút tiêm chống sốc Epinephrine)
    medicalEquipment: {
      oxygenCylinder: {
        hasOxygen: { type: Boolean, default: false },
        capacityLiters: { type: Number, default: 5 }, // 2L, 5L, 8L
        currentPressureBar: { type: Number, default: 150 }, // Chuẩn đầy: 150 bar, tối thiểu dùng được: 50 bar
        lastInspectedAt: { type: Date, default: Date.now },
        regulatorType: { type: String, default: 'PIN_INDEX_YOKE_O2' },
      },
      epiPenAutoInjector: {
        available: { type: Boolean, default: false },
        expiryDate: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 3600 * 1000) },
        doseMg: { type: Number, default: 0.3 }, // 0.3mg adult, 0.15mg junior
        lotNumber: { type: String, default: 'EPI-2026-SG' },
      },
      heatstrokeSupplies: {
        icePacksAvailable: { type: Boolean, default: true },
        icePacksCount: { type: Number, default: 6 },
        oralElectrolytesPackets: { type: Number, default: 20 },
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

safePointAssetSchema.index({ location: '2dsphere' });

module.exports = mongoose.models.SafePointAsset || mongoose.model('SafePointAsset', safePointAssetSchema);
