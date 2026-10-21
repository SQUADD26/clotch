import SwiftUI

/// Static stand-ins for the six notch elements, drawn only in the settings (Figma #95): 11 pt text, 12 pt rings and dots.
/// `chip` puts one alone on its black tile (the palette of «Personalizza il notch»).
struct NotchElementSample: View {
    let element: NotchElement
    var chip = true

    var body: some View {
        if chip {
            content.padding(.horizontal, 10).frame(height: 28)
                .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(.black))
        } else {
            content
        }
    }

    private var content: some View {
        Group {
            switch element {
            case .goalRings:
                HStack(spacing: 3) { ring(.green, 1); ring(.orange, 0.6); ring(.blue, 0.8) }
            case .activeGoal:
                HStack(spacing: 6) { Text("Login sistemato"); Text("12:40").foregroundStyle(.white.opacity(0.6)) }
            case .accounts:
                HStack(spacing: 3) { dot(.purple); dot(.cyan) }
            case .accountsWide:
                HStack(spacing: 6) {
                    dot(.purple); Text("privato 42%")
                    dot(.cyan); Text("squadd 18%")
                }
            case .pendingRequests:
                Text("2").font(.system(size: 11, weight: .semibold)).foregroundStyle(.black)
                    .padding(.horizontal, 5).frame(height: 15).background(Capsule().fill(.orange))
            case .workingSessions:
                Text(String(format: L10n.shared["notch_sample_working"], 3)).foregroundStyle(.white.opacity(0.8))
            }
        }
        .font(.system(size: 11))
        .foregroundStyle(.white)
    }

    private func ring(_ color: Color, _ progress: Double) -> some View {
        ZStack {
            Circle().stroke(.white.opacity(0.2), lineWidth: 2)
            Circle().trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: 12, height: 12)
    }

    private func dot(_ color: Color) -> some View { Circle().fill(color).frame(width: 12, height: 12) }
}

/// The closed notch as the settings show it: black, square on top, rounded under, elements on each side.
struct ClosedNotchPreview: View {
    let layout: NotchScreenLayout
    var width: CGFloat = 334
    var height: CGFloat = 34

    var body: some View {
        HStack(spacing: 0) {
            side(.left)
            Spacer(minLength: 12)
            side(.centre)
            Spacer(minLength: 12)
            side(.right)
        }
        .padding(.horizontal, 12)
        .frame(width: width, height: height)
        .background(UnevenRoundedRectangle(bottomLeadingRadius: 10, bottomTrailingRadius: 10, style: .continuous).fill(.black))
    }

    private func side(_ zone: NotchZone) -> some View {
        HStack(spacing: 6) {
            ForEach(layout.elements(in: zone), id: \.self) { NotchElementSample(element: $0, chip: false) }
        }
    }
}
