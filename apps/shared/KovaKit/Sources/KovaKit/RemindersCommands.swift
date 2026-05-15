import Foundation

public enum KovaRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum KovaReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct KovaRemindersListParams: Codable, Sendable, Equatable {
    public var status: KovaReminderStatusFilter?
    public var limit: Int?

    public init(status: KovaReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct KovaRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct KovaReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct KovaRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [KovaReminderPayload]

    public init(reminders: [KovaReminderPayload]) {
        self.reminders = reminders
    }
}

public struct KovaRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: KovaReminderPayload

    public init(reminder: KovaReminderPayload) {
        self.reminder = reminder
    }
}
