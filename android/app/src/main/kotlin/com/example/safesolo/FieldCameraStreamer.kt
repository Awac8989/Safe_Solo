package com.example.safesolo

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.Image
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import java.io.ByteArrayOutputStream

/**
 * Lightweight native Camera2 streamer for Field Hero live video -> WebRTC/Socket.IO relay
 * without pulling heavy native C++ WebRTC AARs. Streams 320x240 JPEG frames (~8 fps) safely.
 */
object FieldCameraStreamer {
    private const val TAG = "FieldCameraStreamer"
    private const val WIDTH = 320
    private const val HEIGHT = 240
    private const val MIN_FRAME_INTERVAL_MS = 125L

    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    @Volatile
    private var isStreaming = false
    @Volatile
    private var lastFrameEmitMs = 0L

    fun hasCameraPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    @SuppressLint("MissingPermission")
    fun start(context: Context): Map<String, Any> {
        if (isStreaming) {
            return mapOf("started" to true, "alreadyRunning" to true)
        }
        if (!hasCameraPermission(context)) {
            return mapOf("started" to false, "code" to "PERMISSION_DENIED")
        }
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
            ?: return mapOf("started" to false, "code" to "CAMERA_UNAVAILABLE")

        return try {
            val camId = selectCameraId(manager)
                ?: return mapOf("started" to false, "code" to "NO_CAMERA")

            val thread = HandlerThread("SafeSoloFieldCam").apply { start() }
            cameraThread = thread
            val handler = Handler(thread.looper)
            cameraHandler = handler

            val reader = ImageReader.newInstance(WIDTH, HEIGHT, ImageFormat.YUV_420_888, 2)
            imageReader = reader
            reader.setOnImageAvailableListener({ r ->
                val img = r.acquireLatestImage() ?: return@setOnImageAvailableListener
                try {
                    val now = System.currentTimeMillis()
                    if (now - lastFrameEmitMs >= MIN_FRAME_INTERVAL_MS) {
                        lastFrameEmitMs = now
                        val b64 = yuvToBase64Jpeg(img)
                        if (b64 != null) {
                            WatchNativeBridgeBus.emitToFlutter(
                                mapOf(
                                    "sensorType" to "FIELD_CAMERA_FRAME",
                                    "frameBase64" to b64,
                                    "width" to img.width,
                                    "height" to img.height,
                                    "timestamp" to now
                                )
                            )
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Frame encode skipped: ${e.message}")
                } finally {
                    img.close()
                }
            }, handler)

            isStreaming = true
            manager.openCamera(camId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    createCaptureSession(camera, reader, handler)
                }

                override fun onDisconnected(camera: CameraDevice) {
                    stop()
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    Log.e(TAG, "CameraDevice error=$error")
                    stop()
                }
            }, handler)

            mapOf("started" to true, "width" to WIDTH, "height" to HEIGHT, "cameraId" to camId)
        } catch (e: Exception) {
            Log.e(TAG, "Failed opening camera: ${e.message}")
            stop()
            mapOf("started" to false, "code" to "OPEN_FAILED", "error" to (e.message ?: "error"))
        }
    }

    fun stop() {
        isStreaming = false
        try { captureSession?.close() } catch (_: Exception) {}
        captureSession = null
        try { cameraDevice?.close() } catch (_: Exception) {}
        cameraDevice = null
        try { imageReader?.close() } catch (_: Exception) {}
        imageReader = null
        try { cameraThread?.quitSafely() } catch (_: Exception) {}
        cameraThread = null
        cameraHandler = null
    }

    private fun selectCameraId(manager: CameraManager): String? {
        for (id in manager.cameraIdList) {
            val chars = manager.getCameraCharacteristics(id)
            val facing = chars.get(CameraCharacteristics.LENS_FACING)
            if (facing == CameraCharacteristics.LENS_FACING_BACK) return id
        }
        return manager.cameraIdList.firstOrNull()
    }

    private fun createCaptureSession(camera: CameraDevice, reader: ImageReader, handler: Handler) {
        try {
            val surface = reader.surface
            @Suppress("DEPRECATION")
            camera.createCaptureSession(
                listOf(surface),
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        if (!isStreaming) return
                        captureSession = session
                        try {
                            val req = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                                addTarget(surface)
                                set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
                            }.build()
                            session.setRepeatingRequest(req, null, handler)
                        } catch (e: Exception) {
                            Log.w(TAG, "setRepeatingRequest failed: ${e.message}")
                        }
                    }

                    override fun onConfigureFailed(session: CameraCaptureSession) {
                        Log.e(TAG, "CaptureSession configure failed")
                        stop()
                    }
                },
                handler
            )
        } catch (e: Exception) {
            Log.e(TAG, "createCaptureSession failed: ${e.message}")
            stop()
        }
    }

    private fun yuvToBase64Jpeg(image: Image): String? {
        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]

        val ySize = yPlane.buffer.remaining()
        val uSize = uPlane.buffer.remaining()
        val vSize = vPlane.buffer.remaining()

        val nv21 = ByteArray(ySize + uSize + vSize)
        yPlane.buffer.get(nv21, 0, ySize)
        vPlane.buffer.get(nv21, ySize, vSize)
        uPlane.buffer.get(nv21, ySize + vSize, uSize)

        val out = ByteArrayOutputStream()
        val yuv = YuvImage(nv21, ImageFormat.NV21, image.width, image.height, null)
        yuv.compressToJpeg(Rect(0, 0, image.width, image.height), 55, out)
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }
}
