import SwiftUI
import ClotchCore

/// The pill under the notch while Roberto speaks to Clotch (#110), as drawn in Figma: «Parla pure» → «Ti ascolto» with the level
/// bars → his words as they come (three lines at most, the oldest fades out) → «Invio all’Overseer» with «Annulla · 2» → or an error
/// with the move that fixes it. Same black as the notch notes, 440 pt wide (`NotchSize.note`).
struct VoiceInputPill: View {
    @ObservedObject var input: VoiceInputController

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            if showsText { liveText }
            if case .failure(let why) = input.phase { failure(why) }
        }
        .padding(.horizontal, 24)
        .padding(.top, 14)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, minHeight: 42, alignment: .topLeading)
        .accessibilityElement(children: .combine)
    }

    private var showsText: Bool {
        switch input.phase {
        case .listening, .finishing, .thinking, .sending: return !input.text.isEmpty
        default: return false
        }
    }

    // MARK: - Header row

    @ViewBuilder private var header: some View {
        switch input.phase {
        case .ready:
            row(mic(0.55), "Parla pure") {
                KeyCap("esc")
                Button("annulla") { input.cancel() }.buttonStyle(PillText())
            }
        case .listening where input.text.isEmpty:
            row(mic(1), "Ti ascolto") {
                Bars(levels: input.levels, height: 22)
                Spacer(minLength: 8)
                Elapsed(since: input.startedAt)
            }
        case .listening, .finishing:
            row(mic(1), "Trascrivo") {
                Bars(levels: Array(input.levels.suffix(4)), height: 12)
                Spacer(minLength: 8)
                Text(input.engineLabel).font(NotchType.small).foregroundStyle(Color.white.opacity(0.5))
            }
        case .thinking:
            row(Image(systemName: "ellipsis").font(.system(size: 15)).foregroundStyle(GoalInk.secondary), "Penso…") { EmptyView() }
        case .sending:
            row(mic(0.45), "Invio all’Overseer") {
                CancelButton(since: input.sendingSince, seconds: VoiceInputController.cancelSeconds) { input.cancel() }
            }
        case .result(let message):
            // An answer is read whole: it wraps, never cut mid-sentence (#245); the hold already grows with its length.
            Text(message).font(NotchType.note).foregroundStyle(GoalInk.primary)
                .lineLimit(nil).fixedSize(horizontal: false, vertical: true)
        case .failure(let why):
            row(Image(systemName: why == .mic ? "mic.slash.fill" : "exclamationmark.circle.fill").font(.system(size: 15))
                    .foregroundStyle(Color(red: 1, green: 0.27, blue: 0.23)), why.title) { EmptyView() }
        case .idle:
            EmptyView()
        }
    }

    private func row<Mark: View, Trailing: View>(_ mark: Mark, _ title: String, @ViewBuilder trailing: () -> Trailing) -> some View {
        HStack(spacing: 10) {
            mark.frame(width: 16)
            Text(title).font(.system(size: 14, weight: .semibold)).foregroundStyle(GoalInk.primary).lineLimit(1)
            Spacer(minLength: 8)
            HStack(spacing: 8) { trailing() }
        }
        .frame(minHeight: 22)
    }

    private func mic(_ opacity: Double) -> some View {
        Image(systemName: "mic.fill").font(.system(size: 14)).foregroundStyle(Color.white.opacity(opacity))
    }

    // MARK: - Words and errors

    /// Closed words brighter, the segment still changing dimmer. Three lines of 19 pt: past that, the first one fades and goes.
    private var liveText: some View {
        (Text(input.sure).foregroundColor(.white.opacity(0.92))
         + Text(input.sure.isEmpty || input.maybe.isEmpty ? "" : " ")
         + Text(input.maybe).foregroundColor(.white.opacity(input.phase == .sending ? 0.92 : 0.5)))
            .font(.system(size: 14, weight: .medium))
            .lineSpacing(2)
            .lineLimit(NotchEvents.noteLines)
            .truncationMode(.head)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            // shortcut: the fade is by length (about three lines at this width), not by measuring the lines; measure if it ever shows on a short text.
            .mask { FadeTop(on: input.text.count > 120) }
    }

    private func failure(_ why: VoiceInput.Failure) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(why.detail).font(.system(size: 12)).foregroundStyle(Color.white.opacity(0.6))
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                ForEach(Array(why.actions.enumerated()), id: \.offset) { i, action in
                    Button(action.label) { input.perform(action) }.buttonStyle(VoicePillButtonStyle(primary: i == 0))
                }
            }
        }
        .padding(.leading, 26)
    }
}

// MARK: - Pieces

/// Bars that follow the microphone, 3 pt wide on a 6 pt step; the newest (right) are the brightest.
private struct Bars: View {
    let levels: [Double]
    let height: CGFloat

    var body: some View {
        HStack(spacing: 3) {
            ForEach(levels.indices, id: \.self) { i in
                Capsule().fill(Color.white.opacity(0.35 + 0.65 * Double(i + 1) / Double(levels.count)))
                    .frame(width: 3, height: 3 + (height - 3) * min(1, levels[i]))
            }
        }
        .frame(height: height)
        .animation(.easeOut(duration: 0.08), value: levels)
    }
}

private struct Elapsed: View {
    let since: Date

    var body: some View {
        TimelineView(.periodic(from: since, by: 1)) { context in
            let s = max(0, Int(context.date.timeIntervalSince(since)))
            Text("\(s / 60):" + String(format: "%02d", s % 60)).font(NotchType.numbers).foregroundStyle(Color.white.opacity(0.5))
        }
    }
}

private struct KeyCap: View {
    let label: String
    init(_ label: String) { self.label = label }

    var body: some View {
        Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(Color.white.opacity(0.6))
            .padding(.horizontal, 5).padding(.vertical, 1.5)
            .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color.white.opacity(0.3)))
    }
}

/// «Annulla · 2»: the ring empties in `seconds` and the number counts down with it.
private struct CancelButton: View {
    let since: Date
    let seconds: Double
    let action: () -> Void

    var body: some View {
        TimelineView(.animation) { context in
            let left = max(0, seconds - context.date.timeIntervalSince(since))
            Button(action: action) {
                HStack(spacing: 6) {
                    ZStack {
                        Circle().stroke(Color.white.opacity(0.2), lineWidth: 2)
                        Circle().trim(from: 0, to: left / seconds).stroke(Color.white.opacity(0.92), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                    }
                    .frame(width: 12, height: 12)
                    Text("Annulla · \(Int(left.rounded(.up)))")
                }
            }
            .buttonStyle(VoicePillButtonStyle(primary: false))
        }
    }
}

private struct FadeTop: View {
    let on: Bool

    var body: some View {
        on ? AnyView(LinearGradient(stops: [.init(color: .black.opacity(0.14), location: 0), .init(color: .black, location: 0.33)],
                                    startPoint: .top, endPoint: .bottom))
           : AnyView(Color.black)
    }
}

/// Pill buttons: 12 % white, or the main one 94 % white with dark text.
private struct VoicePillButtonStyle: ButtonStyle {
    let primary: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(primary ? Color.black.opacity(0.92) : Color.white.opacity(0.92))
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Capsule().fill(primary ? Color.white.opacity(0.94) : Color.white.opacity(0.12)))
            .opacity(configuration.isPressed ? 0.7 : 1)
            .notchHover(small: true, onDark: nil)
    }
}

private struct PillText: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.white.opacity(configuration.isPressed ? 0.5 : 0.7))
    }
}
