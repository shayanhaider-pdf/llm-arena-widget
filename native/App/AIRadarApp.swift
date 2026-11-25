import SwiftUI
import UniformTypeIdentifiers
import WidgetKit

@main
struct AIRadarApp: App {
    var body: some Scene {
        WindowGroup {
            RadarHome()
                .preferredColorScheme(.dark)
        }
    }
}

private struct RadarHome: View {
    private enum Sheet: String, Identifiable {
        case categories, details, widgetHelp

        var id: Self { self }
    }

    private let store: ArenaStore
    @Environment(\.openURL) private var openURL
    @AppStorage("lastViewedCategory") private var selectedKey = ArenaCategory.search.rawValue
    @State private var snapshot: ArenaSnapshot
    @State private var sheet: Sheet?
    @State private var openedFromWidget = false
    @State private var widgetMessage: String?
    @State private var isRefreshing = false
    @State private var isImporting = false
    @State private var importAfterDismiss = false
    @State private var importMessage: String?

    init() {
        let store = ArenaStore()
        self.store = store
        _snapshot = State(initialValue: store.cached())
    }

    private var selected: ArenaCategory { ArenaCategory(rawValue: selectedKey) ?? .search }
    private var board: ArenaCategorySnapshot { snapshot.category(selected) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    categoryButton

                    if let widgetMessage {
                        Label(widgetMessage, systemImage: "info.circle")
                            .font(.subheadline)
                            .foregroundStyle(RadarColor.muted)
                    }

                    if let coverage = board.coverageMessage {
                        Label(coverage, systemImage: "info.circle")
                            .font(.footnote)
                            .foregroundStyle(RadarColor.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(spacing: 10) {
                        ForEach(board.winners, id: \.tier) { winner in
                            WinnerCard(winner: winner)
                        }
                    }

                    VStack(spacing: 0) {
                        Link(destination: selected.officialURL) {
                            Label("View Arena leaderboard", systemImage: "chart.bar.xaxis")
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 12)
                        }

                        Divider().overlay(RadarColor.rule)

                        Button {
                            sheet = .details
                        } label: {
                            Label("Data and access details", systemImage: "info.circle")
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 12)
                        }

                        if !openedFromWidget {
                            Divider().overlay(RadarColor.rule)
                            widgetHelpButton
                        }
                    }
                    .font(.subheadline.weight(.medium))
                    .buttonStyle(.plain)

                    Text("Rankings by Arena")
                        .font(.footnote)
                        .foregroundStyle(RadarColor.muted)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
            .background(RadarColor.background)
            .navigationTitle("AI Radar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await refresh(force: true) }
                    } label: {
                        if isRefreshing {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    .disabled(isRefreshing)
                    .accessibilityLabel("Refresh published data")
                }
            }
            .toolbarBackground(RadarColor.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .tint(RadarColor.mint)
        .task { await refresh(force: false) }
        .onOpenURL(perform: openWidgetURL)
        .sheet(item: $sheet, onDismiss: presentPendingImport) { destination in
            switch destination {
            case .categories:
                CategoryPicker(selection: selected) { category in
                    selectedKey = category.rawValue
                    openedFromWidget = false
                    widgetMessage = nil
                }
            case .details:
                RadarDetails(category: selected, board: board, snapshot: snapshot) {
                    importAfterDismiss = true
                    sheet = nil
                }
            case .widgetHelp:
                WidgetHelp(openedFromWidget: openedFromWidget)
                    .presentationDetents([.medium, .large])
            }
        }
        .fileImporter(isPresented: $isImporting, allowedContentTypes: [.json], onCompletion: importSettings)
        .alert("Scriptable settings", isPresented: Binding(
            get: { importMessage != nil },
            set: { if !$0 { importMessage = nil } }
        )) {
            Button("OK", role: .cancel) { importMessage = nil }
        } message: {
            Text(importMessage ?? "")
        }
    }

    private var categoryButton: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                if openedFromWidget {
                    sheet = .widgetHelp
                } else {
                    sheet = .categories
                }
            } label: {
                HStack(spacing: 13) {
                    Image(systemName: selected.section.icon)
                        .font(.body.weight(.semibold))
                        .frame(width: 42, height: 42)
                        .background(RadarColor.mint.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(RadarColor.mint)
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(openedFromWidget ? "Home Screen category" : "Choose a category")
                            .font(.subheadline)
                            .foregroundStyle(RadarColor.muted)
                        Text(selected.title)
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(.primary)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: openedFromWidget ? "info.circle" : "chevron.up.chevron.down")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(RadarColor.mint)
                        .accessibilityHidden(true)
                }
                .padding(15)
                .background(RadarColor.card, in: RoundedRectangle(cornerRadius: 20))
                .overlay {
                    RoundedRectangle(cornerRadius: 20).strokeBorder(RadarColor.mint.opacity(0.24))
                }
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(openedFromWidget ? "Edit Home Screen widget" : "Choose a category")
            .accessibilityValue(selected.title)

            if openedFromWidget {
                Button("Browse other categories") { sheet = .categories }
                    .font(.subheadline.weight(.medium))
                    .padding(.vertical, 6)
            }
        }
    }

    private var widgetHelpButton: some View {
        Button {
            sheet = .widgetHelp
        } label: {
            Label("Home Screen widget setup", systemImage: "rectangle.grid.2x2")
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 12)
        }
    }

    @MainActor
    private func refresh(force: Bool) async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        snapshot = await store.load(force: force)
        if force {
            WidgetCenter.shared.reloadAllTimelines()
            sheet = .details
        }
    }

    private func importSettings(_ result: Result<URL, Error>) {
        do {
            let url = try result.get()
            let hasAccess = url.startAccessingSecurityScopedResource()
            defer { if hasAccess { url.stopAccessingSecurityScopedResource() } }
            let summary = try store.importScriptableSettings(Data(contentsOf: url))
            snapshot = store.cached()
            WidgetCenter.shared.reloadAllTimelines()
            var lines = ["Imported \(summary.overridesImported) model overrides for chat categories."]
            if !summary.largeCategories.isEmpty {
                let categories = summary.largeCategories.map(\.title).joined(separator: ", ")
                lines.append("To recreate your board, use Edit Widget and select these rows in order. \(categories).")
            }
            importMessage = lines.joined(separator: "\n\n")
        } catch {
            importMessage = "The settings file couldn’t be imported. Choose AI-Radar/settings.json from Scriptable."
        }
    }

    private func presentPendingImport() {
        guard importAfterDismiss else { return }
        importAfterDismiss = false
        isImporting = true
    }

    private func openWidgetURL(_ url: URL) {
        let route = ArenaModelRoute(url: url)
        guard let category = route?.category ?? ArenaCategory(detailURL: url) else { return }
        selectedKey = category.rawValue
        openedFromWidget = true
        sheet = nil
        widgetMessage = nil
        snapshot = store.cached()

        guard let route else { return }
        if let winner = snapshot.category(category).winners.first(where: {
            $0.tier == route.tier && $0.model?.id == route.modelID
        }), let destination = winner.destination {
            openURL(destination)
        } else {
            widgetMessage = "This widget’s ranking has changed. Choose from the current models below."
        }
    }
}

private struct WinnerCard: View {
    let winner: ArenaWinner

    var body: some View {
        Group {
            if let destination = winner.destination, winner.model != nil {
                Link(destination: destination) { content }
                    .accessibilityHint("Opens the provider or Arena")
            } else {
                content
            }
        }
        .buttonStyle(.plain)
    }

    private var content: some View {
        HStack(spacing: 14) {
            if let model = winner.model {
                Text("#\(model.rank)")
                    .font(.title2.weight(.bold).monospacedDigit())
                    .foregroundStyle(winner.tier.accent)
                    .frame(minWidth: 52)
                    .accessibilityLabel("Arena rank \(model.rank)")
            } else {
                Image(systemName: "minus")
                    .foregroundStyle(RadarColor.muted)
                    .frame(minWidth: 52)
                    .accessibilityHidden(true)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(winner.tier.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(winner.tier.accent)
                Text(winner.displayName ?? "No supported match")
                    .font(.body.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
                if winner.isUnconfirmed {
                    Text("Access unconfirmed")
                        .font(.footnote)
                        .foregroundStyle(RadarColor.muted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if winner.destination != nil {
                Image(systemName: "arrow.up.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(RadarColor.muted)
                    .accessibilityHidden(true)
            }
        }
        .frame(minHeight: 58)
        .padding(13)
        .background(RadarColor.card, in: RoundedRectangle(cornerRadius: 16))
        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(RadarColor.rule) }
        .accessibilityElement(children: .combine)
    }
}

private struct CategoryPicker: View {
    let selection: ArenaCategory
    let onSelect: (ArenaCategory) -> Void
    @State private var query = ""
    @Environment(\.dismiss) private var dismiss

    private func categories(in section: ArenaCategory.Section) -> [ArenaCategory] {
        let search = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return ArenaCategory.allCases.filter { category in
            category.section == section && (search.isEmpty || category.title.localizedStandardContains(search)
                || section.rawValue.localizedStandardContains(search))
        }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(ArenaCategory.Section.allCases) { section in
                    let matches = categories(in: section)
                    if !matches.isEmpty {
                        Section(section.rawValue) {
                            ForEach(matches) { category in
                                Button {
                                    onSelect(category)
                                    dismiss()
                                } label: {
                                    HStack {
                                        Text(category.title).foregroundStyle(.primary)
                                        Spacer()
                                        if category == selection {
                                            Image(systemName: "checkmark")
                                                .foregroundStyle(RadarColor.mint)
                                                .accessibilityHidden(true)
                                        }
                                    }
                                    .frame(minHeight: 28)
                                }
                                .accessibilityAddTraits(category == selection ? .isSelected : [])
                            }
                        }
                    }
                }
            }
            .overlay {
                if ArenaCategory.Section.allCases.allSatisfy({ categories(in: $0).isEmpty }) {
                    ContentUnavailableView.search(text: query)
                }
            }
            .navigationTitle("Categories")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Find a category")
        }
    }
}

private struct RadarDetails: View {
    let category: ArenaCategory
    let board: ArenaCategorySnapshot
    let snapshot: ArenaSnapshot
    let onImport: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section(category.title) {
                    if let description = category.summary { Text(description) }
                    if let coverage = board.coverageMessage { Text(coverage) }
                    if let date = board.publicationDate {
                        LabeledContent("Arena publication", value: date.formatted(.iso8601.year().month().day().dateSeparator(.dash)))
                    }
                    Link("Official Arena leaderboard", destination: category.officialURL)
                    if let source = board.sourceURL, source != category.officialURL {
                        Link("Ranking data source", destination: source)
                    }
                }

                Section("Model access") {
                    Text("Frontier shows the highest Arena rank in the available data. ChatGPT Plus and Free use reviewed consumer access for the category’s mode. Unconfirmed access is marked with a question mark on the widget.")
                    Text("Provider links open the product. You may need to choose the model in that product.")
                    if let date = snapshot.accessReviewedAt {
                        LabeledContent("Registry review", value: date.formatted(.iso8601.year().month().day().dateSeparator(.dash)))
                    }
                    ForEach(board.winners, id: \.tier) { winner in
                        if winner.model != nil, winner.tier != .frontier {
                            VStack(alignment: .leading, spacing: 7) {
                                Text(winner.tier.title).font(.subheadline.bold())
                                if let notes = winner.notes, !notes.isEmpty { Text(notes).font(.subheadline) }
                                if let evidence = winner.evidenceURL { Link("Access evidence", destination: evidence) }
                            }
                        }
                    }
                }

                Section("Feed status") {
                    Text(snapshot.state)
                    Text("The GitHub collector checks Arena monthly. The app and widget use their last valid data when a refresh fails.")
                }

                Section("Scriptable migration") {
                    Button("Import model overrides") { onImport() }
                    Text("Choose the settings.json file from Scriptable. Set each widget’s categories once through Edit Widget.")
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Ranking details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}

private struct WidgetHelp: View {
    let openedFromWidget: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if !openedFromWidget {
                    Label("Add AI Radar from your Home Screen’s widget gallery. Choose AI Radar Board for the large layout.",
                          systemImage: "plus.rectangle.on.rectangle")
                }
                Label("Touch and hold the widget you want to change, then tap Edit Widget. Choose a category or pick the rows for that board.",
                      systemImage: "hand.tap")
                Label("Each widget remembers its own choices. iOS refreshes the Home Screen on its timeline.",
                      systemImage: "checkmark.circle")
            }
            .navigationTitle("Home Screen widgets")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}

private enum RadarColor {
    static let background = Color(red: 0.06, green: 0.07, blue: 0.09)
    static let card = Color(red: 0.11, green: 0.12, blue: 0.15)
    static let rule = Color.white.opacity(0.10)
    static let muted = Color(red: 0.67, green: 0.70, blue: 0.75)
    static let mint = Color(red: 0.57, green: 0.90, blue: 0.75)
}

private extension ArenaTier {
    var accent: Color {
        switch self {
        case .frontier: Color(red: 0.78, green: 0.70, blue: 0.99)
        case .plus: RadarColor.mint
        case .free: Color(red: 0.61, green: 0.79, blue: 0.99)
        }
    }
}
