import CoreLocation
import Foundation
import KovaKit
import UIKit

typealias KovaCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias KovaCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: KovaCameraSnapParams) async throws -> KovaCameraSnapResult
    func clip(params: KovaCameraClipParams) async throws -> KovaCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: KovaLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: KovaLocationGetParams,
        desiredAccuracy: KovaLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: KovaLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> KovaDeviceStatusPayload
    func info() -> KovaDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: KovaPhotosLatestParams) async throws -> KovaPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: KovaContactsSearchParams) async throws -> KovaContactsSearchPayload
    func add(params: KovaContactsAddParams) async throws -> KovaContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: KovaCalendarEventsParams) async throws -> KovaCalendarEventsPayload
    func add(params: KovaCalendarAddParams) async throws -> KovaCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: KovaRemindersListParams) async throws -> KovaRemindersListPayload
    func add(params: KovaRemindersAddParams) async throws -> KovaRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: KovaMotionActivityParams) async throws -> KovaMotionActivityPayload
    func pedometer(params: KovaPedometerParams) async throws -> KovaPedometerPayload
}

struct WatchMessagingStatus: Sendable, Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Sendable, Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalResolveEvent: Sendable, Equatable {
    var replyId: String
    var approvalId: String
    var decision: KovaWatchExecApprovalDecision
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalSnapshotRequestEvent: Sendable, Equatable {
    var requestId: String
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Sendable, Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setStatusHandler(_ handler: (@Sendable (WatchMessagingStatus) -> Void)?)
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func setExecApprovalResolveHandler(_ handler: (@Sendable (WatchExecApprovalResolveEvent) -> Void)?)
    func setExecApprovalSnapshotRequestHandler(
        _ handler: (@Sendable (WatchExecApprovalSnapshotRequestEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: KovaWatchNotifyParams) async throws -> WatchNotificationSendResult
    func sendExecApprovalPrompt(
        _ message: KovaWatchExecApprovalPromptMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalResolved(
        _ message: KovaWatchExecApprovalResolvedMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalExpired(
        _ message: KovaWatchExecApprovalExpiredMessage) async throws -> WatchNotificationSendResult
    func syncExecApprovalSnapshot(
        _ message: KovaWatchExecApprovalSnapshotMessage) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
