/**
 * SmartNotes - Client Application Logic
 */

// Application State
const state = {
  currentNav: 'all',          // 'all', 'pinned', 'archived'
  selectedCategory: null,     // category id or null
  selectedTags: new Set(),    // Set of tag IDs
  selectedType: '',           // '', 'text', 'link', 'file', 'code', 'todo'
  searchQuery: '',            // search string
  sortBy: 'updated_at',       // 'updated_at', 'created_at', 'title'
  sortOrder: 'desc',          // 'asc', 'desc'
  viewMode: 'grid',           // 'grid' or 'list'
  notes: [],
  categories: [],
  tags: [],
  currentViewingNote: null,
  isEditing: false
};

// Pastel Color Options for Notes
const NOTE_COLORS = [
  { name: 'Білий', hex: '#ffffff' },
  { name: 'Блакитний', hex: '#e0f2fe' },
  { name: 'Зелений', hex: '#ecfdf5' },
  { name: 'Жовтий', hex: '#fef3c7' },
  { name: 'Рожевий', hex: '#fdf2f8' },
  { name: 'Фіолетовий', hex: '#f3e8ff' },
  { name: 'Сірий', hex: '#f1f5f9' },
];

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  setupColorPicker();
  loadCategories();
  loadTags();
  loadStats();
  loadNotes();
});

// ================= THEME (DARK / LIGHT) =================
function initTheme() {
  const isDark = localStorage.getItem('theme') === 'dark' || 
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    const isNowDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
    showToast(isNowDark ? 'Увімкнено темну тему' : 'Увімкнено світлу тему', 'info');
  });
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
  // Mobile Sidebar Toggle
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
      sidebar.classList.toggle('fixed');
      sidebar.classList.toggle('inset-y-0');
      sidebar.classList.toggle('left-0');
      sidebar.classList.toggle('z-40');
      sidebar.classList.toggle('bg-white');
      sidebar.classList.toggle('dark:bg-slate-900');
      sidebar.classList.toggle('p-4');
      sidebar.classList.toggle('shadow-2xl');
    });
  }

  // Live Search with Debounce
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  let searchTimer = null;

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    state.searchQuery = val;
    searchClearBtn.classList.toggle('hidden', val.length === 0);

    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      loadNotes();
    }, 250);
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    searchClearBtn.classList.add('hidden');
    loadNotes();
  });

  // Navigation Items (All, Pinned, Archived)
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.remove('bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600', 'dark:text-blue-400');
        b.classList.add('text-slate-600', 'dark:text-slate-300');
      });
      btn.classList.add('bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600', 'dark:text-blue-400');
      btn.classList.remove('text-slate-600', 'dark:text-slate-300');

      state.currentNav = btn.getAttribute('data-nav');
      updateViewTitle();
      loadNotes();
    });
  });

  // Type Filters
  document.querySelectorAll('.type-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-filter-btn').forEach(b => {
        b.classList.remove('text-blue-600', 'dark:text-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20');
        b.classList.add('text-slate-600', 'dark:text-slate-300');
      });
      btn.classList.add('text-blue-600', 'dark:text-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20');
      btn.classList.remove('text-slate-600', 'dark:text-slate-300');

      state.selectedType = btn.getAttribute('data-type');
      updateViewTitle();
      loadNotes();
    });
  });

  // Sort Dropdown
  const sortSelect = document.getElementById('sortSelect');
  sortSelect.addEventListener('change', () => {
    const [field, order] = sortSelect.value.split(':');
    state.sortBy = field;
    state.sortOrder = order;
    loadNotes();
  });

  // View Mode (Grid vs List)
  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewListBtn = document.getElementById('viewListBtn');

  viewGridBtn.addEventListener('click', () => {
    state.viewMode = 'grid';
    viewGridBtn.classList.add('bg-white', 'dark:bg-slate-800', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm');
    viewGridBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
    viewListBtn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm');
    viewListBtn.classList.add('text-slate-500', 'dark:text-slate-400');
    renderNotes();
  });

  viewListBtn.addEventListener('click', () => {
    state.viewMode = 'list';
    viewListBtn.classList.add('bg-white', 'dark:bg-slate-800', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm');
    viewListBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
    viewGridBtn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-blue-600', 'dark:text-blue-400', 'shadow-sm');
    viewGridBtn.classList.add('text-slate-500', 'dark:text-slate-400');
    renderNotes();
  });

  // Clear all filters button
  document.getElementById('clearAllFiltersBtn').addEventListener('click', resetAllFilters);

  // Top action buttons
  document.getElementById('openCreateModalBtn').addEventListener('click', openCreateModal);
  const aboutBtn = document.getElementById('openAboutModalBtn');
  if (aboutBtn) aboutBtn.addEventListener('click', openAboutModal);
  document.getElementById('openCategoryModalBtn').addEventListener('click', openCategoryModal);
  document.getElementById('openTagModalBtn').addEventListener('click', openTagModal);
  document.getElementById('exportBtn').addEventListener('click', handleExport);

  // Modal type selector buttons
  document.querySelectorAll('.modal-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-type-btn').forEach(b => {
        b.classList.remove('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
        b.classList.add('text-slate-600', 'dark:text-slate-400');
      });
      btn.classList.add('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
      btn.classList.remove('text-slate-600', 'dark:text-slate-400');

      const type = btn.getAttribute('data-modal-type');
      document.getElementById('noteTypeInput').value = type;
      toggleTypeFields(type);
    });
  });

  // Setup detail modal action buttons
  document.getElementById('viewDetailPinBtn').addEventListener('click', () => {
    if (state.currentViewingNote) togglePinNote(state.currentViewingNote.id);
  });
  document.getElementById('viewDetailDeleteBtn').addEventListener('click', () => {
    if (state.currentViewingNote) {
      deleteNote(state.currentViewingNote.id);
      closeViewModal();
    }
  });
  document.getElementById('viewDetailEditBtn').addEventListener('click', () => {
    if (state.currentViewingNote) {
      const noteToEdit = state.currentViewingNote;
      closeViewModal();
      openEditModal(noteToEdit);
    }
  });
  document.getElementById('viewDetailCopyBtn').addEventListener('click', () => {
    if (state.currentViewingNote) {
      const text = `${state.currentViewingNote.title}\n\n${state.currentViewingNote.content || ''}`;
      navigator.clipboard.writeText(text);
      showToast('Текст нотатки скопійовано в буфер', 'success');
    }
  });
}

// ================= COLOR PICKER SETUP =================
function setupColorPicker() {
  const container = document.getElementById('colorPickerContainer');
  const colorInput = document.getElementById('noteColorInput');
  container.innerHTML = '';

  NOTE_COLORS.forEach((color, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = color.name;
    btn.className = `w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 transition-transform ${idx === 0 ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`;
    btn.style.backgroundColor = color.hex;
    btn.addEventListener('click', () => {
      container.querySelectorAll('button').forEach(b => b.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-1'));
      btn.classList.add('ring-2', 'ring-blue-500', 'ring-offset-1');
      colorInput.value = color.hex;
    });
    container.appendChild(btn);
  });
}

function selectColorInPicker(hex) {
  const container = document.getElementById('colorPickerContainer');
  const colorInput = document.getElementById('noteColorInput');
  colorInput.value = hex || '#ffffff';
  container.querySelectorAll('button').forEach(btn => {
    if (btn.style.backgroundColor === hex || (hex === '#ffffff' && btn.title === 'Білий')) {
      btn.classList.add('ring-2', 'ring-blue-500', 'ring-offset-1');
    } else {
      btn.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-1');
    }
  });
}

// ================= DRAWING CANVAS SUBSYSTEM =================
const canvasState = {
  canvas: null,
  ctx: null,
  isDrawing: false,
  tool: 'pen',
  color: '#0f172a',
  size: 2,
  initialized: false
};

function initCanvasIfNeeded() {
  const canvas = document.getElementById('sketchCanvas');
  if (!canvas) return;
  canvasState.canvas = canvas;
  canvasState.ctx = canvas.getContext('2d');

  if (canvasState.initialized) return;
  canvasState.initialized = true;

  clearCanvas(true);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function startDraw(e) {
    e.preventDefault();
    canvasState.isDrawing = true;
    const pos = getPos(e);
    canvasState.ctx.beginPath();
    canvasState.ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!canvasState.isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasState.ctx;
    ctx.lineWidth = canvasState.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = canvasState.tool === 'eraser' ? '#ffffff' : canvasState.color;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDraw(e) {
    if (!canvasState.isDrawing) return;
    canvasState.isDrawing = false;
    canvasState.ctx.closePath();
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDraw, { passive: false });

  // Tool buttons
  const toolPenBtn = document.getElementById('toolPenBtn');
  const toolEraserBtn = document.getElementById('toolEraserBtn');

  if (toolPenBtn && toolEraserBtn) {
    toolPenBtn.addEventListener('click', () => {
      canvasState.tool = 'pen';
      toolPenBtn.classList.add('bg-white', 'dark:bg-slate-700', 'text-blue-600', 'dark:text-blue-400', 'border-slate-300', 'dark:border-slate-600');
      toolEraserBtn.classList.remove('bg-white', 'dark:bg-slate-700', 'text-blue-600', 'dark:text-blue-400', 'border-slate-300', 'dark:border-slate-600');
    });

    toolEraserBtn.addEventListener('click', () => {
      canvasState.tool = 'eraser';
      toolEraserBtn.classList.add('bg-white', 'dark:bg-slate-700', 'text-blue-600', 'dark:text-blue-400', 'border-slate-300', 'dark:border-slate-600');
      toolPenBtn.classList.remove('bg-white', 'dark:bg-slate-700', 'text-blue-600', 'dark:text-blue-400', 'border-slate-300', 'dark:border-slate-600');
    });
  }

  // Brush size buttons
  document.querySelectorAll('.brush-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.brush-size-btn').forEach(b => {
        b.classList.remove('border-slate-300', 'dark:border-slate-600', 'bg-white', 'dark:bg-slate-700', 'text-slate-900', 'dark:text-slate-100');
        b.classList.add('border-transparent', 'text-slate-600', 'dark:text-slate-400');
      });
      btn.classList.add('border-slate-300', 'dark:border-slate-600', 'bg-white', 'dark:bg-slate-700', 'text-slate-900', 'dark:text-slate-100');
      btn.classList.remove('border-transparent', 'text-slate-600', 'dark:text-slate-400');
      canvasState.size = parseInt(btn.getAttribute('data-brush-size'), 10) || 2;
    });
  });

  // Colors
  const colorPickerEl = document.getElementById('canvasColorPicker');
  if (colorPickerEl) {
    colorPickerEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        colorPickerEl.querySelectorAll('button').forEach(b => b.classList.remove('ring-1', 'ring-blue-500'));
        btn.classList.add('ring-1', 'ring-blue-500');
        canvasState.color = btn.getAttribute('data-color');
        if (canvasState.tool === 'eraser' && toolPenBtn) {
          toolPenBtn.click();
        }
      });
    });
  }

  // Clear button
  const clearBtn = document.getElementById('clearCanvasBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => clearCanvas(true));
  }
}

function clearCanvas(fillWhite = true) {
  const canvas = document.getElementById('sketchCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (fillWhite) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function loadDrawingToCanvas(dataUrl) {
  initCanvasIfNeeded();
  clearCanvas(true);
  if (!dataUrl) return;
  const img = new Image();
  img.onload = () => {
    const canvas = document.getElementById('sketchCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = dataUrl;
}

// ================= TOGGLE FIELDS BY TYPE =================
function toggleTypeFields(type) {
  const linkBox = document.getElementById('linkInputContainer');
  const fileBox = document.getElementById('fileInputContainer');
  const drawBox = document.getElementById('drawingInputContainer');
  const contentSection = document.getElementById('contentSectionContainer');

  if (linkBox) linkBox.classList.toggle('hidden', type !== 'link');
  if (fileBox) fileBox.classList.toggle('hidden', type !== 'file');
  if (drawBox) {
    drawBox.classList.toggle('hidden', type !== 'draw');
    if (type === 'draw') {
      setTimeout(initCanvasIfNeeded, 50);
    }
  }
  if (contentSection) {
    contentSection.classList.toggle('hidden', type === 'draw');
  }
}

// ================= EDITOR TAB SWITCHING (WRITE / PREVIEW) =================
function switchEditorTab(tab) {
  const writeTab = document.getElementById('editorWriteTab');
  const previewTab = document.getElementById('editorPreviewTab');
  const writeContainer = document.getElementById('editorWriteContainer');
  const previewContainer = document.getElementById('editorPreviewContainer');

  if (tab === 'preview') {
    writeTab.classList.remove('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
    writeTab.classList.add('text-slate-500');
    previewTab.classList.add('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
    previewTab.classList.remove('text-slate-500');

    writeContainer.classList.add('hidden');
    previewContainer.classList.remove('hidden');

    const content = document.getElementById('noteContentInput').value;
    previewContainer.innerHTML = content ? marked.parse(content) : '<span class="text-slate-400 text-xs italic">Текст відсутній...</span>';
  } else {
    previewTab.classList.remove('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
    previewTab.classList.add('text-slate-500');
    writeTab.classList.add('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
    writeTab.classList.remove('text-slate-500');

    previewContainer.classList.add('hidden');
    writeContainer.classList.remove('hidden');
  }
}

// ================= FILE ATTACHMENT HANDLERS =================
let selectedFileObject = null;
let removeExistingFileFlag = false;

function handleFileSelected(input) {
  if (input.files && input.files[0]) {
    selectedFileObject = input.files[0];
    removeExistingFileFlag = false;
    showAttachedFileInfo(selectedFileObject.name, formatBytes(selectedFileObject.size));
  }
}

function showAttachedFileInfo(name, size) {
  document.getElementById('fileUploadPrompt').classList.add('hidden');
  const attachedBox = document.getElementById('fileAttachedInfo');
  attachedBox.classList.remove('hidden');
  document.getElementById('attachedFileName').textContent = name;
  document.getElementById('attachedFileSize').textContent = size;
}

function removeAttachedFile() {
  selectedFileObject = null;
  removeExistingFileFlag = true;
  document.getElementById('noteFileInput').value = '';
  document.getElementById('fileAttachedInfo').classList.add('hidden');
  document.getElementById('fileUploadPrompt').classList.remove('hidden');
}

// ================= API CALLS =================

// 1. Fetch & Render Notes
async function loadNotes() {
  try {
    const params = new URLSearchParams();

    if (state.searchQuery) params.append('q', state.searchQuery);
    if (state.selectedCategory) params.append('category_id', state.selectedCategory);
    if (state.selectedTags.size > 0) params.append('tags', Array.from(state.selectedTags).join(','));
    if (state.selectedType) params.append('type', state.selectedType);
    
    if (state.currentNav === 'pinned') {
      params.append('is_pinned', '1');
      params.append('is_archived', '0');
    } else if (state.currentNav === 'archived') {
      params.append('is_archived', '1');
    } else {
      params.append('is_archived', '0');
    }

    params.append('sort_by', state.sortBy);
    params.append('order', state.sortOrder);

    const res = await fetch(`/api/notes?${params.toString()}`);
    const data = await res.json();

    if (data.status === 'success') {
      state.notes = data.data;
      document.getElementById('filteredCount').textContent = state.notes.length;
      renderActiveFilterPills();
      renderNotes();
    }
  } catch (err) {
    console.error('Помилка завантаження нотаток:', err);
    showToast('Не вдалося завантажити нотатки', 'error');
  }
}

// 2. Fetch & Render Categories
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (data.status === 'success') {
      state.categories = data.data;
      renderCategoryList();
      populateCategorySelect();
    }
  } catch (err) {
    console.error('Помилка завантаження категорій:', err);
  }
}

// 3. Fetch & Render Tags
async function loadTags() {
  try {
    const res = await fetch('/api/tags');
    const data = await res.json();
    if (data.status === 'success') {
      state.tags = data.data;
      renderTagCloud();
    }
  } catch (err) {
    console.error('Помилка завантаження тегів:', err);
  }
}

// 4. Fetch Stats
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (data.status === 'success') {
      const s = data.data;
      document.getElementById('countAllNotes').textContent = s.total_notes;
      document.getElementById('countPinnedNotes').textContent = s.total_pinned;
      document.getElementById('countArchivedNotes').textContent = s.total_archived;

      // Stats Modal Counters
      if (document.getElementById('statNotes')) document.getElementById('statNotes').textContent = s.total_notes;
      if (document.getElementById('statCategories')) document.getElementById('statCategories').textContent = s.total_categories;
      if (document.getElementById('statTags')) document.getElementById('statTags').textContent = s.total_tags;

      // Type badges in sidebar
      if (s.notes_by_type) {
        if (document.getElementById('typeCount-text')) document.getElementById('typeCount-text').textContent = s.notes_by_type['text'] || 0;
        if (document.getElementById('typeCount-draw')) document.getElementById('typeCount-draw').textContent = s.notes_by_type['draw'] || 0;
        if (document.getElementById('typeCount-link')) document.getElementById('typeCount-link').textContent = s.notes_by_type['link'] || 0;
        if (document.getElementById('typeCount-file')) document.getElementById('typeCount-file').textContent = s.notes_by_type['file'] || 0;
        if (document.getElementById('typeCount-code')) document.getElementById('typeCount-code').textContent = s.notes_by_type['code'] || 0;
        if (document.getElementById('typeCount-todo')) document.getElementById('typeCount-todo').textContent = s.notes_by_type['todo'] || 0;
      }
    }
  } catch (err) {
    console.error('Помилка завантаження статистики:', err);
  }
}

// ================= RENDER FUNCTIONS =================

function renderNotes() {
  const container = document.getElementById('notesContainer');
  const emptyState = document.getElementById('emptyState');

  if (state.notes.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  if (state.viewMode === 'list') {
    container.className = 'flex flex-col gap-3';
    container.innerHTML = state.notes.map(note => createNoteListItemHTML(note)).join('');
  } else {
    container.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5';
    container.innerHTML = state.notes.map(note => createNoteCardHTML(note)).join('');
  }
}

// Card HTML Builder
function createNoteCardHTML(note) {
  const isDrawing = note.type === 'draw' || (note.content && note.content.startsWith('data:image/'));
  const typeBadge = getTypeBadge(isDrawing ? 'draw' : note.type);
  const highlightedTitle = highlightSearch(escapeHTML(note.title), state.searchQuery);
  const snippet = isDrawing ? '' : (note.content ? truncate(marked.parse(note.content), 180) : '');
  const dateFormatted = formatDate(note.updated_at);
  const cardBg = note.color && note.color !== '#ffffff' 
    ? `style="border-color: ${note.color}55; background: linear-gradient(135deg, ${note.color}15 0%, var(--glass-card-bg) 100%);"` 
    : '';

  // Render Tags
  const tagsHTML = note.tags && note.tags.length > 0 
    ? note.tags.map(t => `
        <span onclick="event.stopPropagation(); toggleTagFilter(${t.id})" 
              class="tag-pill text-[10px] font-medium px-2 py-0.5 rounded-full cursor-pointer hover:opacity-85 transition-all ${state.selectedTags.has(t.id) ? 'active bg-blue-600 text-white' : 'bg-white/40 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-white/30 dark:border-white/10'}">
          #${escapeHTML(t.name)}
        </span>
      `).join('')
    : '';

  // Material attachment preview
  let attachmentHTML = '';
  if (isDrawing && note.content) {
    attachmentHTML = `
      <div class="mt-2.5 border border-white/40 dark:border-white/10 bg-white/70 dark:bg-black/25 backdrop-blur-md rounded-xl overflow-hidden flex items-center justify-center p-2 shadow-inner">
        <img src="${escapeHTML(note.content)}" alt="Малюнок" class="w-full h-32 object-contain pointer-events-none" />
      </div>
    `;
  } else if (note.type === 'link' && note.url) {
    attachmentHTML = `
      <div class="mt-2.5 p-2 rounded-xl bg-blue-500/10 dark:bg-blue-950/20 border border-blue-400/20 flex items-center justify-between text-xs backdrop-blur-sm">
        <span class="truncate text-blue-700 dark:text-blue-300 font-medium">${escapeHTML(note.url)}</span>
        <a href="${escapeHTML(note.url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="p-1 text-blue-600 dark:text-blue-400 hover:scale-105 transition-transform flex-shrink-0 ml-2" title="Відкрити">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    `;
  } else if (note.type === 'file' && note.file_path) {
    attachmentHTML = `
      <div class="mt-2.5 p-2 rounded-xl bg-slate-500/10 dark:bg-slate-800/25 flex items-center justify-between text-xs border border-white/20 dark:border-white/10 backdrop-blur-sm">
        <div class="flex items-center gap-2 truncate">
          <i class="fa-solid fa-paperclip text-slate-500"></i>
          <span class="truncate font-medium text-slate-700 dark:text-slate-200">${escapeHTML(note.file_name || 'Файл')}</span>
        </div>
        <a href="${escapeHTML(note.file_path)}" download onclick="event.stopPropagation()" class="p-1 text-blue-600 dark:text-blue-400 hover:scale-105 transition-transform flex-shrink-0" title="Завантажити">
          <i class="fa-solid fa-download"></i>
        </a>
      </div>
    `;
  }

  return `
    <div onclick="openViewModal(${note.id})" 
         ${cardBg}
         class="note-card cursor-pointer group relative p-4 flex flex-col justify-between">
      
      <div>
        <!-- Top bar: Category + Type + Pin -->
        <div class="flex items-center justify-between gap-2 mb-2.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${note.category_name ? `
              <span class="badge-apple text-[10px] font-semibold text-white shadow-sm" style="background-color: ${note.category_color || '#5856d6'};">
                ${escapeHTML(note.category_name)}
              </span>
            ` : ''}
            ${typeBadge}
          </div>

          <!-- Pin Button -->
          <button onclick="event.stopPropagation(); togglePinNote(${note.id})" 
                  class="p-1.5 rounded-full transition-all ${note.is_pinned ? 'text-amber-500 bg-amber-500/15' : 'text-slate-400 hover:text-amber-500 hover:bg-white/20'}"
                  title="${note.is_pinned ? 'Відкріпити' : 'Закріпити'}">
            <i class="fa-solid fa-thumbtack ${note.is_pinned ? 'rotate-45' : ''}"></i>
          </button>
        </div>

        <!-- Note Title -->
        <h3 class="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mb-1.5">
          ${highlightedTitle}
        </h3>

        <!-- Content Snippet -->
        ${snippet ? `
          <div class="markdown-body text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed mb-2">
            ${snippet}
          </div>
        ` : ''}

        <!-- Material Attachment Preview -->
        ${attachmentHTML}
      </div>

      <!-- Footer: Tags, Date, Actions -->
      <div class="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
        <div class="flex flex-wrap gap-1">
          ${tagsHTML}
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span>${dateFormatted}</span>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="event.stopPropagation(); editNoteById(${note.id})" class="p-1 hover:text-blue-600" title="Редагувати">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button onclick="event.stopPropagation(); deleteNote(${note.id})" class="p-1 hover:text-rose-500" title="Видалити">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>

    </div>
  `;
}

// List Item HTML Builder
function createNoteListItemHTML(note) {
  const isDrawing = note.type === 'draw' || (note.content && note.content.startsWith('data:image/'));
  const typeBadge = getTypeBadge(isDrawing ? 'draw' : note.type);
  const highlightedTitle = highlightSearch(escapeHTML(note.title), state.searchQuery);
  const dateFormatted = formatDate(note.updated_at);
  const cardBg = note.color && note.color !== '#ffffff' 
    ? `style="border-color: ${note.color}55; background: linear-gradient(135deg, ${note.color}15 0%, var(--glass-card-bg) 100%);"` 
    : '';

  return `
    <div onclick="openViewModal(${note.id})" 
         ${cardBg}
         class="note-card cursor-pointer group p-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <button onclick="event.stopPropagation(); togglePinNote(${note.id})" 
                class="p-1 text-xs ${note.is_pinned ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}">
          <i class="fa-solid fa-thumbtack ${note.is_pinned ? 'rotate-45' : ''}"></i>
        </button>
        <div class="truncate">
          <div class="flex items-center gap-1.5 mb-0.5">
            ${note.category_name ? `
              <span class="badge-apple text-[10px] font-semibold text-white shadow-sm" style="background-color: ${note.category_color || '#5856d6'};">
                ${escapeHTML(note.category_name)}
              </span>
            ` : ''}
            ${typeBadge}
            <span class="text-[11px] text-slate-400">${dateFormatted}</span>
          </div>
          <h3 class="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
            ${highlightedTitle}
          </h3>
        </div>
      </div>

      <div class="flex items-center gap-1.5 flex-shrink-0">
        <div class="hidden sm:flex items-center gap-1">
          ${note.tags.slice(0, 3).map(t => `
            <span class="badge-apple text-[10px] bg-white/40 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-white/20 dark:border-white/10">#${escapeHTML(t.name)}</span>
          `).join('')}
        </div>
        <button onclick="event.stopPropagation(); editNoteById(${note.id})" class="p-1 rounded-full text-slate-400 hover:text-blue-600 hover:bg-white/20">
          <i class="fa-solid fa-pen text-xs"></i>
        </button>
        <button onclick="event.stopPropagation(); deleteNote(${note.id})" class="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-white/20">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </div>
    </div>
  `;
}

// Category List Renderer
function renderCategoryList() {
  const container = document.getElementById('categoryListContainer');
  container.innerHTML = state.categories.map(cat => `
    <button onclick="toggleCategoryFilter(${cat.id})" 
            class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors ${state.selectedCategory === cat.id ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">
      <span class="flex items-center gap-2 truncate">
        <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0" style="background-color: ${cat.color || '#2563eb'};"></span>
        <span class="truncate">${escapeHTML(cat.name)}</span>
      </span>
      <span class="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800">${cat.notes_count || 0}</span>
    </button>
  `).join('');
}

// Tag Cloud Renderer
function renderTagCloud() {
  const container = document.getElementById('tagCloudContainer');
  if (state.tags.length === 0) {
    container.innerHTML = '<span class="text-xs text-slate-400 italic">Тегів ще немає</span>';
    return;
  }

  container.innerHTML = state.tags.map(t => {
    const isSelected = state.selectedTags.has(t.id);
    return `
      <button onclick="toggleTagFilter(${t.id})" 
              class="tag-pill text-xs font-medium px-2 py-0.5 rounded-sm transition-all flex items-center gap-1 ${isSelected ? 'active bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'}">
        <span>#${escapeHTML(t.name)}</span>
        <span class="text-[10px] opacity-70">(${t.notes_count || 0})</span>
      </button>
    `;
  }).join('');
}

// Active Filter Pills Renderer
function renderActiveFilterPills() {
  const row = document.getElementById('activeFiltersRow');
  const container = document.getElementById('filterPillsContainer');
  container.innerHTML = '';

  let hasFilters = false;

  // Category filter pill
  if (state.selectedCategory) {
    const cat = state.categories.find(c => c.id === state.selectedCategory);
    if (cat) {
      hasFilters = true;
      container.appendChild(createPill(`Категорія: ${cat.name}`, () => {
        state.selectedCategory = null;
        loadNotes();
        renderCategoryList();
      }));
    }
  }

  // Type filter pill
  if (state.selectedType) {
    hasFilters = true;
    const typeNames = { text: 'Текст', draw: 'Малюнки', link: 'Посилання', file: 'Файли', code: 'Код', todo: 'Списки' };
    container.appendChild(createPill(`Тип: ${typeNames[state.selectedType] || state.selectedType}`, () => {
      state.selectedType = '';
      document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('text-blue-600', 'bg-blue-50'));
      loadNotes();
    }));
  }

  // Tags filter pills
  state.selectedTags.forEach(tagId => {
    const t = state.tags.find(item => item.id === tagId);
    if (t) {
      hasFilters = true;
      container.appendChild(createPill(`#${t.name}`, () => {
        state.selectedTags.delete(tagId);
        loadNotes();
        renderTagCloud();
      }));
    }
  });

  // Search query pill
  if (state.searchQuery) {
    hasFilters = true;
    container.appendChild(createPill(`Пошук: "${state.searchQuery}"`, () => {
      state.searchQuery = '';
      document.getElementById('searchInput').value = '';
      document.getElementById('searchClearBtn').classList.add('hidden');
      loadNotes();
    }));
  }

  row.classList.toggle('hidden', !hasFilters);
}

function createPill(label, onRemove) {
  const pill = document.createElement('span');
  pill.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-medium bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900';
  pill.innerHTML = `<span>${escapeHTML(label)}</span><button class="hover:text-rose-500 font-bold ml-0.5">&times;</button>`;
  pill.querySelector('button').addEventListener('click', onRemove);
  return pill;
}

// ================= FILTER CONTROLS =================

function toggleCategoryFilter(catId) {
  if (state.selectedCategory === catId) {
    state.selectedCategory = null;
  } else {
    state.selectedCategory = catId;
  }
  renderCategoryList();
  updateViewTitle();
  loadNotes();
}

function toggleTagFilter(tagId) {
  if (state.selectedTags.has(tagId)) {
    state.selectedTags.delete(tagId);
  } else {
    state.selectedTags.add(tagId);
  }
  renderTagCloud();
  loadNotes();
}

function resetAllFilters() {
  state.currentNav = 'all';
  state.selectedCategory = null;
  state.selectedTags.clear();
  state.selectedType = '';
  state.searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClearBtn').classList.add('hidden');

  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.remove('bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600', 'dark:text-blue-400');
    b.classList.add('text-slate-600', 'dark:text-slate-300');
  });
  const allNav = document.querySelector('.nav-item[data-nav="all"]');
  if (allNav) {
    allNav.classList.add('bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600', 'dark:text-blue-400');
  }

  document.querySelectorAll('.type-filter-btn').forEach(b => {
    b.classList.remove('text-blue-600', 'dark:text-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20');
  });

  renderCategoryList();
  renderTagCloud();
  updateViewTitle();
  loadNotes();
  showToast('Всі фільтри скинуто', 'info');
}

function updateViewTitle() {
  const title = document.getElementById('viewTitle');
  if (state.currentNav === 'pinned') {
    title.innerHTML = '<i class="fa-solid fa-thumbtack text-amber-500"></i> <span>Закріплені матеріали</span>';
  } else if (state.currentNav === 'archived') {
    title.innerHTML = '<i class="fa-solid fa-box-archive text-slate-400"></i> <span>Архів нотаток</span>';
  } else if (state.selectedCategory) {
    const cat = state.categories.find(c => c.id === state.selectedCategory);
    title.innerHTML = `<i class="fa-solid fa-folder text-blue-500"></i> <span>Категорія: ${escapeHTML(cat ? cat.name : '')}</span>`;
  } else {
    title.innerHTML = '<i class="fa-solid fa-layer-group text-blue-500"></i> <span>Всі матеріали</span>';
  }
}

// ================= NOTE ACTIONS: CREATE / EDIT / DELETE / PIN =================

function openCreateModal() {
  state.isEditing = false;
  document.getElementById('noteModalTitle').innerHTML = '<i class="fa-solid fa-plus text-blue-500"></i> <span>Створення нотатки</span>';
  document.getElementById('noteIdInput').value = '';
  document.getElementById('noteTitleInput').value = '';
  document.getElementById('noteContentInput').value = '';
  document.getElementById('noteUrlInput').value = '';
  document.getElementById('noteTagsInput').value = '';
  document.getElementById('notePinnedInput').checked = false;
  document.getElementById('noteCategorySelect').value = state.selectedCategory || '';
  
  selectColorInPicker('#ffffff');
  removeAttachedFile();
  switchEditorTab('write');
  clearCanvas(true);

  // Set default type
  const defaultType = state.selectedType || 'text';
  document.getElementById('noteTypeInput').value = defaultType;
  document.querySelectorAll('.modal-type-btn').forEach(b => {
    const active = b.getAttribute('data-modal-type') === defaultType;
    b.classList.toggle('bg-white', active);
    b.classList.toggle('dark:bg-slate-700', active);
    b.classList.toggle('text-blue-600', active);
    b.classList.toggle('dark:text-blue-400', active);
  });
  toggleTypeFields(defaultType);

  document.getElementById('noteModal').classList.remove('hidden');
}

function openEditModal(note) {
  state.isEditing = true;
  document.getElementById('noteModalTitle').innerHTML = '<i class="fa-solid fa-pen text-blue-500"></i> <span>Редагування нотатки</span>';
  document.getElementById('noteIdInput').value = note.id;
  document.getElementById('noteTitleInput').value = note.title;
  document.getElementById('noteContentInput').value = note.content || '';
  document.getElementById('noteUrlInput').value = note.url || '';
  document.getElementById('noteTagsInput').value = note.tags ? note.tags.map(t => t.name).join(', ') : '';
  document.getElementById('notePinnedInput').checked = !!note.is_pinned;
  document.getElementById('noteCategorySelect').value = note.category_id || '';
  
  selectColorInPicker(note.color || '#ffffff');
  switchEditorTab('write');

  // Type tabs
  const noteType = note.type || 'text';
  document.getElementById('noteTypeInput').value = noteType;
  document.querySelectorAll('.modal-type-btn').forEach(b => {
    const active = b.getAttribute('data-modal-type') === noteType;
    b.classList.toggle('bg-white', active);
    b.classList.toggle('dark:bg-slate-700', active);
    b.classList.toggle('text-blue-600', active);
    b.classList.toggle('dark:text-blue-400', active);
  });
  toggleTypeFields(noteType);

  if (noteType === 'draw' && note.content && note.content.startsWith('data:image/')) {
    loadDrawingToCanvas(note.content);
  } else {
    clearCanvas(true);
  }

  // File attached
  if (note.file_path) {
    showAttachedFileInfo(note.file_name, formatBytes(note.file_size));
  } else {
    removeAttachedFile();
  }

  document.getElementById('noteModal').classList.remove('hidden');
}

function closeNoteModal() {
  document.getElementById('noteModal').classList.add('hidden');
}

async function handleSaveNote(e) {
  e.preventDefault();
  const noteId = document.getElementById('noteIdInput').value;
  const isEdit = !!noteId;
  const noteType = document.getElementById('noteTypeInput').value;
  let content = document.getElementById('noteContentInput').value;

  if (noteType === 'draw') {
    const canvas = document.getElementById('sketchCanvas');
    if (canvas) {
      content = canvas.toDataURL('image/png');
    }
  }

  const formData = new FormData();
  formData.append('title', document.getElementById('noteTitleInput').value.trim());
  formData.append('content', content);
  formData.append('type', noteType);
  formData.append('category_id', document.getElementById('noteCategorySelect').value);
  formData.append('url', document.getElementById('noteUrlInput').value.trim());
  formData.append('color', document.getElementById('noteColorInput').value);
  formData.append('is_pinned', document.getElementById('notePinnedInput').checked ? '1' : '0');

  // Tags
  const rawTags = document.getElementById('noteTagsInput').value;
  const tagsArray = rawTags.split(',').map(t => t.trim()).filter(Boolean);
  formData.append('tags', JSON.stringify(tagsArray));

  // File attachment
  if (selectedFileObject) {
    formData.append('file', selectedFileObject);
  }
  if (removeExistingFileFlag) {
    formData.append('remove_file', '1');
  }

  const saveBtn = document.getElementById('saveNoteBtn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Збереження...</span>';

  try {
    const url = isEdit ? `/api/notes/${noteId}` : '/api/notes';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      body: formData
    });

    const data = await res.json();
    if (data.status === 'success') {
      showToast(isEdit ? 'Нотатку успішно оновлено' : 'Нову нотатку створено', 'success');
      closeNoteModal();
      loadNotes();
      loadCategories();
      loadTags();
      loadStats();
    } else {
      showToast(data.message || 'Помилка збереження', 'error');
    }
  } catch (err) {
    console.error('Помилка збереження нотатки:', err);
    showToast('Виникла мережева помилка', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Зберегти</span>';
  }
}

async function togglePinNote(noteId) {
  try {
    const res = await fetch(`/api/notes/${noteId}/pin`, { method: 'POST' });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(data.is_pinned ? 'Нотатку закріплено зверху' : 'Нотатку відкріплено', 'info');
      loadNotes();
      loadStats();
      if (state.currentViewingNote && state.currentViewingNote.id === noteId) {
        state.currentViewingNote.is_pinned = data.is_pinned;
        updateViewDetailPinBtn(data.is_pinned);
      }
    }
  } catch (err) {
    console.error('Помилка зміни закріплення:', err);
  }
}

async function deleteNote(noteId) {
  if (!confirm('Ви впевнені, що бажаєте остаточно видалити цю нотатку?')) return;

  try {
    const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Нотатку видалено', 'success');
      loadNotes();
      loadCategories();
      loadTags();
      loadStats();
    }
  } catch (err) {
    console.error('Помилка видалення нотатки:', err);
    showToast('Не вдалося видалити нотатку', 'error');
  }
}

function editNoteById(noteId) {
  const note = state.notes.find(n => n.id === noteId);
  if (note) openEditModal(note);
}

// ================= NOTE DETAIL / VIEW MODAL =================

function openViewModal(noteId) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return;
  state.currentViewingNote = note;

  document.getElementById('viewDetailTitle').textContent = note.title;
  document.getElementById('viewDetailDates').textContent = `Створено: ${formatDate(note.created_at)} • Оновлено: ${formatDate(note.updated_at)}`;

  // Category
  const catBadge = document.getElementById('viewDetailCategory');
  if (note.category_name) {
    catBadge.textContent = note.category_name;
    catBadge.style.backgroundColor = note.category_color || '#2563eb';
    catBadge.className = 'px-2 py-0.5 rounded-sm text-[10px] font-semibold text-white';
    catBadge.classList.remove('hidden');
  } else {
    catBadge.classList.add('hidden');
  }

  // Type badge
  const isDrawing = note.type === 'draw' || (note.content && note.content.startsWith('data:image/'));
  const typeBadge = document.getElementById('viewDetailType');
  const typeMap = { text: 'Текст', draw: 'Малюнок', link: 'Веб-посилання', file: 'Файл', code: 'Код', todo: 'Список завдань' };
  typeBadge.textContent = typeMap[isDrawing ? 'draw' : note.type] || note.type;

  // Pin state
  updateViewDetailPinBtn(note.is_pinned);

  // Drawing Preview Box
  const drawingBox = document.getElementById('viewDetailDrawingBox');
  if (drawingBox) {
    if (isDrawing && note.content) {
      drawingBox.classList.remove('hidden');
      document.getElementById('viewDetailDrawingImg').src = note.content;
      const downloadBtn = document.getElementById('viewDetailDrawingDownloadBtn');
      if (downloadBtn) {
        downloadBtn.href = note.content;
        downloadBtn.download = `${(note.title || 'drawing').replace(/[^a-z0-9а-яіїєґ_]/gi, '_')}.png`;
      }
    } else {
      drawingBox.classList.add('hidden');
    }
  }

  // Link Preview
  const linkBox = document.getElementById('viewDetailLinkBox');
  if (note.url) {
    linkBox.classList.remove('hidden');
    const linkEl = document.getElementById('viewDetailLink');
    linkEl.textContent = note.url;
    linkEl.href = note.url;
    document.getElementById('viewDetailLinkBtn').href = note.url;
  } else {
    linkBox.classList.add('hidden');
  }

  // File Preview
  const fileBox = document.getElementById('viewDetailFileBox');
  if (note.file_path) {
    fileBox.classList.remove('hidden');
    document.getElementById('viewDetailFileName').textContent = note.file_name || 'Прикріплений файл';
    document.getElementById('viewDetailFileSize').textContent = formatBytes(note.file_size);
    document.getElementById('viewDetailFileDownloadBtn').href = note.file_path;
  } else {
    fileBox.classList.add('hidden');
  }

  // Markdown content
  const contentEl = document.getElementById('viewDetailContent');
  if (isDrawing) {
    contentEl.classList.add('hidden');
  } else if (note.content) {
    contentEl.innerHTML = marked.parse(note.content);
    contentEl.classList.remove('hidden');
  } else {
    contentEl.innerHTML = '<p class="text-slate-400 italic text-xs">Текстовий опис відсутній</p>';
    contentEl.classList.remove('hidden');
  }

  // Tags
  const tagsContainer = document.getElementById('viewDetailTags');
  if (note.tags && note.tags.length > 0) {
    tagsContainer.classList.remove('hidden');
    tagsContainer.innerHTML = note.tags.map(t => `
      <span class="text-xs font-medium px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        #${escapeHTML(t.name)}
      </span>
    `).join('');
  } else {
    tagsContainer.classList.add('hidden');
  }

  document.getElementById('viewModal').classList.remove('hidden');
}

function updateViewDetailPinBtn(isPinned) {
  const pinBtn = document.getElementById('viewDetailPinBtn');
  const pinIndicator = document.getElementById('viewDetailPin');
  if (isPinned) {
    pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack text-amber-500"></i> <span>Відкріпити</span>';
    pinIndicator.classList.remove('hidden');
  } else {
    pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i> <span>Закріпити</span>';
    pinIndicator.classList.add('hidden');
  }
}

function closeViewModal() {
  document.getElementById('viewModal').classList.add('hidden');
  state.currentViewingNote = null;
}

// ================= CATEGORY MANAGER =================

function openCategoryModal() {
  renderCategoryManageList();
  document.getElementById('categoryModal').classList.remove('hidden');
}

function closeCategoryModal() {
  document.getElementById('categoryModal').classList.add('hidden');
}

function renderCategoryManageList() {
  const container = document.getElementById('categoryManageList');
  container.innerHTML = state.categories.map(cat => `
    <div class="flex items-center justify-between p-2 rounded-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
      <div class="flex items-center gap-2 truncate">
        <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0" style="background-color: ${cat.color};"></span>
        <span class="font-medium text-slate-800 dark:text-slate-200 truncate">${escapeHTML(cat.name)}</span>
        <span class="text-slate-400">(${cat.notes_count || 0})</span>
      </div>
      <button onclick="deleteCategory(${cat.id})" class="text-rose-500 hover:text-rose-700 p-1" title="Видалити">
        <i class="fa-solid fa-trash-can text-xs"></i>
      </button>
    </div>
  `).join('');
}

async function handleCreateCategory(e) {
  e.preventDefault();
  const name = document.getElementById('newCategoryName').value.trim();
  const color = document.getElementById('newCategoryColor').value;
  if (!name) return;

  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Категорію створено', 'success');
      document.getElementById('newCategoryName').value = '';
      loadCategories();
      renderCategoryManageList();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Помилка створення категорії', 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('Видалити цю категорію? Нотатки цієї категорії залишаться без категорії.')) return;
  try {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Категорію видалено', 'success');
      if (state.selectedCategory === id) state.selectedCategory = null;
      loadCategories();
      loadNotes();
      renderCategoryManageList();
    }
  } catch (err) {
    showToast('Не вдалося видалити категорію', 'error');
  }
}

function populateCategorySelect() {
  const select = document.getElementById('noteCategorySelect');
  const currentVal = select.value;
  select.innerHTML = '<option value="">Без категорії</option>' + 
    state.categories.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
  select.value = currentVal;
}

// ================= TAG MANAGER =================

function openTagModal() {
  renderTagManageList();
  document.getElementById('tagModal').classList.remove('hidden');
}

function closeTagModal() {
  document.getElementById('tagModal').classList.add('hidden');
}

function renderTagManageList() {
  const container = document.getElementById('tagManageList');
  container.innerHTML = state.tags.map(t => `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
      <span>#${escapeHTML(t.name)}</span>
      <span class="text-slate-400">(${t.notes_count || 0})</span>
      <button onclick="deleteTag(${t.id})" class="text-slate-400 hover:text-rose-500 ml-1">
        <i class="fa-solid fa-xmark text-xs"></i>
      </button>
    </span>
  `).join('');
}

async function handleCreateTag(e) {
  e.preventDefault();
  const name = document.getElementById('newTagName').value.trim();
  const color = document.getElementById('newTagColor').value;
  if (!name) return;

  try {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Тег створено', 'success');
      document.getElementById('newTagName').value = '';
      loadTags();
      renderTagManageList();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Помилка створення тегу', 'error');
  }
}

async function deleteTag(id) {
  try {
    const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Тег видалено', 'success');
      state.selectedTags.delete(id);
      loadTags();
      loadNotes();
      renderTagManageList();
    }
  } catch (err) {
    showToast('Не вдалося видалити тег', 'error');
  }
}

// ================= ABOUT & STATS MODAL =================

function openAboutModal() {
  loadStats();
  document.getElementById('aboutModal').classList.remove('hidden');
}

function closeAboutModal() {
  document.getElementById('aboutModal').classList.add('hidden');
}

// ================= EXPORT =================

async function handleExport() {
  try {
    const res = await fetch('/api/export');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `n0t3_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Резервну копію експортовано у файл JSON', 'success');
  } catch (err) {
    showToast('Помилка під час експорту', 'error');
  }
}

// ================= HELPER UTILITIES =================

function getTypeBadge(type) {
  const map = {
    text: '<span class="badge-apple bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-400/25"><i class="fa-regular fa-file-lines mr-1 text-blue-500"></i>Текст</span>',
    draw: '<span class="badge-apple bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-400/25"><i class="fa-solid fa-paintbrush mr-1 text-indigo-500"></i>Малюнок</span>',
    link: '<span class="badge-apple bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-400/25"><i class="fa-solid fa-link mr-1 text-purple-500"></i>Посилання</span>',
    file: '<span class="badge-apple bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-400/25"><i class="fa-solid fa-paperclip mr-1 text-amber-500"></i>Файл</span>',
    code: '<span class="badge-apple bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-400/25"><i class="fa-solid fa-code mr-1 text-emerald-500"></i>Код</span>',
    todo: '<span class="badge-apple bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-400/25"><i class="fa-regular fa-square-check mr-1 text-rose-500"></i>Список</span>'
  };
  return map[type] || map.text;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function truncate(str, maxLen) {
  if (!str) return '';
  // strip tags for clean snippet preview
  const tmp = document.createElement('div');
  tmp.innerHTML = str;
  const text = tmp.textContent || tmp.innerText || '';
  if (text.length <= maxLen) return text;
  return text.substr(0, maxLen) + '...';
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function highlightSearch(text, query) {
  if (!query || !text) return text;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// Toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');

  const bgStyles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-slate-800 dark:bg-slate-700 text-white'
  };

  const iconStyles = {
    success: '<i class="fa-solid fa-circle-check"></i>',
    error: '<i class="fa-solid fa-triangle-exclamation"></i>',
    info: '<i class="fa-solid fa-circle-info"></i>'
  };

  toast.className = `toast ${bgStyles[type] || bgStyles.info}`;
  toast.innerHTML = `${iconStyles[type] || iconStyles.info} <span>${escapeHTML(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
