import Testing
@testable import Kova

@Suite(.serialized) struct KovaAppDelegateTests {
    @Test @MainActor func resolvesRegistryModelBeforeViewTaskAssignsDelegateModel() {
        let registryModel = NodeAppModel()
        KovaAppModelRegistry.appModel = registryModel
        defer { KovaAppModelRegistry.appModel = nil }

        let delegate = KovaAppDelegate()

        #expect(delegate._test_resolvedAppModel() === registryModel)
    }

    @Test @MainActor func prefersExplicitDelegateModelOverRegistryFallback() {
        let registryModel = NodeAppModel()
        let explicitModel = NodeAppModel()
        KovaAppModelRegistry.appModel = registryModel
        defer { KovaAppModelRegistry.appModel = nil }

        let delegate = KovaAppDelegate()
        delegate.appModel = explicitModel

        #expect(delegate._test_resolvedAppModel() === explicitModel)
    }
}
