"""Behavioral tests for the explanation writing checker (stdlib only)."""

import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("writing-check.py")
check_text = runpy.run_path(str(SCRIPT))["check_text"]


class WritingCheckTests(unittest.TestCase):
    def test_counts_a_sentence_across_soft_line_wraps(self):
        text = "\n".join([" ".join(["word"] * 10)] * 3) + "."
        findings = check_text(text)
        self.assertEqual([(f["rule"], f["words"]) for f in findings],
                         [("long-sentence", 30)])

    def test_keeps_separate_sentences_separate(self):
        self.assertEqual(check_text("Check the size.\nVerify the signature."), [])

    def test_instruction_limit_is_explicit(self):
        text = " ".join(["word"] * 21) + "."
        self.assertEqual(check_text(text), [])
        self.assertEqual(check_text(text, max_words=20)[0]["words"], 21)

    def test_reports_precise_location_after_wrapped_lines(self):
        findings = check_text("The job starts\nwhen you spin up the server.", "notes.md")
        self.assertEqual((findings[0]["rule"], findings[0]["line"],
                          findings[0]["column"], findings[0]["file"]),
                         ("phrasal-verb", 2, 10, "notes.md"))

    def test_protects_uncertainty_and_requirement_strength(self):
        text = ("The request may have failed. The disk might have filled. "
                "You must preserve the backup. You should inspect the logs.")
        self.assertEqual(check_text(text), [])

    def test_does_not_conflate_distinct_actions(self):
        self.assertEqual(check_text("Check the file size. Verify the digital signature."), [])

    def test_ignores_code_and_link_destinations(self):
        text = ("---\nname: robust\n---\n# A robust title\n"
                "```js\nconst robust = 'spin up';\n```\n"
                "Use `robust; spin up` and [the guide](https://host/robust;spin-up).")
        self.assertEqual(check_text(text), [])

    def test_code_fence_closes_with_matching_delimiter(self):
        self.assertEqual(check_text("~~~\n```\nrobust; spin up\n~~~\nRead the guide."), [])

    def test_checks_list_items_and_table_cells_independently(self):
        text = ("- " + " ".join(["word"] * 15) + "\n"
                "- " + " ".join(["word"] * 15) + "\n\n"
                "| A | B |\n| --- | --- |\n"
                "| " + " ".join(["word"] * 15) + " | "
                + " ".join(["word"] * 15) + " |")
        self.assertEqual(check_text(text), [])

    def test_decimal_and_common_abbreviation_do_not_split_sentence(self):
        text = "Use e.g. 1.5 " + " ".join(["word"] * 23) + "."
        self.assertEqual(check_text(text)[0]["words"], 26)

    def test_rules_are_advisory_and_can_be_disabled(self):
        text = "Perform an analysis of the seamless log; spin up the job."
        findings = check_text(text)
        self.assertEqual({f["rule"] for f in findings},
                         {"nominalization", "marketing-adjective", "semicolon", "phrasal-verb"})
        self.assertTrue(all(f["level"] == "advisory" for f in findings))
        self.assertNotIn("semicolon", {f["rule"] for f in
                         check_text(text, disabled={"semicolon"})})

    def test_cli_json_reports_findings_but_exits_successfully(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "--json"],
                                input="Spin up the job.", text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["findings"][0]["rule"], "phrasal-verb")

    def test_cli_does_not_modify_input_file(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "notes.md"
            source.write_text("Spin up the job.", encoding="utf-8")
            result = subprocess.run([sys.executable, str(SCRIPT), "--json", str(source)],
                                    text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(source.read_text(encoding="utf-8"), "Spin up the job.")
            self.assertEqual(json.loads(result.stdout)["findings"][0]["file"], str(source))

    def test_missing_file_is_an_operational_error(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([sys.executable, str(SCRIPT), str(Path(directory) / "missing")],
                                    text=True, capture_output=True)
            self.assertEqual(result.returncode, 2)


if __name__ == "__main__":
    unittest.main()
