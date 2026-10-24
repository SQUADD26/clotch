import Foundation
import ClotchCore

/// Account usage from the dashboard Roberto's Macchine app reads (public, no token). Fetched at
/// launch and when the notch opens (no polling: the numbers are shown only in the open notch). A failed fetch keeps the last good list and the time
/// it was read, so the view says how old it is instead of showing nothing or inventing numbers.
@MainActor final class AccountQuotaFeed: ObservableObject {
    static let shared = AccountQuotaFeed()
    private static let url = URL(string: "https://claude.squaddbackend.com/dashboard/data")!

    @Published private(set) var accounts: [AccountQuota] = []
    /// When the shown list was read; nil until the first success.
    @Published private(set) var fetchedAt: Date?
    @Published private(set) var lastFetchFailed = false
    private var inFlight = false

    func start() {
        refresh()
    }

    func refresh() {
        guard !inFlight else { return }
        inFlight = true
        Task {
            let data = await Self.fetch()
            inFlight = false
            apply(data)
        }
    }

    /// One blocking read, for `--snapshot`.
    func loadNow() {
        final class Box: @unchecked Sendable { var data: Data? }
        let box = Box(), done = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: Self.request()) { data, response, _ in
            if (response as? HTTPURLResponse)?.statusCode == 200 { box.data = data }
            done.signal()
        }.resume()
        _ = done.wait(timeout: .now() + 9)
        apply(box.data)
    }

    private func apply(_ data: Data?) {
        let now = Date()
        if let data, let list = AccountQuotas.parse(data, now: now, registered: Self.registered()) {
            if list != accounts { accounts = list }
            fetchedAt = now
            lastFetchFailed = false
        } else {
            lastFetchFailed = true
        }
    }

    private static func registered() -> [String] {
        let file = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".config/claude-accounts/accounts.json")
        return (try? Data(contentsOf: file)).map(RegisteredAccounts.emails(from:)) ?? []
    }

    private nonisolated static func request() -> URLRequest {
        var request = URLRequest(url: url, timeoutInterval: 8)
        request.setValue("clotch", forHTTPHeaderField: "User-Agent")
        return request
    }

    private nonisolated static func fetch() async -> Data? {
        guard let (data, response) = try? await URLSession.shared.data(for: request()),
              (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return data
    }
}
