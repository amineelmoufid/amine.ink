(function (global) {
  const wordGuidance = {
    single:
      "Keep each caption to exactly one word when natural pauses allow it. Split words only when absolutely necessary.",
    short:
      "Keep captions concise at around 2-4 words each. Split longer sentences into multiple captions to stay readable and in sync.",
    medium:
      "Aim for roughly 4-8 words per caption, breaking at natural phrase boundaries while preserving timing accuracy.",
    sentence:
      "Use full sentences per caption whenever possible, keeping millisecond timing aligned with natural pauses."
  };

  const lineGuidance = {
    "1":
      "Render each caption as a single line. Do not insert manual line breaks or exceed one line per subtitle block.",
    "2":
      "Allow up to two lines per caption. Use line breaks to balance line length and keep the caption easy to read.",
    "3":
      "Permit up to three lines per caption. Insert line breaks only when they improve legibility without changing speech order."
  };

  const scriptGuidance = {
    latin:
      "Write all languages using Latin characters. For Arabic or Darija speech, provide a natural Latin transliteration (example: 'kanbghik bzf habibi').",
    arabic:
      "Write the entire transcription in Arabic script. For non-Arabic speech, transcribe phonetically in Arabic when it remains understandable.",
    both:
      "Use the native script for each language: Arabic or Darija in Arabic script, English and French in Latin script. Preserve code-switching in place."
  };

  function buildFirstPassPrompt(options = {}) {
    const wordsKey = options.words || "short";
    const linesKey = options.lines || "1";
    const scriptKey = options.script || "both";

    return `
You are an expert multilingual and dialect-aware transcriptionist.
Your task is to produce a professional-quality SubRip (.srt) subtitle file with millisecond-level accuracy (00:00:00,000).

Transcription requirements:
- Detect and accurately represent all spoken languages, dialects, and accents (including Moroccan Darija).
- Preserve foreign words and borrowings in their authentic written form.
- ${wordGuidance[wordsKey]}
- ${lineGuidance[linesKey]}
- ${scriptGuidance[scriptKey]}
- Include punctuation (exceptions: period) and capitalization exactly as spoken.
- Maintain natural sentence flow; never summarize, translate, or omit content.
- Ensure proper sequential caption numbering and no overlapping time ranges.
- Output only valid .srt content with no additional commentary.

Goal:
Create a clean, linguistically faithful, and fully synchronized subtitle file.
`.trim();
  }

  function buildForeignWordCorrectionPrompt() {
    return `
You are an expert multilingual linguist and subtitle editor.
Review the provided SubRip (.srt) file and detect any French, English, or Spanish words that are written in Arabic script or phonetic Arabic spelling, then restore them to their correct Latin spelling.

Correction instructions:
- Only modify words that are clearly foreign (French, English, or Spanish) but written in Arabic script.
- Replace each detected foreign word with its correct Latin spelling.
- Keep Arabic words in Arabic script.
- Do not translate or paraphrase; only correct the script of borrowed words.
- Preserve sentence structure, punctuation, numbering, and timestamps exactly as in the input.
- Output only the corrected .srt content with no commentary.
`.trim();
  }

  const promptTemplates = {
    buildFirstPassPrompt,
    buildForeignWordCorrectionPrompt,
    wordGuidance,
    lineGuidance,
    scriptGuidance
  };

  global.promptTemplates = promptTemplates;
})(window);
