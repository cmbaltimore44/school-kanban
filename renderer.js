(function () {
  'use strict';

  const STORAGE_TASKS = 'kanban.tasks';
  const STORAGE_CLASSES = 'kanban.classes';
  const STORAGE_THEME = 'kanban.theme';

  const COLORS = [
    '#3b6ef6', '#e0453f', '#d98a00', '#2fa84f',
    '#8a4fd9', '#d94f9e', '#1fb6b6', '#6b6b70',
  ];

  const COLUMNS = ['todo', 'doing', 'done'];

  let tasks = loadJSON(STORAGE_TASKS, []);
  let classes = loadJSON(STORAGE_CLASSES, []);

  let editingTaskId = null;
  let selectedColor = COLORS[0];
  let isCustomColor = false;
  let draggingTaskId = null;
  let filterText = '';
  let filterClassId = '';

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

  function saveClasses() {
    localStorage.setItem(STORAGE_CLASSES, JSON.stringify(classes));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- elements ----------

  const el = {
    board: document.getElementById('board'),
    taskCount: document.getElementById('task-count'),
    searchInput: document.getElementById('search-input'),
    classFilter: document.getElementById('class-filter'),
    manageClassesBtn: document.getElementById('manage-classes-btn'),
    newTaskBtn: document.getElementById('new-task-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),

    taskModalOverlay: document.getElementById('task-modal-overlay'),
    taskModalTitle: document.getElementById('task-modal-title'),
    taskModalClose: document.getElementById('task-modal-close'),
    taskForm: document.getElementById('task-form'),
    taskId: document.getElementById('task-id'),
    taskTitle: document.getElementById('task-title'),
    taskClass: document.getElementById('task-class'),
    taskDue: document.getElementById('task-due'),
    taskPriority: document.getElementById('task-priority'),
    taskNotes: document.getElementById('task-notes'),
    taskDeleteBtn: document.getElementById('task-delete-btn'),
    taskCancelBtn: document.getElementById('task-cancel-btn'),

    classModalOverlay: document.getElementById('class-modal-overlay'),
    classModalClose: document.getElementById('class-modal-close'),
    classList: document.getElementById('class-list'),
    classForm: document.getElementById('class-form'),
    className: document.getElementById('class-name'),
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

  function getClass(classId) {
    return classes.find((c) => c.id === classId) || null;
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

  function renderClassFilterOptions() {
    const previous = el.classFilter.value;
    el.classFilter.innerHTML = '<option value="">All classes</option>';
    classes.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      el.classFilter.appendChild(opt);
    });
    if (classes.some((c) => c.id === previous)) el.classFilter.value = previous;
  }

  function renderTaskClassOptions() {
    el.taskClass.innerHTML = '';
    if (classes.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No classes yet';
      el.taskClass.appendChild(opt);
      return;
    }
    classes.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      el.taskClass.appendChild(opt);
    });
  }

  function matchesFilters(task) {
    if (filterClassId && task.classId !== filterClassId) return false;
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
        hint.textContent = col === 'todo' ? 'No assignments yet' : 'Nothing here';
        container.appendChild(hint);
        return;
      }

      colTasks.forEach((task) => container.appendChild(renderCard(task)));
    });

    el.taskCount.textContent = tasks.length
      ? `${tasks.length} assignment${tasks.length === 1 ? '' : 's'}`
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

    const cls = getClass(task.classId);
    if (cls) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.background = cls.color;
      chip.textContent = cls.name;
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
    renderTaskClassOptions();

    if (editingTaskId) {
      const task = tasks.find((t) => t.id === editingTaskId);
      el.taskModalTitle.textContent = 'Edit Assignment';
      el.taskId.value = task.id;
      el.taskTitle.value = task.title;
      el.taskClass.value = task.classId || '';
      el.taskDue.value = task.dueDate || '';
      el.taskPriority.value = task.priority || 'medium';
      el.taskNotes.value = task.notes || '';
      el.taskDeleteBtn.hidden = false;
      el.taskForm.dataset.column = task.column;
    } else {
      el.taskModalTitle.textContent = 'New Assignment';
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
      task.classId = el.taskClass.value || null;
      task.dueDate = el.taskDue.value || null;
      task.priority = el.taskPriority.value;
      task.notes = el.taskNotes.value.trim();
    } else {
      tasks.push({
        id: uid(),
        title,
        classId: el.taskClass.value || null,
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

  // ---------- class modal ----------

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

  function renderClassManagerList() {
    el.classList.innerHTML = '';
    if (classes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-classes';
      empty.textContent = 'No classes yet — add one below.';
      el.classList.appendChild(empty);
      return;
    }
    classes.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'class-row';

      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = c.color;
      row.appendChild(swatch);

      const name = document.createElement('span');
      name.className = 'class-name';
      name.textContent = c.name;
      row.appendChild(name);

      const remove = document.createElement('button');
      remove.className = 'remove-class';
      remove.textContent = '×';
      remove.title = 'Remove class';
      remove.addEventListener('click', () => {
        classes = classes.filter((x) => x.id !== c.id);
        tasks.forEach((t) => {
          if (t.classId === c.id) t.classId = null;
        });
        saveClasses();
        saveTasks();
        renderClassManagerList();
        renderClassFilterOptions();
        renderBoard();
      });
      row.appendChild(remove);

      el.classList.appendChild(row);
    });
  }

  function openClassModal() {
    selectedColor = COLORS[classes.length % COLORS.length];
    isCustomColor = false;
    renderColorSwatches();
    renderClassManagerList();
    el.classModalOverlay.classList.add('open');
  }

  function closeClassModal() {
    el.classModalOverlay.classList.remove('open');
    el.classForm.reset();
    renderTaskClassOptions();
    renderClassFilterOptions();
  }

  el.manageClassesBtn.addEventListener('click', openClassModal);
  el.classModalClose.addEventListener('click', closeClassModal);
  el.classModalOverlay.addEventListener('click', (e) => {
    if (e.target === el.classModalOverlay) closeClassModal();
  });

  el.classForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = el.className.value.trim();
    if (!name) return;
    classes.push({ id: uid(), name, color: selectedColor });
    saveClasses();
    el.className.value = '';
    selectedColor = COLORS[classes.length % COLORS.length];
    isCustomColor = false;
    renderColorSwatches();
    renderClassManagerList();
    renderClassFilterOptions();
  });

  // ---------- filters ----------

  el.searchInput.addEventListener('input', (e) => {
    filterText = e.target.value;
    renderBoard();
  });

  el.classFilter.addEventListener('change', (e) => {
    filterClassId = e.target.value;
    renderBoard();
  });

  // ---------- drag and drop ----------

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
      closeClassModal();
    }
  });

  // ---------- init ----------

  renderClassFilterOptions();
  renderTaskClassOptions();
  renderBoard();
  applyTheme(localStorage.getItem(STORAGE_THEME) === 'dark' ? 'dark' : 'light');
})();
