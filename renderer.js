(function () {
  'use strict';

  const STORAGE_TASKS = 'kanban.tasks';
  const STORAGE_CATEGORIES = 'kanban.categories';
  const STORAGE_CATEGORIES_LEGACY = 'kanban.classes';
  const STORAGE_THEME = 'kanban.theme';

  const COLORS = [
    '#3b6ef6', '#e0453f', '#d98a00', '#2fa84f',
    '#8a4fd9', '#d94f9e', '#1fb6b6', '#6b6b70',
  ];

  const COLUMNS = ['todo', 'doing', 'done'];

  // ---------- one-time migration from the old "classes" naming ----------

  function migrateLegacyStorage() {
    if (!localStorage.getItem(STORAGE_CATEGORIES) && localStorage.getItem(STORAGE_CATEGORIES_LEGACY)) {
      localStorage.setItem(STORAGE_CATEGORIES, localStorage.getItem(STORAGE_CATEGORIES_LEGACY));
    }

    const raw = localStorage.getItem(STORAGE_TASKS);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      let changed = false;
      parsed.forEach((t) => {
        if (t.classId !== undefined && t.categoryId === undefined) {
          t.categoryId = t.classId;
          delete t.classId;
          changed = true;
        }
      });
      if (changed) localStorage.setItem(STORAGE_TASKS, JSON.stringify(parsed));
    } catch (e) {
      // ignore malformed data, loadJSON below will fall back safely
    }
  }

  migrateLegacyStorage();

  let tasks = loadJSON(STORAGE_TASKS, []);
  let categories = loadJSON(STORAGE_CATEGORIES, []);

  let editingTaskId = null;
  let selectedColor = COLORS[0];
  let isCustomColor = false;
  let draggingTaskId = null;
  let filterText = '';
  let filterCategoryId = '';

  // ---------- persistence ----------

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_TASKS, JSON.stringify(tasks));
  }

  function saveCategories() {
    localStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(categories));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- elements ----------

  const el = {
    board: document.getElementById('board'),
    taskCount: document.getElementById('task-count'),
    searchInput: document.getElementById('search-input'),
    categoryFilter: document.getElementById('category-filter'),
    manageCategoriesBtn: document.getElementById('manage-categories-btn'),
    newTaskBtn: document.getElementById('new-task-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),

    taskModalOverlay: document.getElementById('task-modal-overlay'),
    taskModalTitle: document.getElementById('task-modal-title'),
    taskModalClose: document.getElementById('task-modal-close'),
    taskForm: document.getElementById('task-form'),
    taskId: document.getElementById('task-id'),
    taskTitle: document.getElementById('task-title'),
    taskCategory: document.getElementById('task-category'),
    taskDue: document.getElementById('task-due'),
    taskPriority: document.getElementById('task-priority'),
    taskNotes: document.getElementById('task-notes'),
    taskDeleteBtn: document.getElementById('task-delete-btn'),
    taskCancelBtn: document.getElementById('task-cancel-btn'),

    categoryModalOverlay: document.getElementById('category-modal-overlay'),
    categoryModalClose: document.getElementById('category-modal-close'),
    categoryList: document.getElementById('category-list'),
    categoryForm: document.getElementById('category-form'),
    categoryName: document.getElementById('category-name'),
    colorSwatches: document.getElementById('color-swatches'),
    customColorInput: document.getElementById('custom-color-input'),
  };

  const lists = {
    todo: document.getElementById('list-todo'),
    doing: document.getElementById('list-doing'),
    done: document.getElementById('list-done'),
  };

  const counts = {
    todo: document.getElementById('count-todo'),
    doing: document.getElementById('count-doing'),
    done: document.getElementById('count-done'),
  };

  // ---------- helpers ----------

  function getCategory(categoryId) {
    return categories.find((c) => c.id === categoryId) || null;
  }

  function dueStatus(task) {
    if (!task.dueDate || task.column === 'done') return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate + 'T00:00:00');
    const diffDays = Math.round((due - today) / 86400000);
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 1) return 'soon';
    return null;
  }

  function formatDue(dateStr) {
    const due = new Date(dateStr + 'T00:00:00');
    return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // ---------- rendering ----------

  function renderCategoryFilterOptions() {
    const previous = el.categoryFilter.value;
    el.categoryFilter.innerHTML = '<option value="">All categories</option>';
    categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      el.categoryFilter.appendChild(opt);
    });
    if (categories.some((c) => c.id === previous)) el.categoryFilter.value = previous;
  }

  function renderTaskCategoryOptions() {
    el.taskCategory.innerHTML = '';
    if (categories.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No categories yet';
      el.taskCategory.appendChild(opt);
      return;
    }
    categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      el.taskCategory.appendChild(opt);
    });
  }

  function matchesFilters(task) {
    if (filterCategoryId && task.categoryId !== filterCategoryId) return false;
    if (filterText) {
      const haystack = (task.title + ' ' + (task.notes || '')).toLowerCase();
      if (!haystack.includes(filterText.toLowerCase())) return false;
    }
    return true;
  }

  function renderBoard() {
    const visible = tasks.filter(matchesFilters);

    COLUMNS.forEach((col) => {
      const container = lists[col];
      container.innerHTML = '';
      const colTasks = visible
        .filter((t) => t.column === col)
        .sort((a, b) => {
          if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return a.createdAt - b.createdAt;
        });

      counts[col].textContent = colTasks.length;

      if (colTasks.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'empty-hint';
        hint.textContent = col === 'todo' ? 'No tasks yet' : 'Nothing here';
        container.appendChild(hint);
        return;
      }

      colTasks.forEach((task) => container.appendChild(renderCard(task)));
    });

    el.taskCount.textContent = tasks.length
      ? `${tasks.length} task${tasks.length === 1 ? '' : 's'}`
      : '';
  }

  function renderCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card' + (task.column === 'done' ? ' done' : '');
    card.draggable = true;
    card.dataset.id = task.id;

    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.title;
    card.appendChild(title);

    if (task.notes) {
      const notes = document.createElement('div');
      notes.className = 'task-notes';
      notes.textContent = task.notes;
      card.appendChild(notes);
    }

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const dot = document.createElement('span');
    dot.className = 'priority-dot priority-' + (task.priority || 'medium');
    dot.title = (task.priority || 'medium') + ' priority';
    meta.appendChild(dot);

    const cat = getCategory(task.categoryId);
    if (cat) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.background = cat.color;
      chip.textContent = cat.name;
      meta.appendChild(chip);
    }

    if (task.dueDate) {
      const badge = document.createElement('span');
      const status = dueStatus(task);
      badge.className = 'due-badge' + (status ? ' ' + status : '');
      badge.textContent = (status === 'overdue' ? 'Overdue · ' : '') + formatDue(task.dueDate);
      meta.appendChild(badge);
    }

    card.appendChild(meta);

    card.addEventListener('click', () => openTaskModal(task.id));

    card.addEventListener('dragstart', () => {
      draggingTaskId = task.id;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      draggingTaskId = null;
      card.classList.remove('dragging');
    });

    return card;
  }

  // ---------- task modal ----------

  function openTaskModal(taskId, defaultColumn) {
    editingTaskId = taskId || null;
    renderTaskCategoryOptions();

    if (editingTaskId) {
      const task = tasks.find((t) => t.id === editingTaskId);
      el.taskModalTitle.textContent = 'Edit Task';
      el.taskId.value = task.id;
      el.taskTitle.value = task.title;
      el.taskCategory.value = task.categoryId || '';
      el.taskDue.value = task.dueDate || '';
      el.taskPriority.value = task.priority || 'medium';
      el.taskNotes.value = task.notes || '';
      el.taskDeleteBtn.hidden = false;
      el.taskForm.dataset.column = task.column;
    } else {
      el.taskModalTitle.textContent = 'New Task';
      el.taskForm.reset();
      el.taskId.value = '';
      el.taskPriority.value = 'medium';
      el.taskDeleteBtn.hidden = true;
      el.taskForm.dataset.column = defaultColumn || 'todo';
    }

    el.taskModalOverlay.classList.add('open');
    el.taskTitle.focus();
  }

  function closeTaskModal() {
    el.taskModalOverlay.classList.remove('open');
    editingTaskId = null;
  }

  el.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = el.taskTitle.value.trim();
    if (!title) return;

    if (editingTaskId) {
      const task = tasks.find((t) => t.id === editingTaskId);
      task.title = title;
      task.categoryId = el.taskCategory.value || null;
      task.dueDate = el.taskDue.value || null;
      task.priority = el.taskPriority.value;
      task.notes = el.taskNotes.value.trim();
    } else {
      tasks.push({
        id: uid(),
        title,
        categoryId: el.taskCategory.value || null,
        dueDate: el.taskDue.value || null,
        priority: el.taskPriority.value,
        notes: el.taskNotes.value.trim(),
        column: el.taskForm.dataset.column || 'todo',
        createdAt: Date.now(),
      });
    }

    saveTasks();
    renderBoard();
    closeTaskModal();
  });

  el.taskDeleteBtn.addEventListener('click', () => {
    if (!editingTaskId) return;
    tasks = tasks.filter((t) => t.id !== editingTaskId);
    saveTasks();
    renderBoard();
    closeTaskModal();
  });

  el.taskModalClose.addEventListener('click', closeTaskModal);
  el.taskCancelBtn.addEventListener('click', closeTaskModal);
  el.taskModalOverlay.addEventListener('click', (e) => {
    if (e.target === el.taskModalOverlay) closeTaskModal();
  });

  el.newTaskBtn.addEventListener('click', () => openTaskModal(null, 'todo'));

  // ---------- category modal ----------

  function renderColorSwatches() {
    el.colorSwatches.innerHTML = '';
    COLORS.forEach((color) => {
      const swatch = document.createElement('div');
      swatch.className = 'swatch-option' + (!isCustomColor && color === selectedColor ? ' selected' : '');
      swatch.style.background = color;
      swatch.addEventListener('click', () => {
        selectedColor = color;
        isCustomColor = false;
        renderColorSwatches();
      });
      el.colorSwatches.appendChild(swatch);
    });

    el.customColorInput.classList.toggle('selected', isCustomColor);
    if (isCustomColor) el.customColorInput.value = selectedColor;
  }

  el.customColorInput.addEventListener('input', (e) => {
    selectedColor = e.target.value;
    isCustomColor = true;
    renderColorSwatches();
  });

  function persistCategoryOrderFromDOM() {
    const orderedIds = Array.from(el.categoryList.querySelectorAll('.category-row')).map((r) => r.dataset.id);
    categories.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
    saveCategories();
    renderTaskCategoryOptions();
    renderCategoryFilterOptions();
  }

  function renderCategoryManagerList() {
    el.categoryList.innerHTML = '';
    if (categories.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-categories';
      empty.textContent = 'No categories yet — add one below.';
      el.categoryList.appendChild(empty);
      return;
    }
    categories.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'category-row';
      row.draggable = true;
      row.dataset.id = c.id;

      const handle = document.createElement('span');
      handle.className = 'drag-handle';
      handle.textContent = '⠿';
      handle.title = 'Drag to reorder';
      row.appendChild(handle);

      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = c.color;
      row.appendChild(swatch);

      const name = document.createElement('span');
      name.className = 'category-name';
      name.textContent = c.name;
      name.title = c.name;
      row.appendChild(name);

      const remove = document.createElement('button');
      remove.className = 'remove-category';
      remove.textContent = '×';
      remove.title = 'Remove category';
      remove.addEventListener('click', () => {
        categories = categories.filter((x) => x.id !== c.id);
        tasks.forEach((t) => {
          if (t.categoryId === c.id) t.categoryId = null;
        });
        saveCategories();
        saveTasks();
        renderCategoryManagerList();
        renderCategoryFilterOptions();
        renderTaskCategoryOptions();
        renderBoard();
      });
      row.appendChild(remove);

      row.addEventListener('dragstart', () => {
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        persistCategoryOrderFromDOM();
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = el.categoryList.querySelector('.category-row.dragging');
        if (!dragging || dragging === row) return;
        const rect = row.getBoundingClientRect();
        const before = e.clientY - rect.top < rect.height / 2;
        el.categoryList.insertBefore(dragging, before ? row : row.nextSibling);
      });

      el.categoryList.appendChild(row);
    });
  }

  function openCategoryModal() {
    selectedColor = COLORS[categories.length % COLORS.length];
    isCustomColor = false;
    renderColorSwatches();
    renderCategoryManagerList();
    el.categoryModalOverlay.classList.add('open');
  }

  function closeCategoryModal() {
    el.categoryModalOverlay.classList.remove('open');
    el.categoryForm.reset();
    renderTaskCategoryOptions();
    renderCategoryFilterOptions();
  }

  el.manageCategoriesBtn.addEventListener('click', openCategoryModal);
  el.categoryModalClose.addEventListener('click', closeCategoryModal);
  el.categoryModalOverlay.addEventListener('click', (e) => {
    if (e.target === el.categoryModalOverlay) closeCategoryModal();
  });

  el.categoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = el.categoryName.value.trim();
    if (!name) return;
    categories.push({ id: uid(), name, color: selectedColor });
    saveCategories();
    el.categoryName.value = '';
    selectedColor = COLORS[categories.length % COLORS.length];
    isCustomColor = false;
    renderColorSwatches();
    renderCategoryManagerList();
    renderCategoryFilterOptions();
  });

  // ---------- filters ----------

  el.searchInput.addEventListener('input', (e) => {
    filterText = e.target.value;
    renderBoard();
  });

  el.categoryFilter.addEventListener('change', (e) => {
    filterCategoryId = e.target.value;
    renderBoard();
  });

  // ---------- drag and drop (tasks between columns) ----------

  Object.values(lists).forEach((container) => {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');
    });
    container.addEventListener('dragleave', () => {
      container.classList.remove('drag-over');
    });
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      if (!draggingTaskId) return;
      const task = tasks.find((t) => t.id === draggingTaskId);
      if (!task) return;
      task.column = container.dataset.column;
      saveTasks();
      renderBoard();
    });
  });

  // ---------- theme ----------

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      el.themeToggleBtn.textContent = '☀️';
    } else {
      document.documentElement.removeAttribute('data-theme');
      el.themeToggleBtn.textContent = '🌙';
    }
  }

  el.themeToggleBtn.addEventListener('click', () => {
    const current = localStorage.getItem(STORAGE_THEME) === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_THEME, next);
    applyTheme(next);
  });

  // ---------- keyboard ----------

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTaskModal();
      closeCategoryModal();
    }
  });

  // ---------- init ----------

  renderCategoryFilterOptions();
  renderTaskCategoryOptions();
  renderBoard();
  applyTheme(localStorage.getItem(STORAGE_THEME) === 'dark' ? 'dark' : 'light');
})();
