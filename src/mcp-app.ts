import { App } from "@modelcontextprotocol/ext-apps";
import { marked } from "marked";

// DOM elements
const chickletEl = document.getElementById("chicklet")!;
const chickletTitleEl = document.getElementById("chicklet-title")!;
const chickletPreviewEl = document.getElementById("chicklet-preview")!;
const chickletChevronEl = document.getElementById("chicklet-chevron")!;
const expandedViewEl = document.getElementById("expanded-view")!;
const openLinkEl = document.getElementById("open-link") as HTMLAnchorElement;
const viewContainer = document.getElementById("view-container")!;
const editContainer = document.getElementById("edit-container")!;
const editTitleEl = document.getElementById("edit-title") as HTMLInputElement;
const editContentEl = document.getElementById(
  "edit-content",
) as HTMLTextAreaElement;
const editBtn = document.getElementById("edit-btn") as HTMLButtonElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const cancelBtn = document.getElementById("cancel-btn") as HTMLButtonElement;
const statusBar = document.getElementById("status-bar")!;

// Page state
let pageData: {
  title: string;
  content: string;
  link?: string;
  workspaceId: string;
  pageId: string;
} | null = null;

let isEditing = false;
let isExpanded = false;

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Generate a plain-text preview (first ~120 chars of content)
function getPreviewText(markdown: string): string {
  const plain = markdown
    .replace(/^#{1,6}\s+/gm, "") // strip heading markers
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/`(.+?)`/g, "$1") // inline code
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
    .replace(/!\[.*?\]\(.+?\)/g, "") // images
    .replace(/^\s*[-*+]\s+/gm, "") // list markers
    .replace(/^\s*\d+\.\s+/gm, "") // ordered list markers
    .replace(/\n+/g, " ") // collapse newlines
    .trim();
  return plain.length > 120 ? plain.slice(0, 117) + "..." : plain;
}

function renderChicklet() {
  if (!pageData) return;
  chickletTitleEl.textContent = pageData.title;
  const preview = getPreviewText(pageData.content);
  chickletPreviewEl.textContent = preview || "Empty page";
}

function renderPage() {
  if (!pageData) return;

  renderChicklet();

  if (pageData.link) {
    openLinkEl.href = pageData.link;
    openLinkEl.style.display = "";
  }

  if (pageData.content.trim()) {
    viewContainer.innerHTML = marked.parse(pageData.content) as string;
  } else {
    viewContainer.innerHTML =
      '<div class="empty-state">This page is empty.</div>';
  }
}

function toggleExpand() {
  isExpanded = !isExpanded;
  expandedViewEl.classList.toggle("open", isExpanded);
  chickletEl.classList.toggle("expanded", isExpanded);
  chickletChevronEl.classList.toggle("expanded", isExpanded);
  chickletEl.setAttribute("aria-expanded", String(isExpanded));
}

function enterEditMode() {
  if (!pageData) return;
  if (!isExpanded) toggleExpand();
  isEditing = true;
  editTitleEl.value = pageData.title;
  editContentEl.value = pageData.content;

  viewContainer.style.display = "none";
  editContainer.style.display = "block";
  editBtn.style.display = "none";
  saveBtn.style.display = "";
  cancelBtn.style.display = "";
  statusBar.textContent = "";
  statusBar.className = "status-bar";

  editContentEl.focus();
}

function exitEditMode() {
  isEditing = false;
  viewContainer.style.display = "";
  editContainer.style.display = "none";
  editBtn.style.display = "";
  saveBtn.style.display = "none";
  cancelBtn.style.display = "none";
}

function setStatus(text: string, type: "saving" | "saved" | "error" | "") {
  statusBar.textContent = text;
  statusBar.className = `status-bar ${type}`;
}

// Chicklet click to expand/collapse
chickletEl.addEventListener("click", toggleExpand);
chickletEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    toggleExpand();
  }
});

// Try injected data first (Bebop host injects this before </head>)
const injectedData = (window as Record<string, unknown>).__MCP_TOOL_RESULT__ as
  | { content?: Array<{ type: string; text?: string }> }
  | undefined;

if (injectedData?.content) {
  const text = injectedData.content.find((c) => c.type === "text")?.text;
  if (text) {
    try {
      pageData = JSON.parse(text);
      renderPage();
    } catch {
      viewContainer.innerHTML = `<div class="empty-state">Failed to parse page data.</div>`;
    }
  }
}

// Also initialize the MCP App protocol for hosts that support it (e.g. Claude Code desktop)
const app = new App({ name: "Loop Page Viewer", version: "1.0.0" });
app.connect().catch(() => {
  // Connection may fail in hosts that don't implement ext-apps protocol — that's OK
  // if we already rendered from injected data above
});

// Handle tool result pushed by the host via ext-apps protocol
app.ontoolresult = (result) => {
  const text = result.content?.find(
    (c: { type: string }) => c.type === "text",
  )?.text;
  if (!text) return;

  try {
    pageData = JSON.parse(text);
    renderPage();
  } catch {
    viewContainer.innerHTML = `<div class="empty-state">Failed to parse page data.</div>`;
  }
};

// Edit button
editBtn.addEventListener("click", enterEditMode);

// Cancel button
cancelBtn.addEventListener("click", () => {
  exitEditMode();
  setStatus("", "");
});

// Save button
saveBtn.addEventListener("click", async () => {
  if (!pageData) return;

  const updatedTitle = editTitleEl.value.trim();
  const updatedContent = editContentEl.value;

  if (!updatedTitle) {
    setStatus("Title cannot be empty.", "error");
    return;
  }

  setStatus("Saving...", "saving");
  saveBtn.disabled = true;

  try {
    await app.callServerTool({
      name: "request_page_update",
      arguments: {
        workspaceId: pageData.workspaceId,
        pageId: pageData.pageId,
        title: updatedTitle,
        content: updatedContent,
      },
    });

    // Update local state
    pageData.title = updatedTitle;
    pageData.content = updatedContent;
    renderPage();
    exitEditMode();
    setStatus("Update sent to Loop.", "saved");

    setTimeout(() => setStatus("", ""), 3000);
  } catch (err) {
    setStatus(
      `Save failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      "error",
    );
  } finally {
    saveBtn.disabled = false;
  }
});

// Handle tab key in textarea for indentation
editContentEl.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const start = editContentEl.selectionStart;
    const end = editContentEl.selectionEnd;
    editContentEl.value =
      editContentEl.value.substring(0, start) +
      "  " +
      editContentEl.value.substring(end);
    editContentEl.selectionStart = editContentEl.selectionEnd = start + 2;
  }
});
