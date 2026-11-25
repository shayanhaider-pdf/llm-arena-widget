import Foundation
#if canImport(AppIntents)
import AppIntents
#endif

enum ArenaCategory: String, CaseIterable, Identifiable, Sendable {
    case agent, alignment, work, coding, chatagent, taskoutcome, steering, tooluse
    case text, search, vision, documents
    case webdev, imagewebdev
    case image, editing, multiedit
    case video, imagevideo, videoedit
    case reasoning, writing, instruction

    enum Section: String, CaseIterable, Identifiable, Sendable {
        case agent = "Agent"
        case chat = "Chat"
        case code = "Code"
        case image = "Image"
        case video = "Video"
        case specialties = "Text specialties"

        var id: Self { self }

        var icon: String {
            switch self {
            case .agent: "cpu"
            case .chat: "bubble.left"
            case .code: "chevron.left.forwardslash.chevron.right"
            case .image: "photo"
            case .video: "film"
            case .specialties: "text.alignleft"
            }
        }
    }

    var id: Self { self }

    var section: Section {
        switch self {
        case .agent, .alignment, .work, .coding, .chatagent, .taskoutcome, .steering, .tooluse: .agent
        case .text, .search, .vision, .documents: .chat
        case .webdev, .imagewebdev: .code
        case .image, .editing, .multiedit: .image
        case .video, .imagevideo, .videoedit: .video
        case .reasoning, .writing, .instruction: .specialties
        }
    }

    var title: String {
        switch self {
        case .agent: "Agent Overall"
        case .alignment: "Alignment"
        case .work: "Work Capability"
        case .coding: "Agent Coding"
        case .chatagent: "Agent Chat"
        case .taskoutcome: "Task Outcome"
        case .steering: "Steering"
        case .tooluse: "Tool Use"
        case .text: "Overall Text"
        case .search: "Search"
        case .vision: "Vision"
        case .documents: "Documents"
        case .webdev: "WebDev"
        case .imagewebdev: "Image-to-WebDev"
        case .image: "Image Generation"
        case .editing: "Single Image Edit"
        case .multiedit: "Multi Image Edit"
        case .video: "Video Generation"
        case .imagevideo: "Image-to-Video"
        case .videoedit: "Video Editing"
        case .reasoning: "Reasoning"
        case .writing: "Creative Writing"
        case .instruction: "Instruction Following"
        }
    }

    var compactTitle: String {
        switch self {
        case .work: "Work"
        case .text: "Text"
        case .image: "Text to image"
        case .editing: "Single edit"
        case .multiedit: "Multi edit"
        case .video: "Text to video"
        case .instruction: "Instructions"
        default: title
        }
    }

    var sourceKey: String {
        switch self {
        case .agent: "agent_capability:overall"
        case .alignment: "agent_alignment:overall"
        case .work: "agent_capability:work"
        case .coding: "agent_capability:code"
        case .chatagent: "agent_capability:chat"
        case .taskoutcome: "agent_task_outcome:overall"
        case .steering: "agent_steerability:overall"
        case .tooluse: "agent_tool_efficiency:overall"
        case .text: "text_style_control:overall"
        case .search: "search:overall"
        case .vision: "vision_style_control:overall"
        case .documents: "document_style_control:overall"
        case .webdev: "webdev:overall"
        case .imagewebdev: "webdev:image_to_webdev"
        case .image: "text_to_image:overall"
        case .editing: "image_edit:overall"
        case .multiedit: "image_edit:multi_image_edit"
        case .video: "text_to_video:overall"
        case .imagevideo: "image_to_video:overall"
        case .videoedit: "video_edit:overall"
        case .reasoning: "text_style_control:hard_prompts"
        case .writing: "text_style_control:creative_writing"
        case .instruction: "text_style_control:instruction_following"
        }
    }

    var officialURL: URL {
        let path: String
        switch self {
        case .agent: path = "agent"
        case .alignment: path = "agent/alignment"
        case .work: path = "agent/work"
        case .coding: path = "agent/code"
        case .chatagent: path = "agent/chat"
        case .taskoutcome: path = "agent/task-feedback"
        case .steering: path = "agent/steerability"
        case .tooluse: path = "agent/tool-efficiency"
        case .text: path = "chat/text"
        case .search: path = "chat/search"
        case .vision: path = "chat/vision"
        case .documents: path = "chat/document"
        case .webdev: path = "code"
        case .imagewebdev: path = "code/image-to-webdev"
        case .image: path = "image/text-to-image"
        case .editing: path = "image/image-edit/single-image"
        case .multiedit: path = "image/image-edit/multi-image"
        case .video: path = "video/text-to-video"
        case .imagevideo: path = "video/image-to-video"
        case .videoedit: path = "video/video-edit"
        case .reasoning: path = "chat/text/hard-prompts"
        case .writing: path = "chat/text/creative-writing"
        case .instruction: path = "chat/text/instruction-following"
        }
        return URL(string: "https://arena.ai/leaderboard/\(path)")!
    }

    var summary: String? {
        switch self {
        case .reasoning: "Uses Arena’s Hard Prompts text leaderboard as a proxy for reasoning."
        case .work: "Uses the Work category on Arena’s Agent Capability leaderboard."
        default: nil
        }
    }

    var detailURL: URL { URL(string: "airadar://category/\(rawValue)")! }

    init?(detailURL: URL) {
        guard detailURL.scheme == "airadar", detailURL.host == "category",
              detailURL.pathComponents.count == 2 else { return nil }
        self.init(rawValue: detailURL.lastPathComponent)
    }
}

struct ArenaModelRoute {
    let category: ArenaCategory
    let tier: ArenaTier
    let modelID: String

    var url: URL {
        var components = URLComponents()
        components.scheme = "airadar"
        components.host = "model"
        components.path = "/\(category.rawValue)/\(tier.rawValue)"
        components.queryItems = [URLQueryItem(name: "id", value: modelID)]
        return components.url ?? category.detailURL
    }

    init(category: ArenaCategory, tier: ArenaTier, modelID: String) {
        self.category = category
        self.tier = tier
        self.modelID = modelID
    }

    init?(url: URL) {
        guard url.scheme == "airadar", url.host == "model",
              url.user == nil, url.password == nil, url.port == nil, url.fragment == nil,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let query = components.queryItems, query.count == 1, query[0].name == "id",
              let id = query[0].value, !id.isEmpty, id.utf8.count <= 1_024 else { return nil }
        let path = url.pathComponents
        guard path.count == 3, let category = ArenaCategory(rawValue: path[1]),
              let tier = ArenaTier(rawValue: path[2]) else { return nil }
        self.init(category: category, tier: tier, modelID: id)
    }
}

#if canImport(AppIntents)
extension ArenaCategory: AppEnum {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Radar Category"

    static let caseDisplayRepresentations: [ArenaCategory: DisplayRepresentation] = [
        .agent: "Agent Overall",
        .alignment: "Alignment",
        .work: "Work Capability",
        .coding: "Agent Coding",
        .chatagent: "Agent Chat",
        .taskoutcome: "Task Outcome",
        .steering: "Steering",
        .tooluse: "Tool Use",
        .text: "Overall Text",
        .search: "Search",
        .vision: "Vision",
        .documents: "Documents",
        .webdev: "WebDev",
        .imagewebdev: "Image-to-WebDev",
        .image: "Image Generation",
        .editing: "Single Image Edit",
        .multiedit: "Multi Image Edit",
        .video: "Video Generation",
        .imagevideo: "Image-to-Video",
        .videoedit: "Video Editing",
        .reasoning: "Reasoning",
        .writing: "Creative Writing",
        .instruction: "Instruction Following"
    ]
}
#endif
