import XCTest
@testable import ClotchCore

final class PRMergeMotionTests: XCTestCase {
    func testMergedPRStaysThroughTheLightThenLeaves() {
        let stay = PRMergeMotion.stay(reduceMotion: false)
        XCTAssertGreaterThanOrEqual(stay, PRMergeMotion.delay + PRMergeMotion.shimmer, "removed only after the whole pass of light")
        XCTAssertEqual(stay, 4.7, accuracy: 0.0001, "#100: 2.5 s more than the 2.2 s of #86")
        XCTAssertEqual(PRMergeMotion.removed(reduceMotion: false), stay + PRMergeMotion.wipe, accuracy: 0.0001, "the text fades left to right first")
        XCTAssertEqual(PRMergeMotion.gone(reduceMotion: false), stay + PRMergeMotion.wipe + PRMergeMotion.exit, accuracy: 0.0001)
        XCTAssertLessThan(PRMergeMotion.gone(reduceMotion: false), 6, "news, not a wait")
    }

    func testReduceMotionKeepsTheRowLongEnoughToReadThenOnlyFades() {
        let stay = PRMergeMotion.stay(reduceMotion: true)
        XCTAssertEqual(stay, PRMergeMotion.stay(reduceMotion: false), accuracy: 0.0001, "the same 2.5 s more")
        XCTAssertEqual(PRMergeMotion.removed(reduceMotion: true), stay, accuracy: 0.0001, "no wipe, a fade only")
        XCTAssertLessThan(PRMergeMotion.gone(reduceMotion: true) - stay, PRMergeMotion.exit, "a short fade, shorter than the spring")
    }
}
