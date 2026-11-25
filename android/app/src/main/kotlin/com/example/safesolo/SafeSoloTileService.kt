package com.example.safesolo

import android.content.Intent
import android.os.Vibrator
import android.os.VibratorManager
import android.os.VibrationEffect
import android.os.Build
import android.content.Context
import androidx.concurrent.futures.CallbackToFutureAdapter
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DeviceParametersBuilders
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.DimensionBuilders.wrap
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject

/**
 * Native Galaxy Watch 5 Wear OS Tile:
 * - Swipe once from Watch Face to see live Heart Rate, SpO2 & Dead-Man countdown
 * - 1-Tap Check-in ("✓ ĐIỂM DANH") executes directly via Wear Data Layer Bluetooth without leaving the tile
 * - 1-Tap Emergency ("🚨 SOS") triggers Wear Data Layer packet + wakes emergency UI
 */
class SafeSoloTileService : TileService() {
    companion object {
        private const val RESOURCES_VERSION = "1"
        private const val ACTION_CHECKIN = "tile_checkin_now"
        private const val ACTION_SOS = "tile_sos_now"
    }

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        return CallbackToFutureAdapter.getFuture { completer ->
            val lastClick = requestParams.currentState.lastClickableId
            var feedbackBanner: String? = null

            if (lastClick == ACTION_CHECKIN) {
                val now = System.currentTimeMillis()
                val snap = WatchNativeBridgeBus.readSnapshot(applicationContext)
                WatchNativeBridgeBus.saveVitalsSnapshot(
                    context = applicationContext,
                    lastCheckinMs = now,
                    nextDeadlineMs = now + 12L * 3600L * 1000L
                )
                val packet = JSONObject().apply {
                    put("protocol", "SSWP/1.0")
                    put("messageId", "tile_chk_$now")
                    put("timestamp", java.time.Instant.now().toString())
                    put("sender", "watch")
                    put("type", "TELEMETRY")
                    put("action", "DEADMAN_CHECKIN")
                    put("payload", JSONObject().apply {
                        put("deviceId", snap.optString("deviceId", "watch_galaxy_5"))
                        put("userId", snap.optString("pairedUserId", ""))
                        put("mood", "Wear OS Tile 1-chạm")
                        put("source", "WEAR_OS_TILE")
                    })
                }
                WearDataLayerHelper.sendPacket(applicationContext, WearDataLayerHelper.PATH_TILE_ACTION, packet.toString())
                WatchNativeBridgeBus.emitToFlutter(
                    mapOf(
                        "sensorType" to "WEAR_TILE_ACTION",
                        "action" to "DEADMAN_CHECKIN",
                        "timestamp" to now
                    )
                )
                pulseTileHaptic(120)
                feedbackBanner = "✓ Đã điểm danh an toàn (+12h)"
            } else if (lastClick == ACTION_SOS) {
                val now = System.currentTimeMillis()
                val snap = WatchNativeBridgeBus.readSnapshot(applicationContext)
                val packet = JSONObject().apply {
                    put("protocol", "SSWP/1.0")
                    put("messageId", "tile_sos_$now")
                    put("timestamp", java.time.Instant.now().toString())
                    put("sender", "watch")
                    put("type", "EMERGENCY")
                    put("action", "HARDWARE_SOS")
                    put("payload", JSONObject().apply {
                        put("deviceId", snap.optString("deviceId", "watch_galaxy_5"))
                        put("userId", snap.optString("pairedUserId", ""))
                        put("heartRate", snap.optInt("heartRate", 76))
                        put("spO2", snap.optInt("spO2", 98))
                        put("source", "WEAR_OS_TILE")
                        put("alert", "SOS 1-chạm từ SafeSolo Wear OS Tile!")
                    })
                }
                WearDataLayerHelper.sendPacket(applicationContext, WearDataLayerHelper.PATH_TILE_ACTION, packet.toString())
                WatchNativeBridgeBus.emitToFlutter(
                    mapOf(
                        "sensorType" to "WEAR_TILE_ACTION",
                        "action" to "HARDWARE_SOS",
                        "timestamp" to now
                    )
                )
                pulseTileHaptic(500)
                feedbackBanner = "🚨 Đang phát tín hiệu SOS!"
                val intent = Intent(applicationContext, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    putExtra("safesolo_wear_action", "HARDWARE_SOS")
                }
                try {
                    startActivity(intent)
                } catch (_: Exception) {}
            }

            val tile = buildTileLayout(requestParams.deviceConfiguration, feedbackBanner)
            completer.set(tile)
            "SafeSoloTileFuture"
        }
    }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> {
        return CallbackToFutureAdapter.getFuture { completer ->
            completer.set(
                ResourceBuilders.Resources.Builder()
                    .setVersion(RESOURCES_VERSION)
                    .build()
            )
            "SafeSoloTileResourcesFuture"
        }
    }

    private fun buildTileLayout(
        deviceParams: DeviceParametersBuilders.DeviceParameters,
        feedbackBanner: String?
    ): TileBuilders.Tile {
        val snap = WatchNativeBridgeBus.readSnapshot(applicationContext)
        val hr = snap.optInt("heartRate", 76)
        val spo2 = snap.optInt("spO2", 98)
        val isOffWrist = snap.optBoolean("isOffWrist", false)
        val nextDeadlineMs = snap.optLong("nextDeadlineMs", 0L)

        val vitalsText = if (isOffWrist) "Tháo tay · Đeo lại" else "❤ $hr BPM · SpO2 $spo2%"
        val countdownText = if (nextDeadlineMs > System.currentTimeMillis()) {
            val mins = ((nextDeadlineMs - System.currentTimeMillis()) / 60000L).coerceAtLeast(1)
            val hrs = mins / 60
            val remM = mins % 60
            if (hrs > 0) "⏱ Còn ${hrs}g ${remM}p" else "⏱ Còn ${remM} phút"
        } else {
            "⏱ Giám sát 24/7"
        }

        val root = LayoutElementBuilders.Column.Builder()
            .setWidth(expand())
            .setHeight(wrap())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText("SAFESOLO WATCH")
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(sp(12f))
                            .setWeight(LayoutElementBuilders.FONT_WEIGHT_BOLD)
                            .setColor(argb(0xFF38BDF8.toInt()))
                            .build()
                    )
                    .build()
            )
            .addContent(
                LayoutElementBuilders.Spacer.Builder().setHeight(dp(4f)).build()
            )
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText(vitalsText)
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(sp(13f))
                            .setWeight(LayoutElementBuilders.FONT_WEIGHT_BOLD)
                            .setColor(argb(if (isOffWrist) 0xFFF59E0B.toInt() else 0xFFF8FAFC.toInt()))
                            .build()
                    )
                    .build()
            )
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText(feedbackBanner ?: countdownText)
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(sp(11f))
                            .setColor(argb(if (feedbackBanner != null) 0xFF34D399.toInt() else 0xFF94A3B8.toInt()))
                            .build()
                    )
                    .build()
            )
            .addContent(
                LayoutElementBuilders.Spacer.Builder().setHeight(dp(8f)).build()
            )
            .addContent(
                buildActionButton(
                    id = ACTION_CHECKIN,
                    label = "✓ ĐIỂM DANH AN TOÀN",
                    bgColor = 0xFF059669.toInt()
                )
            )
            .addContent(
                LayoutElementBuilders.Spacer.Builder().setHeight(dp(6f)).build()
            )
            .addContent(
                buildActionButton(
                    id = ACTION_SOS,
                    label = "🚨 SOS KHẨN CẤP",
                    bgColor = 0xFFDC2626.toInt()
                )
            )
            .build()

        val box = LayoutElementBuilders.Box.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setBackground(
                        ModifiersBuilders.Background.Builder()
                            .setColor(argb(0xFF050A14.toInt()))
                            .build()
                    )
                    .setPadding(
                        ModifiersBuilders.Padding.Builder()
                            .setAll(dp(12f))
                            .build()
                    )
                    .build()
            )
            .addContent(root)
            .build()

        val timeline = TimelineBuilders.Timeline.Builder()
            .addTimelineEntry(
                TimelineBuilders.TimelineEntry.Builder()
                    .setLayout(LayoutElementBuilders.Layout.Builder().setRoot(box).build())
                    .build()
            )
            .build()

        return TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setFreshnessIntervalMillis(60_000L)
            .setTileTimeline(timeline)
            .build()
    }

    private fun buildActionButton(id: String, label: String, bgColor: Int): LayoutElementBuilders.Box {
        return LayoutElementBuilders.Box.Builder()
            .setWidth(dp(156f))
            .setHeight(dp(34f))
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setBackground(
                        ModifiersBuilders.Background.Builder()
                            .setColor(argb(bgColor))
                            .setCorner(
                                ModifiersBuilders.Corner.Builder()
                                    .setRadius(dp(17f))
                                    .build()
                            )
                            .build()
                    )
                    .setClickable(
                        ModifiersBuilders.Clickable.Builder()
                            .setId(id)
                            .setOnClick(ActionBuilders.LoadAction.Builder().build())
                            .build()
                    )
                    .build()
            )
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText(label)
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(sp(11f))
                            .setWeight(LayoutElementBuilders.FONT_WEIGHT_BOLD)
                            .setColor(argb(0xFFFFFFFF.toInt()))
                            .build()
                    )
                    .build()
            )
            .build()
    }

    private fun pulseTileHaptic(ms: Long) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                @Suppress("DEPRECATION")
                v?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
            }
        } catch (_: Exception) {}
    }
}
