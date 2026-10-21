import XCTest
@testable import ClotchCore

final class PRMergeMotionTests: XCTestCase {
    func testMergedPRStaysThroughTheLightThenLeaves() {
        let stay = PRMergeMotion.stay(reduceMotion: false)
        XCTAssertGreaterThanOrEqual(stay, PRMergeMotion.delay + PRMergeMotion.shimmer, "removed only after the whole pass of light")
        XCTAssertEqual(PRMergeMotion.gone(reduceMotion: false), stay + PRMergeMotion.exit, accuracy: 0.0001)
        XCTAssertLessThan(PRMergeMotion.gone(reduceMotion: false), 3, "news, not a wait")
    }

    func testReduceMotionKeepsTheRowLongEnoughToReadThenOnlyFades() {
        let stay = PRMergeMotion.stay(reduceMotion: true)
        XCTAssertGreaterThanOrEqual(stay, 1.5)
        XCTAssertLessThan(PRMergeMotion.gone(reduceMotion: true) - stay, PRMergeMotion.exit, "a short fade, shorter than the spring")
    }
}
