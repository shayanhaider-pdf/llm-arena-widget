import AppIntents
import SwiftUI
import WidgetKit

struct RadarCategoryIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "AI Radar Category"
    static let description = IntentDescription("Choose which Arena leaderboard this widget shows.")

    @Parameter(title: "Category", default: .search)
    var category: ArenaCategory

    static var parameterSummary: some ParameterSummary {
        Summary("Show \(\.$category)")
    }
}

struct RadarBoardIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "AI Radar Board"
    static let description = IntentDescription("Choose up to five Arena categories in display order.")

    @Parameter(title: "Use Default Rows", default: false)
    var useDefaultRows: Bool

    @Parameter(title: "Row 1", default: .work)
    var row1: ArenaCategory?

    @Parameter(title: "Row 2", default: .text)
    var row2: ArenaCategory?

    @Parameter(title: "Row 3", default: .documents)
    var row3: ArenaCategory?

    @Parameter(title: "Row 4", default: .search)
    var row4: ArenaCategory?

    @Parameter(title: "Row 5", default: .image)
    var row5: ArenaCategory?

    static var parameterSummary: some ParameterSummary {
        When(\.$useDefaultRows, .equalTo, true) {
            Summary("Show default categories") {
                \.$useDefaultRows
            }
        } otherwise: {
            Summary("Choose categories in display order") {
                \.$row1
                \.$row2
                \.$row3
                \.$row4
                \.$row5
                \.$useDefaultRows
            }
        }
    }

    static let defaultCategories: [ArenaCategory] = [.work, .text, .documents, .search, .image]

    var categories: [ArenaCategory] {
        if useDefaultRows {
            return Self.defaultCategories
        }
        return [row1, row2, row3, row4, row5].compactMap { $0 }
    }
}

struct RadarWidgetEntry: TimelineEntry {
    struct Row {
        let category: ArenaCategory
        let winners: [ArenaWinner]
    }

    let date = Date.now
    let rows: [Row]

    init(_ categories: [ArenaCategory], snapshot: ArenaSnapshot) {
        rows = categories.map { Row(category: $0, winners: snapshot.category($0).winners) }
    }
}

private func radarTimeline(_ categories: [ArenaCategory]) async -> Timeline<RadarWidgetEntry> {
    let snapshot = await ArenaStore().load()
    let entry = RadarWidgetEntry(categories, snapshot: snapshot)
    // The shared store handles the daily fetch policy. A later timeline can retry offline failures.
    return Timeline(entries: [entry], policy: .after(entry.date.addingTimeInterval(6 * 60 * 60)))
}

private struct RadarCategoryProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> RadarWidgetEntry {
        RadarWidgetEntry([.search], snapshot: ArenaStore().cached())
    }

    func snapshot(for configuration: RadarCategoryIntent, in context: Context) async -> RadarWidgetEntry {
        RadarWidgetEntry([configuration.category], snapshot: ArenaStore().cached())
    }

    func timeline(for configuration: RadarCategoryIntent, in context: Context) async -> Timeline<RadarWidgetEntry> {
        await radarTimeline([configuration.category])
    }
}

private struct RadarBoardProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> RadarWidgetEntry {
        RadarWidgetEntry(RadarBoardIntent.defaultCategories, snapshot: ArenaStore().cached())
    }

    func snapshot(for configuration: RadarBoardIntent, in context: Context) async -> RadarWidgetEntry {
        RadarWidgetEntry(configuration.categories, snapshot: ArenaStore().cached())
    }

    func timeline(for configuration: RadarBoardIntent, in context: Context) async -> Timeline<RadarWidgetEntry> {
        await radarTimeline(configuration.categories)
    }
}

struct RadarCategoryWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "AIRadar.category", intent: RadarCategoryIntent.self, provider: RadarCategoryProvider()) {
            RadarWidgetView(entry: $0)
        }
        .configurationDisplayName("AI Radar")
        .description("Compare the Frontier, ChatGPT Plus and Free leaders for one Arena category.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

struct RadarBoardWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "AIRadar.board", intent: RadarBoardIntent.self, provider: RadarBoardProvider()) {
            RadarWidgetView(entry: $0)
        }
        .configurationDisplayName("AI Radar Board")
        .description("Compare AI models across up to five Arena categories of your choice.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}

@main
struct AIRadarWidgetBundle: WidgetBundle {
    var body: some Widget {
        RadarCategoryWidget()
        RadarBoardWidget()
    }
}
