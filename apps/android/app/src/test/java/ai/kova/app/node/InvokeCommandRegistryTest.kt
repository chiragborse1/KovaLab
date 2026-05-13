package ai.kova.app.node

import ai.kova.app.protocol.KovaCalendarCommand
import ai.kova.app.protocol.KovaCameraCommand
import ai.kova.app.protocol.KovaCallLogCommand
import ai.kova.app.protocol.KovaCapability
import ai.kova.app.protocol.KovaContactsCommand
import ai.kova.app.protocol.KovaDeviceCommand
import ai.kova.app.protocol.KovaLocationCommand
import ai.kova.app.protocol.KovaMotionCommand
import ai.kova.app.protocol.KovaNotificationsCommand
import ai.kova.app.protocol.KovaPhotosCommand
import ai.kova.app.protocol.KovaSmsCommand
import ai.kova.app.protocol.KovaSystemCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      KovaCapability.Canvas.rawValue,
      KovaCapability.Device.rawValue,
      KovaCapability.Notifications.rawValue,
      KovaCapability.System.rawValue,
      KovaCapability.Photos.rawValue,
      KovaCapability.Contacts.rawValue,
      KovaCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      KovaCapability.Camera.rawValue,
      KovaCapability.Location.rawValue,
      KovaCapability.Sms.rawValue,
      KovaCapability.CallLog.rawValue,
      KovaCapability.VoiceWake.rawValue,
      KovaCapability.Motion.rawValue,
    )

  private val coreCommands =
    setOf(
      KovaDeviceCommand.Status.rawValue,
      KovaDeviceCommand.Info.rawValue,
      KovaDeviceCommand.Permissions.rawValue,
      KovaDeviceCommand.Health.rawValue,
      KovaNotificationsCommand.List.rawValue,
      KovaNotificationsCommand.Actions.rawValue,
      KovaSystemCommand.Notify.rawValue,
      KovaPhotosCommand.Latest.rawValue,
      KovaContactsCommand.Search.rawValue,
      KovaContactsCommand.Add.rawValue,
      KovaCalendarCommand.Events.rawValue,
      KovaCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      KovaCameraCommand.Snap.rawValue,
      KovaCameraCommand.Clip.rawValue,
      KovaCameraCommand.List.rawValue,
      KovaLocationCommand.Get.rawValue,
      KovaMotionCommand.Activity.rawValue,
      KovaMotionCommand.Pedometer.rawValue,
      KovaSmsCommand.Send.rawValue,
      KovaSmsCommand.Search.rawValue,
      KovaCallLogCommand.Search.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          sendSmsAvailable = false,
          readSmsAvailable = false,
          smsSearchPossible = false,
          callLogAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(KovaMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(KovaMotionCommand.Pedometer.rawValue))
  }

  @Test
  fun advertisedCommands_splitsSmsSendAndSearchAvailability() {
    val readOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(readSmsAvailable = true, smsSearchPossible = true),
      )
    val sendOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCommands.contains(KovaSmsCommand.Search.rawValue))
    assertFalse(readOnlyCommands.contains(KovaSmsCommand.Send.rawValue))
    assertTrue(sendOnlyCommands.contains(KovaSmsCommand.Send.rawValue))
    assertFalse(sendOnlyCommands.contains(KovaSmsCommand.Search.rawValue))
    assertTrue(requestableSearchCommands.contains(KovaSmsCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_includeSmsWhenEitherSmsPathIsAvailable() {
    val readOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCapabilities.contains(KovaCapability.Sms.rawValue))
    assertTrue(sendOnlyCapabilities.contains(KovaCapability.Sms.rawValue))
    assertFalse(requestableSearchCapabilities.contains(KovaCapability.Sms.rawValue))
  }

  @Test
  fun advertisedCommands_excludesCallLogWhenUnavailable() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(callLogAvailable = false))

    assertFalse(commands.contains(KovaCallLogCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_excludesCallLogWhenUnavailable() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(callLogAvailable = false))

    assertFalse(capabilities.contains(KovaCapability.CallLog.rawValue))
  }

  @Test
  fun advertisedCapabilities_includesVoiceWakeWithoutAdvertisingCommands() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(voiceWakeEnabled = true))
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(voiceWakeEnabled = true))

    assertTrue(capabilities.contains(KovaCapability.VoiceWake.rawValue))
    assertFalse(commands.any { it.contains("voice", ignoreCase = true) })
  }

  @Test
  fun find_returnsForegroundMetadataForCameraCommands() {
    val list = InvokeCommandRegistry.find(KovaCameraCommand.List.rawValue)
    val location = InvokeCommandRegistry.find(KovaLocationCommand.Get.rawValue)

    assertNotNull(list)
    assertEquals(true, list?.requiresForeground)
    assertNotNull(location)
    assertEquals(false, location?.requiresForeground)
  }

  @Test
  fun find_returnsNullForUnknownCommand() {
    assertNull(InvokeCommandRegistry.find("not.real"))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    smsSearchPossible: Boolean = false,
    callLogAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      sendSmsAvailable = sendSmsAvailable,
      readSmsAvailable = readSmsAvailable,
      smsSearchPossible = smsSearchPossible,
      callLogAvailable = callLogAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(actual: List<String>, expected: Set<String>) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(actual: List<String>, forbidden: Set<String>) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}
