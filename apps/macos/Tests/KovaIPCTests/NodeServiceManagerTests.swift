import Foundation
import Testing
@testable import Kova

@Suite(.serialized) struct NodeServiceManagerTests {
    @Test func `builds node service commands with current CLI shape`() async throws {
        try await TestIsolation.withUserDefaultsValues(["kova.gatewayProjectRootPath": nil]) {
            let tmp = try makeTempDirForTests()
            CommandResolver.setProjectRoot(tmp.path)

            let kovaPath = tmp.appendingPathComponent("node_modules/.bin/kova")
            try makeExecutableForTests(at: kovaPath)

            let start = NodeServiceManager._testServiceCommand(["start"])
            #expect(start == [kovaPath.path, "node", "start", "--json"])

            let stop = NodeServiceManager._testServiceCommand(["stop"])
            #expect(stop == [kovaPath.path, "node", "stop", "--json"])
        }
    }
}
