import XCTest
@testable import Clotch

final class L10nTests: XCTestCase {
    override func setUp() {
        L10n.shared.language = "en"
    }

    override func tearDown() {
        L10n.shared.language = "system"
    }

    func testTurkishTranslationsContainAllKeysPresentInEnglish() {
        let enKeys = Set(L10n.strings["en"]?.keys ?? Dictionary<String, String>().keys)
        let trKeys = Set(L10n.strings["tr"]?.keys ?? Dictionary<String, String>().keys)

        let missingKeys = enKeys.subtracting(trKeys)
        XCTAssertTrue(missingKeys.isEmpty, "Turkish is missing keys: \(missingKeys)")
    }

    func testKoreanTranslationsContainAllKeysPresentInEnglish() {
        let enKeys = Set(L10n.strings["en"]?.keys ?? Dictionary<String, String>().keys)
        let koKeys = Set(L10n.strings["ko"]?.keys ?? Dictionary<String, String>().keys)

        let missingKeys = enKeys.subtracting(koKeys)
        XCTAssertTrue(missingKeys.isEmpty, "Korean is missing keys: \(missingKeys)")
    }

    func testJapaneseTranslationsContainAllKeysPresentInEnglish() {
        let enKeys = Set(L10n.strings["en"]?.keys ?? Dictionary<String, String>().keys)
        let jaKeys = Set(L10n.strings["ja"]?.keys ?? Dictionary<String, String>().keys)

        let missingKeys = enKeys.subtracting(jaKeys)
        XCTAssertTrue(missingKeys.isEmpty, "Japanese is missing keys: \(missingKeys)")
    }

    func testGermanTranslationsContainAllKeysPresentInEnglish() {
        let enKeys = Set(L10n.strings["en"]?.keys ?? Dictionary<String, String>().keys)
        let deKeys = Set(L10n.strings["de"]?.keys ?? Dictionary<String, String>().keys)

        let missingKeys = enKeys.subtracting(deKeys)
        XCTAssertTrue(missingKeys.isEmpty, "German is missing keys: \(missingKeys)")
    }

    /// The class guard: every language has every English key, with the same placeholders (scripts/check-l10n.py does the same without Swift).
    func testEveryLanguageHasEveryEnglishKeyWithItsPlaceholders() throws {
        let en = try XCTUnwrap(L10n.strings["en"])
        let placeholder = try NSRegularExpression(pattern: #"%(?:\d+\$)?[-+ 0#]*\d*(?:\.\d+)?(?:ll|l|h)?[@dfsuxXeg%]"#)
        func marks(_ s: String) -> [String] {
            placeholder.matches(in: s, range: NSRange(s.startIndex..., in: s)).map { String(s[Range($0.range, in: s)!]) }.sorted()
        }
        for (lang, table) in L10n.strings where lang != "en" {
            XCTAssertEqual(Set(en.keys).subtracting(table.keys), [], "\(lang) is missing keys")
            for (key, value) in en {
                if let local = table[key] { XCTAssertEqual(marks(local), marks(value), "\(lang) \(key)") }
            }
        }
    }

    func testTurkishTranslationReturnsCorrectValue() {
        L10n.shared.language = "tr"

        XCTAssertEqual(L10n.shared["general"], "Genel")
        XCTAssertEqual(L10n.shared["behavior"], "Davranış")
        XCTAssertEqual(L10n.shared["appearance"], "Görünüm")
        XCTAssertEqual(L10n.shared["language"], "Dil")
        XCTAssertEqual(L10n.shared["settings_title"], "Clotch Ayarları")
        XCTAssertEqual(L10n.shared["quit"], "Çık")
    }

    func testKoreanTranslationReturnsCorrectValue() {
        L10n.shared.language = "ko"

        XCTAssertEqual(L10n.shared["general"], "일반")
        XCTAssertEqual(L10n.shared["behavior"], "동작")
        XCTAssertEqual(L10n.shared["appearance"], "외관")
        XCTAssertEqual(L10n.shared["language"], "언어")
        XCTAssertEqual(L10n.shared["settings_title"], "Clotch 설정")
        XCTAssertEqual(L10n.shared["quit"], "종료")
    }

    func testJapaneseTranslationReturnsCorrectValue() {
        L10n.shared.language = "ja"

        XCTAssertEqual(L10n.shared["general"], "一般")
        XCTAssertEqual(L10n.shared["behavior"], "動作")
        XCTAssertEqual(L10n.shared["appearance"], "外観")
        XCTAssertEqual(L10n.shared["language"], "言語")
        XCTAssertEqual(L10n.shared["settings_title"], "Clotch 設定")
        XCTAssertEqual(L10n.shared["quit"], "終了")
    }

    func testGermanTranslationReturnsCorrectValue() {
        L10n.shared.language = "de"

        XCTAssertEqual(L10n.shared["general"], "Allgemein")
        XCTAssertEqual(L10n.shared["behavior"], "Verhalten")
        XCTAssertEqual(L10n.shared["appearance"], "Darstellung")
        XCTAssertEqual(L10n.shared["language"], "Sprache")
        XCTAssertEqual(L10n.shared["settings_title"], "Clotch-Einstellungen")
        XCTAssertEqual(L10n.shared["quit"], "Beenden")
    }

    func testNotchAnimationSpeedLabelsAreLocalized() {
        let expected: [String: (open: String, close: String, description: String)] = [
            "en": ("Opening speed", "Closing speed", "How fast the island expands and collapses"),
            "de": ("Öffnungsgeschwindigkeit", "Schließgeschwindigkeit", "Wie schnell die Insel auf- und zuklappt"),
            "zh": ("展开速度", "收起速度", "灵动岛展开和收起动画的快慢"),
            "zh-Hant": ("展開速度", "收合速度", "靈動島展開和收合動畫的快慢"),
            "ja": ("開くスピード", "閉じるスピード", "アイランドが展開・収縮する速さ"),
            "ko": ("열기 속도", "닫기 속도", "아일랜드가 펼쳐지고 접히는 속도"),
            "tr": ("Açılma Hızı", "Kapanma Hızı", "Adanın ne kadar hızlı açılıp kapandığı"),
        ]

        for (language, translation) in expected {
            L10n.shared.language = language
            XCTAssertEqual(L10n.shared["notch_open_speed"], translation.open)
            XCTAssertEqual(L10n.shared["notch_close_speed"], translation.close)
            XCTAssertEqual(L10n.shared["notch_animation_speed_desc"], translation.description)
        }
    }

    func testEffectiveLanguageReturnsTurkishWhenSystemLocaleIsTurkish() {
        L10n.shared.language = "system"

        let turkishEffective = L10n.shared.effectiveLanguage
        XCTAssertNotEqual(turkishEffective, "tr")
    }

    func testFallbackToEnglishWhenTurkishKeyIsMissing() {
        L10n.shared.language = "tr"

        let result = L10n.shared["nonexistent_key"]
        XCTAssertEqual(result, "nonexistent_key")
    }

    func testAllLanguageOptionsAvailableInSettings() {
        let availableLanguages = ["system", "en", "zh", "de", "ja", "ko", "tr"]

        for lang in availableLanguages {
            L10n.shared.language = lang
            let value = L10n.shared["general"]
            XCTAssertFalse(value.isEmpty, "Language '\(lang)' should return a value for 'general' key")
        }
    }

    func testTurkishNumericPlaceholdersWork() {
        L10n.shared.language = "tr"

        let customSoundSet = L10n.shared["custom_sound_set"]
        let formatted = String(format: customSoundSet, "mysound.wav")
        XCTAssertEqual(formatted, "Özel: mysound.wav")

        let updateAvailable = L10n.shared["update_available_body"]
        let formattedUpdate = String(format: updateAvailable, "1.0.19", "1.0.18")
        XCTAssertEqual(formattedUpdate, "Clotch 1.0.19 mevcut (şimdiki: 1.0.18). İndirmek ister misiniz?")
    }

    func testKoreanNumericPlaceholdersWork() {
        L10n.shared.language = "ko"

        let customSoundSet = L10n.shared["custom_sound_set"]
        let formatted = String(format: customSoundSet, "mysound.wav")
        XCTAssertEqual(formatted, "사용자 지정: mysound.wav")

        let updateAvailable = L10n.shared["update_available_body"]
        let formattedUpdate = String(format: updateAvailable, "1.0.19", "1.0.18")
        XCTAssertEqual(formattedUpdate, "Clotch 1.0.19 버전을 사용할 수 있습니다(현재: 1.0.18). 다운로드하시겠습니까?")
    }

    func testJapaneseNumericPlaceholdersWork() {
        L10n.shared.language = "ja"

        let customSoundSet = L10n.shared["custom_sound_set"]
        let formatted = String(format: customSoundSet, "mysound.wav")
        XCTAssertEqual(formatted, "カスタム: mysound.wav")

        let updateAvailable = L10n.shared["update_available_body"]
        let formattedUpdate = String(format: updateAvailable, "1.0.19", "1.0.18")
        XCTAssertEqual(formattedUpdate, "Clotch 1.0.19 が利用可能です (現在: 1.0.18)。ダウンロードしますか？")
    }

    func testGermanNumericPlaceholdersWork() {
        L10n.shared.language = "de"

        let customSoundSet = L10n.shared["custom_sound_set"]
        let formatted = String(format: customSoundSet, "mysound.wav")
        XCTAssertEqual(formatted, "Eigen: mysound.wav")

        let updateAvailable = L10n.shared["update_available_body"]
        let formattedUpdate = String(format: updateAvailable, "1.0.19", "1.0.18")
        XCTAssertEqual(formattedUpdate, "Clotch 1.0.19 ist verfügbar (aktuell: 1.0.18). Möchtest du es herunterladen?")
    }

    // MARK: - reply_complete_placeholder

    func testReplyCompletePlaceholderExistsInAllLanguages() {
        let languages = ["en", "de", "zh", "zh-Hant", "ja", "ko", "tr"]
        for lang in languages {
            guard let dict = L10n.strings[lang] else {
                XCTFail("Language '\(lang)' not found in L10n.strings")
                continue
            }
            XCTAssertTrue(dict.keys.contains("reply_complete_placeholder"),
                          "Language '\(lang)' is missing reply_complete_placeholder")
        }
    }

    func testReplyCompletePlaceholderHasNoBrackets() {
        let languages = ["en", "de", "zh", "zh-Hant", "ja", "ko", "tr"]
        for lang in languages {
            let value = L10n.strings[lang]?["reply_complete_placeholder"] ?? ""
            XCTAssertFalse(value.hasPrefix("["),
                           "'\(lang)' reply_complete_placeholder must not start with '['")
            XCTAssertFalse(value.hasSuffix("]"),
                           "'\(lang)' reply_complete_placeholder must not end with ']'")
        }
    }

    func testReplyCompletePlaceholderReturnsLocalizedValuePerLanguage() {
        let expected: [String: String] = [
            "en": "Reply complete",
            "de": "Antwort abgeschlossen",
            "zh": "回复完成",
            "zh-Hant": "回覆完成",
            "ja": "返信完了",
            "ko": "답변 완료",
            "tr": "Yanıt tamamlandı",
        ]
        for (lang, translation) in expected {
            L10n.shared.language = lang
            XCTAssertEqual(L10n.shared["reply_complete_placeholder"], translation,
                           "Wrong reply_complete_placeholder for language '\(lang)'")
        }
    }
}
