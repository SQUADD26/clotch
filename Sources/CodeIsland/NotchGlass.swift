import SwiftUI

// Liquid Glass for the notch: the real glassEffect on macOS 26+, a quiet stand-in elsewhere.
// The island itself stays black (it continues the hardware notch, as the Dynamic Island does):
// glass is the material of the plates inside it, over a backdrop that never changes, so text
// contrast holds whatever the wallpaper is.

private struct NotchSnapshotKey: EnvironmentKey { static let defaultValue = false }

extension EnvironmentValues {
    /// True inside `--snapshot`: ImageRenderer cannot sample a backdrop, so plates draw the stand-in.
    var notchSnapshot: Bool {
        get { self[NotchSnapshotKey.self] }
        set { self[NotchSnapshotKey.self] = newValue }
    }
}

private struct GlassPlate: ViewModifier {
    let radius: CGFloat
    let tint: Color?
    @Environment(\.notchSnapshot) private var snapshot

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if snapshot {
            standIn(content)
        } else if #available(macOS 26, *) {
            content.glassEffect(tint.map { Glass.regular.tint($0) } ?? Glass.regular, in: .rect(cornerRadius: radius))
        } else {
            standIn(content)
        }
        #else
        standIn(content)
        #endif
    }

    /// Glass without a backdrop: a lifted plate and its lit top edge, the tint as a wash.
    private func standIn(_ content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return content.background {
            shape.fill(Color.white.opacity(0.075))
                .overlay { shape.fill((tint ?? .clear).opacity(0.5)) }
                .overlay {
                    shape.strokeBorder(LinearGradient(colors: [.white.opacity(0.22), .white.opacity(0.04)],
                                                      startPoint: .top, endPoint: .bottom), lineWidth: 0.5)
                }
        }
    }
}

/// Groups plates so the system renders them in one pass and lets them merge and morph.
struct GlassGroup<Content: View>: View {
    var spacing: CGFloat = 8
    @ViewBuilder var content: Content
    @Environment(\.notchSnapshot) private var snapshot

    var body: some View {
        #if compiler(>=6.2)
        if snapshot {
            content
        } else if #available(macOS 26, *) {
            GlassEffectContainer(spacing: spacing) { content }
        } else {
            content
        }
        #else
        content
        #endif
    }
}

extension View {
    /// `tint` already carries its opacity: glass tints suggest state, never paint it.
    func glassPlate(radius: CGFloat, tint: Color? = nil) -> some View {
        modifier(GlassPlate(radius: radius, tint: tint))
    }

    /// Identity for morphing between plates inside one GlassGroup.
    @ViewBuilder func glassID(_ id: String, in namespace: Namespace.ID) -> some View {
        #if compiler(>=6.2)
        if #available(macOS 26, *) { glassEffectID(id, in: namespace) } else { self }
        #else
        self
        #endif
    }
}
