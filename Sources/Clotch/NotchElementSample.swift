import SwiftUI

/// Static stand-ins for the six notch elements, drawn only inside the customize window.
struct NotchElementSample: View {
    let element: NotchElement

    var body: some View {
        content
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .frame(height: 26)
            .background(Capsule().fill(.black))
    }

    @ViewBuilder private var content: some View {
        switch element {
        case .goalRings:
            HStack(spacing: 4) {
                ring(.yellow, 0.7); ring(.green, 1); ring(.green, 1); ring(.gray, 0)
            }
        case .activeGoal:
            HStack(spacing: 6) {
                Text("Notch: goal")
                Image(systemName: "timer")
                Text("2:04:17").monospacedDigit().foregroundStyle(.white.opacity(0.8))
            }
        case .accounts:
            HStack(spacing: 3) {
                bar(.green, 0.3); bar(.yellow, 0.6); bar(.yellow, 0.6)
            }
        case .accountsWide:
            HStack(spacing: 5) {
                ring(.green, 0.25)
                Text("claudesquadd1").font(.system(size: 11)).foregroundStyle(.white.opacity(0.85))
                Text("25%").foregroundStyle(.green)
                Text("+2").foregroundStyle(.white.opacity(0.6))
            }
        case .pendingRequests:
            HStack(spacing: 5) { Image(systemName: "tray"); Text("6") }
        case .workingSessions:
            HStack(spacing: 5) { Image(systemName: "terminal"); Text("2") }
        }
    }

    private func ring(_ color: Color, _ progress: Double) -> some View {
        ZStack {
            Circle().stroke(.white.opacity(0.2), lineWidth: 2)
            Circle().trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: 14, height: 14)
    }

    private func bar(_ color: Color, _ fill: Double) -> some View {
        ZStack(alignment: .bottom) {
            Capsule().fill(.white.opacity(0.2))
            Capsule().fill(color).frame(height: 16 * fill)
        }
        .frame(width: 6, height: 16)
    }
}
