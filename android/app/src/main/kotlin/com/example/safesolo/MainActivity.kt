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
import android.util.Log
import android.view.WindowManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
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

    private var sensorEventListener: SensorEventListener? = null
    private var eventSink: EventChannel.EventSink? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private var batteryReceiver: BroadcastReceiver? = null
    private var isOffWrist = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        initSensors()
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
        // Kiểm tra loại chuẩn Android hoặc cảm biến quang học BioActive của Samsung
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
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // Method Channel
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, METHOD_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "getDeviceInfo" -> {
                        val model = Build.MODEL ?: "Unknown"
                        val manufacturer = Build.MANUFACTURER ?: "Unknown"
                        val isWatch = packageManager.hasSystemFeature(PackageManager.FEATURE_WATCH)
                        val isSmR900 = model.contains("SM-R900", ignoreCase = true) ||
                                       model.contains("Watch5", ignoreCase = true)
                        val info = mapOf(
                            "model" to model,
                            "manufacturer" to manufacturer,
                            "brand" to (Build.BRAND ?: "Unknown"),
                            "isWatch" to isWatch,
                            "isSmR900" to isSmR900,
                            "hasHeartRate" to (heartRateSensor != null),
                            "hasStepCounter" to (stepCounterSensor != null),
                            "hasSpO2" to (spo2Sensor != null),
                            "hasOffbody" to (offbodySensor != null)
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
                    else -> result.notImplemented()
                }
            }

        // Event Channel truyền dòng dữ liệu cảm biến thời gian thực
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL)
            .setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    eventSink = events
                    startSensorListening()
                }

                override fun onCancel(arguments: Any?) {
                    stopSensorListening()
                    eventSink = null
                }
            })
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

        // Phát mức pin ban đầu
        sendEvent(mapOf(
            "sensorType" to "BATTERY",
            "level" to getBatteryLevel(),
            "timestamp" to System.currentTimeMillis()
        ))

        // Lắng nghe thay đổi mức pin
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
                    else -> {
                        // Kiểm tra cảm biến SpO2
                        if (spo2Sensor != null && event.sensor == spo2Sensor) {
                            val spo2Val = event.values[0].toInt()
                            sendEvent(mapOf(
                                "sensorType" to "SPO2",
                                "value" to spo2Val,
                                "accuracy" to event.accuracy,
                                "timestamp" to now
                            ))
                        } else if (offbodySensor != null && event.sensor == offbodySensor) {
                            isOffWrist = (event.values[0] == 0f)
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

        // Đăng ký tất cả các cảm biến nhịp tim phần cứng (Batch & Wakeup) với chu kỳ 1s (1Hz)
        val hrList = sm.getSensorList(Sensor.TYPE_HEART_RATE)
        for (s in hrList) {
            val period = if (s.minDelay > 0) s.minDelay else 1000000
            val reg1 = sm.registerListener(sensorEventListener, s, period)
            Log.i("MainActivity", "Registered HR sensor ${s.name} (delay=$period): success=$reg1")
            if (!reg1) {
                val reg2 = sm.registerListener(sensorEventListener, s, SensorManager.SENSOR_DELAY_NORMAL)
                Log.i("MainActivity", "Registered HR sensor ${s.name} (SENSOR_DELAY_NORMAL): success=$reg2")
            }
        }
        if (hrList.isEmpty()) {
            heartRateSensor?.let {
                val r = sm.registerListener(sensorEventListener, it, SensorManager.SENSOR_DELAY_NORMAL)
                Log.i("MainActivity", "Registered default HR sensor ${it.name}: success=$r")
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
        stopSensorListening()
        super.onDestroy()
    }
}
