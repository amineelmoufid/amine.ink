const GEMINI_KEYS = [
  "AIzaSyAcJ2ZHlmjzuNwbkah8uy9dPvOm-DCGUeI",
  "AIzaSyDcjE8ku11RVMsb-91VQCpFQ4JQTKYV1-4",
  "AIzaSyD4c913NvzKh6POitWSdSVCpXXNR3hkmYcSRT"
];

const modelEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

const fallbackPromptTemplates = (() => {
  const wordGuidance = {
    single: "Keep each caption to exactly one word whenever natural pauses allow it. Split words only when absolutely required.",
    short: "Keep captions compact at roughly 2 to 4 words each. Split longer speech into multiple captions to stay within the limit.",
    medium: "Balance readability with timing by using roughly 4 to 8 words per caption. Split at logical phrase boundaries.",
    sentence: "Use complete sentences per caption, even if they are longer, while still respecting timing accuracy."
  };

  const lineGuidance = {
    "1": "Render each caption as a single line. Do not insert manual line breaks.",
    "2": "Format captions with up to 2 lines. When a caption needs a break, split it into two balanced lines.",
    "3": "Allow up to 3 lines per caption. Use line breaks to keep each line readable and balanced."
  };

  const scriptGuidance = {
    latin: "Write every language using Latin characters. For Arabic or Darija speech, provide a natural Latin transliteration (e.g., 'kanbghik bzf habibi').",
    arabic: "Render the entire transcription using Arabic script. Transcribe non-Arabic words phonetically in Arabic where possible.",
    both: "Use the native script of each language: Arabic or Darija in Arabic script, English/French/other Latin languages in Latin script. Preserve code-switching within captions."
  };

  function buildFirstPassPrompt(options = {}) {
    const wordsKey = options.words || "short";
    const linesKey = options.lines || "1";
    const scriptKey = options.script || "latin";

    return `
You are an expert multilingual transcriptionist.
- Transcribe the provided audio into SRT format with millisecond precision (00:00:00,000).
- Detect and preserve all spoken languages, dialects (including Moroccan Darija), and code-switching.
- ${wordGuidance[wordsKey]}
- ${lineGuidance[linesKey]}
- ${scriptGuidance[scriptKey]}
- Maintain punctuation, sentence flow, and speaker intent. Never summarise or omit content.
- Ensure consecutive caption numbering, no overlaps, and precise timing anchored to speech.
- Return only the final SRT file with no extra commentary.
`.trim();
  }

  return {
    buildFirstPassPrompt,
    buildForeignWordCorrectionPrompt() {
      return `
You are an expert multilingual linguist and subtitle editor.
Review the provided SubRip (.srt) file and detect any French, English, or Spanish words that are written in Arabic script or phonetic Arabic spelling, then restore them to their correct Latin spelling.

Correction instructions:
- Only modify words that are clearly foreign (French, English, or Spanish) but written in Arabic script.
- Replace each detected foreign word with its correct Latin spelling.
- Keep Arabic words in Arabic script.
- Do not translate or paraphrase; only correct the script of borrowed words.
- Preserve sentence structure, punctuation, numbering, and timestamps exactly as in the input.
- If the foreign word begins with the Arabic article "al", keep the prefix. Examples:
  "alkayssir" -> "alcaissier"
  "albarq" -> "le parc" or "alpark" depending on context.
- Output only the corrected .srt content with no commentary.
`.trim();
    },
    wordGuidance,
    lineGuidance,
    scriptGuidance
  };
})();

function getPromptTemplates() {
  if (window.promptTemplates) {
    return window.promptTemplates;
  }
  if (!getPromptTemplates.warningShown) {
    console.warn("promptTemplates not found on window; using fallback prompt strings.");
    getPromptTemplates.warningShown = true;
  }
  return fallbackPromptTemplates;
}

const fileInput = document.getElementById("audio-file");
const fileLabel = document.getElementById("file-label");
const transcribeBtn = document.getElementById("transcribe-btn");
const languageFixBtn = document.getElementById("language-fix-btn");
const downloadBtn = document.getElementById("download-btn");
const srtOutput = document.getElementById("srt-output");
const statusEl = document.getElementById("status");
const audioPlayer = document.getElementById("audio-player");
const captionListEl = document.getElementById("caption-list");
const shiftBackBtn = document.getElementById("shift-back-btn");
const shiftForwardBtn = document.getElementById("shift-forward-btn");
const playCaptionBtn = document.getElementById("play-caption-btn");
const inspectorStartInput = document.getElementById("inspector-start");
const inspectorEndInput = document.getElementById("inspector-end");
const inspectorTextInput = document.getElementById("inspector-text");
const applyCaptionBtn = document.getElementById("apply-caption-btn");
const resetCaptionBtn = document.getElementById("reset-caption-btn");
const inspectorStatus = document.getElementById("inspector-status");
const viewSrtBtn = document.getElementById("view-srt-btn");
const viewHighlightBtn = document.getElementById("view-highlight-btn");
const highlightContainer = document.getElementById("highlight-container");
const highlightListEl = document.getElementById("highlight-list");
const markUncertainBtn = document.getElementById("mark-uncertain-btn");
const clearPlayBtn = document.getElementById("clear-play-btn");
const previewText = document.getElementById("preview-text");
const previewCounter = document.getElementById("preview-counter");
const previewPrevBtn = document.getElementById("preview-prev-btn");
const previewPlayBtn = document.getElementById("preview-play-btn");
const previewNextBtn = document.getElementById("preview-next-btn");
const translatorLanguageInput = document.getElementById("translator-language");
const translateBtn = document.getElementById("translate-btn");
const translatorStatus = document.getElementById("translator-status");
const translationOutput = document.getElementById("translation-output");

let lastAudioBase64 = "";
let lastAudioMimeType = "";
let audioObjectUrl = "";
let captions = [];
let selectedCaptionIndex = -1;
let currentPlayingIndex = -1;
let isProcessing = false;
let currentPreviewMode = "srt";
let highlightSelectionIndex = -1;
let highlightedCaptions = new Set();
let playbackClampEnd = null;
let highlightActiveControls = null;
let previewIndex = -1;

srtOutput.addEventListener("input", () => {
  updateLanguageFixButton();
});

applyCaptionBtn.addEventListener("click", () => {
  applyInspectorChanges();
});

resetCaptionBtn.addEventListener("click", () => {
  if (selectedCaptionIndex < 0 || !captions[selectedCaptionIndex]) {
    return;
  }
  populateInspector(selectedCaptionIndex);
  setInspectorStatus("Reverted caption edits.", "info");
});

populateInspector(-1);

viewSrtBtn.addEventListener("click", () => switchPreviewMode("srt"));
viewHighlightBtn.addEventListener("click", () => switchPreviewMode("highlight"));
markUncertainBtn.addEventListener("click", () => markSelectedHighlight());
clearPlayBtn.addEventListener("click", () => clearAndPlaySelected());

if (previewPrevBtn) {
  previewPrevBtn.addEventListener("click", event => {
    event.stopPropagation();
    if (!captions.length || previewIndex <= 0 || isProcessing) {
      return;
    }
    updatePreviewIndex(previewIndex - 1);
  });
}

if (previewNextBtn) {
  previewNextBtn.addEventListener("click", event => {
    event.stopPropagation();
    if (!captions.length || previewIndex >= captions.length - 1 || isProcessing) {
      return;
    }
    updatePreviewIndex(previewIndex + 1);
  });
}

if (previewPlayBtn) {
  previewPlayBtn.addEventListener("click", event => {
    event.stopPropagation();
    if (previewIndex < 0 || previewIndex >= captions.length) {
      return;
    }
    playCaptionSegment(previewIndex);
  });
}

if (translateBtn) {
  translateBtn.addEventListener("click", () => {
    runTranslation();
  });
}

updatePreviewDisplay();
setTranslatorStatus("");

renderHighlightList();
updateHighlightButtons();
switchPreviewMode("srt");

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  fileLabel.textContent = file ? file.name : "Choose audio file...";
  srtOutput.value = "";
  lastAudioBase64 = "";
  lastAudioMimeType = "";
  downloadBtn.disabled = true;
  languageFixBtn.disabled = true;
  setAudioSource(file || null);
  resetVisualEditor();
  if (file) {
    setStatus("Audio loaded. Configure options and start transcription when ready.", "info");
  } else {
    setStatus("Please choose an audio file to begin.", "info");
  }
});

transcribeBtn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    setStatus("Please choose an audio file first.", "error");
    return;
  }

  setStatus("Reading audio file...");
  toggleWorking(true);

  try {
    const base64Data = await fileToBase64(file);
    const mimeType = guessMimeType(file);
    lastAudioBase64 = base64Data;
    lastAudioMimeType = mimeType;

    const options = gatherOptions();
    const instructions = buildPrompt(options);
    const payload = buildPayload(instructions, base64Data, mimeType);
    const srtText = await callGeminiWithRotation(payload);

    if (!srtText) {
      throw new Error("Gemini did not return transcription text.");
    }

    srtOutput.value = srtText.trim();
    downloadBtn.disabled = false;
    setStatus("Transcription complete. Review the SRT or adjust timings below.", "success");
    loadCaptionsIntoEditor(srtText);
    updateLanguageFixButton();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Something went wrong during transcription.", "error");
  } finally {
    toggleWorking(false);
  }
});

shiftBackBtn.addEventListener("click", () => shiftSelectedCaption(-100));
shiftForwardBtn.addEventListener("click", () => shiftSelectedCaption(100));

audioPlayer.addEventListener("timeupdate", handleAudioTimeUpdate);
audioPlayer.addEventListener("ended", () => {
  updateCaptionHighlight(-1);
  playbackClampEnd = null;
});
audioPlayer.addEventListener("loadedmetadata", () => {
  updateInspectorControls(selectedCaptionIndex >= 0 && Boolean(captions[selectedCaptionIndex]));
  updatePlayButtonsState();
});

playCaptionBtn.addEventListener("click", () => {
  if (selectedCaptionIndex < 0 || !captions[selectedCaptionIndex]) {
    return;
  }
  const caption = captions[selectedCaptionIndex];
  audioPlayer.currentTime = (caption.start || 0) / 1000;
  playbackClampEnd = caption.end;
  audioPlayer.play().catch(() => {
    setInspectorStatus("Unable to start playback automatically.", "error");
  });
});

languageFixBtn.addEventListener("click", async () => {
  const baseSrt = getActiveSrt();
  if (!baseSrt) {
    setStatus("No SRT text available to correct yet.", "error");
    return;
  }

  setStatus("Running language correction pass...");
  toggleWorking(true);

  try {
    const templates = getPromptTemplates();
    const prompt = templates.buildForeignWordCorrectionPrompt
      ? templates.buildForeignWordCorrectionPrompt()
      : null;
    if (!prompt) {
      throw new Error("Language correction prompt is unavailable.");
    }

    const payload = buildLanguageCorrectionPayload(prompt, baseSrt);
    const correctedSrt = await callGeminiWithRotation(payload);

    if (!correctedSrt) {
      throw new Error("Gemini did not return corrected subtitles.");
    }

    const cleaned = correctedSrt.trim();
    srtOutput.value = cleaned;
    downloadBtn.disabled = false;
    loadCaptionsIntoEditor(cleaned);
    updateLanguageFixButton();
    setStatus("Language correction applied. Review the updated SRT.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Language correction failed.", "error");
  } finally {
    toggleWorking(false);
  }
});

downloadBtn.addEventListener("click", () => {
  const content = getActiveSrt();
  if (!content) {
    setStatus("Nothing to download yet.", "error");
    return;
  }

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = generateFileName();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setStatus("SRT file downloaded.", "success");
});

function gatherOptions() {
  const wordsOption = document.querySelector('input[name="words-per-caption"]:checked')?.value || "short";
  const linesOption = document.querySelector('input[name="lines-per-caption"]:checked')?.value || "1";
  const scriptOption = document.querySelector('input[name="character-script"]:checked')?.value || "latin";

  return {
    words: wordsOption,
    lines: linesOption,
    script: scriptOption
  };
}

function buildPrompt(options) {
  const templates = getPromptTemplates();
  if (!templates.buildFirstPassPrompt) {
    throw new Error("First pass prompt template is missing.");
  }
  return templates.buildFirstPassPrompt(options);
}

function buildPayload(prompt, base64Data, mimeType) {
  return {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      topK: 32,
      maxOutputTokens: 8192
    }
  };
}

function buildLanguageCorrectionPayload(prompt, srtText) {
  return {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            text: "Here is the .srt file to correct:\n" + srtText
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.9,
      topK: 32,
      maxOutputTokens: 8192
    }
  };
}

function buildTranslationPayload(targetLanguage, srtText) {
  const prompt = `
You are an expert subtitle translator.
Translate the following SubRip (.srt) captions into ${targetLanguage}.
- Preserve every numerical index and timestamp exactly as provided.
- Translate only the caption text content.
- Maintain line breaks and formatting inside each caption block.
- Return only the translated .srt content with no additional commentary.
`.trim();

  return {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            text: "Here is the .srt file:\n" + srtText
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      topK: 32,
      maxOutputTokens: 8192
    }
  };
}

function setAudioSource(file) {
  if (audioObjectUrl) {
    try {
      URL.revokeObjectURL(audioObjectUrl);
    } catch (err) {
      console.warn("Failed to revoke previous audio URL.", err);
    }
    audioObjectUrl = "";
  }

  if (file) {
    audioObjectUrl = URL.createObjectURL(file);
    audioPlayer.src = audioObjectUrl;
  } else {
    audioPlayer.removeAttribute("src");
  }
  audioPlayer.load();
  updateInspectorControls(selectedCaptionIndex >= 0 && Boolean(captions[selectedCaptionIndex]));
  updatePlayButtonsState();
}

function resetVisualEditor() {
  captions = [];
  selectedCaptionIndex = -1;
  currentPlayingIndex = -1;
  captionListEl.innerHTML = '<p class="hint">Captions will appear here after transcription.</p>';
  updateShiftButtons();
  populateInspector(-1);
  updateLanguageFixButton();
  highlightedCaptions = new Set();
  highlightSelectionIndex = -1;
  renderHighlightList();
  updateHighlightButtons();
  updatePlayButtonsState();
}

function loadCaptionsIntoEditor(srtText) {
  const parsed = parseSrt(srtText);
  if (!parsed.length) {
    captionListEl.innerHTML = '<p class="hint">Unable to parse captions for visual editing.</p>';
    captions = [];
    selectedCaptionIndex = -1;
    currentPlayingIndex = -1;
    updateShiftButtons();
    populateInspector(-1);
    updateLanguageFixButton();
    highlightedCaptions = new Set();
    highlightSelectionIndex = -1;
    renderHighlightList();
    updateHighlightButtons();
    return;
  }

  captions = parsed;
  selectedCaptionIndex = 0;
  currentPlayingIndex = -1;
  highlightedCaptions = new Set();
  highlightSelectionIndex = captions.length ? 0 : -1;
  renderCaptionList();
  applySelectionHighlight();
  updateCaptionHighlight(currentPlayingIndex, { force: true, scroll: false });
  updateShiftButtons();
  populateInspector(selectedCaptionIndex);
  updateLanguageFixButton();
  renderHighlightList();
  updateHighlightButtons();
}

function renderCaptionList() {
  if (!captions.length) {
    captionListEl.innerHTML = '<p class="hint">Captions will appear here after transcription.</p>';
    return;
  }

  const previousScroll = captionListEl.scrollTop;
  captionListEl.innerHTML = "";

  captions.forEach((caption, index) => {
    const row = document.createElement("div");
    row.className = "caption-row";
    if (index === selectedCaptionIndex) {
      row.classList.add("active");
    }
    if (index === currentPlayingIndex) {
      row.classList.add("playing");
    }

    const header = document.createElement("header");
    header.className = "caption-row-header";

    const meta = document.createElement("div");
    meta.className = "caption-meta";
    const indexLabel = document.createElement("span");
    indexLabel.textContent = `#${index + 1}`;
    const timeLabel = document.createElement("span");
    timeLabel.textContent = `${msToTime(caption.start)} -> ${msToTime(caption.end)}`;
    meta.appendChild(indexLabel);
    meta.appendChild(timeLabel);

    const playBtn = createPlayButton(() => playCaptionSegment(index), "caption");
    header.appendChild(meta);
    header.appendChild(playBtn);

    const textPara = document.createElement("p");
    textPara.textContent = caption.text;

    row.appendChild(header);
    row.appendChild(textPara);
    row.addEventListener("click", () => {
      setSelectedCaption(index, { seek: true });
    });

    captionListEl.appendChild(row);
  });

  captionListEl.scrollTop = previousScroll;
  updatePlayButtonsState();
}

function setSelectedCaption(index, options = {}) {
  if (!captions.length) {
    selectedCaptionIndex = -1;
    updateShiftButtons();
    populateInspector(-1);
    return;
  }

  const { seek = false, fromHighlight = false } = options;
  const safeIndex = Math.max(0, Math.min(index, captions.length - 1));
  selectedCaptionIndex = safeIndex;
  if (!fromHighlight) {
    highlightSelectionIndex = safeIndex;
  }
  applySelectionHighlight();
  updateShiftButtons();
  populateInspector(safeIndex);
  if (!fromHighlight) {
    renderHighlightList();
    updateHighlightButtons();
  }

  if (seek) {
    const target = captions[safeIndex];
    audioPlayer.currentTime = (target.start || 0) / 1000;
    handleAudioTimeUpdate();
  }
}

function applySelectionHighlight() {
  const rows = captionListEl.querySelectorAll(".caption-row");
  rows.forEach((row, idx) => {
    row.classList.toggle("active", idx === selectedCaptionIndex);
  });
}

function updateCaptionHighlight(newIndex, options = {}) {
  const { force = false, scroll = true } = options;
  if (!force && newIndex === currentPlayingIndex) {
    return;
  }

  const rows = captionListEl.querySelectorAll(".caption-row");
  const highlightItems = highlightListEl ? highlightListEl.querySelectorAll(".highlight-item") : [];
  if (currentPlayingIndex >= 0) {
    if (rows[currentPlayingIndex]) {
      rows[currentPlayingIndex].classList.remove("playing");
    }
    if (highlightItems[currentPlayingIndex]) {
      highlightItems[currentPlayingIndex].classList.remove("playing");
    }
  }

  currentPlayingIndex = newIndex;

  if (currentPlayingIndex >= 0 && rows[currentPlayingIndex]) {
    rows[currentPlayingIndex].classList.add("playing");
    if (scroll) {
      rows[currentPlayingIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
  if (currentPlayingIndex >= 0 && highlightItems[currentPlayingIndex]) {
    highlightItems[currentPlayingIndex].classList.add("playing");
    if (currentPreviewMode === "highlight" && scroll) {
      highlightItems[currentPlayingIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
}

function handleAudioTimeUpdate() {
  if (!captions.length) {
    return;
  }
  const timeMs = audioPlayer.currentTime * 1000;
  let matchIndex = -1;

  for (let i = 0; i < captions.length; i += 1) {
    const caption = captions[i];
    if (timeMs >= caption.start && timeMs <= caption.end) {
      matchIndex = i;
      break;
    }
  }

  updateCaptionHighlight(matchIndex);
  if (playbackClampEnd !== null && timeMs >= playbackClampEnd - 20) {
    audioPlayer.pause();
    playbackClampEnd = null;
  }
}

function shiftSelectedCaption(deltaMs) {
  if (selectedCaptionIndex < 0 || !captions[selectedCaptionIndex]) {
    return;
  }

  const caption = captions[selectedCaptionIndex];
  const newStart = Math.max(0, caption.start + deltaMs);
  const newEnd = Math.max(newStart + 10, caption.end + deltaMs);

  caption.start = newStart;
  caption.end = newEnd;

  renderCaptionList();
  applySelectionHighlight();
  updateCaptionHighlight(currentPlayingIndex, { force: true, scroll: false });
  applyCaptionsToOutputs();
  populateInspector(selectedCaptionIndex);
  setInspectorStatus("Caption timing adjusted.", "success");
  setStatus("Caption timing adjusted. Export when ready.", "info");
}

function applyCaptionsToOutputs() {
  if (!captions.length) {
    return;
  }
  const updatedSrt = captionsToSrt(captions);
  srtOutput.value = updatedSrt;
  downloadBtn.disabled = false;
  updateShiftButtons();
  updateLanguageFixButton();
  renderHighlightList();
  updateHighlightButtons();
}

function updateShiftButtons() {
  const hasSelection = selectedCaptionIndex >= 0 && captions[selectedCaptionIndex];
  shiftBackBtn.disabled = isProcessing || !hasSelection;
  shiftForwardBtn.disabled = isProcessing || !hasSelection;
}

function updateLanguageFixButton() {
  const hasSrt = Boolean(getActiveSrt());
  languageFixBtn.disabled = isProcessing || !hasSrt;
}

function switchPreviewMode(mode) {
  if (mode !== "srt" && mode !== "highlight") {
    return;
  }
  currentPreviewMode = mode;
  viewSrtBtn.classList.toggle("active", mode === "srt");
  viewHighlightBtn.classList.toggle("active", mode === "highlight");
  srtOutput.classList.toggle("hidden", mode !== "srt");
  highlightContainer.classList.toggle("hidden", mode !== "highlight");

  if (mode === "highlight") {
    ensureCaptionsHydrated();
    renderHighlightList();
    updateHighlightButtons();
  } else {
    markUncertainBtn.disabled = true;
    clearPlayBtn.disabled = true;
    refreshHighlightControlsState();
  }
}

function ensureCaptionsHydrated() {
  if (captions.length) {
    return;
  }

  const rawSrt = getActiveSrt();
  if (!rawSrt) {
    return;
  }

  const parsed = parseSrt(rawSrt);
  if (!parsed.length) {
    return;
  }

  captions = parsed;
  selectedCaptionIndex = parsed.length ? 0 : -1;
  highlightSelectionIndex = parsed.length ? 0 : -1;
  highlightedCaptions = new Set();
  renderCaptionList();
  applySelectionHighlight();
  updateCaptionHighlight(-1, { force: true, scroll: false });
  populateInspector(selectedCaptionIndex);
}

function renderHighlightList() {
  if (!highlightListEl) {
    return;
  }

  if (!captions.length) {
    ensureCaptionsHydrated();
  }

  highlightActiveControls = null;

  if (!captions.length) {
    highlightSelectionIndex = -1;
    highlightListEl.innerHTML =
      '<p class="hint">Run a transcription first, then switch to highlight mode to review plain text.</p>';
    return;
  }

  if (highlightSelectionIndex >= captions.length) {
    highlightSelectionIndex = captions.length - 1;
  }
  if (highlightSelectionIndex < 0 && captions.length > 0) {
    highlightSelectionIndex = 0;
  }

  const fragment = document.createDocumentFragment();
  captions.forEach((caption, index) => {
    const item = document.createElement("div");
    item.className = "highlight-item";
    if (index === highlightSelectionIndex) {
      item.classList.add("selected");
    }
    if (highlightedCaptions.has(index)) {
      item.classList.add("flagged");
    }
    if (index === currentPlayingIndex) {
      item.classList.add("playing");
    }
    item.dataset.index = String(index);

    if (index === highlightSelectionIndex) {
      item.appendChild(buildHighlightEditor(caption));
    } else {
      const staticRow = document.createElement("div");
      staticRow.className = "highlight-static-row";
      const textDisplay = document.createElement("div");
      textDisplay.className = "highlight-text-static";
      textDisplay.textContent = caption.text || `Caption ${index + 1}`;
      const playBtn = createPlayButton(() => playCaptionSegment(index), "highlight");
      staticRow.append(textDisplay, playBtn);
      item.appendChild(staticRow);
    }

    item.addEventListener("click", () => selectHighlightItem(index));
    fragment.appendChild(item);
  });

  highlightListEl.innerHTML = "";
  highlightListEl.appendChild(fragment);
  refreshHighlightControlsState();
  updatePlayButtonsState();
}

function buildHighlightEditor(caption) {
  const wrapper = document.createElement("div");
  wrapper.className = "highlight-item-editor";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "highlight-reset-btn";
  resetButton.textContent = "Reset";
  resetButton.disabled = isProcessing;
  resetButton.addEventListener("click", event => {
    event.stopPropagation();
    resetHighlightEdits();
  });
  wrapper.appendChild(resetButton);

  const textArea = document.createElement("textarea");
  textArea.className = "highlight-editor-text";
  textArea.value = caption.text;
  textArea.disabled = isProcessing;
  textArea.addEventListener("click", event => event.stopPropagation());
  textArea.addEventListener("input", event => {
    event.stopPropagation();
    autoResizeHighlightTextarea(textArea);
    commitHighlightTextChange(textArea.value);
  });

  const startControls = createHighlightTimeControls("start", caption.start);
  const endControls = createHighlightTimeControls("end", caption.end);

  const controlsRow = document.createElement("div");
  controlsRow.className = "combined-time-controls";
  const playButton = createPlayButton(() => playCaptionSegment(highlightSelectionIndex), "highlight");
  controlsRow.append(startControls.container, endControls.container, playButton);

  wrapper.append(textArea, controlsRow);

  autoResizeHighlightTextarea(textArea);

  highlightActiveControls = {
    textArea,
    startInput: startControls.input,
    startMinus: startControls.minus,
    startPlus: startControls.plus,
    endInput: endControls.input,
    endMinus: endControls.minus,
    endPlus: endControls.plus,
    resetButton,
    playButton,
    original: {
      start: caption.start,
      end: caption.end,
      text: caption.text
    }
  };

  return wrapper;
}

function createPlayButton(onClick, variant = "caption") {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    variant === "highlight" ? "highlight-play-btn" : "caption-play-btn";
  button.textContent = "Play";
  button.disabled = isProcessing || !audioPlayer.src || (variant === "highlight" && currentPreviewMode !== "highlight");
  button.addEventListener("click", event => {
    event.stopPropagation();
    if (button.disabled) {
      return;
    }
    onClick();
  });
  return button;
}

function updatePlayButtonsState() {
  const disabledForCaption = isProcessing || !audioPlayer.src;
  const disabledForHighlight = isProcessing || !audioPlayer.src || currentPreviewMode !== "highlight";

  const captionButtons = captionListEl.querySelectorAll(".caption-play-btn");
  captionButtons.forEach(button => {
    button.disabled = disabledForCaption;
  });

  if (highlightListEl) {
    const highlightButtons = highlightListEl.querySelectorAll(".highlight-play-btn");
    highlightButtons.forEach(button => {
      button.disabled = disabledForHighlight;
    });
  }

  if (highlightActiveControls?.playButton) {
    highlightActiveControls.playButton.disabled = disabledForHighlight;
  }
}

function createHighlightTimeControls(field, valueMs) {
  const container = document.createElement("div");
  container.className = "inline-time-controls";

  const label = document.createElement("span");
  label.className = "time-label";
  label.textContent = field === "start" ? "Start" : "End";

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.textContent = "-100ms";
  minusBtn.disabled = isProcessing;
  minusBtn.addEventListener("click", event => {
    event.stopPropagation();
    nudgeHighlightTiming(field, -100);
  });

  const input = document.createElement("input");
  input.type = "text";
  input.value = msToTime(valueMs);
  input.disabled = isProcessing;
  input.addEventListener("click", event => event.stopPropagation());
  input.addEventListener("change", event => {
    event.stopPropagation();
    commitHighlightTimingChange({ announce: true });
  });
  input.addEventListener("blur", () => {
    commitHighlightTimingChange();
  });

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.textContent = "+100ms";
  plusBtn.disabled = isProcessing;
  plusBtn.addEventListener("click", event => {
    event.stopPropagation();
    nudgeHighlightTiming(field, 100);
  });

  const buttonRow = document.createElement("div");
  buttonRow.className = "time-buttons";
  buttonRow.append(minusBtn, input, plusBtn);

  container.append(label, buttonRow);
  return { container, input, minus: minusBtn, plus: plusBtn };
}

function autoResizeHighlightTextarea(textArea) {
  if (!textArea) {
    return;
  }
  textArea.style.height = "auto";
  textArea.style.height = `${Math.max(48, textArea.scrollHeight)}px`;
}

function updatePreviewIndex(index, options = {}) {
  if (!previewText) {
    return;
  }

  if (!captions.length) {
    previewIndex = -1;
    updatePreviewDisplay();
    return;
  }

  let target = Number.isFinite(index) ? index : previewIndex;
  if (!Number.isFinite(target) || target < 0 || target >= captions.length) {
    if (selectedCaptionIndex >= 0) {
      target = selectedCaptionIndex;
    } else {
      target = 0;
    }
  }

  const clamped = Math.max(0, Math.min(target, captions.length - 1));
  previewIndex = clamped;
  updatePreviewDisplay();

  if (!options.fromSelection && !options.skipSelectionSync) {
    setSelectedCaption(clamped, { seek: options.seek ?? false });
  }
}

function updatePreviewDisplay() {
  if (!previewText || !previewPrevBtn || !previewNextBtn) {
    return;
  }

  if (!captions.length || previewIndex < 0 || previewIndex >= captions.length) {
    previewText.textContent = "No captions loaded yet.";
    if (previewCounter) {
      previewCounter.textContent = "-- / --";
    }
    previewPrevBtn.disabled = true;
    previewNextBtn.disabled = true;
    if (previewPlayBtn) {
      previewPlayBtn.disabled = true;
    }
    return;
  }

  const caption = captions[previewIndex];
  previewText.textContent = caption.text || `Caption ${previewIndex + 1}`;
  if (previewCounter) {
    previewCounter.textContent = `#${previewIndex + 1} / ${captions.length}`;
  }

  previewPrevBtn.disabled = isProcessing || previewIndex <= 0;
  previewNextBtn.disabled = isProcessing || previewIndex >= captions.length - 1;
  if (previewPlayBtn) {
    previewPlayBtn.disabled = isProcessing || !audioPlayer.src;
  }
}

function setTranslatorStatus(message, tone = "info") {
  if (!translatorStatus) {
    return;
  }
  translatorStatus.textContent = message;
  translatorStatus.dataset.tone = tone;
}

function syncCaptionEdits(options = {}) {
  if (!captions.length) {
    return;
  }

  const updatedSrt = captionsToSrt(captions);
  srtOutput.value = updatedSrt;
  downloadBtn.disabled = false;
  updateShiftButtons();
  updateLanguageFixButton();
  renderCaptionList();
  applySelectionHighlight();
  updateCaptionHighlight(currentPlayingIndex, { force: true, scroll: false });
  populateInspector(selectedCaptionIndex);
  updateHighlightButtons();
  updatePreviewIndex(previewIndex, { fromSelection: true, skipSelectionSync: true });

  if (options.statusMessage) {
    setStatus(options.statusMessage, options.statusTone || "info");
  }
}

function updateHighlightInputsFromCaption() {
  if (!highlightActiveControls || highlightSelectionIndex < 0 || !captions[highlightSelectionIndex]) {
    return;
  }
  const caption = captions[highlightSelectionIndex];
  if (highlightActiveControls.startInput) {
    highlightActiveControls.startInput.value = msToTime(caption.start);
  }
  if (highlightActiveControls.endInput) {
    highlightActiveControls.endInput.value = msToTime(caption.end);
  }
  updatePreviewDisplay();
}

function commitHighlightTextChange(value) {
  if (highlightSelectionIndex < 0 || !captions[highlightSelectionIndex]) {
    return;
  }
  const normalized = value.replace(/\r/g, "");
  const caption = captions[highlightSelectionIndex];
  if (caption.text === normalized) {
    return;
  }
  caption.text = normalized;
  syncCaptionEdits();
  if (!highlightActiveControls?.textArea) {
    updatePreviewDisplay();
  }
}

function commitHighlightTimingChange(options = {}) {
  if (
    !highlightActiveControls ||
    highlightSelectionIndex < 0 ||
    !captions[highlightSelectionIndex]
  ) {
    return;
  }

  const startValue = highlightActiveControls.startInput?.value.trim() ?? "";
  const endValue = highlightActiveControls.endInput?.value.trim() ?? "";

  const startMs = parseTimestampString(startValue);
  const endMs = parseTimestampString(endValue);

  if (startMs === null || endMs === null) {
    setStatus("Invalid timestamp in highlight editor.", "error");
    updateHighlightInputsFromCaption();
    return;
  }

  if (endMs <= startMs) {
    setStatus("End time must be greater than start time.", "error");
    updateHighlightInputsFromCaption();
    return;
  }

  const caption = captions[highlightSelectionIndex];
  if (caption.start === startMs && caption.end === endMs) {
    updateHighlightInputsFromCaption();
    return;
  }

  caption.start = startMs;
  caption.end = endMs;

  if (options.announce) {
    syncCaptionEdits({ statusMessage: "Highlight timing updated.", statusTone: "success" });
  } else {
    syncCaptionEdits();
  }

  updateHighlightInputsFromCaption();
  updatePreviewDisplay();
}

function refreshHighlightControlsState() {
  if (!highlightActiveControls) {
    return;
  }
  const controls = highlightActiveControls;
  const disabled = isProcessing || currentPreviewMode !== "highlight";
  [
    controls.textArea,
    controls.startInput,
    controls.endInput,
    controls.startMinus,
    controls.startPlus,
    controls.endMinus,
    controls.endPlus,
    controls.resetButton,
    controls.playButton
  ].forEach(ctrl => {
    if (ctrl) {
      ctrl.disabled = disabled;
    }
  });
}

function selectHighlightItem(index) {
  if (index < 0 || index >= captions.length) {
    return;
  }
  highlightSelectionIndex = index;
  setSelectedCaption(index, { seek: false, fromHighlight: true });
  renderHighlightList();
  updateHighlightButtons();
}

function updateHighlightButtons() {
  const hasSelection = highlightSelectionIndex >= 0 && captions[highlightSelectionIndex];
  markUncertainBtn.disabled = isProcessing || currentPreviewMode !== "highlight" || !hasSelection;
  clearPlayBtn.disabled = isProcessing || currentPreviewMode !== "highlight" || !hasSelection || !audioPlayer.src;
  refreshHighlightControlsState();
  updatePlayButtonsState();
}

function markSelectedHighlight() {
  if (highlightSelectionIndex < 0 || !captions[highlightSelectionIndex]) {
    return;
  }
  highlightedCaptions.add(highlightSelectionIndex);
  renderHighlightList();
  updateHighlightButtons();
  setStatus("Marked caption as uncertain.", "info");
}

function clearAndPlaySelected() {
  if (highlightSelectionIndex < 0 || !captions[highlightSelectionIndex]) {
    return;
  }
  highlightedCaptions.delete(highlightSelectionIndex);
  renderHighlightList();
  updateHighlightButtons();
  setStatus("Cleared highlight and playing segment.", "info");
  playSelectedHighlight();
}

function playSelectedHighlight() {
  if (highlightSelectionIndex < 0 || !captions[highlightSelectionIndex]) {
    return;
  }
  playCaptionSegment(highlightSelectionIndex);
}

function resetHighlightEdits() {
  if (
    !highlightActiveControls ||
    highlightSelectionIndex < 0 ||
    !captions[highlightSelectionIndex]
  ) {
    return;
  }
  const { original, textArea, startInput, endInput } = highlightActiveControls;
  if (!original) {
    return;
  }

  const caption = captions[highlightSelectionIndex];
  caption.start = original.start;
  caption.end = original.end;
  caption.text = original.text;

  if (textArea) {
    textArea.value = original.text;
    autoResizeHighlightTextarea(textArea);
  }
  if (startInput) {
    startInput.value = msToTime(original.start);
  }
  if (endInput) {
    endInput.value = msToTime(original.end);
  }

  syncCaptionEdits({ statusMessage: "Highlight reset to original.", statusTone: "info" });
}

function nudgeHighlightTiming(field, delta) {
  if (highlightSelectionIndex < 0 || !captions[highlightSelectionIndex]) {
    return;
  }
  const caption = captions[highlightSelectionIndex];
  if (field === "start") {
    const maxStart = Math.max(0, caption.end - 10);
    const desired = caption.start + delta;
    caption.start = Math.max(0, Math.min(maxStart, desired));
    if (caption.end <= caption.start) {
      caption.end = caption.start + 10;
    }
  } else {
    const desired = caption.end + delta;
    const minEnd = caption.start + 10;
    caption.end = Math.max(minEnd, desired);
  }

  updateHighlightInputsFromCaption();
  syncCaptionEdits();
}

async function runTranslation() {
  if (!translateBtn) {
    return;
  }

  const language = translatorLanguageInput?.value.trim();
  if (!language) {
    setTranslatorStatus("Please enter a target language.", "error");
    return;
  }

  const baseSrt = getActiveSrt();
  if (!baseSrt) {
    setTranslatorStatus("No captions available to translate yet.", "error");
    return;
  }

  setTranslatorStatus(`Translating to ${language}...`, "info");
  translateBtn.disabled = true;
  toggleWorking(true);

  try {
    const payload = buildTranslationPayload(language, baseSrt);
    const translatedSrt = await callGeminiWithRotation(payload);
    if (!translatedSrt) {
      throw new Error("Gemini did not return translated subtitles.");
    }
    if (translationOutput) {
      translationOutput.value = translatedSrt.trim();
    }
    setTranslatorStatus(`Translation ready (${language}).`, "success");
  } catch (error) {
    console.error(error);
    setTranslatorStatus(error.message || "Translation failed.", "error");
  } finally {
    toggleWorking(false);
    translateBtn.disabled = false;
  }
}

function updateInspectorControls(enabled) {
  const canEnable = Boolean(enabled);
  inspectorStartInput.disabled = !canEnable;
  inspectorEndInput.disabled = !canEnable;
  inspectorTextInput.disabled = !canEnable;
  applyCaptionBtn.disabled = !canEnable;
  resetCaptionBtn.disabled = !canEnable;
  playCaptionBtn.disabled = !canEnable || !audioPlayer.src;
}

function populateInspector(index) {
  if (index < 0 || !captions[index]) {
    inspectorStartInput.value = "";
    inspectorEndInput.value = "";
    inspectorTextInput.value = "";
    updateInspectorControls(false);
    setInspectorStatus("");
    return;
  }

  const caption = captions[index];
  inspectorStartInput.value = msToTime(caption.start);
  inspectorEndInput.value = msToTime(caption.end);
  inspectorTextInput.value = caption.text;
  updateInspectorControls(true);
  setInspectorStatus("");
}

function setInspectorStatus(message, tone = "info") {
  inspectorStatus.textContent = message;
  inspectorStatus.dataset.tone = tone;
}

function applyInspectorChanges() {
  if (selectedCaptionIndex < 0 || !captions[selectedCaptionIndex]) {
    return;
  }

  const startValue = inspectorStartInput.value.trim();
  const endValue = inspectorEndInput.value.trim();
  const newText = inspectorTextInput.value.replace(/\r/g, "");

  const startMs = parseTimestampString(startValue);
  const endMs = parseTimestampString(endValue);

  if (startMs === null || endMs === null) {
    setInspectorStatus("Invalid timestamp. Use HH:MM:SS,mmm format.", "error");
    return;
  }

  if (endMs <= startMs) {
    setInspectorStatus("End time must be greater than start time.", "error");
    return;
  }

  const caption = captions[selectedCaptionIndex];
  caption.start = startMs;
  caption.end = endMs;
  caption.text = newText;

  renderCaptionList();
  applySelectionHighlight();
  updateCaptionHighlight(currentPlayingIndex, { force: true, scroll: false });
  applyCaptionsToOutputs();
  populateInspector(selectedCaptionIndex);
  setInspectorStatus("Caption updated.", "success");
}

function playCaptionSegment(index) {
  if (index < 0 || !captions[index]) {
    return;
  }
  const caption = captions[index];
  audioPlayer.currentTime = (caption.start || 0) / 1000;
  playbackClampEnd = caption.end;
  audioPlayer.play().catch(() => {
    setStatus("Unable to start audio playback automatically.", "error");
  });
}

async function callGeminiWithRotation(payload) {
  const shuffledKeys = shuffle([...GEMINI_KEYS]);
  let lastError;

  for (const key of shuffledKeys) {
    try {
      const response = await fetch(`${modelEndpoint}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Gemini error (${response.status}): ${details}`);
      }

      const data = await response.json();
      const text = extractText(data);
      if (!text) {
        throw new Error("Empty response from Gemini.");
      }

      return text;
    } catch (err) {
      console.warn(`Key failed, trying another: ${err.message}`);
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

function extractText(apiResponse) {
  const parts = apiResponse?.candidates?.[0]?.content?.parts;
  if (!parts) {
    return "";
  }
  return parts.map(part => part.text || "").join("").trim();
}

function guessMimeType(file) {
  if (file.type) {
    return file.type;
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "mp3":
    case "mpeg":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
    case "webm":
      return "audio/webm";
    default:
      return "application/octet-stream";
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      } else {
        reject(new Error("Failed to read file as base64."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the audio file."));
    reader.readAsDataURL(file);
  });
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function toggleWorking(isWorking) {
  transcribeBtn.disabled = isWorking;
  fileInput.disabled = isWorking;
  isProcessing = isWorking;
  downloadBtn.disabled = isWorking || !getActiveSrt();
  updateShiftButtons();
  updateLanguageFixButton();
  updateInspectorControls(!isWorking && selectedCaptionIndex >= 0 && Boolean(captions[selectedCaptionIndex]));
  updatePlayButtonsState();
}

function setStatus(message, tone = "info") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function generateFileName() {
  const baseName = fileInput.files?.[0]?.name.replace(/\.[^/.]+$/, "") || "transcription";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${baseName}-${timestamp}.srt`;
}

function getActiveSrt() {
  return (srtOutput.value || "").trim();
}

function captionsToSrt(list) {
  return list
    .map((caption, idx) => {
      const blockLines = [
        String(idx + 1),
        `${msToTime(caption.start)} --> ${msToTime(caption.end)}`,
        caption.text
      ];
      return blockLines.join("\n");
    })
    .join("\n\n");
}

function textToBase64(text) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function parseSrt(raw) {
  if (!raw) {
    return [];
  }

  const normalized = raw.replace(/\r/g, "");
  const lines = normalized.split("\n");
  const result = [];
  let i = 0;
  const TIME_PATTERN = /^(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/;

  while (i < lines.length) {
    let line = lines[i].trim();

    // Skip empty lines between blocks
    if (!line) {
      i += 1;
      continue;
    }

    let sequence = Number.NaN;
    if (/^\d+$/.test(line)) {
      sequence = Number.parseInt(line, 10);
      i += 1;
      line = lines[i]?.trim() ?? "";
    }

    const timeMatch = line.match(
      /^(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/
    );
    if (!timeMatch) {
      i += 1;
      continue;
    }

    const startTimestamp = normalizeSrtTimestamp(timeMatch[1]);
    const endTimestamp = normalizeSrtTimestamp(timeMatch[2]);
    i += 1;

    const textLines = [];
    while (i < lines.length) {
      const textLine = lines[i];
      if (textLine.trim() === "") {
        break;
      }
      const trimmed = textLine.trim();
      const nextTrimmed = lines[i + 1]?.trim() ?? "";
      if (/^\d+$/.test(trimmed) && TIME_PATTERN.test(nextTrimmed)) {
        break;
      }
      if (TIME_PATTERN.test(trimmed)) {
        break;
      }
      textLines.push(textLine.replace(/\s+$/g, ""));
      i += 1;
    }

    result.push({
      index: Number.isNaN(sequence) ? result.length + 1 : sequence,
      start: timeToMs(startTimestamp),
      end: timeToMs(endTimestamp),
      text: textLines.join("\n")
    });

    while (i < lines.length && lines[i].trim() === "") {
      i += 1;
    }
  }

  return result;
}

function parseTimestampString(value) {
  const trimmed = value.trim();
  const normalized = normalizeSrtTimestamp(trimmed);
  if (!/^\d{2}:\d{2}:\d{2},\d{3}$/.test(normalized)) {
    return null;
  }
  return timeToMs(normalized);
}

function normalizeSrtTimestamp(ts) {
  return ts.replace(".", ",");
}

function timeToMs(timestamp) {
  const normalized = normalizeSrtTimestamp(timestamp);
  const match = normalized.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!match) {
    return 0;
  }
  const hours = Number.parseInt(match[1], 10) || 0;
  const minutes = Number.parseInt(match[2], 10) || 0;
  const seconds = Number.parseInt(match[3], 10) || 0;
  const milliseconds = Number.parseInt(match[4], 10) || 0;

  return (((hours * 60 + minutes) * 60) + seconds) * 1000 + milliseconds;
}

function msToTime(value) {
  const safeValue = Math.max(0, Math.round(value));
  const totalSeconds = Math.floor(safeValue / 1000);
  const milliseconds = safeValue % 1000;
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}














