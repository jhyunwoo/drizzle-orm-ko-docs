#!/usr/bin/env python3

import argparse
import json
import sys


def load_translation():
    import argostranslate.translate

    languages = argostranslate.translate.get_installed_languages()
    english = next(language for language in languages if language.code == "en")
    korean = next(language for language in languages if language.code == "ko")
    return english.get_translation(korean)


def run_stdio():
    translation = load_translation()
    print(json.dumps({"ready": True}), flush=True)

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue

        try:
            payload = json.loads(raw_line)
            request_id = payload["id"]
            text = payload["text"]
            translated = translation.translate(text)
            print(
                json.dumps(
                    {
                        "id": request_id,
                        "text": translated,
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )
        except Exception as error:  # noqa: BLE001
            request_id = None
            try:
                request_id = payload.get("id")
            except Exception:  # noqa: BLE001
                pass

            print(
                json.dumps(
                    {
                        "id": request_id,
                        "error": str(error),
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stdio", action="store_true")
    args = parser.parse_args()

    if args.stdio:
        run_stdio()
        return

    print("Pass --stdio to run the Argos translation bridge.", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
