const form = document.getElementById("ask-form");
const input = document.getElementById("message");
const log = document.getElementById("log");
const scrollArea = document.querySelector(".scroll-area");
const submitButton = form.querySelector("button");
const suggestions = document.getElementById("suggestions");
const attachButton = document.getElementById("attach-button");
const imageInput = document.getElementById("image-input");
const attachmentPreview = document.getElementById("attachment-preview");
const attachmentThumb = document.getElementById("attachment-thumb");
const attachmentRemove = document.getElementById("attachment-remove");

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

let pendingImage = null; // { mediaType, data (base64, no prefix), dataUrl }
let isSending = false;

const narrowScreen = window.matchMedia("(max-width: 480px)");
const applyPlaceholder = (isNarrow) => {
  input.placeholder = isNarrow ? "メッセージを入力" : "メッセージを入力（Enterで送信 / Shift+Enterで改行）";
};
applyPlaceholder(narrowScreen.matches);
narrowScreen.addEventListener("change", (event) => applyPlaceholder(event.matches));

let sessionKey = null;

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(text) {
  const html = marked.parse(text);
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
}

function scrollToBottom() {
  scrollArea.scrollTop = scrollArea.scrollHeight;
}

const AVATARS = { user: "You", error: "!" };
const ASSISTANT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 3.2a1.3 1.3 0 1 1 1.3 1.3" />' +
  '<path d="M12 4.5V7" />' +
  '<path d="M12 7 3.4 12.9a1 1 0 0 0 .57 1.83h16.06a1 1 0 0 0 .57-1.83Z" />' +
  '<path d="M4.5 17.3h15" />' +
  "</svg>";

function createMessage(kind) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${kind}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  if (kind === "assistant") {
    avatar.innerHTML = ASSISTANT_ICON;
  } else {
    avatar.textContent = AVATARS[kind] ?? "";
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  log.appendChild(wrapper);
  scrollToBottom();
  return { wrapper, bubble };
}

function appendUserMessage(text, imageDataUrl) {
  document.body.classList.add("chat-active");
  const { bubble } = createMessage("user");
  if (imageDataUrl) {
    const img = document.createElement("img");
    img.className = "attached-image";
    img.src = imageDataUrl;
    img.alt = "添付した画像";
    bubble.appendChild(img);
  }
  bubble.appendChild(document.createTextNode(text));
}

function appendErrorMessage(text) {
  const { bubble } = createMessage("error");
  bubble.textContent = text;
}

function appendThinkingMessage() {
  const { wrapper, bubble } = createMessage("assistant");
  wrapper.classList.add("thinking");
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  return wrapper;
}

function resolveAssistantMessage(wrapper, text) {
  wrapper.classList.remove("thinking");
  const bubble = wrapper.querySelector(".bubble");
  bubble.innerHTML = renderMarkdown(text);
  bubble.querySelectorAll("a").forEach((a) => {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
  scrollToBottom();
}

// --- textarea auto-resize ---

function resizeTextarea() {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

input.addEventListener("input", resizeTextarea);

// --- Enter sends the message; Shift+Enter inserts a newline instead ---

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    if (event.shiftKey) {
      return; // let the textarea insert the newline as usual
    }
    event.preventDefault();
    form.requestSubmit();
  }
});

// --- image attachment (file picker or paste, for photo-based diagnosis) ---

function showAttachment(dataUrl) {
  attachmentThumb.src = dataUrl;
  attachmentPreview.hidden = false;
  attachButton.classList.add("has-image");
}

function clearAttachment() {
  pendingImage = null;
  attachmentPreview.hidden = true;
  attachmentThumb.src = "";
  attachButton.classList.remove("has-image");
  imageInput.value = "";
}

function processImageFile(file) {
  if (!file) return;
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    appendErrorMessage("対応していない画像形式です（PNG / JPEG / WEBP / GIFのみ）。");
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    appendErrorMessage("画像サイズが大きすぎます（8MBまで）。");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    pendingImage = { mediaType: file.type, data: base64, dataUrl };
    showAttachment(dataUrl);
  };
  reader.readAsDataURL(file);
}

attachButton.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", () => processImageFile(imageInput.files?.[0]));
attachmentRemove.addEventListener("click", clearAttachment);

input.addEventListener("paste", (event) => {
  const item = Array.from(event.clipboardData?.items ?? []).find((it) => it.kind === "file" && it.type.startsWith("image/"));
  if (!item) return;
  event.preventDefault();
  processImageFile(item.getAsFile());
});

// --- suggestion chips (shown before the first message) ---

suggestions?.addEventListener("click", (event) => {
  const chip = event.target.closest(".suggestion-chip");
  if (!chip) return;
  input.value = chip.dataset.prompt ?? "";
  resizeTextarea();
  form.requestSubmit();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSending) return; // a reply is still in flight; let the user keep typing, but don't send yet

  const image = pendingImage;
  const typed = input.value.trim();
  const message = typed || (image ? "この写真を見て診断してください。" : "");
  if (!message) return;

  isSending = true;
  appendUserMessage(message, image?.dataUrl);
  input.value = "";
  resizeTextarea();
  clearAttachment();
  submitButton.disabled = true;

  const thinkingEl = appendThinkingMessage();

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        sessionKey,
        ...(image ? { image: { mediaType: image.mediaType, data: image.data } } : {}),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      thinkingEl.remove();
      appendErrorMessage(data.error ?? "不明なエラーが発生しました。");
      return;
    }
    sessionKey = data.sessionKey;
    resolveAssistantMessage(thinkingEl, data.reply);
  } catch (error) {
    thinkingEl.remove();
    appendErrorMessage(String(error));
  } finally {
    isSending = false;
    submitButton.disabled = false;
    input.focus();
  }
});
