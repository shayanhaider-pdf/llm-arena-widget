import SwiftUI
import WidgetKit

struct RadarWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var renderingMode
    @Environment(\.showsWidgetContainerBackground) private var showsContainerBackground
    @ScaledMetric(relativeTo: .caption) private var typeScale: CGFloat = 1

    let entry: RadarWidgetEntry

    var body: some View {
        Group {
            if family == .systemLarge {
                board
            } else if let row = entry.rows.first {
                if family == .systemSmall {
                    small(row)
                        .widgetURL(row.category.detailURL)
                } else {
                    medium(row)
                        .widgetURL(row.category.detailURL)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
            if isFullColor {
                LinearGradient(
                    colors: [
                        Color(red: 0.15, green: 0.17, blue: 0.21),
                        Color(red: 0.08, green: 0.09, blue: 0.11)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            } else {
                Color.clear
            }
        }
    }

    private var isFullColor: Bool { renderingMode == .fullColor }
    private var hasGraphiteBackground: Bool { isFullColor && showsContainerBackground }
    private var ink: Color { hasGraphiteBackground ? Color(white: 0.96) : .primary }
    private var muted: Color { hasGraphiteBackground ? Color(red: 0.70, green: 0.74, blue: 0.79) : .secondary }
    private var rule: Color { hasGraphiteBackground ? .white.opacity(0.12) : .primary.opacity(0.18) }

    private func accent(_ tier: ArenaTier) -> Color {
        guard hasGraphiteBackground else { return .primary }
        switch tier {
        case .frontier: return Color(red: 0.79, green: 0.69, blue: 1)
        case .plus: return Color(red: 0.57, green: 0.93, blue: 0.79)
        case .free: return Color(red: 0.58, green: 0.80, blue: 1)
        }
    }

    private var separator: some View {
        Rectangle()
            .fill(rule)
            .frame(height: 0.5)
            .accessibilityHidden(true)
    }

    private func small(_ row: RadarWidgetEntry.Row) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Text(row.category.title)
                    .font(.system(size: 16 * min(typeScale, 1.12), weight: .bold))
                    .foregroundStyle(ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.70)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                Image(systemName: "scope")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(muted)
                    .accessibilityHidden(true)
            }
            .padding(.bottom, 5)

            ForEach(row.winners.indices, id: \.self) { index in
                let winner = row.winners[index]
                separator
                HStack(spacing: 7) {
                    VStack(alignment: .leading, spacing: 1) {
                        rank(winner, size: 15)
                        Text(winner.tier == .plus ? "Plus" : winner.tier.title)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(muted)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(width: 41, alignment: .leading)
                    modelName(winner, size: 11)
                    Spacer(minLength: 0)
                }
                .frame(maxHeight: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(spoken(winner)))
            }
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 10)
    }

    private func medium(_ row: RadarWidgetEntry.Row) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(row.category.title)
                    .font(.system(size: 19 * min(typeScale, 1.12), weight: .bold))
                    .foregroundStyle(ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                Link(destination: row.category.detailURL) {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(muted)
                        .frame(width: 30, height: 28)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(Text("View \(row.category.title) details"))
            }
            HStack(spacing: 6) {
                ForEach(row.winners.indices, id: \.self) { index in
                    let winner = row.winners[index]
                    modelLink(winner, category: row.category) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(winner.tier.title)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(muted)
                                .lineLimit(1)
                                .minimumScaleFactor(0.72)
                            rank(winner, size: 24)
                            modelName(winner, size: 12)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                        .background {
                            if hasGraphiteBackground {
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(.white.opacity(0.035))
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 10)
                                            .strokeBorder(rule, lineWidth: 0.5)
                                    }
                            }
                        }
                        .contentShape(Rectangle())
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(Text(spoken(winner)))
                    }
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    private var board: some View {
        GeometryReader { geometry in
            if entry.rows.isEmpty {
                VStack(spacing: 6) {
                    Text("No categories selected")
                        .font(.headline)
                        .foregroundStyle(ink)
                    Text("Long-press and choose Edit Widget.")
                        .font(.caption)
                        .foregroundStyle(muted)
                }
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                let labelWidth = min(84, geometry.size.width * 0.24)
                let cellWidth = max(0, (geometry.size.width - labelWidth - 18) / 3)
                let rowHeight = min(58, max(0, (geometry.size.height - 30) / CGFloat(entry.rows.count)))
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 6) {
                        Color.clear
                            .frame(width: labelWidth, height: 1)
                            .accessibilityHidden(true)
                        tierHeading(.frontier, width: cellWidth)
                        tierHeading(.plus, width: cellWidth)
                        tierHeading(.free, width: cellWidth)
                    }
                    .padding(.bottom, 8)
                    ForEach(entry.rows.indices, id: \.self) { index in
                        separator
                        boardRow(entry.rows[index], labelWidth: labelWidth, cellWidth: cellWidth)
                            .frame(height: rowHeight)
                    }
                }
            }
        }
        .padding(12)
    }

    private func tierHeading(_ tier: ArenaTier, width: CGFloat) -> some View {
        Text(tier.title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(accent(tier))
            .lineLimit(1)
            .minimumScaleFactor(0.72)
            .frame(width: width, alignment: .leading)
            .accessibilityHidden(true)
    }

    private func boardRow(_ row: RadarWidgetEntry.Row, labelWidth: CGFloat, cellWidth: CGFloat) -> some View {
        HStack(spacing: 6) {
            Link(destination: row.category.detailURL) {
                Text(row.category.compactTitle)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ink)
                    .lineLimit(2)
                    .minimumScaleFactor(0.76)
                    .frame(width: labelWidth, alignment: .leading)
                    .frame(maxHeight: .infinity)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(Text("View \(row.category.title) details"))
            ForEach(row.winners.indices, id: \.self) { index in
                let winner = row.winners[index]
                modelLink(winner, category: row.category) {
                    VStack(alignment: .leading, spacing: 2) {
                        rank(winner, size: 15)
                        modelName(winner, size: 10)
                    }
                    .frame(width: cellWidth, alignment: .leading)
                    .frame(maxHeight: .infinity)
                    .contentShape(Rectangle())
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(Text("\(row.category.title), \(spoken(winner))"))
                }
            }
        }
    }

    @ViewBuilder
    private func modelLink<Content: View>(
        _ winner: ArenaWinner,
        category: ArenaCategory,
        @ViewBuilder content: () -> Content
    ) -> some View {
        if let model = winner.model, winner.destination != nil {
            let route = ArenaModelRoute(category: category, tier: winner.tier, modelID: model.id)
            Link(destination: route.url, label: content)
                .buttonStyle(.plain)
        } else {
            content()
        }
    }

    private func rank(_ winner: ArenaWinner, size: CGFloat) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text(winner.model.map { "#\($0.rank)" } ?? "—")
                .font(.system(size: size, weight: .bold, design: .monospaced))
                .foregroundStyle(winner.model == nil ? muted : accent(winner.tier))
                .widgetAccentable(winner.model != nil)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
            if winner.isUnconfirmed {
                Text("?")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(muted)
            }
        }
    }

    private func modelName(_ winner: ArenaWinner, size: CGFloat) -> some View {
        Text(winner.displayName ?? "Unavailable")
            .font(.system(size: size * min(typeScale, 1.15), weight: .semibold))
            .foregroundStyle(winner.model == nil ? muted : ink)
            .lineLimit(2)
            .minimumScaleFactor(0.76)
    }

    private func spoken(_ winner: ArenaWinner) -> String {
        guard let model = winner.model else { return "\(winner.tier.title), unavailable" }
        let status = winner.isUnconfirmed ? ", access unconfirmed" : ""
        return "\(winner.tier.title), rank \(model.rank), \(winner.displayName ?? model.id)\(status)"
    }
}
