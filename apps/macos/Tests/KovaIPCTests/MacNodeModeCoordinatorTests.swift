import Foundation
import KovaKit
import Testing
@testable import Kova

struct MacNodeModeCoordinatorTests {
    @Test func remoteModeDoesNotAdvertiseBrowserProxy() {
        let caps = MacNodeModeCoordinator.resolvedCaps(
            browserControlEnabled: true,
            cameraEnabled: false,
            locationMode: .off,
            connectionMode: .remote)
        let commands = MacNodeModeCoordinator.resolvedCommands(caps: caps)

        #expect(!caps.contains(KovaCapability.browser.rawValue))
        #expect(!commands.contains(KovaBrowserCommand.proxy.rawValue))
        #expect(commands.contains(KovaCanvasCommand.present.rawValue))
        #expect(commands.contains(KovaSystemCommand.notify.rawValue))
    }

    @Test func localModeAdvertisesBrowserProxyWhenEnabled() {
        let caps = MacNodeModeCoordinator.resolvedCaps(
            browserControlEnabled: true,
            cameraEnabled: false,
            locationMode: .off,
            connectionMode: .local)
        let commands = MacNodeModeCoordinator.resolvedCommands(caps: caps)

        #expect(caps.contains(KovaCapability.browser.rawValue))
        #expect(commands.contains(KovaBrowserCommand.proxy.rawValue))
    }
}
