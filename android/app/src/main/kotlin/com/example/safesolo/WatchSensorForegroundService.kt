package com.example.safesolo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.wear.tiles.TileService
import org.json.JSONArray
import org.json.JSONObject
import java.util.ArrayDeque
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.sqrt

/**
 * Independent lightweight Foreground Sensor Service for Galaxy Watch 5.
 * Keeps BioActive PPG + Off-Body + 3-Phase IMU Fall Fusion active when the watch screen sleeps
 * or returns to Samsung's default watch face, syncing snapshots to SafeSoloTileService & Phone via BT.
 */
class WatchSensorForegroundService : Service(), SensorEventListener {
    companion object {
        private const val TAG = "WatchSensorFGS"
        private const val CHANNEL_ID = "safesolo_watch_shield_channel"
        private const val NOTIF_ID = 5509
        const val ACTION_START = "com.example.safesolo.WATCH_SENSOR_START"
        const val ACTION_STOP = "com.example.safesolo.WATCH_SENSOR_STOP"
    }

    private var sensorManager: SensorManager? = null
    private var accelSensor: Sensor? = null
    private var hrSensor: Sensor? = null
    private var offbodySensor: Sensor? = null
    private var stepCounterSensor: Sensor? = null

    private val handler = Handler(Looper.getMainLooper())
    private val gWaveformBuffer = ArrayDeque<Double>()
    private var lastAccelEmitMs = 0L
    private var lastSyncMs = 0L
    private var lastTileUpdateMs = 0L

    private var lastHr = 76
    private var lastSteps = 0
    private var isOffWrist = false
    private var latestSvmG = 1.0

    // Native 3-Phase Fusion when Watch screen is off
    private var fusionPhase = "IDLE_MONITORING"
    private var impactAtMs = 0L
    private var peakSvmG = 1.0
    private var stillMotionSamples = 0
    private var activeMotionSamples = 0
    private var lastCountdownTriggerMs = 0L

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification("Bảo vệ Watch 5 · Sẵn sàng"))
        registerWatchSensors()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun registerWatchSensors() {
        val sm = getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
        sensorManager = sm
        accelSensor = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        hrSensor = sm.getDefaultSensor(Sensor.TYPE_HEART_RATE)
        stepCounterSensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            offbodySensor = sm.getDefaultSensor(Sensor.TYPE_LOW_LATENCY_OFFBODY_DETECT)
        }

        accelSensor?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_UI) }
        hrSensor?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
        stepCounterSensor?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_UI) }
        offbodySensor?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
        Log.i(TAG, "WatchSensorForegroundService sensors registered (accel=${accelSensor != null}, hr=${hrSensor != null}, offbody=${offbodySensor != null})")
    }

    override fun onSensorChanged(event: SensorEvent?) {
        event ?: return
        val now = System.currentTimeMillis()
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                val ax = event.values[0] / 9.80665
                val ay = event.values[1] / 9.80665
                val az = event.values[2] / 9.80665
                val svm = sqrt(ax * ax + ay * ay + az * az)
                latestSvmG = svm
                val safeSvm = if (svm > 0.001) svm else 0.001
                val tiltDeg = acos((abs(az) / safeSvm).coerceIn(0.0, 1.0)) * (180.0 / Math.PI)

                if (gWaveformBuffer.size >= 32) gWaveformBuffer.removeFirst()
                gWaveformBuffer.addLast((svm * 100.0).toInt() / 100.0)

                evaluateNative3PhaseFusion(now, svm, tiltDeg)

                if (now - lastAccelEmitMs >= 150) {
                    lastAccelEmitMs = now
                    WatchNativeBridgeBus.emitToFlutter(
                        mapOf(
                            "sensorType" to "ACCELEROMETER",
                            "axG" to ax,
                            "ayG" to ay,
                            "azG" to az,
                            "svmG" to svm,
                            "tiltAngle" to tiltDeg,
                            "timestamp" to now
                        )
                    )
                }
            }
            Sensor.TYPE_HEART_RATE -> {
                val bpm = event.values[0].toInt()
                if (bpm in 35..220 && !isOffWrist) {
                    lastHr = bpm
                    WatchNativeBridgeBus.saveVitalsSnapshot(context = applicationContext, heartRate = bpm)
                    maybeSyncStateAndTile(now)
                }
            }
            Sensor.TYPE_STEP_COUNTER -> {
                val st = event.values[0].toInt()
                if (st >= 0) {
                    lastSteps = st
                    WatchNativeBridgeBus.saveVitalsSnapshot(context = applicationContext, steps = st)
                }
            }
            else -> {
                if (offbodySensor != null && event.sensor == offbodySensor) {
                    isOffWrist = (event.values[0] == 0f)
                    WatchNativeBridgeBus.saveVitalsSnapshot(context = applicationContext, isOffWrist = isOffWrist)
                    if (isOffWrist && fusionPhase != "IDLE_MONITORING") {
                        fusionPhase = "REJECTED_OFF_WRIST"
                        impactAtMs = 0L
                        Log.i(TAG, "3-Phase Fusion REJECTED: off-body == true (watch on table)")
                    }
                    maybeSyncStateAndTile(now)
                }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun evaluateNative3PhaseFusion(nowMs: Long, svm: Double, tiltDeg: Double) {
        if (isOffWrist) return

        if (fusionPhase == "IDLE_MONITORING" || fusionPhase == "REJECTED_OFF_WRIST" || fusionPhase == "REJECTED_POST_IMPACT_MOTION") {
            if (svm >= 2.5 && (nowMs - lastCountdownTriggerMs > 20_000L)) {
                fusionPhase = "STILLNESS_OFFBODY_CHECK"
                impactAtMs = nowMs
                peakSvmG = svm
                stillMotionSamples = 0
                activeMotionSamples = 0
                WatchNativeBridgeBus.saveVitalsSnapshot(
                    context = applicationContext,
                    svmG = svm,
                    fusionPhase = fusionPhase
                )
                Log.i(TAG, "3-Phase Fusion Phase 1 impact: peak=${"%.2f".format(svm)}g")
            }
            return
        }

        if (fusionPhase == "STILLNESS_OFFBODY_CHECK") {
            if (svm > peakSvmG) peakSvmG = svm
            val elapsed = nowMs - impactAtMs
            if (elapsed >= 1000L) {
                val dev = abs(svm - 1.0)
                if (dev < 0.45) {
                    stillMotionSamples++
                } else {
                    activeMotionSamples++
                }
            }
            if (elapsed >= 4000L) {
                if (isOffWrist) {
                    fusionPhase = "REJECTED_OFF_WRIST"
                    WatchNativeBridgeBus.saveVitalsSnapshot(context = applicationContext, fusionPhase = fusionPhase)
                    return
                }
                val total = stillMotionSamples + activeMotionSamples
                val stillRatio = if (total > 0) stillMotionSamples.toDouble() / total else 1.0
                if (stillRatio < 0.6) {
                    fusionPhase = "REJECTED_POST_IMPACT_MOTION"
                    WatchNativeBridgeBus.saveVitalsSnapshot(context = applicationContext, fusionPhase = fusionPhase)
                    Log.i(TAG, "3-Phase Fusion Phase 2 REJECTED: user kept moving (ratio=${"%.2f".format(stillRatio)})")
                } else {
                    fusionPhase = "PPG_AND_COUNTDOWN"
                    lastCountdownTriggerMs = nowMs
                    WatchNativeBridgeBus.saveVitalsSnapshot(
                        context = applicationContext,
                        svmG = peakSvmG,
                        fusionPhase = fusionPhase
                    )
                    vibrateWatch()
                    dispatchBackgroundFallPacket(peakSvmG, tiltDeg)
                    // Reset back to IDLE after 16s so background monitoring can catch future events
                    handler.postDelayed({
                        fusionPhase = "IDLE_MONITORING"
                        WatchNativeBridgeBus.saveVitalsSnapshot(context = applicationContext, fusionPhase = fusionPhase)
                    }, 16_000L)
                }
            }
        }
    }

    private fun dispatchBackgroundFallPacket(peakG: Double, tiltDeg: Double) {
        val snap = WatchNativeBridgeBus.readSnapshot(applicationContext)
        val packet = JSONObject().apply {
            put("protocol", "SSWP/1.0")
            put("messageId", "bg_fall_${System.currentTimeMillis()}")
            put("timestamp", java.time.Instant.now().toString())
            put("sender", "watch")
            put("type", "EMERGENCY")
            put("action", "FALL_DETECTED")
            put("payload", JSONObject().apply {
                put("deviceId", snap.optString("deviceId", "watch_galaxy_5"))
                put("userId", snap.optString("pairedUserId", ""))
                put("svmG", (peakG * 100).toInt() / 100.0)
                put("tiltAngle", (tiltDeg * 10).toInt() / 10.0)
                put("heartRate", lastHr)
                put("spO2", snap.optInt("spO2", 98))
                put("isOffWrist", isOffWrist)
                put("fusionPhase", "PPG_AND_COUNTDOWN")
                put("gForceWaveform", JSONArray(gWaveformBuffer.toList()))
                put("alert", "Fusion 3 pha phát hiện té ngã (${"%.2f".format(peakG)}g) khi màn hình Watch đang tắt!")
            })
        }
        WearDataLayerHelper.sendPacket(applicationContext, WearDataLayerHelper.PATH_PACKET, packet.toString())

        val wakeIntent = Intent(applicationContext, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("safesolo_wear_action", "FALL_DETECTED")
            putExtra("safesolo_wear_packet", packet.toString())
        }
        try {
            startActivity(wakeIntent)
        } catch (_: Exception) {}
    }

    private fun maybeSyncStateAndTile(nowMs: Long) {
        if (nowMs - lastTileUpdateMs >= 15_000L) {
            lastTileUpdateMs = nowMs
            try {
                TileService.getUpdater(applicationContext).requestUpdate(SafeSoloTileService::class.java)
            } catch (_: Exception) {}
        }
        if (nowMs - lastSyncMs >= 10_000L) {
            lastSyncMs = nowMs
            val snap = WatchNativeBridgeBus.readSnapshot(applicationContext)
            val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
            val bat = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.takeIf { it in 1..100 } ?: 85
            WearDataLayerHelper.syncVitalsDataItem(
                context = applicationContext,
                deviceId = snap.optString("deviceId", "watch_galaxy_5"),
                heartRate = lastHr,
                spO2 = snap.optInt("spO2", 98),
                battery = bat,
                steps = lastSteps,
                isOffWrist = isOffWrist,
                svmG = latestSvmG,
                fusionPhase = fusionPhase
            )
        }
    }

    private fun vibrateWatch() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator?.vibrate(VibrationEffect.createOneShot(650, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                @Suppress("DEPRECATION")
                v?.vibrate(VibrationEffect.createOneShot(650, VibrationEffect.DEFAULT_AMPLITUDE))
            }
        } catch (_: Exception) {}
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(
                CHANNEL_ID,
                "SafeSolo Watch Shield 24/7",
                NotificationManager.IMPORTANCE_LOW
            )
            nm.createNotificationChannel(ch)
        }
    }

    private fun buildNotification(text: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java)
        val pi = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("SafeSolo Watch Shield")
            .setContentText(text)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        sensorManager?.unregisterListener(this)
        super.onDestroy()
    }
}
