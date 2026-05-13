package ai.kova.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class KovaProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", KovaCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", KovaCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", KovaCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", KovaCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", KovaCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", KovaCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", KovaCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", KovaCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", KovaCapability.Canvas.rawValue)
    assertEquals("camera", KovaCapability.Camera.rawValue)
    assertEquals("voiceWake", KovaCapability.VoiceWake.rawValue)
    assertEquals("location", KovaCapability.Location.rawValue)
    assertEquals("sms", KovaCapability.Sms.rawValue)
    assertEquals("device", KovaCapability.Device.rawValue)
    assertEquals("notifications", KovaCapability.Notifications.rawValue)
    assertEquals("system", KovaCapability.System.rawValue)
    assertEquals("photos", KovaCapability.Photos.rawValue)
    assertEquals("contacts", KovaCapability.Contacts.rawValue)
    assertEquals("calendar", KovaCapability.Calendar.rawValue)
    assertEquals("motion", KovaCapability.Motion.rawValue)
    assertEquals("callLog", KovaCapability.CallLog.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", KovaCameraCommand.List.rawValue)
    assertEquals("camera.snap", KovaCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", KovaCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", KovaNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", KovaNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", KovaDeviceCommand.Status.rawValue)
    assertEquals("device.info", KovaDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", KovaDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", KovaDeviceCommand.Health.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", KovaSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", KovaPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", KovaContactsCommand.Search.rawValue)
    assertEquals("contacts.add", KovaContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", KovaCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", KovaCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", KovaMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", KovaMotionCommand.Pedometer.rawValue)
  }

  @Test
  fun smsCommandsUseStableStrings() {
    assertEquals("sms.send", KovaSmsCommand.Send.rawValue)
    assertEquals("sms.search", KovaSmsCommand.Search.rawValue)
  }

  @Test
  fun callLogCommandsUseStableStrings() {
    assertEquals("callLog.search", KovaCallLogCommand.Search.rawValue)
  }

}
