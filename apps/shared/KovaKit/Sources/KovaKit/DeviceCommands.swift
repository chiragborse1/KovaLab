import Foundation

public enum KovaDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum KovaBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum KovaThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum KovaNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum KovaNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct KovaBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: KovaBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: KovaBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct KovaThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: KovaThermalState

    public init(state: KovaThermalState) {
        self.state = state
    }
}

public struct KovaStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct KovaNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: KovaNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [KovaNetworkInterfaceType]

    public init(
        status: KovaNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [KovaNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct KovaDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: KovaBatteryStatusPayload
    public var thermal: KovaThermalStatusPayload
    public var storage: KovaStorageStatusPayload
    public var network: KovaNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: KovaBatteryStatusPayload,
        thermal: KovaThermalStatusPayload,
        storage: KovaStorageStatusPayload,
        network: KovaNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct KovaDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
