package com.example.safesolo

import android.content.Context
import android.os.Handler
import android.os.Looper
import io.flutter.plugin.common.EventChannel
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Shared state + event bus bridging background Android services (WearableListenerService,
 * WatchSensorForegroundService, SafeSoloTileService) and active Flutter EventChannel.
 */
object WatchNativeBridgeBus {
    private const val PREFS_NAME = "safesolo_watch_state"
    private const val KEY_HEART_RATE = "heart_rate"
    private const val KEY_SPO2 = "spo2"
    private const val KEY_BATTERY = "battery"
    private const val KEY_STEPS = "steps"
    private const val KEY_OFF_WRIST = "is_off_wrist"
    private const val KEY_SVM_G = "svm_g"
    private const val KEY_USER_NAME = "user_name"
    private const val KEY_IS_PAIRED = "is_paired"
    private const val KEY_NEXT_DEADLINE_MS = "next_deadline_ms"
    private const val KEY_LAST_CHECKIN_MS = "last_checkin_ms"
    private const val KEY_FUSION_PHASE = "fusion_phase"
    private const val KEY_EMERGENCY_PHONES = "emergency_phones"
    private const val KEY_VICTIM_NAME = "victim_name"
    private const val KEY_LAST_LAT = "last_lat"
    private const val KEY_LAST_LNG = "last_lng"
    private const val KEY_DEVICE_ID = "hardware_device_id"
    private const val KEY_PAIRED_USER_ID = "paired_user_id"

    private val mainHandler = Handler(Looper.getMainLooper())
    @Volatile
    private var eventSink: EventChannel.EventSink? = null
    private val pendingEvents = ConcurrentLinkedQueue<Map<String, Any>>()

    fun attachEventSink(sink: EventChannel.EventSink?) {
        eventSink = sink
        if (sink != null) {
            while (true) {
                val queued = pendingEvents.poll() ?: break
                mainHandler.post { eventSink?.success(queued) }
            }
        }
    }

    fun emitToFlutter(event: Map<String, Any>) {
        val sink = eventSink
        if (sink != null) {
            mainHandler.post { sink.success(event) }
        } else {
            if (pendingEvents.size > 40) {
                pendingEvents.poll()
            }
            pendingEvents.offer(event)
        }
    }

    fun saveVitalsSnapshot(
        context: Context,
        heartRate: Int? = null,
        spO2: Int? = null,
        battery: Int? = null,
        steps: Int? = null,
        isOffWrist: Boolean? = null,
        svmG: Double? = null,
        userName: String? = null,
        isPaired: Boolean? = null,
        nextDeadlineMs: Long? = null,
        lastCheckinMs: Long? = null,
        fusionPhase: String? = null,
        deviceId: String? = null,
        pairedUserId: String? = null
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ed = prefs.edit()
        if (heartRate != null && heartRate > 0) ed.putInt(KEY_HEART_RATE, heartRate)
        if (spO2 != null && spO2 > 0) ed.putInt(KEY_SPO2, spO2)
        if (battery != null && battery >= 0) ed.putInt(KEY_BATTERY, battery)
        if (steps != null && steps >= 0) ed.putInt(KEY_STEPS, steps)
        if (isOffWrist != null) ed.putBoolean(KEY_OFF_WRIST, isOffWrist)
        if (svmG != null) ed.putFloat(KEY_SVM_G, svmG.toFloat())
        if (!userName.isNullOrBlank()) ed.putString(KEY_USER_NAME, userName)
        if (isPaired != null) ed.putBoolean(KEY_IS_PAIRED, isPaired)
        if (nextDeadlineMs != null && nextDeadlineMs > 0) ed.putLong(KEY_NEXT_DEADLINE_MS, nextDeadlineMs)
        if (lastCheckinMs != null && lastCheckinMs > 0) ed.putLong(KEY_LAST_CHECKIN_MS, lastCheckinMs)
        if (!fusionPhase.isNullOrBlank()) ed.putString(KEY_FUSION_PHASE, fusionPhase)
        if (!deviceId.isNullOrBlank()) ed.putString(KEY_DEVICE_ID, deviceId)
        if (!pairedUserId.isNullOrBlank()) ed.putString(KEY_PAIRED_USER_ID, pairedUserId)
        ed.apply()
    }

    fun readSnapshot(context: Context): JSONObject {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return JSONObject().apply {
            put("heartRate", prefs.getInt(KEY_HEART_RATE, 76))
            put("spO2", prefs.getInt(KEY_SPO2, 98))
            put("battery", prefs.getInt(KEY_BATTERY, 85))
            put("steps", prefs.getInt(KEY_STEPS, 0))
            put("isOffWrist", prefs.getBoolean(KEY_OFF_WRIST, false))
            put("svmG", prefs.getFloat(KEY_SVM_G, 1.0f).toDouble())
            put("userName", prefs.getString(KEY_USER_NAME, "SafeSolo User") ?: "SafeSolo User")
            put("isPaired", prefs.getBoolean(KEY_IS_PAIRED, false))
            put("nextDeadlineMs", prefs.getLong(KEY_NEXT_DEADLINE_MS, 0L))
            put("lastCheckinMs", prefs.getLong(KEY_LAST_CHECKIN_MS, 0L))
            put("fusionPhase", prefs.getString(KEY_FUSION_PHASE, "IDLE_MONITORING") ?: "IDLE_MONITORING")
            put("deviceId", prefs.getString(KEY_DEVICE_ID, "watch_galaxy_5") ?: "watch_galaxy_5")
            put("pairedUserId", prefs.getString(KEY_PAIRED_USER_ID, "") ?: "")
        }
    }

    fun saveEmergencyContacts(
        context: Context,
        phoneNumbers: List<String>,
        victimName: String?,
        lat: Double?,
        lng: Double?
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val arr = JSONArray()
        phoneNumbers.map { it.trim() }.filter { it.isNotEmpty() }.distinct().forEach { arr.put(it) }
        prefs.edit().apply {
            putString(KEY_EMERGENCY_PHONES, arr.toString())
            if (!victimName.isNullOrBlank()) putString(KEY_VICTIM_NAME, victimName)
            if (lat != null) putFloat(KEY_LAST_LAT, lat.toFloat())
            if (lng != null) putFloat(KEY_LAST_LNG, lng.toFloat())
        }.apply()
    }

    fun getSavedEmergencyContext(context: Context): Triple<List<String>, String, Pair<Double, Double>> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val phones = mutableListOf<String>()
        try {
            val arr = JSONArray(prefs.getString(KEY_EMERGENCY_PHONES, "[]") ?: "[]")
            for (i in 0 until arr.length()) {
                val p = arr.optString(i).trim()
                if (p.isNotEmpty()) phones.add(p)
            }
        } catch (_: Exception) {}
        val name = prefs.getString(KEY_VICTIM_NAME, "SafeSolo User") ?: "SafeSolo User"
        val lat = prefs.getFloat(KEY_LAST_LAT, 10.7769f).toDouble()
        val lng = prefs.getFloat(KEY_LAST_LNG, 106.7009f).toDouble()
        return Triple(phones, name, Pair(lat, lng))
    }
}
