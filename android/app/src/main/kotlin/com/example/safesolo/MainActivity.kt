package com.example.safesolo

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.WindowManager
import java.security.MessageDigest
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.sqrt
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.wear.tiles.TileService
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.android.RenderMode
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val METHOD_CHANNEL = "com.example.safesolo/watch_native"
    private val EVENT_CHANNEL = "com.example.safesolo/watch_sensors"

    private var sensorManager: SensorManager? = null
    private var heartRateSensor: Sensor? = null
    private var stepCounterSensor: Sensor? = null
    private var stepDetectorSensor: Sensor? = null
    private var spo2Sensor: Sensor? = null
    private var offbodySensor: Sensor? = null
    private var accelerometerSensor: Sensor? = null

    private var sensorEventListener: SensorEventListener? = null
    private var eventSink: EventChannel.EventSink? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private var batteryReceiver: BroadcastReceiver? = null
    private var isOffWrist = false
    private var lastAccelEmitMs = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        initSensors()
        handleWearLaunchIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleWearLaunchIntent(intent)
    }

    private fun handleWearLaunchIntent(intent: Intent?) {
        val action = intent?.getStringExtra("safesolo_wear_action") ?: return
        val packet = intent.getStringExtra("safesolo_wear_packet") ?: ""
        WatchNativeBridgeBus.emitToFlutter(
            mapOf(
                "sensorType" to "WEAR_LAUNCH_ACTION",
                "action" to action,
                "payloadJson" to packet,
                "timestamp" to System.currentTimeMillis()
            )
        )
    }

    override fun getRenderMode(): RenderMode {
        return RenderMode.texture
    }

    private fun initSensors() {
        val sm = sensorManager ?: return

        // 1. Heart Rate (Sensor.TYPE_HEART_RATE = 21)
        heartRateSensor = sm.getDefaultSensor(Sensor.TYPE_HEART_RATE)
        if (heartRateSensor == null) {
            val allSensors = sm.getSensorList(Sensor.TYPE_ALL)
            for (s in allSensors) {
                if (s.type == Sensor.TYPE_HEART_RATE || s.type == 69682 || s.stringType.contains("heart_rate")) {
                    heartRateSensor = s
                    break
                }
            }
        }
        Log.i("MainActivity", "initSensors: heartRateSensor=$heartRateSensor")

        // 2. Step Counter (Sensor.TYPE_STEP_COUNTER = 19) & Detector (18)
        stepCounterSensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        stepDetectorSensor = sm.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)

        // 3. SpO2 / Oxygen Saturation
        val allSensors = sm.getSensorList(Sensor.TYPE_ALL)
        for (s in allSensors) {
            val name = s.name.lowercase()
            val stringType = s.stringType.lowercase()
            if (s.type == 65545 || s.type == 38 ||
                name.contains("spo2") || name.contains("oxygen") ||
                name.contains("pulse_ox") || stringType.contains("spo2") ||
                stringType.contains("oxygen") || name.contains("sao2")) {
                spo2Sensor = s
                break
            }
        }

        // 4. Off-body detect (Sensor.TYPE_LOW_LATENCY_OFFBODY_DETECT = 34)
        offbodySensor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            sm.getDefaultSensor(Sensor.TYPE_LOW_LATENCY_OFFBODY_DETECT)
        } else {
            null
        }

        // 5. Real 3-axis Accelerometer for 3-Phase Sensor Fusion (IMU + Off-body + PPG)
        accelerometerSensor = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, METHOD_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "getDeviceInfo" -> {
                        val model = Build.MODEL ?: "Unknown"
                        val manufacturer = Build.MANUFACTURER ?: "Unknown"
                        val isWatch = packageManager.hasSystemFeature(PackageManager.FEATURE_WATCH)
                        val isSmR900 = model.contains("SM-R900", ignoreCase = true) ||
                                       model.contains("Watch5", ignoreCase = true)
                        val hardwareDeviceId = buildStableHardwareDeviceId(model, isWatch, isSmR900)
                        val info = mapOf(
                            "model" to model,
                            "manufacturer" to manufacturer,
                            "brand" to (Build.BRAND ?: "Unknown"),
                            "isWatch" to isWatch,
                            "isSmR900" to isSmR900,
                            "hardwareDeviceId" to hardwareDeviceId,
                            "hasHeartRate" to (heartRateSensor != null),
                            "hasStepCounter" to (stepCounterSensor != null),
                            "hasSpO2" to (spo2Sensor != null),
                            "hasOffbody" to (offbodySensor != null),
                            "hasAccelerometer" to (accelerometerSensor != null),
                            "hasTelephony" to EmergencySmsHelper.hasTelephonyFeature(this),
                            "hasSmsPermission" to EmergencySmsHelper.hasSmsPermission(this)
                        )
                        result.success(info)
                    }
                    "getBatteryLevel" -> {
                        result.success(getBatteryLevel())
                    }
                    "requestSensorPermissions" -> {
                        requestPermissionsIfNeeded()
                        result.success(true)
                    }
                    "isOffWrist" -> {
                        result.success(isOffWrist)
                    }
                    "hasSmsPermission" -> {
                        result.success(mapOf(
                            "granted" to EmergencySmsHelper.hasSmsPermission(this),
                            "hasTelephony" to EmergencySmsHelper.hasTelephonyFeature(this)
                        ))
                    }
                    "requestSmsPermission" -> {
                        if (EmergencySmsHelper.hasSmsPermission(this)) {
                            result.success(true)
                        } else {
                            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.SEND_SMS), 1002)
                            result.success(false)
                        }
                    }
                    "sendDirectSms" -> {
                        val phone = call.argument<String>("phoneNumber") ?: ""
                        val message = call.argument<String>("message") ?: ""
                        val res = EmergencySmsHelper.sendDirectSms(this, phone, message)
                        result.success(res)
                    }
                    "saveEmergencyContactsForBackground" -> {
                        val phones = call.argument<List<String>>("phoneNumbers") ?: emptyList()
                        val victimName = call.argument<String>("victimName")
                        val lat = call.argument<Double>("lat")
                        val lng = call.argument<Double>("lng")
                        WatchNativeBridgeBus.saveEmergencyContacts(this, phones, victimName, lat, lng)
                        result.success(true)
                    }
                    "sendWearMessage" -> {
                        val path = call.argument<String>("path") ?: WearDataLayerHelper.PATH_PACKET
                        val payloadJson = call.argument<String>("payloadJson") ?: "{}"
                        WearDataLayerHelper.sendPacket(this, path, payloadJson) { info ->
                            mainHandler.post { result.success(info) }
                        }
                    }
                    "getWearConnectedNodes" -> {
                        WearDataLayerHelper.getConnectedNodes(this) { nodes ->
                            mainHandler.post { result.success(nodes) }
                        }
                    }
                    "syncWatchSnapshotToTile" -> {
                        val heartRate = call.argument<Int>("heartRate")
                        val spO2 = call.argument<Int>("spO2")
                        val battery = call.argument<Int>("battery")
                        val steps = call.argument<Int>("steps")
                        val isOff = call.argument<Boolean>("isOffWrist")
                        val svmG = call.argument<Double>("svmG")
                        val userName = call.argument<String>("userName")
                        val isPaired = call.argument<Boolean>("isPaired")
                        val nextDeadlineMs = (call.argument<Number>("nextDeadlineMs"))?.toLong()
                        val fusionPhase = call.argument<String>("fusionPhase")
                        val deviceId = call.argument<String>("deviceId")
                        val pairedUserId = call.argument<String>("pairedUserId")

                        WatchNativeBridgeBus.saveVitalsSnapshot(
                            context = applicationContext,
                            heartRate = heartRate,
                            spO2 = spO2,
                            battery = battery,
                            steps = steps,
                            isOffWrist = isOff,
                            svmG = svmG,
                            userName = userName,
                            isPaired = isPaired,
                            nextDeadlineMs = nextDeadlineMs,
                            fusionPhase = fusionPhase,
                            deviceId = deviceId,
                            pairedUserId = pairedUserId
                        )
                        if (deviceId != null) {
                            WearDataLayerHelper.syncVitalsDataItem(
                                context = applicationContext,
                                deviceId = deviceId,
                                heartRate = heartRate ?: 76,
                                spO2 = spO2 ?: 98,
                                battery = battery ?: 85,
                                steps = steps ?: 0,
                                isOffWrist = isOff ?: false,
                                svmG = svmG ?: 1.0,
                                fusionPhase = fusionPhase ?: "IDLE_MONITORING"
                            )
                        }
                        try {
                            TileService.getUpdater(applicationContext).requestUpdate(SafeSoloTileService::class.java)
                        } catch (_: Exception) {}
                        result.success(true)
                    }
                    "startWatchBackgroundService" -> {
                        try {
                            val svcIntent = Intent(this, WatchSensorForegroundService::class.java).apply {
                                action = WatchSensorForegroundService.ACTION_START
                            }
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                startForegroundService(svcIntent)
                            } else {
                                startService(svcIntent)
                            }
                            result.success(true)
                        } catch (e: Exception) {
                            Log.w("MainActivity", "Could not start WatchSensorForegroundService: ${e.message}")
                            result.success(false)
                        }
                    }
                    "stopWatchBackgroundService" -> {
                        try {
                            stopService(Intent(this, WatchSensorForegroundService::class.java))
                            result.success(true)
                        } catch (_: Exception) {
                            result.success(false)
                        }
                    }
                    "startFieldCameraStream" -> {
                        if (!FieldCameraStreamer.hasCameraPermission(this)) {
                            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), 1003)
                            result.success(mapOf("started" to false, "code" to "PERMISSION_REQUESTED"))
                        } else {
                            result.success(FieldCameraStreamer.start(this))
                        }
                    }
                    "stopFieldCameraStream" -> {
                        FieldCameraStreamer.stop()
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }

        EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL)
            .setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    eventSink = events
                    WatchNativeBridgeBus.attachEventSink(events)
                    startSensorListening()
                }

                override fun onCancel(arguments: Any?) {
                    stopSensorListening()
                    WatchNativeBridgeBus.attachEventSink(null)
                    eventSink = null
                }
            })
    }

    private fun buildStableHardwareDeviceId(model: String, isWatch: Boolean, isSmR900: Boolean): String {
        val rawAndroidId = try {
            Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "safesolo"
        } catch (_: Exception) {
            "safesolo"
        }
        val hash6 = try {
            val digest = MessageDigest.getInstance("SHA-256").digest(rawAndroidId.toByteArray(Charsets.UTF_8))
            digest.take(3).joinToString("") { "%02x".format(it) }
        } catch (_: Exception) {
            rawAndroidId.takeLast(6).lowercase()
        }
        val modelSlug = model.lowercase().replace(Regex("[^a-z0-9]+"), "_").trim('_')
        return if (isWatch || isSmR900) {
            if (isSmR900) "watch_r900_$hash6" else "watch_${modelSlug}_$hash6"
        } else {
            "phone_${modelSlug}_$hash6"
        }
    }

    private fun getBatteryLevel(): Int {
        val ifilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        val batteryStatus: Intent? = registerReceiver(null, ifilter)
        val level: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        return if (level >= 0 && scale > 0) {
            ((level / scale.toFloat()) * 100).toInt()
        } else {
            85
        }
    }

    private fun requestPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val permissions = mutableListOf<String>()
            val candidates = arrayOf(
                Manifest.permission.BODY_SENSORS,
                "android.permission.BODY_SENSORS_BACKGROUND",
                "android.permission.health.READ_HEART_RATE",
                "android.permission.health.READ_STEPS",
                "android.permission.health.READ_OXYGEN_SATURATION",
                "com.samsung.permission.SSENSOR"
            )
            for (p in candidates) {
                try {
                    if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                        permissions.add(p)
                    }
                } catch (_: Exception) {}
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION)
                    != PackageManager.PERMISSION_GRANTED) {
                    permissions.add(Manifest.permission.ACTIVITY_RECOGNITION)
                }
            }
            if (permissions.isNotEmpty()) {
                Log.i("MainActivity", "Requesting permissions: $permissions")
                ActivityCompat.requestPermissions(this, permissions.toTypedArray(), 1001)
            }
        }
    }

    private fun startSensorListening() {
        val sm = sensorManager ?: return

        sendEvent(mapOf(
            "sensorType" to "BATTERY",
            "level" to getBatteryLevel(),
            "timestamp" to System.currentTimeMillis()
        ))

        batteryReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                intent?.let {
                    val level = it.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                    val scale = it.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                    if (level >= 0 && scale > 0) {
                        val pct = ((level / scale.toFloat()) * 100).toInt()
                        sendEvent(mapOf(
                            "sensorType" to "BATTERY",
                            "level" to pct,
                            "timestamp" to System.currentTimeMillis()
                        ))
                    }
                }
            }
        }
        try {
            registerReceiver(batteryReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        } catch (_: Exception) {}

        sensorEventListener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent?) {
                event ?: return
                val now = System.currentTimeMillis()

                when (event.sensor.type) {
                    Sensor.TYPE_HEART_RATE -> {
                        val bpm = event.values[0].toInt()
                        Log.i("MainActivity", "HEART_RATE onSensorChanged: bpm=$bpm, accuracy=${event.accuracy}")
                        if (bpm > 0) {
                            WatchNativeBridgeBus.saveVitalsSnapshot(context = applicationContext, heartRate = bpm)
                            sendEvent(mapOf(
                                "sensorType" to "HEART_RATE",
                                "value" to bpm,
                                "accuracy" to event.accuracy,
                                "timestamp" to now
                            ))
                        }
                    }
                    Sensor.TYPE_STEP_COUNTER -> {
                        val steps = event.values[0].toInt()
                        WatchNativeBridgeBus.saveVitalsSnapshot(context = applicationContext, steps = steps)
                        sendEvent(mapOf(
                            "sensorType" to "STEP_COUNTER",
                            "value" to steps,
                            "accuracy" to event.accuracy,
                            "timestamp" to now
                        ))
                    }
                    Sensor.TYPE_STEP_DETECTOR -> {
                        sendEvent(mapOf(
                            "sensorType" to "STEP_DETECTOR",
                            "value" to 1,
                            "timestamp" to now
                        ))
                    }
                    Sensor.TYPE_ACCELEROMETER -> {
                        val axG = event.values[0] / 9.80665
                        val ayG = event.values[1] / 9.80665
                        val azG = event.values[2] / 9.80665
                        val svmG = sqrt(axG * axG + ayG * ayG + azG * azG)
                        val safeSvm = if (svmG > 0.001) svmG else 0.001
                        val tiltDeg = acos((abs(azG) / safeSvm).coerceIn(0.0, 1.0)) * (180.0 / Math.PI)
                        // Emit immediately on high-G impact spikes (>= 2.2g) or throttle normal stream to ~12Hz
                        if (svmG >= 2.2 || (now - lastAccelEmitMs >= 80)) {
                            lastAccelEmitMs = now
                            sendEvent(mapOf(
                                "sensorType" to "ACCELEROMETER",
                                "axG" to axG,
                                "ayG" to ayG,
                                "azG" to azG,
                                "svmG" to svmG,
                                "tiltAngle" to tiltDeg,
                                "timestamp" to now
                            ))
                        }
                    }
                    else -> {
                        if (spo2Sensor != null && event.sensor == spo2Sensor) {
                            val spo2Val = event.values[0].toInt()
                            if (spo2Val > 0) {
                                WatchNativeBridgeBus.saveVitalsSnapshot(context = applicationContext, spO2 = spo2Val)
                            }
                            sendEvent(mapOf(
                                "sensorType" to "SPO2",
                                "value" to spo2Val,
                                "accuracy" to event.accuracy,
                                "timestamp" to now
                            ))
                        } else if (offbodySensor != null && event.sensor == offbodySensor) {
                            isOffWrist = (event.values[0] == 0f)
                            WatchNativeBridgeBus.saveVitalsSnapshot(context = applicationContext, isOffWrist = isOffWrist)
                            sendEvent(mapOf(
                                "sensorType" to "OFFBODY",
                                "isOffWrist" to isOffWrist,
                                "timestamp" to now
                            ))
                        }
                    }
                }
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
                if (sensor?.type == Sensor.TYPE_HEART_RATE) {
                    sendEvent(mapOf(
                        "sensorType" to "HEART_RATE_ACCURACY",
                        "accuracy" to accuracy,
                        "timestamp" to System.currentTimeMillis()
                    ))
                }
            }
        }

        val hrList = sm.getSensorList(Sensor.TYPE_HEART_RATE)
        for (s in hrList) {
            val period = if (s.minDelay > 0) s.minDelay else 1000000
            val reg1 = sm.registerListener(sensorEventListener, s, period)
            if (!reg1) {
                sm.registerListener(sensorEventListener, s, SensorManager.SENSOR_DELAY_NORMAL)
            }
        }
        if (hrList.isEmpty()) {
            heartRateSensor?.let {
                sm.registerListener(sensorEventListener, it, SensorManager.SENSOR_DELAY_NORMAL)
            }
        }
        stepCounterSensor?.let {
            sm.registerListener(sensorEventListener, it, SensorManager.SENSOR_DELAY_UI)
        }
        stepDetectorSensor?.let {
            sm.registerListener(sensorEventListener, it, SensorManager.SENSOR_DELAY_UI)
        }
        spo2Sensor?.let {
            sm.registerListener(sensorEventListener, it, SensorManager.SENSOR_DELAY_FASTEST)
        }
        offbodySensor?.let {
            sm.registerListener(sensorEventListener, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
        accelerometerSensor?.let {
            sm.registerListener(sensorEventListener, it, SensorManager.SENSOR_DELAY_UI)
        }
    }

    private fun stopSensorListening() {
        sensorEventListener?.let {
            sensorManager?.unregisterListener(it)
        }
        sensorEventListener = null

        batteryReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (_: Exception) {}
        }
        batteryReceiver = null
    }

    private fun sendEvent(data: Map<String, Any>) {
        mainHandler.post {
            eventSink?.success(data)
        }
    }

    override fun onDestroy() {
        FieldCameraStreamer.stop()
        stopSensorListening()
        super.onDestroy()
    }
}
