// swift-tools-version: 6.2
// Package manifest for the Kova macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "Kova",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "KovaIPC", targets: ["KovaIPC"]),
        .library(name: "KovaDiscovery", targets: ["KovaDiscovery"]),
        .executable(name: "Kova", targets: ["Kova"]),
        .executable(name: "kova-mac", targets: ["KovaMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.3.0"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.4.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.10.1"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/KovaKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "KovaIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "KovaDiscovery",
            dependencies: [
                .product(name: "KovaKit", package: "KovaKit"),
            ],
            path: "Sources/KovaDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "Kova",
            dependencies: [
                "KovaIPC",
                "KovaDiscovery",
                .product(name: "KovaKit", package: "KovaKit"),
                .product(name: "KovaChatUI", package: "KovaKit"),
                .product(name: "KovaProtocol", package: "KovaKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/Kova.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "KovaMacCLI",
            dependencies: [
                "KovaDiscovery",
                .product(name: "KovaKit", package: "KovaKit"),
                .product(name: "KovaProtocol", package: "KovaKit"),
            ],
            path: "Sources/KovaMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "KovaIPCTests",
            dependencies: [
                "KovaIPC",
                "Kova",
                "KovaDiscovery",
                .product(name: "KovaProtocol", package: "KovaKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
