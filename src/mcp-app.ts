import { App } from "@modelcontextprotocol/ext-apps";
import { marked } from "marked";

// DOM elements
const pageTitleEl = document.getElementById("page-title")!;
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

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

function renderPage() {
  if (!pageData) return;

  pageTitleEl.textContent = pageData.title;

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

function enterEditMode() {
  if (!pageData) return;
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

// Initialize the MCP App
const app = new App({ name: "Loop Page Viewer", version: "1.0.0" });
app.connect();

// Handle tool result pushed by the host
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
