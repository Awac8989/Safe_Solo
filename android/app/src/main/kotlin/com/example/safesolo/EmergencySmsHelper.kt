package com.example.safesolo

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Native zero-touch SMS emergency dispatcher via Android SmsManager.
 * Used when victim is incapacitated/unconscious (confirmed fall / Dead-Man timeout)
 * or under coercion (Duress PIN) without requiring interactive compose UI confirmation.
 */
object EmergencySmsHelper {
    private const val TAG = "EmergencySmsHelper"

    fun hasSmsPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasTelephonyFeature(context: Context): Boolean {
        return context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)
    }

    fun sendDirectSms(context: Context, phoneNumber: String, message: String): Map<String, Any> {
        val cleanPhone = phoneNumber.replace(Regex("[^0-9+]"), "")
        if (cleanPhone.length < 3) {
            return mapOf(
                "sent" to false,
                "code" to "INVALID_PHONE",
                "error" to "Số điện thoại khẩn cấp không hợp lệ"
            )
        }
        if (!hasTelephonyFeature(context)) {
            return mapOf(
                "sent" to false,
                "code" to "NO_TELEPHONY",
                "error" to "Thiết bị không có modem GSM/SMS (ví dụ Watch Bluetooth)"
            )
        }
        if (!hasSmsPermission(context)) {
            return mapOf(
                "sent" to false,
                "code" to "PERMISSION_DENIED",
                "error" to "Chưa cấp quyền SEND_SMS trong Cài đặt"
            )
        }

        return try {
            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java) ?: @Suppress("DEPRECATION") SmsManager.getDefault()
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }
            val parts = smsManager.divideMessage(message)
            if (parts.size > 1) {
                smsManager.sendMultipartTextMessage(cleanPhone, null, parts, null, null)
            } else {
                smsManager.sendTextMessage(cleanPhone, null, message, null, null)
            }
            Log.i(TAG, "Zero-touch SMS dispatched to $cleanPhone (${parts.size} parts)")
            mapOf(
                "sent" to true,
                "method" to "SMS_MANAGER",
                "phoneNumber" to cleanPhone,
                "parts" to parts.size,
                "timestamp" to System.currentTimeMillis()
            )
        } catch (e: Exception) {
            Log.e(TAG, "SmsManager send failed: ${e.message}")
            mapOf(
                "sent" to false,
                "code" to "SEND_FAILED",
                "error" to (e.message ?: "SmsManager error")
            )
        }
    }

    fun dispatchSavedContactsOfflineSms(context: Context, reason: String): List<Map<String, Any>> {
        val (phones, victimName, coords) = WatchNativeBridgeBus.getSavedEmergencyContext(context)
        val snap = WatchNativeBridgeBus.readSnapshot(context)
        val hr = snap.optInt("heartRate", 0)
        val spo2 = snap.optInt("spO2", 0)
        val bat = snap.optInt("battery", 0)
        val latStr = "%.5f".format(coords.first)
        val lngStr = "%.5f".format(coords.second)
        val vitals = if (hr > 0) " [HR:$hr,SpO2:$spo2%,Pin:$bat%]" else ""
        val msg = "SAFESOLO SOS! $victimName: $reason.$vitals Vi tri: https://maps.google.com/?q=$latStr,$lngStr"

        return phones.map { phone ->
            sendDirectSms(context, phone, msg)
        }
    }
}
