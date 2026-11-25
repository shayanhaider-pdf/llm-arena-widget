import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

enum ArenaTier: String, CaseIterable, Identifiable, Sendable {
    case frontier, plus, free

    var id: Self { self }

    var title: String {
        switch self {
        case .frontier: "Frontier"
        case .plus: "ChatGPT Plus"
        case .free: "Free"
        }
    }
}

struct ArenaModel: Codable, Identifiable, Sendable {
    let id: String
    let rank: Int
    let organization: String?
    private let publishedRating: Double?
    private let indexScore: Double?
    private let score: Double?

    var rating: Double? { publishedRating ?? indexScore ?? score }

    enum CodingKeys: String, CodingKey {
        case id, rank, organization, score
        case publishedRating = "rating"
        case indexScore = "index_score"
    }
}

struct ArenaWinner: Identifiable, Sendable {
    let tier: ArenaTier
    var model: ArenaModel? = nil
    var displayName: String? = nil
    var destination: URL? = nil
    var isUnconfirmed = false
    var evidenceURL: URL? = nil
    var notes: String? = nil

    var id: ArenaTier { tier }
}

struct ArenaCategorySnapshot: Sendable {
    let category: ArenaCategory
    let models: [ArenaModel]
    let winners: [ArenaWinner]
    let publicationDate: Date?
    let observedDate: Date?
    let isPartial: Bool
    let totalModels: Int?
    let sourceURL: URL?
    let secondarySourceURL: URL?
    let coverageMessage: String?

    var officialURL: URL { category.officialURL }
}

struct ArenaSnapshot: Sendable {
    fileprivate let cache: ArenaCache
    fileprivate let today: String
    fileprivate let oldestAccessDate: String
    let state: String

    var generatedAt: Date? { cache.generatedAt }
    var accessReviewedAt: Date? { cache.access.flatMap { ArenaDate.parseDay($0.reviewedAt) } }

    func category(_ category: ArenaCategory) -> ArenaCategorySnapshot {
        let group = cache.groups[category.sourceKey]
        let models = group?.models.sorted {
            if $0.rank != $1.rank { return $0.rank < $1.rank }
            return normalizedID($0.id) < normalizedID($1.id)
        } ?? []
        let scope = AccessScope(category)
        let displayNamesOnly = category == .alignment && group?.source == category.officialURL.absoluteString
        let registry = displayNamesOnly ? [:] : activeRegistry(for: scope)
        let frontier = models.first.map { makeWinner(.frontier, $0, category) }
        let winners = [frontier, eligibleWinner(.plus), eligibleWinner(.free)]
            .enumerated().map { index, winner in
                winner ?? ArenaWinner(tier: ArenaTier.allCases[index])
            }

        let coverage: String?
        if let group, group.isPartial {
            let count = group.models.count
            if let total = group.totalModels, total > count {
                coverage = "Partial Arena snapshot with \(count) of \(total) ranked models."
            } else {
                coverage = "Partial Arena snapshot with \(count) ranked models."
            }
        } else if group == nil {
            coverage = "No validated rankings are available for this category."
        } else if displayNamesOnly {
            coverage = "Arena’s public Alignment snapshot lists display names. Exact benchmark variants are unavailable for access matching."
        } else {
            coverage = nil
        }
        return ArenaCategorySnapshot(
            category: category,
            models: models,
            winners: winners,
            publicationDate: group.flatMap { ArenaDate.parseDay($0.date) },
            observedDate: group.flatMap { ArenaDate.parseDay($0.observed ?? $0.date) },
            isPartial: group?.isPartial ?? false,
            totalModels: group?.totalModels,
            sourceURL: group.flatMap { trustedHTTPS($0.source) },
            secondarySourceURL: group.flatMap { trustedHTTPS($0.secondarySource) },
            coverageMessage: coverage
        )

        func eligibleWinner(_ tier: ArenaTier) -> ArenaWinner? {
            var firstUnconfirmed: ArenaWinner?
            for model in models {
                let id = normalizedID(model.id)
                let personal = scope == .chat ? cache.overrides[id] : nil
                let personalFlag = tier == .plus ? personal?.plus : personal?.free
                let evidence = registry[id]
                if let personalFlag {
                    if personalFlag {
                        var winner = makeWinner(tier, model, category)
                        winner.notes = "Personal chat access imported from Scriptable."
                        return winner
                    }
                    continue
                }
                guard let evidence else { continue }
                let level = evidence.level(for: tier, scope: scope)
                guard level != .none else { continue }
                var winner = makeWinner(tier, model, category)
                winner.isUnconfirmed = level == .candidate
                winner.evidenceURL = trustedHTTPS(evidence.entry.source ?? evidence.provider.source)
                winner.notes = evidence.entry.notes
                if level == .confirmed { return winner }
                if firstUnconfirmed == nil { firstUnconfirmed = winner }
            }
            return firstUnconfirmed
        }
    }

    private func makeWinner(_ tier: ArenaTier, _ model: ArenaModel, _ category: ArenaCategory) -> ArenaWinner {
        let key = normalizedID(model.id)
        let name = cache.overrides[key]?.name ?? (key == "amazon-web-search-agent" ? "Amazon Web Search" : model.id)
        return ArenaWinner(tier: tier, model: model, displayName: name, destination: providerURL(model.id, category))
    }

    private func activeRegistry(for scope: AccessScope) -> [String: ScopedEvidence] {
        guard let registry = cache.access, registry.reviewedAt >= oldestAccessDate,
              registry.reviewedAt <= today else { return [:] }
        var entries: [String: ScopedEvidence] = [:]
        for provider in registry.providers where (provider.reviewedAt ?? registry.reviewedAt) >= oldestAccessDate {
            for entry in provider.models + (provider.codeModels ?? []) {
                guard entry.expiresAt.map({ $0 > today }) ?? true else { continue }
                let id = normalizedID(entry.id)
                if entry.scope == scope || (scope == .image && entry.scope == .chat && legacyImageEvidence.contains(id)) {
                    if entries[id] == nil || entry.scope == scope {
                        entries[id] = ScopedEvidence(provider: provider, entry: entry)
                    }
                }
            }
        }
        return entries
    }
}

struct ArenaMigrationSummary: Sendable {
    let overridesImported: Int
    let largeCategories: [ArenaCategory]
}

struct ArenaStore: Sendable {
    private static let rankingsURL = URL(string: "https://raw.githubusercontent.com/shayanhaider-pdf/llm-arena-widget/main/data/widget.json")!
    private static let accessURL = URL(string: "https://raw.githubusercontent.com/shayanhaider-pdf/llm-arena-widget/main/data/access.json")!

    private let directory: URL
    private let session: URLSession
    private let bundledRankings: Data?
    private let bundledAccess: Data?
    private let clock: @Sendable () -> Date

    init(
        directory: URL? = nil,
        session: URLSession = .shared,
        bundledRankings: Data? = nil,
        bundledAccess: Data? = nil,
        clock: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.directory = directory ?? Self.cacheDirectory
        self.session = session
        self.bundledRankings = bundledRankings ?? Self.bundledJSON("widget")
        self.bundledAccess = bundledAccess ?? Self.bundledJSON("access")
        self.clock = clock
    }

    func cached() -> ArenaSnapshot {
        let now = clock()
        return snapshot(from: readCache(now: now), now: now)
    }

    func load(force: Bool = false) async -> ArenaSnapshot {
        let now = clock()
        let today = ArenaDate.day(now)
        var cache = readCache(now: now)
        let fetchRanks = force || cache.rankingsSync.shouldCheck(now: now, today: today)
        let fetchAccess = force || cache.accessSync.shouldCheck(now: now, today: today)
        if !fetchRanks && !fetchAccess { return snapshot(from: cache, now: now) }

        async let ranks = fetchRanks ? fetch(Self.rankingsURL, as: Feed.self, byteLimit: 4_000_000) : nil
        async let access = fetchAccess ? fetch(Self.accessURL, as: AccessRegistry.self, byteLimit: 500_000) : nil
        let update = await (ranks, access)
        do {
            cache = try editCache(now: now) { current in
                if fetchRanks {
                    let accepted = update.0.map { current.merge($0, today: today) } ?? false
                    current.rankingsSync.record(at: now, today: today, success: accepted)
                }
                if fetchAccess {
                    let accepted = update.1.map { current.merge($0, today: today) } ?? false
                    current.accessSync.record(at: now, today: today, success: accepted)
                }
            }
        } catch {
            // Keep the current response usable even if local storage is unavailable.
            if let ranks = update.0 { _ = cache.merge(ranks, today: today) }
            if let access = update.1 { _ = cache.merge(access, today: today) }
            return snapshot(from: cache, now: now, storageFailure: true)
        }
        return snapshot(from: cache, now: now)
    }

    func importScriptableSettings(_ data: Data) throws -> ArenaMigrationSummary {
        guard data.count <= 500_000 else { throw CocoaError(.fileReadTooLarge) }
        let settings = try JSONDecoder().decode(LegacySettings.self, from: data)
        guard settings.registry != nil || settings.large != nil else { throw CocoaError(.fileReadCorruptFile) }
        let overrides = (settings.registry ?? [:]).compactMap { key, value -> (String, PersonalAccess)? in
            let key = normalizedID(key)
            guard validModelID(key), let value = value.value else { return nil }
            let name = value.name?.trimmingCharacters(in: .whitespacesAndNewlines)
            let displayName = name.flatMap { $0.isEmpty ? nil : String($0.prefix(140)) }
            guard displayName != nil || value.plus != nil || value.free != nil else { return nil }
            let plus = value.plus == true && !openAIModel(key) ? nil : value.plus
            return (key, PersonalAccess(name: displayName, plus: plus, free: value.free))
        }
        _ = try editCache(now: clock()) { cache in
            for (key, value) in overrides { cache.overrides[key] = value }
        }
        var seen = Set<ArenaCategory>()
        let order = (settings.large ?? []).compactMap(ArenaCategory.init(rawValue:)).filter { seen.insert($0).inserted }
        return ArenaMigrationSummary(overridesImported: overrides.count, largeCategories: Array(order.prefix(5)))
    }

    private var fileURL: URL { directory.appendingPathComponent("arena-cache.json") }

    private static var cacheDirectory: URL {
        let files = FileManager.default
        #if canImport(Darwin)
        let group = Bundle.main.object(forInfoDictionaryKey: "AIRadarAppGroup") as? String ?? "group.com.shayanhaider.airadar"
        if let shared = files.containerURL(forSecurityApplicationGroupIdentifier: group) {
            return shared.appendingPathComponent("AI Radar", isDirectory: true)
        }
        #endif
        return files.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("AI Radar", isDirectory: true)
    }

    private static func bundledJSON(_ name: String) -> Data? {
        Bundle.main.url(forResource: name, withExtension: "json").flatMap { try? Data(contentsOf: $0) }
    }

    private func readCache(now: Date) -> ArenaCache {
        let today = ArenaDate.day(now)
        let stored = try? Data(contentsOf: fileURL)
        var cache = stored.flatMap { try? JSONDecoder().decode(ArenaCache.self, from: $0) } ?? ArenaCache()
        if cache.groups.count < ArenaCategory.allCases.count,
           let bundledRankings, let feed = try? JSONDecoder().decode(Feed.self, from: bundledRankings) {
            _ = cache.merge(feed, today: today)
        }
        if cache.access == nil,
           let bundledAccess, let access = try? JSONDecoder().decode(AccessRegistry.self, from: bundledAccess) {
            _ = cache.merge(access, today: today)
        }
        return cache
    }

    private func editCache(now: Date, update: (inout ArenaCache) -> Void) throws -> ArenaCache {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        // Serialize the short read/merge/write across the app and widget processes.
        let lock = directory.appendingPathComponent("cache.lock").path.withCString {
            open($0, O_CREAT | O_RDWR, 0o600)
        }
        guard lock >= 0 else { throw CocoaError(.fileWriteUnknown) }
        defer { close(lock) }
        while flock(lock, LOCK_EX) != 0 {
            guard errno == EINTR else { throw CocoaError(.fileWriteUnknown) }
        }
        defer { _ = flock(lock, LOCK_UN) }
        var cache = readCache(now: now)
        update(&cache)
        try JSONEncoder().encode(cache).write(to: fileURL, options: .atomic)
        return cache
    }

    private func fetch<T: Decodable & Sendable>(_ url: URL, as type: T.Type, byteLimit: Int) async -> T? {
        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200,
                  http.url?.scheme == "https", http.url?.host == url.host, data.count <= byteLimit else { return nil }
            return try JSONDecoder().decode(type, from: data)
        } catch {
            return nil
        }
    }

    private func snapshot(from cache: ArenaCache, now: Date, storageFailure: Bool = false) -> ArenaSnapshot {
        let today = ArenaDate.day(now)
        let oldest = ArenaDate.day(now.addingTimeInterval(-62 * 86_400))
        let state: String
        if cache.groups.isEmpty {
            state = "Rankings are currently unavailable."
        } else if storageFailure {
            state = "This check could not save the local cache."
        } else if cache.rankingsSync.failed || cache.accessSync.failed {
            state = "The latest check was incomplete. Showing the last valid data."
        } else if cache.access.map({ $0.reviewedAt < oldest }) ?? true {
            state = "Access evidence is unavailable or needs review."
        } else if cache.rankingsSync.successDay == nil {
            state = "Showing rankings included with the app."
        } else {
            state = "Showing the latest downloaded Arena snapshot."
        }
        return ArenaSnapshot(cache: cache, today: today, oldestAccessDate: oldest, state: state)
    }
}

private struct ArenaCache: Codable, Sendable {
    var groups: [String: RankGroup] = [:]
    var generatedAt: Date?
    var access: AccessRegistry?
    var overrides: [String: PersonalAccess] = [:]
    var rankingsSync = SyncStamp()
    var accessSync = SyncStamp()

    mutating func merge(_ feed: Feed, today: String) -> Bool {
        guard feed.source == "lmarena-ai/leaderboard-dataset",
              let generated = ArenaDate.parseTimestamp(feed.generatedAt), ArenaDate.day(generated) <= today else { return false }
        var validGroupCount = 0
        for category in ArenaCategory.allCases {
            let path = category.sourceKey.split(separator: ":").map(String.init)
            guard path.count == 2, let subset = feed.subsets[path[0]]?.value,
                  ArenaDate.isValidDay(subset.checked), subset.checked <= today else { continue }
            let names = category == .reasoning ? [path[1], "hard_6", "hard"] : [path[1]]
            guard let group = names.lazy.compactMap({ subset.groups[$0]?.value }).first(where: { $0.isValid(checked: subset.checked) }) else { continue }
            validGroupCount += 1
            if let old = groups[category.sourceKey], !group.canReplace(old) { continue }
            groups[category.sourceKey] = group
        }
        if validGroupCount > 0, generated >= (generatedAt ?? .distantPast) { generatedAt = generated }
        return validGroupCount > 0
    }

    mutating func merge(_ incoming: AccessRegistry, today: String) -> Bool {
        guard incoming.isValid(today: today) else { return false }
        if access.map({ $0.reviewedAt <= incoming.reviewedAt }) ?? true { access = incoming }
        return true
    }
}

private struct SyncStamp: Codable, Sendable {
    var successDay: String?
    var lastAttempt: Date?
    var failed = false

    func shouldCheck(now: Date, today: String) -> Bool {
        if successDay == today { return false }
        return lastAttempt.map { $0 > now || now.timeIntervalSince($0) >= 30 * 60 } ?? true
    }

    mutating func record(at time: Date, today: String, success: Bool) {
        if let lastAttempt, lastAttempt > time { return }
        lastAttempt = time
        failed = !success
        if success { successDay = today }
    }
}

private struct Feed: Decodable, Sendable {
    let source: String
    let generatedAt: String
    let subsets: [String: Lossy<Subset>]
}

private struct Subset: Decodable, Sendable {
    let checked: String
    let groups: [String: Lossy<RankGroup>]
}

private struct Lossy<Value: Decodable & Sendable>: Decodable, Sendable {
    let value: Value?
    init(from decoder: Decoder) { value = try? Value(from: decoder) }
}

private struct RankGroup: Codable, Sendable {
    let date: String
    let observed: String?
    let models: [ArenaModel]
    let partial: Bool?
    let totalModels: Int?
    let source: String?
    let secondarySource: String?

    var isPartial: Bool { partial == true || (totalModels ?? models.count) > models.count }

    func isValid(checked: String) -> Bool {
        guard ArenaDate.isValidDay(date), date <= checked,
              observed.map({ ArenaDate.isValidDay($0) && $0 >= date && $0 <= checked }) ?? true,
              !models.isEmpty, models.count <= 10_000,
              totalModels.map({ $0 >= models.count }) ?? true else { return false }
        var ids = Set<String>()
        return models.contains(where: { $0.rank == 1 }) && models.allSatisfy { model in
            let key = normalizedID(model.id)
            return validModelID(key) && ids.insert(key).inserted && model.rank > 0
        }
    }

    func canReplace(_ old: RankGroup) -> Bool {
        if isPartial != old.isPartial { return !isPartial }
        if date != old.date { return date > old.date }
        if models.count != old.models.count, isPartial { return models.count > old.models.count }
        return (observed ?? date) >= (old.observed ?? old.date)
    }
}

private enum AccessScope: String, Codable, Sendable {
    case chat, work, code, image, video

    init(_ category: ArenaCategory) {
        switch category {
        case .coding, .webdev, .imagewebdev: self = .code
        case .agent, .alignment, .work, .chatagent, .taskoutcome, .steering, .tooluse: self = .work
        case .image, .editing, .multiedit: self = .image
        case .video, .imagevideo, .videoedit: self = .video
        default: self = .chat
        }
    }
}

private enum AccessLevel {
    case none, candidate, confirmed
}

private struct AccessRegistry: Codable, Sendable {
    let schemaVersion: Int
    let reviewedAt: String
    let providers: [AccessProvider]

    func isValid(today: String) -> Bool {
        guard schemaVersion == 1, ArenaDate.isValidDay(reviewedAt), reviewedAt <= today,
              !providers.isEmpty else { return false }
        var keys = Set<String>()
        return providers.allSatisfy { provider in
            !provider.provider.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
                trustedHTTPS(provider.url) != nil && trustedHTTPS(provider.source) != nil &&
                (provider.reviewedAt.map { ArenaDate.isValidDay($0) && $0 <= reviewedAt } ?? true) &&
                (provider.models + (provider.codeModels ?? [])).allSatisfy { entry in
                    let id = normalizedID(entry.id)
                    return validModelID(id) && keys.insert("\(entry.scope.rawValue):\(id)").inserted &&
                        (entry.expiresAt.map(ArenaDate.isValidDay) ?? true) &&
                        (entry.source.map { trustedHTTPS($0) != nil } ?? true)
                }
        }
    }
}

private struct AccessProvider: Codable, Sendable {
    let provider: String
    let url: String
    let source: String
    let reviewedAt: String?
    let models: [AccessEntry]
    let codeModels: [AccessEntry]?
}

private struct AccessEntry: Codable, Sendable {
    enum Status: String, Codable, Sendable {
        case free, plus, unverified, paid
        case reportedFree = "reported_free"
        case plusCandidate = "plus_candidate"
    }

    let id: String
    let status: Status
    let publishedScope: AccessScope?
    let plusCandidate: Bool?
    let source: String?
    let notes: String?
    let expiresAt: String?

    var scope: AccessScope { publishedScope ?? .chat }

    enum CodingKeys: String, CodingKey {
        case id, status, plusCandidate, source, notes, expiresAt
        case publishedScope = "scope"
    }
}

private struct ScopedEvidence {
    let provider: AccessProvider
    let entry: AccessEntry

    func level(for tier: ArenaTier, scope: AccessScope) -> AccessLevel {
        switch tier {
        case .frontier:
            return .none
        case .plus:
            guard provider.provider.caseInsensitiveCompare("OpenAI") == .orderedSame else { return .none }
            if entry.status == .plus { return .confirmed }
            return entry.status == .plusCandidate || entry.plusCandidate == true ? .candidate : .none
        case .free:
            if entry.status == .reportedFree { return .candidate }
            guard entry.status == .free else { return .none }
            // The legacy code records for these two IDs only document browser chat.
            if scope == .code && browserOnlyCodingEvidence.contains(normalizedID(entry.id)) { return .candidate }
            return .confirmed
        }
    }
}

private let browserOnlyCodingEvidence: Set<String> = ["qwen3.8-max", "claude sonnet 4.6"]

// The current registry labels these explicit image product records as chat.
private let legacyImageEvidence: Set<String> = [
    "gpt-image-2.6 flare (medium)", "gpt-image-2.6 sunburst (medium)",
    "gemini 3.1 flash image (nano-banana-2, web search)", "minimax h3-image", "qwen-image-2.1"
]

private struct PersonalAccess: Codable, Sendable {
    let name: String?
    let plus: Bool?
    let free: Bool?
}

private struct LegacySettings: Decodable {
    let large: [String]?
    let registry: [String: Lossy<PersonalAccess>]?
}

private enum ArenaDate {
    static func day(_ date: Date) -> String {
        String(ISO8601DateFormatter().string(from: date).prefix(10))
    }

    static func parseDay(_ value: String) -> Date? {
        guard value.count == 10,
              let parsed = ISO8601DateFormatter().date(from: value + "T00:00:00Z"), day(parsed) == value else { return nil }
        return parsed
    }

    static func isValidDay(_ value: String) -> Bool { parseDay(value) != nil }

    static func parseTimestamp(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
}

private func normalizedID(_ id: String) -> String {
    id.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
}

private func validModelID(_ id: String) -> Bool {
    !id.isEmpty && id.count <= 300 && !["__proto__", "constructor", "prototype"].contains(id) &&
        id.unicodeScalars.allSatisfy { !CharacterSet.controlCharacters.contains($0) }
}

private func trustedHTTPS(_ source: String?) -> URL? {
    guard let source, let parts = URLComponents(string: source), parts.scheme == "https",
          let host = parts.host, !host.isEmpty, parts.user == nil, parts.password == nil,
          parts.port == nil else { return nil }
    return parts.url
}

private func openAIModel(_ id: String) -> Bool {
    id.range(of: #"^(gpt(?:[-\s\d]|$)|chatgpt|openai[\s/:_-]|o[134](?:[-\s.]|$)|dall[- ]?e)"#, options: .regularExpression) != nil
}

private func providerURL(_ model: String, _ category: ArenaCategory) -> URL? {
    var id = normalizedID(model)
    if id.hasPrefix("models/") { id.removeFirst(7) }
    let scope = AccessScope(category)
    if openAIModel(id) {
        switch scope {
        case .work: return URL(string: "https://chatgpt.com/work/")
        case .code: return URL(string: "https://chatgpt.com/codex/")
        default: return URL(string: "https://chatgpt.com/")
        }
    }
    for (pattern, link) in providerRoutes where id.range(of: pattern, options: .regularExpression) != nil {
        return URL(string: link)
    }
    return nil
}

private let providerRoutes: [(String, String)] = [
    (#"^(claude|anthropic[\s/:_-])"#, "https://claude.ai/new"),
    (#"^(gemini|google[\s/:_-]|gemma|imagen|veo|nano[- ]?banana)"#, "https://gemini.google.com/"),
    (#"^(qwen|qwq|qvq|alibaba[\s/:_-])"#, "https://chat.qwen.ai/"),
    (#"^deepseek"#, "https://chat.deepseek.com/"),
    (#"^(grok|xai[\s/:_-]|x\.ai)"#, "https://grok.com/"),
    (#"^(mistral|mixtral|magistral|ministral|devstral|pixtral|codestral)"#, "https://chat.mistral.ai/"),
    (#"^(kimi|moonshot)"#, "https://www.kimi.com/"),
    (#"^(glm(?:[-\s\d]|$)|zai[\s/:_-]|z\.ai|zhipu|chatglm)"#, "https://chat.z.ai/"),
    (#"^(llama|muse|meta[\s/:_-])"#, "https://www.meta.ai/"),
    (#"^(perplexity|sonar)"#, "https://www.perplexity.ai/"),
    (#"^ideogram"#, "https://ideogram.ai/"),
    (#"^midjourney"#, "https://www.midjourney.com/"),
    (#"^runway"#, "https://app.runwayml.com/"),
    (#"^minimax"#, "https://agent.minimax.io/"),
    (#"^(ernie|baidu)"#, "https://yiyan.baidu.com/"),
    (#"^(hunyuan|hy4)"#, "https://yuanbao.tencent.com/"),
    (#"^(step[- ]?\d|stepfun)"#, "https://stepfun.com/")
]
