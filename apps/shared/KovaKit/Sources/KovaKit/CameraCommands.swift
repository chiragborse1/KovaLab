import Foundation

public enum KovaCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum KovaCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum KovaCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum KovaCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct KovaCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: KovaCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: KovaCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: KovaCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: KovaCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct KovaCameraClipParams: Codable, Sendable, Equatable {
    public var facing: KovaCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: KovaCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: KovaCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: KovaCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
