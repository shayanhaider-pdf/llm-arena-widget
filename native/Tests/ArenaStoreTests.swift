import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import XCTest
@testable import AIRadar

final class ArenaStoreTests: XCTestCase {
    private let fixtureDate = ISO8601DateFormatter().date(from: "2026-11-25T18:00:00Z")!

    func testBundledRankingsCoverEveryArenaCategory() throws {
        let ranks = try productionFixture("widget")
        let access = try productionFixture("access")
        let publication = try XCTUnwrap(JSONSerialization.jsonObject(with: ranks) as? [String: Any])
        let generated = try XCTUnwrap(publication["generatedAt"] as? String)
        let clock = ISO8601DateFormatter()
        clock.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = try XCTUnwrap(clock.date(from: generated) ?? ISO8601DateFormatter().date(from: generated))
        let store = ArenaStore(
            directory: scratchDirectory(), bundledRankings: ranks, bundledAccess: access, clock: { date }
        )
        let snapshot = store.cached()
        XCTAssertEqual(ArenaCategory.allCases.count, 23)
        for category in ArenaCategory.allCases {
            let board = snapshot.category(category)
            XCTAssertEqual(board.winners.map(\.tier), ArenaTier.allCases, category.rawValue)
            XCTAssertEqual(board.winners.first?.model?.rank, 1, category.rawValue)
            XCTAssertNotNil(board.sourceURL, category.rawValue)
        }
        let alignment = snapshot.category(.alignment)
        if alignment.sourceURL == ArenaCategory.alignment.officialURL {
            XCTAssertNil(alignment.winners[1].model)
            XCTAssertNil(alignment.winners[2].model)
            XCTAssertNotNil(alignment.coverageMessage)
        }
    }

    func testOriginalRanksAndConfirmedAccessTakePriority() throws {
        let snapshot = try sampleStore().cached()
        let text = snapshot.category(.text)
        XCTAssertEqual(text.winners.map { $0.model?.rank }, [1, 12, 27])
        XCTAssertTrue(text.winners.allSatisfy { !$0.isUnconfirmed })
        XCTAssertEqual(text.winners[1].destination?.host, "chatgpt.com")
        for category in [ArenaCategory.work, .image] {
            let board = snapshot.category(category)
            XCTAssertEqual(board.winners.map { $0.model?.rank }, [1, nil, nil])
        }
    }

    func testExpiredEvidenceFallsBackToAnExplicitCandidate() throws {
        let expiry = ISO8601DateFormatter().date(from: "2026-11-26T00:00:00Z")!
        let snapshot = try sampleStore(date: expiry).cached()
        let free = snapshot.category(.text).winners[2]
        XCTAssertEqual(free.model?.rank, 2)
        XCTAssertTrue(free.isUnconfirmed)
    }

    func testInvalidRefreshKeepsTheOfflineSnapshot() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InvalidFeedResponse.self]
        let store = try sampleStore(session: URLSession(configuration: configuration))
        let snapshot = await store.load(force: true)
        XCTAssertEqual(snapshot.category(.text).winners.map { $0.model?.rank }, [1, 12, 27])
        XCTAssertEqual(store.cached().category(.text).winners.map { $0.model?.rank }, [1, 12, 27])
        XCTAssertTrue(snapshot.state.contains("last valid"))
    }

    func testImportKeepsPersonalEligibilityInChat() throws {
        let store = try sampleStore()
        let data = Data(#"{"large":["work","text","text","invalid","search"],"registry":{"gpt-example":{"name":"My GPT","free":true}}}"#.utf8)
        let migration = try store.importScriptableSettings(data)
        XCTAssertEqual(migration.overridesImported, 1)
        XCTAssertEqual(migration.largeCategories, [.work, .text, .search])
        let cached = store.cached()
        XCTAssertEqual(cached.category(.text).winners[2].model?.rank, 1)
        XCTAssertEqual(cached.category(.text).winners[2].displayName, "My GPT")
        XCTAssertNil(cached.category(.work).winners[2].model)
    }

    func testModelLinksRoundTripExactArenaID() throws {
        let modelID = "Gemini + GPT / (xHigh 90%) #雪"
        let link = ArenaModelRoute(category: .search, tier: .free, modelID: modelID).url
        let route = try XCTUnwrap(ArenaModelRoute(url: link))
        XCTAssertEqual(route.category, .search)
        XCTAssertEqual(route.tier, .free)
        XCTAssertEqual(route.modelID, modelID)

        for value in [
            "https://model/search/free?id=model", "airadar://model/search/free", "airadar://model/search/free?id=",
            "airadar://model/missing/free?id=model", "airadar://model/search/missing?id=model",
            "airadar://model/search/free?id=model&id=other"
        ] {
            XCTAssertNil(ArenaModelRoute(url: try XCTUnwrap(URL(string: value))), value)
        }
    }

    private func sampleStore(date: Date? = nil, session: URLSession = .shared) throws -> ArenaStore {
        let group: [String: Any] = [
            "date": "2026-11-22", "observed": "2026-11-25", "partial": false, "totalModels": 4,
            "source": "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset",
            "models": [
                ["id": "Other-verified", "rank": 27], ["id": "GPT-verified", "rank": 12],
                ["id": "Other-reported", "rank": 2], ["id": "GPT-example", "rank": 1]
            ]
        ]
        let feed: [String: Any] = [
            "source": "lmarena-ai/leaderboard-dataset", "generatedAt": "2026-11-25T12:45:25.769837+00:00",
            "subsets": [
                "text_style_control": ["checked": "2026-11-25", "groups": ["overall": group]],
                "agent_capability": ["checked": "2026-11-25", "groups": ["work": group]],
                "text_to_image": ["checked": "2026-11-25", "groups": ["overall": group]]
            ]
        ]
        let registry = Data(#"""
        {"schemaVersion":1,"reviewedAt":"2026-11-25","providers":[
          {"provider":"OpenAI","url":"https://chatgpt.com/","source":"https://openai.com/","models":[
            {"id":"GPT-example","status":"plus_candidate","scope":"chat"},
            {"id":"GPT-verified","status":"plus","scope":"chat"}]},
          {"provider":"Other","url":"https://example.com/","source":"https://example.com/access","models":[
            {"id":"Other-reported","status":"reported_free","scope":"chat"},
            {"id":"Other-verified","status":"free","scope":"chat","expiresAt":"2026-11-26"}]}
        ]}
        """#.utf8)
        let date = date ?? fixtureDate
        return ArenaStore(directory: scratchDirectory(), session: session,
                          bundledRankings: try JSONSerialization.data(withJSONObject: feed),
                          bundledAccess: registry, clock: { date })
    }

    private func scratchDirectory() -> URL {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        return directory
    }

    private func productionFixture(_ name: String) throws -> Data {
        #if os(Linux)
        let root = try XCTUnwrap(ProcessInfo.processInfo.environment["AIRADAR_TEST_REPOSITORY"])
        return try Data(contentsOf: URL(fileURLWithPath: root).appendingPathComponent("data/\(name).json"))
        #else
        return try Data(contentsOf: XCTUnwrap(Bundle.main.url(forResource: name, withExtension: "json")))
        #endif
    }
}

private final class InvalidFeedResponse: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
    }

    override func stopLoading() {}
}
