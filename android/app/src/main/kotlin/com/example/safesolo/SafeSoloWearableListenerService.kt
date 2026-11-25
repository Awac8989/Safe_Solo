package com.example.safesolo

import android.content.Intent
import android.util.Log
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject
import java.nio.charset.StandardCharsets

/**
 * Receives real-time Wear OS Data Layer packets (MessageClient / DataClient) over Bluetooth
 * between Galaxy Watch 5 and Galaxy A53 even when screens are locked or app is backgrounded.
 */
class SafeSoloWearableListenerService : WearableListenerService() {
    companion object {
        private const val TAG = "SafeSoloWearListener"
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        super.onMessageReceived(messageEvent)
        val path = messageEvent.path
        val jsonStr = String(messageEvent.data, StandardCharsets.UTF_8)
        Log.i(TAG, "onMessageReceived path=$path from=${messageEvent.sourceNodeId} bytes=${messageEvent.data.size}")

        if (!path.startsWith("/safesolo")) return

        try {
            val obj = JSONObject(jsonStr)
            val action = obj.optString("action", "")
            val payload = obj.optJSONObject("payload")

            if (payload != null) {
                WatchNativeBridgeBus.saveVitalsSnapshot(
                    context = applicationContext,
                    heartRate = payload.optInt("heartRate", 0).takeIf { it > 0 },
                    spO2 = payload.optInt("spO2", 0).takeIf { it > 0 },
                    battery = payload.optInt("battery", -1).takeIf { it >= 0 },
                    steps = payload.optInt("steps", -1).takeIf { it >= 0 },
                    isOffWrist = if (payload.has("isOffWrist")) payload.optBoolean("isOffWrist") else null,
                    svmG = if (payload.has("svmG")) payload.optDouble("svmG") else null,
                    deviceId = payload.optString("deviceId", ""),
                    pairedUserId = payload.optString("userId", "")
                )
            }

            // Forward immediately into Dart WatchSyncManager via active EventChannel
            WatchNativeBridgeBus.emitToFlutter(
                mapOf(
                    "sensorType" to "WEAR_MESSAGE",
                    "path" to path,
                    "payloadJson" to jsonStr,
                    "sourceNodeId" to messageEvent.sourceNodeId,
                    "timestamp" to System.currentTimeMillis()
                )
            )

            // Handle critical offline emergencies on Phone even if UI is killed/asleep
            val isPhone = !packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_WATCH)
            if (isPhone && (action == "DURESS_SOS" || action == "HARDWARE_SOS" || action == "FALL_DETECTED" || action == "WEAR_TILE_SOS")) {
                Log.w(TAG, "Critical Wear Data Layer emergency received on phone ($action)")
                // Also wake MainActivity if SOS came from Tile/button while app wasn't open
                val intent = Intent(applicationContext, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    putExtra("safesolo_wear_action", action)
                    putExtra("safesolo_wear_packet", jsonStr)
                }
                try {
                    startActivity(intent)
                } catch (_: Exception) {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed parsing Wearable message: ${e.message}")
        }
    }

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        super.onDataChanged(dataEvents)
        for (event in dataEvents) {
            if (event.type == DataEvent.TYPE_CHANGED && event.dataItem.uri.path == WearDataLayerHelper.PATH_VITALS_DATA) {
                try {
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    WatchNativeBridgeBus.saveVitalsSnapshot(
                        context = applicationContext,
                        heartRate = dataMap.getInt("heartRate", 0).takeIf { it > 0 },
                        spO2 = dataMap.getInt("spO2", 0).takeIf { it > 0 },
                        battery = dataMap.getInt("battery", -1).takeIf { it >= 0 },
                        steps = dataMap.getInt("steps", -1).takeIf { it >= 0 },
                        isOffWrist = dataMap.getBoolean("isOffWrist", false),
                        svmG = dataMap.getDouble("svmG", 1.0),
                        fusionPhase = dataMap.getString("fusionPhase", "IDLE_MONITORING"),
                        deviceId = dataMap.getString("deviceId", "")
                    )
                } catch (_: Exception) {}
            }
        }
    }
}
