/**
 * Professional Quiz Authoring Studio Module
 * Streamlined question management, clipboard screenshot pasting, bulk import, and duplication.
 */

const QuizBuilder = {
  editingQuizId: null,
  questions: [],
  currentQuestionIndex: 0,
  activeInput: null,
  _sidebarInitialized: false,
  detState: {
    size: 2,
    type: 'vmatrix',
    cells: {
      2: [['', ''], ['', '']],
      3: [['', '', ''], ['', '', ''], ['', '', '']]
    }
  },

  initNewQuiz() {
    this.editingQuizId = null;
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.activeInput = null;
    this.isPublished = 0;
    document.getElementById('builder-header-title').textContent = 'Create New Assessment';
    document.getElementById('input-quiz-title').value = '';
    document.getElementById('input-quiz-desc').value = '';
    document.getElementById('input-quiz-category').value = 'JEE Prep';
    document.getElementById('input-quiz-time').value = '0';
    document.getElementById('input-quiz-pos-marks').value = '4';
    document.getElementById('input-quiz-neg-marks').value = '1';

    // Add initial question on page 1
    this.addQuestion();
    this.initMathSidebarEvents();
    this.updateActiveBadge();
  },

  loadQuizForEditing(quiz) {
    this.editingQuizId = quiz.id;
    this.questions = JSON.parse(JSON.stringify(quiz.questions || []));
    this.currentQuestionIndex = 0;
    this.activeInput = null;
    this.isPublished = quiz.is_published ? 1 : 0;

    document.getElementById('builder-header-title').textContent = `Edit Assessment: ${quiz.title}`;
    document.getElementById('input-quiz-title').value = quiz.title || '';
    document.getElementById('input-quiz-desc').value = quiz.description || '';
    document.getElementById('input-quiz-category').value = quiz.category || 'JEE Prep';
    document.getElementById('input-quiz-time').value = quiz.time_limit_minutes || 0;
    document.getElementById('input-quiz-pos-marks').value = quiz.positive_marks ?? 4;
    document.getElementById('input-quiz-neg-marks').value = quiz.negative_marks ?? 1;

    if (this.questions.length === 0) {
      this.addQuestion();
    } else {
      this.renderQuestions();
    }
    this.initMathSidebarEvents();
    this.updateActiveBadge();
  },

  goToQuestion(idx) {
    if (idx < 0) idx = 0;
    if (idx >= this.questions.length) idx = this.questions.length - 1;
    this.currentQuestionIndex = idx;
    this.renderQuestions();
    this.updateActiveBadge();

    // Focus active question input
    setTimeout(() => {
      const qInput = document.getElementById(`q_text_${idx}`);
      if (qInput) qInput.focus();
    }, 50);
  },

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.goToQuestion(this.currentQuestionIndex + 1);
    } else {
      // User finished the current question; add new question page automatically
      this.addQuestion();
      App.showToast(`Switched to Question ${this.questions.length}`, 'info');
    }
  },

  prevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.goToQuestion(this.currentQuestionIndex - 1);
    }
  },

  addQuestion(type = 'mcq') {
    this.questions.push({
      question_type: type,
      question_text: '',
      image_url: '',
      explanation: '',
      correct_numerical_value: '',
      numerical_tolerance: 0,
      options: [
        { option_text: '', is_correct: true },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false }
      ]
    });
    this.currentQuestionIndex = this.questions.length - 1;
    this.renderQuestions();
  },

  setQuestionType(qIdx, type) {
    const q = this.questions[qIdx];
    if (!q) return;
    q.question_type = type;
    if (type === 'integer' && (q.correct_numerical_value === undefined || q.correct_numerical_value === null)) {
      q.correct_numerical_value = '';
      q.numerical_tolerance = 0;
    }
    this.renderQuestions();
    App.showToast(`Switched Question ${qIdx + 1} to ${type === 'integer' ? 'Numerical / Integer (+4, 0)' : 'Single Choice MCQ (+4, -1)'}`, 'info');
  },

  duplicateQuestion(qIdx) {
    const clone = JSON.parse(JSON.stringify(this.questions[qIdx]));
    this.questions.splice(qIdx + 1, 0, clone);
    this.currentQuestionIndex = qIdx + 1;
    this.renderQuestions();
    App.showToast(`Duplicated Question ${qIdx + 1} to page ${qIdx + 2}`, 'info');
  },

  removeQuestion(idx) {
    if (this.questions.length <= 1) {
      App.showToast('Assessment must have at least one question', 'error');
      return;
    }
    this.questions.splice(idx, 1);
    if (this.currentQuestionIndex >= this.questions.length) {
      this.currentQuestionIndex = this.questions.length - 1;
    }
    this.renderQuestions();
    App.showToast(`Removed question`, 'info');
  },

  setPresetTrueFalse(qIdx) {
    this.questions[qIdx].options = [
      { option_text: 'True', is_correct: true },
      { option_text: 'False', is_correct: false }
    ];
    this.renderQuestions();
    App.showToast('Applied True / False preset', 'info');
  },

  setPreset4Options(qIdx) {
    this.questions[qIdx].options = [
      { option_text: '', is_correct: true },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false }
    ];
    this.renderQuestions();
    App.showToast('Applied 4-options preset', 'info');
  },

  addOption(qIdx) {
    const q = this.questions[qIdx];
    if (q.options.length >= 8) {
      App.showToast('Maximum 8 options allowed per question', 'warning');
      return;
    }
    q.options.push({
      option_text: '',
      is_correct: false
    });
    this.renderQuestions();
  },

  removeOption(qIdx, optIdx) {
    const q = this.questions[qIdx];
    if (q.options.length <= 2) {
      App.showToast('Each question must have at least 2 options', 'error');
      return;
    }
    const wasCorrect = q.options[optIdx].is_correct;
    q.options.splice(optIdx, 1);
    if (wasCorrect && q.options.length > 0) {
      q.options[0].is_correct = true;
    }
    this.renderQuestions();
  },

  setCorrectOption(qIdx, optIdx) {
    const q = this.questions[qIdx];
    q.options.forEach((opt, idx) => {
      opt.is_correct = idx === optIdx;
    });
    this.renderQuestions();
  },

  async handleImageUpload(qIdx, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      App.showToast('Please select or paste a valid image file', 'error');
      return;
    }

    try {
      App.showToast('Uploading image...', 'info');
      const url = await API.uploadImage(file);
      this.questions[qIdx].image_url = url;
      this.renderQuestions();
      App.showToast('Diagram attached successfully!', 'success');
    } catch (err) {
      App.showToast(`Upload failed: ${err.message}`, 'error');
    }
  },

  async handleOptionImageUpload(qIdx, optIdx, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      App.showToast('Please select or paste a valid image file', 'error');
      return;
    }

    try {
      App.showToast('Uploading option image...', 'info');
      const url = await API.uploadImage(file);
      if (this.questions[qIdx] && this.questions[qIdx].options[optIdx]) {
        this.questions[qIdx].options[optIdx].image_url = url;
        this.renderQuestions();
        App.showToast(`Option image attached successfully!`, 'success');
      }
    } catch (err) {
      App.showToast(`Option image upload failed: ${err.message}`, 'error');
    }
  },

  removeOptionImage(qIdx, optIdx) {
    if (this.questions[qIdx] && this.questions[qIdx].options[optIdx]) {
      this.questions[qIdx].options[optIdx].image_url = '';
      this.renderQuestions();
    }
  },

  removeImage(qIdx) {
    this.questions[qIdx].image_url = '';
    this.renderQuestions();
  },

  renderQuestions() {
    const container = document.getElementById('builder-questions-container');
    if (!container) return;

    if (this.questions.length === 0) {
      this.addQuestion();
      return;
    }

    if (this.currentQuestionIndex < 0) this.currentQuestionIndex = 0;
    if (this.currentQuestionIndex >= this.questions.length) {
      this.currentQuestionIndex = this.questions.length - 1;
    }

    const qIdx = this.currentQuestionIndex;
    const q = this.questions[qIdx];
    const isInteger = q.question_type === 'integer';
    const isLastQ = qIdx === this.questions.length - 1;
    const fragment = document.createDocumentFragment();

    // 1. Question Navigator Strip / Pagination Tabs
    const navStrip = document.createElement('div');
    navStrip.className = 'q-nav-strip';
    navStrip.innerHTML = `
      <div class="q-nav-strip-header">
        <div class="q-nav-strip-info">
          <span class="q-nav-label">Questions:</span>
          <span class="badge badge-indigo" style="font-size:0.75rem; padding:0.2rem 0.55rem;">Question ${qIdx + 1} of ${this.questions.length}</span>
        </div>
        <div class="q-nav-strip-actions">
          <button type="button" class="btn btn-outline btn-xs btn-strip-prev" ${qIdx === 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} title="Previous question page">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            <span>Prev</span>
          </button>
          <button type="button" class="btn btn-outline btn-xs btn-strip-next" title="${isLastQ ? 'Done · Add next question' : 'Go to next question'}">
            <span>${isLastQ ? 'Next (+)' : 'Next'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
      <div class="q-nav-pills">
        ${this.questions.map((_, i) => `
          <button type="button" class="q-nav-pill ${i === qIdx ? 'active' : ''}" data-nav-q="${i}" title="Jump to Question ${i + 1}">
            Q${i + 1}
          </button>
        `).join('')}
        <button type="button" class="q-nav-pill q-nav-pill-add" id="btn-builder-strip-add" title="Add a new question page">+ Add Q</button>
      </div>
    `;
    fragment.appendChild(navStrip);

    // 2. Main Question Block (Single Page View for active question)
    const qBlock = document.createElement('div');
    qBlock.className = 'question-block';
    qBlock.id = `q-block-${qIdx}`;

    // Options HTML with Live Math/Special Characters Preview
    // Options HTML with Live Math/Special Characters Preview
    let answerSectionHtml = '';
    if (isInteger) {
      answerSectionHtml = `
        <div class="form-group" style="margin-top:1rem;">
          <label class="form-label" style="margin-bottom:0.45rem;">Correct Numerical Value *</label>
          <div class="int-answer-row">
            <div style="flex:1;">
              <input type="number" step="any" class="form-control int-val-input" placeholder="e.g. 24 or -3.5" value="${q.correct_numerical_value !== undefined && q.correct_numerical_value !== null ? q.correct_numerical_value : ''}" data-q="${qIdx}">
            </div>
            <div style="width:140px;">
              <input type="number" step="any" min="0" class="form-control int-tol-input" placeholder="Tolerance (± 0)" value="${q.numerical_tolerance || 0}" data-q="${qIdx}">
            </div>
          </div>
        </div>
      `;
    } else {
      let optionsHtml = '';
      const letters = 'ABCDEFGH';
      q.options.forEach((opt, optIdx) => {
        const isCorrect = Boolean(opt.is_correct);
        const hasText = Boolean(opt.option_text && opt.option_text.trim());
        const hasImg = Boolean(opt.image_url && opt.image_url.trim());
        const renderedMath = hasText ? App.formatMathText(opt.option_text) : '';
        optionsHtml += `
          <div class="builder-opt-item">
            <div class="builder-opt-row ${isCorrect ? 'is-correct-opt' : ''}">
              <button type="button" class="opt-key-btn ${isCorrect ? 'active-correct' : ''}" 
                      title="Click to mark as correct answer"
                      data-q="${qIdx}" data-opt="${optIdx}">
                <span class="kbd-cap">${letters[optIdx]}</span>
                ${isCorrect ? '<span class="correct-check-badge">✓ Correct</span>' : ''}
              </button>
              <input type="text" class="form-control opt-text-input" 
                     placeholder="Option ${letters[optIdx]} (text or formula, optional if image uploaded)" 
                     value="${this.escapeHtml(opt.option_text || '')}"
                     data-q="${qIdx}" data-opt="${optIdx}">
              
              <input type="file" accept="image/*" class="file-input-hidden opt-file-input" id="opt_file_input_${qIdx}_${optIdx}" style="display:none;" data-q="${qIdx}" data-opt="${optIdx}">
              <button type="button" class="btn btn-outline btn-sm btn-opt-attach-img ${hasImg ? 'has-img-attached' : ''}" 
                      title="${hasImg ? 'Option has image attached (click to change)' : 'Attach image/diagram to this option'}"
                      data-q="${qIdx}" data-opt="${optIdx}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>${hasImg ? 'Img ✓' : 'Img'}</span>
              </button>

              <button type="button" class="btn btn-outline btn-sm btn-del-opt" 
                      title="Remove this option"
                      data-q="${qIdx}" data-opt="${optIdx}">✕</button>
            </div>

            ${hasImg ? `
              <div class="opt-image-preview-wrapper" data-q="${qIdx}" data-opt="${optIdx}">
                <div class="opt-img-thumb-container" onclick="App.openLightbox('${opt.image_url}')" title="Click to view full diagram">
                  <img src="${opt.image_url}" class="opt-img-thumb" alt="Option ${letters[optIdx]} Diagram" />
                </div>
                <button type="button" class="btn-remove-opt-img" title="Remove image from option ${letters[optIdx]}" data-q="${qIdx}" data-opt="${optIdx}">✕</button>
              </div>
            ` : ''}

            <div class="option-preview-box" id="opt_preview_${qIdx}_${optIdx}" style="${hasText ? 'display:flex;' : 'display:none;'}">
              <span class="option-preview-tag">Preview ${letters[optIdx]}:</span>
              <div class="option-preview-content">${renderedMath}</div>
            </div>
          </div>
        `;
      });

      answerSectionHtml = `
        <div class="form-group" style="margin-top:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.45rem;">
            <label class="form-label" style="margin:0;">Options <span style="font-size:0.75rem; font-weight:normal; text-transform:none; color:var(--text-muted); margin-left:0.35rem;">(click letter to mark correct)</span> *</label>
            <button type="button" class="btn btn-outline btn-sm btn-add-opt" data-q="${qIdx}">+ Add Option</button>
          </div>
          ${optionsHtml}
        </div>
      `;
    }

    // Image / Diagram Dropzone HTML (Compact slim design)
    let imageHtml = '';
    if (q.image_url) {
      imageHtml = `
        <div class="image-preview-wrapper">
          <img src="${q.image_url}" class="image-preview-thumb" alt="Question Diagram" />
          <button type="button" class="btn-remove-img" data-q="${qIdx}" title="Remove diagram">✕</button>
        </div>
      `;
    } else {
      imageHtml = `
        <div class="image-upload-zone image-upload-slim" data-q="${qIdx}" tabindex="0" title="Click to browse, or paste image with Ctrl+V">
          <input type="file" accept="image/*" class="file-input-hidden" id="file_input_${qIdx}" style="display:none;" data-q="${qIdx}">
          <div class="image-upload-content">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>Attach diagram or screenshot (or paste Ctrl+V)</span>
          </div>
        </div>
      `;
    }

    const hasExpl = Boolean(q.explanation && q.explanation.trim());
    const explMath = hasExpl ? App.formatMathText(q.explanation) : '';

    qBlock.innerHTML = `
      <div class="question-block-header">
        <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
          <span class="badge badge-indigo" style="font-size:0.78rem; padding:0.25rem 0.65rem; font-weight:700;">Question ${qIdx + 1} of ${this.questions.length}</span>
          <div class="q-type-selector">
            <button type="button" class="q-type-btn ${isInteger ? '' : 'active'}" data-type="mcq" data-q="${qIdx}">MCQ</button>
            <button type="button" class="q-type-btn ${isInteger ? 'active' : ''}" data-type="integer" data-q="${qIdx}">Numerical</button>
          </div>
          ${!isInteger ? `
          <div class="q-presets">
            <button type="button" class="btn btn-outline btn-sm btn-preset-4" data-q="${qIdx}" title="Reset to standard 4 options">4 Options</button>
            <button type="button" class="btn btn-outline btn-sm btn-preset-tf" data-q="${qIdx}" title="Reset to True / False">True / False</button>
          </div>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:0.45rem;">
          <button type="button" class="btn btn-secondary btn-sm btn-dup-q" data-q="${qIdx}" title="Duplicate this question">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Duplicate</span>
          </button>
          <button type="button" class="btn btn-danger btn-sm btn-del-q" data-q="${qIdx}">Delete</button>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:0.75rem;">
        <div class="q-text-header-row" style="margin-bottom:0.45rem;">
          <label class="form-label" style="margin:0;">Question *</label>
        </div>
        <textarea class="form-control q-text-input" id="q_text_${qIdx}" rows="3" placeholder="Type your question..." data-q="${qIdx}">${this.escapeHtml(q.question_text)}</textarea>
        <div class="math-preview-box" id="math_preview_${qIdx}" style="${q.question_text ? 'display:block;' : 'display:none;'}">
          <span class="math-preview-tag">Preview:</span>
          <div class="math-preview-content">${App.formatMathText(q.question_text)}</div>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:0.85rem;">
        ${imageHtml}
      </div>

      ${answerSectionHtml}

      <div class="form-group" style="margin-top:1rem;">
        <label class="form-label" style="margin-bottom:0.45rem;">Explanation (Optional)</label>
        <textarea class="form-control q-expl-input" rows="2" placeholder="Add explanation or solution notes..." data-q="${qIdx}">${this.escapeHtml(q.explanation)}</textarea>
        <div class="math-preview-box" id="expl_preview_${qIdx}" style="${hasExpl ? 'display:block;' : 'display:none;'}">
          <span class="math-preview-tag">Preview:</span>
          <div class="math-preview-content">${explMath}</div>
        </div>
      </div>
    `;

    fragment.appendChild(qBlock);
    container.innerHTML = '';
    container.appendChild(fragment);

    // Update Sticky Bar Controls & Text
    const btnStickyPrev = document.getElementById('btn-builder-sticky-prev');
    if (btnStickyPrev) {
      btnStickyPrev.disabled = qIdx === 0;
      btnStickyPrev.style.opacity = qIdx === 0 ? '0.4' : '1';
      btnStickyPrev.style.cursor = qIdx === 0 ? 'not-allowed' : 'pointer';
    }
    const nextLabel = document.getElementById('btn-builder-sticky-next-label');
    if (nextLabel) {
      nextLabel.textContent = isLastQ ? 'Done · Next Q' : 'Next Q';
    }
    const statsIndicator = document.getElementById('builder-stats-indicator');
    if (statsIndicator) {
      const qCount = this.questions.length;
      const posMarks = parseFloat(document.getElementById('input-quiz-pos-marks')?.value) || 4;
      const totalMarks = qCount * posMarks;
      statsIndicator.textContent = `Question ${qIdx + 1} of ${qCount} · ${totalMarks} Marks`;
    }

    this.bindBuilderEvents();
  },

  bindBuilderEvents() {
    const qIdx = this.currentQuestionIndex;

    // Top Strip Navigation Pills
    document.querySelectorAll('.q-nav-pill[data-nav-q]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetQ = parseInt(e.currentTarget.dataset.navQ);
        this.goToQuestion(targetQ);
      });
    });

    // Top Strip Prev & Next
    const stripPrev = document.querySelector('.btn-strip-prev');
    if (stripPrev) {
      stripPrev.addEventListener('click', () => this.prevQuestion());
    }
    const stripNext = document.querySelector('.btn-strip-next');
    if (stripNext) {
      stripNext.addEventListener('click', () => this.nextQuestion());
    }

    // Top Strip Add
    const stripAdd = document.getElementById('btn-builder-strip-add');
    if (stripAdd) {
      stripAdd.addEventListener('click', () => this.addQuestion());
    }

    // Question type buttons
    document.querySelectorAll('.q-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qIndex = parseInt(e.currentTarget.dataset.q);
        const type = e.currentTarget.dataset.type;
        this.setQuestionType(qIndex, type);
      });
    });

    // Integer answer value input
    document.querySelectorAll('.int-val-input').forEach(el => {
      el.addEventListener('input', (e) => {
        const qIndex = parseInt(e.target.dataset.q);
        if (this.questions[qIndex]) {
          this.questions[qIndex].correct_numerical_value = e.target.value;
        }
      });
    });

    // Integer tolerance input
    document.querySelectorAll('.int-tol-input').forEach(el => {
      el.addEventListener('input', (e) => {
        const qIndex = parseInt(e.target.dataset.q);
        if (this.questions[qIndex]) {
          this.questions[qIndex].numerical_tolerance = parseFloat(e.target.value) || 0;
        }
      });
    });

    // Sync Question text & live math preview
    document.querySelectorAll('.q-text-input').forEach(el => {
      el.addEventListener('input', (e) => {
        const qIndex = parseInt(e.target.dataset.q);
        if (this.questions[qIndex]) {
          this.questions[qIndex].question_text = e.target.value;
          const previewBox = document.getElementById(`math_preview_${qIndex}`);
          if (previewBox) {
            const content = previewBox.querySelector('.math-preview-content');
            if (content) content.innerHTML = App.formatMathText(e.target.value);
            previewBox.style.display = e.target.value.trim() ? 'block' : 'none';
          }
        }
      });
    });

    // Initialize unified right-side math toolbar events
    this.initMathSidebarEvents();

    // Sync Question Explanation & live explanation preview
    document.querySelectorAll('.q-expl-input').forEach(el => {
      el.addEventListener('input', (e) => {
        const qIndex = parseInt(e.target.dataset.q);
        if (this.questions[qIndex]) {
          this.questions[qIndex].explanation = e.target.value;
          const previewBox = document.getElementById(`expl_preview_${qIndex}`);
          if (previewBox) {
            const content = previewBox.querySelector('.math-preview-content');
            if (content) content.innerHTML = App.formatMathText(e.target.value);
            previewBox.style.display = e.target.value.trim() ? 'block' : 'none';
          }
        }
      });
    });

    // Sync Option text & live option preview
    document.querySelectorAll('.opt-text-input').forEach(el => {
      el.addEventListener('input', (e) => {
        const qIndex = parseInt(e.target.dataset.q);
        const optIdx = parseInt(e.target.dataset.opt);
        if (this.questions[qIndex] && this.questions[qIndex].options[optIdx]) {
          this.questions[qIndex].options[optIdx].option_text = e.target.value;
          const previewBox = document.getElementById(`opt_preview_${qIndex}_${optIdx}`);
          if (previewBox) {
            const content = previewBox.querySelector('.option-preview-content');
            if (content) content.innerHTML = App.formatMathText(e.target.value);
            previewBox.style.display = e.target.value.trim() ? 'flex' : 'none';
          }
        }
      });
    });

    // Correct option button
    document.querySelectorAll('.opt-key-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const qIndex = parseInt(target.dataset.q);
        const optIdx = parseInt(target.dataset.opt);
        this.setCorrectOption(qIndex, optIdx);
      });
    });

    // Preset buttons
    document.querySelectorAll('.btn-preset-tf').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qIndex = parseInt(e.currentTarget.dataset.q);
        this.setPresetTrueFalse(qIndex);
      });
    });

    document.querySelectorAll('.btn-preset-4').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qIndex = parseInt(e.currentTarget.dataset.q);
        this.setPreset4Options(qIndex);
      });
    });

    // Duplicate Question button
    document.querySelectorAll('.btn-dup-q').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qIndex = parseInt(e.currentTarget.dataset.q);
        this.duplicateQuestion(qIndex);
      });
    });

    // Add Option button
    document.querySelectorAll('.btn-add-opt').forEach(el => {
      el.addEventListener('click', (e) => {
        const qIndex = parseInt(e.currentTarget.dataset.q);
        this.addOption(qIndex);
      });
    });

    // Delete Option button
    document.querySelectorAll('.btn-del-opt').forEach(el => {
      el.addEventListener('click', (e) => {
        const qIndex = parseInt(e.currentTarget.dataset.q);
        const optIdx = parseInt(e.currentTarget.dataset.opt);
        this.removeOption(qIndex, optIdx);
      });
    });

    // Delete Question button
    document.querySelectorAll('.btn-del-q').forEach(el => {
      el.addEventListener('click', (e) => {
        const qIndex = parseInt(e.currentTarget.dataset.q);
        this.removeQuestion(qIndex);
      });
    });

    // Option Attach Image button
    document.querySelectorAll('.btn-opt-attach-img').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qIndex = parseInt(e.currentTarget.dataset.q);
        const optIdx = parseInt(e.currentTarget.dataset.opt);
        const fileInput = document.getElementById(`opt_file_input_${qIndex}_${optIdx}`);
        if (fileInput) fileInput.click();
      });
    });

    // Option file input changes
    document.querySelectorAll('.opt-file-input').forEach(el => {
      el.addEventListener('change', (e) => {
        const qIndex = parseInt(e.target.dataset.q);
        const optIdx = parseInt(e.target.dataset.opt);
        if (e.target.files && e.target.files[0]) {
          this.handleOptionImageUpload(qIndex, optIdx, e.target.files[0]);
        }
      });
    });

    // Remove Option Image button
    document.querySelectorAll('.btn-remove-opt-img').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qIndex = parseInt(e.currentTarget.dataset.q);
        const optIdx = parseInt(e.currentTarget.dataset.opt);
        this.removeOptionImage(qIndex, optIdx);
      });
    });

    // Main Question File input changes
    document.querySelectorAll('.file-input-hidden:not(.opt-file-input)').forEach(el => {
      el.addEventListener('change', (e) => {
        const qIndex = parseInt(e.target.dataset.q);
        if (e.target.files && e.target.files[0]) {
          this.handleImageUpload(qIndex, e.target.files[0]);
        }
      });
    });

    // Drag and drop and Paste on upload zones
    document.querySelectorAll('.image-upload-zone').forEach(zone => {
      const qIndex = parseInt(zone.dataset.q);
      zone.addEventListener('click', () => {
        const fileInput = document.getElementById(`file_input_${qIndex}`);
        if (fileInput) fileInput.click();
      });

      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });

      zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleImageUpload(qIndex, e.dataTransfer.files[0]);
        }
      });

      zone.addEventListener('paste', (e) => {
        this.handlePasteImage(e, qIndex);
      });
    });

    // Remove Image button
    document.querySelectorAll('.btn-remove-img').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qIndex = parseInt(e.currentTarget.dataset.q);
        this.removeImage(qIndex);
      });
    });

    // Question block-level paste listener
    const currentBlock = document.getElementById(`q-block-${qIdx}`);
    if (currentBlock) {
      currentBlock.addEventListener('paste', (e) => {
        if (e.clipboardData && e.clipboardData.items) {
          for (let i = 0; i < e.clipboardData.items.length; i++) {
            if (e.clipboardData.items[i].type.startsWith('image/')) {
              e.preventDefault();
              const file = e.clipboardData.items[i].getAsFile();
              this.handleImageUpload(qIdx, file);
              return;
            }
          }
        }
      });
    }
  },

  handlePasteEvent(e, qIdx) {
    if (!e.clipboardData || !e.clipboardData.items) return;
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      const item = e.clipboardData.items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        this.handleImageUpload(qIdx, file);
        return;
      }
    }
  },

  /* ==================== QUICK TEXT-TO-MCQ BULK PARSER ==================== */
  parseBulkText(rawText) {
    if (!rawText || !rawText.trim()) return [];
    const lines = rawText.split('\n');
    const parsed = [];
    let currentQ = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Question line detection (e.g. "1. Question", "Q1: Question", "1) Question")
      const qMatch = line.match(/^(?:Q(?:uestion)?\s*)?(\d+)[\.\:\)]\s*(.+)/i);
      // Option line detection (e.g. "A) text", "*B) text", "a.", "[x] text")
      const optMatch = line.match(/^(\*)?\s*[\(\[]?([A-Ha-h]|\d+)[\.\)\]]\s*(.+)/);
      // Explanation line detection (e.g. "Explanation: text")
      const explMatch = line.match(/^(?:Explanation|Note|Expl|Solution)[\:\-]\s*(.+)/i);

      if (explMatch && currentQ) {
        currentQ.explanation = explMatch[1].trim();
      } else if (optMatch && currentQ) {
        const isCorrect = Boolean(optMatch[1]) || line.startsWith('*') || line.endsWith('*');
        const text = optMatch[3].trim().replace(/\*$/, '').replace(/^\*/, '').trim();
        currentQ.options.push({
          option_text: text,
          is_correct: isCorrect
        });
      } else if (qMatch) {
        if (currentQ) {
          this.finalizeParsedQuestion(currentQ);
          parsed.push(currentQ);
        }
        currentQ = {
          question_text: qMatch[2].trim(),
          image_url: '',
          explanation: '',
          options: []
        };
      } else if (currentQ && currentQ.options.length === 0) {
        currentQ.question_text += ' ' + line;
      } else if (currentQ && currentQ.options.length > 0) {
        currentQ.options[currentQ.options.length - 1].option_text += ' ' + line;
      } else {
        if (currentQ) {
          this.finalizeParsedQuestion(currentQ);
          parsed.push(currentQ);
        }
        currentQ = {
          question_text: line,
          image_url: '',
          explanation: '',
          options: []
        };
      }
    }

    if (currentQ) {
      this.finalizeParsedQuestion(currentQ);
      parsed.push(currentQ);
    }

    return parsed;
  },

  finalizeParsedQuestion(q) {
    if (q.options.length === 0) {
      q.options = [
        { option_text: 'Option A', is_correct: true },
        { option_text: 'Option B', is_correct: false },
        { option_text: 'Option C', is_correct: false },
        { option_text: 'Option D', is_correct: false }
      ];
    }
    const hasCorrect = q.options.some(o => o.is_correct);
    if (!hasCorrect && q.options.length > 0) {
      q.options[0].is_correct = true;
    }
  },

  applyBulkImport(text, replace = false) {
    const parsed = this.parseBulkText(text);
    if (parsed.length === 0) {
      App.showToast('Could not parse any questions from text', 'error');
      return false;
    }

    if (replace || (this.questions.length === 1 && !this.questions[0].question_text)) {
      this.questions = parsed;
    } else {
      this.questions.push(...parsed);
    }

    this.currentQuestionIndex = 0;
    this.renderQuestions();
    App.showToast(`Imported ${parsed.length} questions successfully!`, 'success');
    return true;
  },

  async saveQuiz(publish = null) {
    if (this._isSaving) return;

    if (publish !== null) {
      this.isPublished = publish ? 1 : 0;
    }

    const title = document.getElementById('input-quiz-title').value.trim();
    const description = document.getElementById('input-quiz-desc').value.trim();
    const category = document.getElementById('input-quiz-category').value.trim() || 'General';
    const timeLimit = parseInt(document.getElementById('input-quiz-time').value) || 0;

    if (!title) {
      App.showToast('Please enter an assessment title', 'error');
      document.getElementById('input-quiz-title').focus();
      return;
    }

    if (this.questions.length === 0) {
      App.showToast('Please add at least one question', 'error');
      return;
    }

    // Validate questions
    for (let i = 0; i < this.questions.length; i++) {
      const q = this.questions[i];
      if (!q.question_text.trim()) {
        this.goToQuestion(i);
        App.showToast(`Question ${i + 1} text is empty`, 'error');
        setTimeout(() => {
          const el = document.getElementById(`q_text_${i}`);
          if (el) el.focus();
        }, 60);
        return;
      }
      if (q.question_type === 'integer') {
        if (q.correct_numerical_value === '' || q.correct_numerical_value === null || isNaN(q.correct_numerical_value)) {
          this.goToQuestion(i);
          App.showToast(`Question ${i + 1} requires a valid numerical correct answer`, 'error');
          setTimeout(() => {
            const el = document.querySelector('.int-val-input');
            if (el) el.focus();
          }, 60);
          return;
        }
      } else {
        if (q.options.length < 2) {
          this.goToQuestion(i);
          App.showToast(`Question ${i + 1} must have at least 2 options`, 'error');
          return;
        }
        const hasEmptyOpt = q.options.some(o => !((o.option_text && o.option_text.trim()) || (o.image_url && o.image_url.trim())));
        if (hasEmptyOpt) {
          this.goToQuestion(i);
          App.showToast(`Question ${i + 1} has an option missing both text and image`, 'error');
          return;
        }
        const hasCorrect = q.options.some(o => o.is_correct);
        if (!hasCorrect) {
          this.goToQuestion(i);
          App.showToast(`Question ${i + 1} must have a correct answer selected`, 'error');
          return;
        }
      }
    }

    const posMarks = parseFloat(document.getElementById('input-quiz-pos-marks').value) || 4.0;
    const negMarks = parseFloat(document.getElementById('input-quiz-neg-marks').value) || 1.0;

    const isPub = this.isPublished ? 1 : 0;
    const payload = {
      title,
      description,
      category,
      time_limit_minutes: timeLimit,
      positive_marks: posMarks,
      negative_marks: negMarks,
      is_published: isPub,
      questions: this.questions
    };

    this._isSaving = true;
    const saveBtn = document.getElementById('btn-builder-save');
    const draftBtn = document.getElementById('btn-builder-save-draft');
    const originalSaveText = saveBtn ? saveBtn.innerHTML : '';
    const originalDraftText = draftBtn ? draftBtn.innerHTML : '';

    const spinner = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.8s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" />
      </svg>
      <span>Saving...</span>
    `;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.65';
      saveBtn.style.pointerEvents = 'none';
      if (isPub) saveBtn.innerHTML = spinner;
    }
    if (draftBtn) {
      draftBtn.disabled = true;
      draftBtn.style.opacity = '0.65';
      draftBtn.style.pointerEvents = 'none';
      if (!isPub) draftBtn.innerHTML = spinner;
    }

    try {
      if (this.editingQuizId) {
        await API.updateQuiz(this.editingQuizId, payload);
        App.showToast(isPub ? 'Assessment updated and published for students!' : 'Assessment updated (saved as draft).', 'success');
      } else {
        await API.createQuiz(payload);
        App.showToast(isPub ? 'Assessment published! Live and visible to students.' : 'Assessment saved as Draft (hidden from students).', 'success');
      }
      App.showDashboard();
    } catch (err) {
      App.showToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      this._isSaving = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '';
        saveBtn.style.pointerEvents = '';
        saveBtn.innerHTML = originalSaveText;
      }
      if (draftBtn) {
        draftBtn.disabled = false;
        draftBtn.style.opacity = '';
        draftBtn.style.pointerEvents = '';
        draftBtn.innerHTML = originalDraftText;
      }
    }
  },

  exportCurrentQuizJson() {
    const title = document.getElementById('input-quiz-title').value.trim() || 'quiz';
    const payload = {
      title,
      description: document.getElementById('input-quiz-desc').value.trim(),
      category: document.getElementById('input-quiz-category').value.trim() || 'General',
      time_limit_minutes: parseInt(document.getElementById('input-quiz-time').value) || 0,
      questions: this.questions
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast('Assessment exported to JSON', 'success');
  },

  importQuizJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.title || !Array.isArray(data.questions)) {
          throw new Error('Invalid assessment JSON format');
        }
        document.getElementById('input-quiz-title').value = data.title || '';
        document.getElementById('input-quiz-desc').value = data.description || '';
        document.getElementById('input-quiz-category').value = data.category || 'General';
        document.getElementById('input-quiz-time').value = data.time_limit_minutes || 0;

        this.questions = data.questions;
        this.currentQuestionIndex = 0;
        this.renderQuestions();
        App.showToast(`Loaded "${data.title}"`, 'success');
      } catch (err) {
        App.showToast(`Import error: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  },

  initMathSidebarEvents() {
    if (this._sidebarInitialized) return;
    this._sidebarInitialized = true;

    const sidebar = document.getElementById('builder-math-sidebar');
    if (!sidebar) return;

    // Track focused input inside builder view
    const builderContainer = document.getElementById('view-builder');
    if (builderContainer) {
      builderContainer.addEventListener('focusin', (e) => {
        if (e.target && e.target.closest('#det-builder-card')) {
          // Do not overwrite active target input when typing inside determinant builder cells
          return;
        }
        if (e.target && (e.target.matches('.q-text-input, .opt-text-input, .q-expl-input, .int-val-input') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
          this.activeInput = e.target;
          this.updateActiveBadge();
        }
      });
    }

    // Attach click and mousedown events to regular math sidebar buttons
    sidebar.querySelectorAll('.math-side-btn:not(.math-det-trigger-btn)').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        // Prevent button click from causing active input to lose focus / selection
        e.preventDefault();
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.insertMathSymbol(btn);
      });
    });

    // Attach click and mousedown events to determinant / matrix trigger buttons
    sidebar.querySelectorAll('.math-det-trigger-btn').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const type = btn.dataset.detType || 'vmatrix';
        const size = parseInt(btn.dataset.detSize) || 2;
        this.openDetBuilder(type, size);
      });
    });

    this.initDetBuilder();
  },

  updateActiveBadge() {
    const badge = document.getElementById('math-target-badge');
    this.updateDetTargetHint();
    if (!badge) return;
    if (!this.activeInput || !document.body.contains(this.activeInput)) {
      badge.textContent = 'Active Input';
      badge.style.borderColor = 'var(--border-subtle)';
      badge.style.color = 'var(--text-muted)';
      return;
    }
    const el = this.activeInput;
    badge.style.borderColor = 'rgba(99, 102, 241, 0.4)';
    badge.style.color = 'var(--accent-indigo)';

    if (el.classList.contains('q-text-input')) {
      const qIdx = parseInt(el.dataset.q);
      badge.textContent = `Q${qIdx + 1} Question`;
    } else if (el.classList.contains('opt-text-input')) {
      const qIdx = parseInt(el.dataset.q);
      const optIdx = parseInt(el.dataset.opt);
      const optLetter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || (optIdx + 1);
      badge.textContent = `Q${qIdx + 1} Option ${optLetter}`;
    } else if (el.classList.contains('q-expl-input')) {
      const qIdx = parseInt(el.dataset.q);
      badge.textContent = `Q${qIdx + 1} Expl`;
    } else if (el.classList.contains('int-val-input')) {
      const qIdx = parseInt(el.dataset.q);
      badge.textContent = `Q${qIdx + 1} Numerical`;
    } else {
      badge.textContent = el.placeholder ? el.placeholder.slice(0, 14) : 'Selected Input';
    }
  },

  insertMathSymbol(btn) {
    let input = this.activeInput;
    if (!input || !document.body.contains(input)) {
      input = document.querySelector('.q-text-input');
    }
    if (!input) {
      App.showToast('Please click inside a question or option field first', 'info');
      return;
    }

    const snippetRaw = btn.dataset.insert || btn.textContent.trim();
    let snippet = snippetRaw;
    // Normalize any double backslashes before commands (e.g. \\begin -> \begin)
    snippet = snippet.replace(/\\\\([a-zA-Z])/g, '\\$1');
    while (snippet.indexOf('\\\\\\\\') !== -1) {
      snippet = snippet.replace(/\\\\\\\\/g, '\\\\');
    }
    const suffix = btn.dataset.suffix;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const val = input.value;
    const before = val.substring(0, start);
    const selected = val.substring(start, end);
    const after = val.substring(end, val.length);

    if (selected) {
      if (suffix) {
        snippet = selected + suffix;
      } else if (snippet.includes('{}')) {
        snippet = snippet.replace('{}', `{${selected}}`);
      } else if (snippet.startsWith('^') || snippet.startsWith('_')) {
        snippet = selected + snippet;
      }
      input.value = before + snippet + after;
    } else {
      if (suffix && before.length > 0 && /[0-9a-zA-Z]$/.test(before)) {
        snippet = suffix;
      }
      input.value = before + snippet + after;
    }

    let newCursorPos = start + snippet.length;
    if (!selected && snippet.includes('{}')) {
      newCursorPos = start + snippet.indexOf('{}') + 1;
    }

    input.focus();
    input.setSelectionRange(newCursorPos, newCursorPos);

    // Fire input event to keep model and math preview up to date
    input.dispatchEvent(new Event('input', { bubbles: true }));

    this.activeInput = input;
    this.updateActiveBadge();
  },

  initDetBuilder() {
    const card = document.getElementById('det-builder-card');
    if (!card) return;

    // Type selector buttons (|A| vs [A])
    card.querySelectorAll('.det-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        card.querySelectorAll('.det-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.detState.type = btn.dataset.type || 'vmatrix';
        const wrapper = document.getElementById('det-grid-wrapper');
        if (wrapper && wrapper.dataset) wrapper.dataset.type = this.detState.type;
        this.updateDetPreview();
      });
    });

    // Size selector buttons (2x2 vs 3x3)
    card.querySelectorAll('.det-size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        card.querySelectorAll('.det-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.detState.size = parseInt(btn.dataset.size) || 2;
        this.renderDetGrid();
      });
    });

    // Clear button
    const btnClear = document.getElementById('btn-det-clear');
    if (btnClear) {
      btnClear.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearDetBuilder();
      });
    }

    // Close button
    const btnClose = document.getElementById('btn-det-close');
    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeDetBuilder();
      });
    }

    // Done / Paste button
    const btnDone = document.getElementById('btn-det-done');
    if (btnDone) {
      btnDone.addEventListener('click', (e) => {
        e.preventDefault();
        this.pasteDeterminant();
      });
    }

    this.renderDetGrid();
    this.updateDetTargetHint();
  },

  openDetBuilder(type, size) {
    const card = document.getElementById('det-builder-card');
    if (!card) return;

    if (type) this.detState.type = type;
    if (size) this.detState.size = size;

    // Update active class on type buttons
    card.querySelectorAll('.det-type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === this.detState.type);
    });

    // Update active class on size buttons
    card.querySelectorAll('.det-size-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.size) === this.detState.size);
    });

    // Update title text
    const titleEl = document.getElementById('det-builder-title-text');
    if (titleEl) {
      const typeLabel = this.detState.type === 'vmatrix' ? 'Determinant' : 'Matrix';
      titleEl.textContent = `${this.detState.size}×${this.detState.size} ${typeLabel}`;
    }

    card.classList.add('active');
    this.renderDetGrid();
    this.updateDetTargetHint();

    setTimeout(() => {
      const first = card.querySelector('.det-cell-input[data-r="0"][data-c="0"]');
      if (first) {
        first.focus();
        first.select();
      }
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 40);
  },

  closeDetBuilder() {
    const card = document.getElementById('det-builder-card');
    if (card) {
      card.classList.remove('active');
    }
  },

  renderDetGrid() {
    const gridEl = document.getElementById('det-cells-grid');
    if (!gridEl) return;
    const size = this.detState.size;
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    const wrapper = document.getElementById('det-grid-wrapper');
    if (wrapper && wrapper.dataset) {
      wrapper.dataset.size = size;
      wrapper.dataset.type = this.detState.type;
    }

    const currentCells = this.detState.cells[size];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'det-cell-input';
        inp.dataset.r = r;
        inp.dataset.c = c;
        inp.placeholder = `a${r + 1}${c + 1}`;
        inp.value = currentCells[r][c] || '';
        inp.autocomplete = 'off';
        inp.spellcheck = false;

        inp.addEventListener('input', (e) => {
          this.detState.cells[size][r][c] = e.target.value;
          this.updateDetPreview();
        });

        inp.addEventListener('keydown', (e) => {
          this.handleDetCellKeydown(e, r, c, size);
        });

        gridEl.appendChild(inp);
      }
    }
    this.updateDetPreview();
  },

  handleDetCellKeydown(e, r, c, size) {
    let nextR = r;
    let nextC = c;
    if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
      if (c < size - 1) { nextC = c + 1; }
      else if (r < size - 1) { nextR = r + 1; nextC = 0; }
    } else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
      if (c > 0) { nextC = c - 1; }
      else if (r > 0) { nextR = r - 1; nextC = size - 1; }
    } else if (e.key === 'ArrowDown') {
      if (r < size - 1) { nextR = r + 1; }
    } else if (e.key === 'ArrowUp') {
      if (r > 0) { nextR = r - 1; }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (r === size - 1 && c === size - 1) {
        this.pasteDeterminant();
        return;
      } else {
        if (c < size - 1) { nextC = c + 1; }
        else if (r < size - 1) { nextR = r + 1; nextC = 0; }
      }
    }

    if (nextR !== r || nextC !== c) {
      const nextInput = document.querySelector(`.det-cell-input[data-r="${nextR}"][data-c="${nextC}"]`);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  },

  updateDetPreview() {
    const prevEl = document.getElementById('det-mini-preview');
    if (!prevEl) return;
    const latex = this.buildDetLatex(false);
    if (!latex) {
      prevEl.innerHTML = `<span class="det-preview-placeholder">Live Preview</span>`;
      return;
    }
    if (typeof katex !== 'undefined') {
      try {
        prevEl.innerHTML = katex.renderToString(latex, { displayMode: false, throwOnError: false });
      } catch (e) {
        prevEl.textContent = latex;
      }
    } else {
      prevEl.textContent = latex;
    }
  },

  buildDetLatex(fallbackToPlaceholders = true) {
    const size = this.detState.size;
    const type = this.detState.type;
    const cells = this.detState.cells[size];

    let hasAnyValue = false;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (cells[r][c] && cells[r][c].trim()) {
          hasAnyValue = true;
          break;
        }
      }
    }

    if (!hasAnyValue && !fallbackToPlaceholders) {
      return '';
    }

    const rows = [];
    for (let r = 0; r < size; r++) {
      const rowVals = [];
      for (let c = 0; c < size; c++) {
        let val = cells[r][c] ? cells[r][c].trim() : '';
        if (!val && fallbackToPlaceholders) {
          val = '0';
        }
        rowVals.push(val);
      }
      rows.push(rowVals.join(' & '));
    }

    return `\\begin{${type}} ${rows.join(' \\\\ ')} \\end{${type}}`;
  },

  updateDetTargetHint() {
    const hint = document.getElementById('det-target-hint');
    if (!hint) return;
    if (!this.activeInput || !document.body.contains(this.activeInput)) {
      hint.textContent = 'Target: Current Q';
      return;
    }
    const el = this.activeInput;
    if (el.classList.contains('q-text-input')) {
      const qIdx = parseInt(el.dataset.q);
      hint.textContent = `Target: Q${qIdx + 1} Question`;
    } else if (el.classList.contains('opt-text-input')) {
      const qIdx = parseInt(el.dataset.q);
      const optIdx = parseInt(el.dataset.opt);
      const optLetter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || (optIdx + 1);
      hint.textContent = `Target: Q${qIdx + 1} Opt ${optLetter}`;
    } else if (el.classList.contains('q-expl-input')) {
      const qIdx = parseInt(el.dataset.q);
      hint.textContent = `Target: Q${qIdx + 1} Expl`;
    } else if (el.classList.contains('int-val-input')) {
      const qIdx = parseInt(el.dataset.q);
      hint.textContent = `Target: Q${qIdx + 1} Num`;
    } else {
      hint.textContent = 'Target: Active';
    }
  },

  pasteDeterminant() {
    let input = this.activeInput;
    if (!input || !document.body.contains(input)) {
      input = document.querySelector('.q-text-input');
    }
    if (!input) {
      App.showToast('Please click inside a question or option field first', 'info');
      return;
    }

    const latex = this.buildDetLatex(true);
    if (!latex) return;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const val = input.value;
    const before = val.substring(0, start);
    const after = val.substring(end);

    const leadingSpace = (before.length > 0 && !/\s$/.test(before)) ? ' ' : '';
    const trailingSpace = (after.length > 0 && !/^\s/.test(after)) ? ' ' : '';

    const insertion = leadingSpace + latex + trailingSpace;
    input.value = before + insertion + after;

    const newCursor = start + insertion.length;
    input.focus();
    input.setSelectionRange(newCursor, newCursor);

    // Trigger input event to update model and live preview
    input.dispatchEvent(new Event('input', { bubbles: true }));

    let targetName = 'Question';
    if (input.classList.contains('opt-text-input')) {
      const optIdx = parseInt(input.dataset.opt);
      const optLetter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || (optIdx + 1);
      targetName = `Option ${optLetter}`;
    } else if (input.classList.contains('q-expl-input')) {
      targetName = 'Explanation';
    }
    const typeLabel = this.detState.type === 'vmatrix' ? 'Determinant' : 'Matrix';
    App.showToast(`${typeLabel} pasted into ${targetName}`, 'success');
    this.closeDetBuilder();
  },

  clearDetBuilder() {
    const size = this.detState.size;
    this.detState.cells[size] = size === 2 ? [['', ''], ['', '']] : [['', '', ''], ['', '', ''], ['', '', '']];
    this.renderDetGrid();
    const first = document.querySelector('.det-cell-input[data-r="0"][data-c="0"]');
    if (first) first.focus();
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
