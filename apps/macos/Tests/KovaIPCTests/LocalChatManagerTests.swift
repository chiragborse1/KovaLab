import Testing
@testable import Kova

@Suite(.serialized)
@MainActor
struct LocalChatManagerTests {
    @Test func `preferred session key is non empty`() async {
        let key = await LocalChatManager.shared.preferredSessionKey()
        #expect(!key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }
}
