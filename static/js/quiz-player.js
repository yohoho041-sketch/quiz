/**
 * Quiz Player Engine
 * Handles MCQ test taking, keyboard shortcuts, image display, timer, and scoring.
 */

const QuizPlayer = {
  quiz: null,
  currentIndex: 0,
  userAnswers: {},   // { questionId: selectedOptionId }
  flaggedQuestions: new Set(),
  mode: 'exam',      // 'exam' or 'practice'
  timerInterval: null,
  secondsRemaining: 0,
  timeTakenSeconds: 0,
  zoomLevels: [0.8, 0.9, 1.0, 1.15, 1.3, 1.5],
  visitedQuestions: new Set(),
  violationsCount: 0,
  maxViolations: 3,
  violationsLog: [],
  isDisqualified: false,
  isTimerPaused: false,
  studentName: 'Anonymous Student',
  studentRoll: '',

  startQuiz(quiz, mode = 'exam', originalQuiz = null, studentInfo = null) {
    this.quiz = quiz;
    this.originalQuiz = originalQuiz || quiz;
    if (studentInfo) {
      if (studentInfo.name) this.studentName = studentInfo.name.trim();
      if (studentInfo.roll) this.studentRoll = studentInfo.roll.trim();
    }
    this.hasSubmitted = false;
    this._isSubmitting = false;

    const btnSubmit = document.getElementById('btn-submit-quiz');
    const btnPalette = document.getElementById('btn-palette-submit-quiz');
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.style.opacity = '';
      btnSubmit.style.pointerEvents = '';
      btnSubmit.innerHTML = '<span>Submit Test</span>';
    }
    if (btnPalette) {
      btnPalette.disabled = false;
      btnPalette.style.opacity = '';
      btnPalette.style.pointerEvents = '';
      btnPalette.innerHTML = '<span>Submit Exam</span>';
    }

    this.currentIndex = 0;
    this.userAnswers = {};
    this.flaggedQuestions.clear();
    this.visitedQuestions = new Set();
    if (quiz.questions && quiz.questions.length > 0) {
      this.visitedQuestions.add(quiz.questions[0].id);
    }
    this.mode = mode;
    this.timeTakenSeconds = 0;
    this.zoomReset();

    this.violationsCount = 0;
    this.violationsLog = [];
    this.isDisqualified = false;
    this.isTimerPaused = false;

    // Trigger Fullscreen Mode
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } catch (e) {}
    document.body.classList.add('fullscreen-test-mode');

    // Anti-Cheating Lockdown in Exam Mode
    if (mode === 'exam') {
      document.body.classList.add('exam-lockdown-active');
      this.activateAntiCheatingLockdown();
    } else {
      document.body.classList.remove('exam-lockdown-active');
      this.deactivateAntiCheatingLockdown();
    }

    // Set title and mode badge
    document.getElementById('player-quiz-title').textContent = quiz.title;
    const modeBadge = document.getElementById('player-mode-badge');
    if (mode === 'drill') {
      modeBadge.textContent = '🎯 Weak-Spot Drill';
      modeBadge.className = 'badge badge-drill';
    } else if (mode === 'practice') {
      modeBadge.textContent = 'Practice Mode';
      modeBadge.className = 'badge badge-emerald';
    } else {
      modeBadge.textContent = 'Exam Mode';
      modeBadge.className = 'badge badge-indigo';
    }

    const schemeBadge = document.getElementById('player-scheme-badge');
    if (schemeBadge) {
      const pos = quiz.positive_marks ?? 4;
      const neg = quiz.negative_marks ?? 1;
      schemeBadge.textContent = `+${pos}, -${neg} Scheme`;
    }

    // Setup timer (always active in full screen)
    this.setupTimer(mode === 'drill' ? 0 : quiz.time_limit_minutes);

    // Render palette
    this.renderPalette();

    // Render first question
    this.renderCurrentQuestion();

    // Setup keyboard listeners
    this.attachKeyboardEvents();
  },

  setupTimer(limitMinutes) {
    clearInterval(this.timerInterval);
    const timerBox = document.getElementById('player-timer');
    timerBox.style.display = 'flex';
    timerBox.classList.remove('timer-warning');

    if (limitMinutes && limitMinutes > 0 && this.mode !== 'practice' && this.mode !== 'drill') {
      // Countdown Timer
      this.isCountdown = true;
      this.secondsRemaining = limitMinutes * 60;
      this.updateTimerDisplay();

      this.timerInterval = setInterval(() => {
        if (this.isTimerPaused) return;
        this.secondsRemaining--;
        this.timeTakenSeconds++;
        this.updateTimerDisplay();

        if (this.secondsRemaining <= 60) {
          timerBox.classList.add('timer-warning');
        }

        if (this.secondsRemaining <= 0) {
          clearInterval(this.timerInterval);
          App.showToast('Time limit reached. Submitting assessment...', 'warning');
          this.submitQuiz(true);
        }
      }, 1000);
    } else {
      // Elapsed Count-up Timer (Untimed or Practice)
      this.isCountdown = false;
      this.timeTakenSeconds = 0;
      this.updateElapsedTimerDisplay();

      this.timerInterval = setInterval(() => {
        if (this.isTimerPaused) return;
        this.timeTakenSeconds++;
        this.updateElapsedTimerDisplay();
      }, 1000);
    }
  },

  updateTimerDisplay() {
    const mins = Math.floor(Math.max(0, this.secondsRemaining) / 60);
    const secs = Math.max(0, this.secondsRemaining) % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('timer-display').textContent = formatted;
  },

  updateElapsedTimerDisplay() {
    const mins = Math.floor(this.timeTakenSeconds / 60);
    const secs = this.timeTakenSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('timer-display').textContent = formatted;
  },

  renderPalette() {
    const grid = document.getElementById('palette-grid');
    grid.innerHTML = '';

    const questions = this.quiz.questions;
    let countAns = 0;
    let countNotAns = 0;
    let countMarked = 0;
    let countMarkedAns = 0;
    let countNotVis = 0;

    questions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette-btn';
      btn.textContent = idx + 1;
      btn.setAttribute('aria-label', `Question ${idx + 1}`);

      const isCurrent = idx === this.currentIndex;
      const isAnswered = this.userAnswers[q.id] !== undefined && this.userAnswers[q.id] !== null && String(this.userAnswers[q.id]).trim() !== '';
      const isFlagged = this.flaggedQuestions.has(q.id);
      const isVisited = this.visitedQuestions ? this.visitedQuestions.has(q.id) : false;

      if (isCurrent) btn.classList.add('palette-btn-current');

      if (isAnswered && isFlagged) {
        btn.classList.add('palette-btn-markedans');
        countMarkedAns++;
      } else if (!isAnswered && isFlagged) {
        btn.classList.add('palette-btn-marked');
        countMarked++;
      } else if (isAnswered) {
        btn.classList.add('palette-btn-ans');
        countAns++;
      } else if (isVisited) {
        btn.classList.add('palette-btn-notans');
        countNotAns++;
      } else {
        btn.classList.add('palette-btn-notvis');
        countNotVis++;
      }

      btn.addEventListener('click', () => {
        this.goToQuestion(idx);
      });

      grid.appendChild(btn);
    });

    document.getElementById('palette-total-count').textContent = questions.length;

    // Update real-time 5-state JEE CBT legend counters
    const elAns = document.getElementById('palette-count-ans');
    const elNotAns = document.getElementById('palette-count-notans');
    const elNotVis = document.getElementById('palette-count-notvis');
    const elMarked = document.getElementById('palette-count-marked');
    const elMarkedAns = document.getElementById('palette-count-markedans');
    if (elAns) elAns.textContent = countAns;
    if (elNotAns) elNotAns.textContent = countNotAns;
    if (elNotVis) elNotVis.textContent = countNotVis;
    if (elMarked) elMarked.textContent = countMarked;
    if (elMarkedAns) elMarkedAns.textContent = countMarkedAns;
  },

  renderCurrentQuestion() {
    const questions = this.quiz.questions;
    const q = questions[this.currentIndex];
    if (!q) return;

    if (!this.visitedQuestions) this.visitedQuestions = new Set();
    this.visitedQuestions.add(q.id);
    this.renderPalette();

    // Progress Bar
    const percent = ((this.currentIndex + 1) / questions.length) * 100;
    document.getElementById('player-progress-fill').style.width = `${percent}%`;
    document.getElementById('player-progress-text').textContent = `Question ${this.currentIndex + 1} of ${questions.length}`;

    // Question Number & Text
    document.getElementById('current-q-badge').textContent = `Q${this.currentIndex + 1}`;
    document.getElementById('current-q-text').innerHTML = App.formatMathText(q.question_text);

    // Marking scheme badge next to Q number
    const marksBadge = document.getElementById('current-q-marks-badge');
    const pos = this.quiz.positive_marks ?? 4;
    const neg = this.quiz.negative_marks ?? 1;
    if (marksBadge) {
      if (q.question_type === 'integer') {
        marksBadge.textContent = `Numerical · +${pos}, 0`;
        marksBadge.className = 'badge badge-slate';
      } else {
        marksBadge.textContent = `MCQ · +${pos}, -${neg}`;
        marksBadge.className = 'badge badge-slate';
      }
    }

    // Flag button state
    const flagBtn = document.getElementById('btn-flag-question');
    const isFlagged = this.flaggedQuestions.has(q.id);
    flagBtn.innerHTML = isFlagged ? '★ Flagged <span class="kbd-cap" style="margin-left:4px;">F</span>' : '☆ Flag for Review <span class="kbd-cap" style="margin-left:4px;">F</span>';
    flagBtn.className = 'btn btn-outline';
    if (isFlagged) {
      flagBtn.style.borderColor = 'var(--accent-amber)';
      flagBtn.style.color = 'var(--accent-amber)';
      flagBtn.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
    } else {
      flagBtn.style.borderColor = '';
      flagBtn.style.color = '';
      flagBtn.style.backgroundColor = '';
    }

    // Question Image Handling
    const imgContainer = document.getElementById('question-image-container');
    if (q.image_url && q.image_url.trim()) {
      imgContainer.style.display = 'block';
      imgContainer.innerHTML = `
        <img src="${q.image_url}" alt="Question Diagram" loading="lazy"
             onerror="this.onerror=null; this.style.display='none'; const b=this.parentElement.querySelector('.image-zoom-badge'); if(b) b.style.display='none'; const fb=this.parentElement.querySelector('.img-error-fallback'); if(fb) fb.style.display='flex';" />
        <div class="image-zoom-badge">
          <span style="display:flex;align-items:center;gap:4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Click to enlarge
          </span>
        </div>
        <div class="img-error-fallback" style="display:none; flex-direction:column; align-items:center; justify-content:center; padding:1.25rem; gap:0.5rem; color:var(--text-secondary); text-align:center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style="font-size:0.875rem;">Diagram failed to load</span>
          <button type="button" class="btn btn-outline btn-xs" style="margin-top:4px;" onclick="event.stopPropagation(); const p=this.closest('.question-image-box'); const img=p.querySelector('img'); if(img){ img.src='${q.image_url}?t='+Date.now(); img.style.display='block'; } const b=p.querySelector('.image-zoom-badge'); if(b) b.style.display='block'; this.parentElement.style.display='none';">↻ Retry Diagram</button>
        </div>
      `;
      imgContainer.onclick = () => App.openLightbox(q.image_url);
    } else {
      imgContainer.style.display = 'none';
      imgContainer.innerHTML = '';
      imgContainer.onclick = null;
    }

    // Question Answer input containers
    const optionsContainer = document.getElementById('options-list');
    const numericalContainer = document.getElementById('numerical-input-container');
    const numInput = document.getElementById('input-numerical-answer');
    const clearNumBtn = document.getElementById('btn-clear-numerical');
    const keypad = document.getElementById('cbt-numeric-keypad');

    const userAnswer = this.userAnswers[q.id];

    if (q.question_type === 'integer') {
      optionsContainer.style.display = 'none';
      optionsContainer.innerHTML = '';
      if (numericalContainer) numericalContainer.style.display = 'block';

      if (numInput) {
        numInput.value = (userAnswer !== undefined && userAnswer !== null) ? userAnswer : '';

        // Practice / drill mode feedback
        if ((this.mode === 'practice' || this.mode === 'drill') && userAnswer !== undefined && String(userAnswer).trim() !== '') {
          const corrVal = q.correct_numerical_value;
          const tol = q.numerical_tolerance || 0;
          let isCorrect = false;
          try {
            isCorrect = (corrVal !== null && corrVal !== undefined) && Math.abs(parseFloat(userAnswer) - parseFloat(corrVal)) <= tol;
          } catch (e) {}

          if (isCorrect) {
            numInput.style.borderColor = 'var(--accent-emerald)';
            numInput.style.backgroundColor = 'var(--accent-emerald-subtle)';
          } else {
            numInput.style.borderColor = 'var(--accent-rose)';
            numInput.style.backgroundColor = 'var(--accent-rose-subtle)';
          }
        } else {
          numInput.style.borderColor = '';
          numInput.style.backgroundColor = '';
        }

        numInput.oninput = (e) => {
          const val = e.target.value.trim();
          if (val) {
            this.userAnswers[q.id] = val;
          } else {
            delete this.userAnswers[q.id];
          }
          this.renderPalette();
        };
      }

      if (clearNumBtn && numInput) {
        clearNumBtn.onclick = () => {
          numInput.value = '';
          delete this.userAnswers[q.id];
          this.renderPalette();
          numInput.focus();
        };
      }

      if (keypad && numInput) {
        keypad.onclick = (e) => {
          const btn = e.target.closest('.cbt-key');
          if (!btn) return;
          const key = btn.dataset.key;
          const action = btn.dataset.action;

          if (key) {
            numInput.value += key;
          } else if (action === 'backspace') {
            numInput.value = numInput.value.slice(0, -1);
          } else if (action === 'clear') {
            numInput.value = '';
          }

          const val = numInput.value.trim();
          if (val) {
            this.userAnswers[q.id] = val;
          } else {
            delete this.userAnswers[q.id];
          }
          this.renderPalette();
          numInput.focus();
        };
      }
    } else {
      if (numericalContainer) numericalContainer.style.display = 'none';
      optionsContainer.style.display = 'flex';
      optionsContainer.innerHTML = '';

      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const selectedOptId = this.userAnswers[q.id];

      q.options.forEach((opt, optIdx) => {
        const card = document.createElement('div');
        card.className = 'option-card';
        if (selectedOptId === opt.id) {
          card.classList.add('selected');
        }

        // In practice or drill mode, if already answered, reveal correct/incorrect styling
        if ((this.mode === 'practice' || this.mode === 'drill') && selectedOptId !== undefined) {
          if (opt.is_correct) {
            card.classList.add('correct-reveal');
          } else if (selectedOptId === opt.id) {
            card.classList.add('incorrect-reveal');
          }
        }

        const keyLabel = alphabet[optIdx] || `${optIdx + 1}`;
        const hasImg = Boolean(opt.image_url && opt.image_url.trim());
        const hasText = Boolean(opt.option_text && opt.option_text.trim());

        let optContentHtml = '';
        if (hasImg) {
          optContentHtml += `
            <div class="option-image-box">
              <img src="${opt.image_url}" alt="Option ${keyLabel} Diagram" loading="lazy"
                   onerror="this.onerror=null; this.style.display='none'; const fb=this.parentElement.querySelector('.img-error-fallback'); if(fb) fb.style.display='flex';" />
              <button type="button" class="opt-img-zoom-btn" title="Click to enlarge option diagram" onclick="event.stopPropagation(); App.openLightbox('${opt.image_url}');">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <span>Enlarge</span>
              </button>
              <div class="img-error-fallback" style="display:none; padding:0.5rem; font-size:0.75rem; color:var(--text-muted); text-align:center;">
                Diagram failed to load.
                <button type="button" class="btn btn-outline btn-xs" style="margin-left:4px;" onclick="event.stopPropagation(); const img=this.parentElement.parentElement.querySelector('img'); if(img){img.src='${opt.image_url}?t='+Date.now(); img.style.display='block';} this.parentElement.style.display='none';">↻</button>
              </div>
            </div>
          `;
        }
        if (hasText || !hasImg) {
          optContentHtml += `<div class="option-text">${App.formatMathText(opt.option_text || '')}</div>`;
        }

        card.innerHTML = `
          <div class="option-key"><span class="kbd-cap">${keyLabel}</span></div>
          <div class="option-body" style="flex:1; display:flex; flex-direction:column; gap:0.45rem;">
            ${optContentHtml}
          </div>
        `;

        card.addEventListener('click', () => {
          this.selectOption(q.id, opt.id);
        });

        optionsContainer.appendChild(card);
      });
    }

    // Explanation Box (in practice/drill mode after answering)
    const explanationBox = document.getElementById('explanation-container');
    const isAnswered = userAnswer !== undefined && userAnswer !== null && String(userAnswer).trim() !== '';
    if ((this.mode === 'practice' || this.mode === 'drill') && isAnswered && q.explanation) {
      explanationBox.style.display = 'block';
      let correctDisplay = '';
      if (q.question_type === 'integer') {
        correctDisplay = `<div style="font-size:0.85rem; font-weight:600; color:var(--accent-emerald); margin-bottom:0.4rem;">Correct Answer: ${q.correct_numerical_value}</div>`;
      }
      explanationBox.innerHTML = `
        <div class="explanation-box">
          <div class="explanation-title">Explanation &amp; Solution</div>
          ${correctDisplay}
          <div class="explanation-text">${App.formatMathText(q.explanation)}</div>
        </div>
      `;
    } else {
      explanationBox.style.display = 'none';
      explanationBox.innerHTML = '';
    }

    // Navigation buttons state
    const prevBtn = document.getElementById('btn-prev-q');
    const nextBtn = document.getElementById('btn-next-q');
    const submitBtn = document.getElementById('btn-submit-quiz');

    prevBtn.disabled = this.currentIndex === 0;

    if (this.currentIndex === questions.length - 1) {
      nextBtn.style.display = 'none';
      submitBtn.style.display = 'inline-flex';
    } else {
      nextBtn.style.display = 'inline-flex';
      submitBtn.style.display = 'none';
    }

    this.renderPalette();

    this.renderPalette();
  },

  selectOption(questionId, optionId) {
    this.userAnswers[questionId] = optionId;
    this.renderCurrentQuestion();
  },

  toggleFlagCurrent() {
    const q = this.quiz.questions[this.currentIndex];
    if (!q) return;

    if (this.flaggedQuestions.has(q.id)) {
      this.flaggedQuestions.delete(q.id);
    } else {
      this.flaggedQuestions.add(q.id);
    }
    this.renderCurrentQuestion();
  },

  goToQuestion(idx) {
    if (idx >= 0 && idx < this.quiz.questions.length) {
      this.currentIndex = idx;
      this.renderCurrentQuestion();
    }
  },

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderCurrentQuestion();
    }
  },

  nextQuestion() {
    if (this.currentIndex < this.quiz.questions.length - 1) {
      this.currentIndex++;
      this.renderCurrentQuestion();
    }
  },

  confirmSubmit() {
    if (this._isSubmitting) return;
    const total = this.quiz.questions.length;
    let answeredCount = 0;
    (this.quiz.questions || []).forEach(q => {
      const uVal = this.userAnswers[q.id];
      if (uVal !== undefined && uVal !== null && String(uVal).trim() !== '') {
        answeredCount++;
      }
    });
    const unanswered = total - answeredCount;
    const markedCount = this.flaggedQuestions ? this.flaggedQuestions.size : 0;

    if (this.hasSubmitted || this._isSubmitting) return;

    const modal = document.getElementById('submit-confirm-modal');
    if (!modal) {
      // Fallback to direct submit if modal is absent
      this.submitQuiz();
      return;
    }

    const btnProceed = document.getElementById('btn-submit-confirm-proceed');
    const btnCancel = document.getElementById('btn-submit-confirm-cancel');
    if (btnProceed) {
      btnProceed.disabled = false;
      btnProceed.style.pointerEvents = '';
      btnProceed.style.opacity = '';
      btnProceed.innerHTML = '<span>Submit Now</span>';
    }
    if (btnCancel) {
      btnCancel.disabled = false;
      btnCancel.style.pointerEvents = '';
    }

    const statsEl = document.getElementById('submit-confirm-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div style="background:var(--bg-card); padding:0.75rem; border-radius:8px; border:1px solid var(--border-color); text-align:center;">
          <div style="font-size:1.4rem; font-weight:700; color:var(--text-primary); font-family:var(--font-mono);">${total}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Total Questions</div>
        </div>
        <div style="background:rgba(16,185,129,0.08); padding:0.75rem; border-radius:8px; border:1px solid rgba(16,185,129,0.25); text-align:center;">
          <div style="font-size:1.4rem; font-weight:700; color:var(--accent-emerald); font-family:var(--font-mono);">${answeredCount}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Answered</div>
        </div>
        <div style="background:rgba(239,68,68,0.08); padding:0.75rem; border-radius:8px; border:1px solid rgba(239,68,68,0.25); text-align:center;">
          <div style="font-size:1.4rem; font-weight:700; color:${unanswered > 0 ? 'var(--accent-rose)' : 'var(--text-muted)'}; font-family:var(--font-mono);">${unanswered}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Not Answered</div>
        </div>
        <div style="background:rgba(139,92,246,0.08); padding:0.75rem; border-radius:8px; border:1px solid rgba(139,92,246,0.25); text-align:center;">
          <div style="font-size:1.4rem; font-weight:700; color:var(--accent-purple, #a78bfa); font-family:var(--font-mono);">${markedCount}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Marked for Review</div>
        </div>
      `;
    }

    const warningEl = document.getElementById('submit-confirm-warning');
    if (warningEl) {
      if (unanswered > 0) {
        warningEl.style.display = 'block';
        warningEl.textContent = `⚠️ You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Unanswered questions receive 0 marks.`;
      } else {
        warningEl.style.display = 'none';
      }
    }

    modal.classList.add('active');
  },

  hideSubmitConfirmModal() {
    const modal = document.getElementById('submit-confirm-modal');
    if (modal) modal.classList.remove('active');
  },

  executeSubmitFromModal() {
    if (this.hasSubmitted || this._isSubmitting) return;

    const btnProceed = document.getElementById('btn-submit-confirm-proceed');
    const btnCancel = document.getElementById('btn-submit-confirm-cancel');
    if (btnProceed) {
      btnProceed.disabled = true;
      btnProceed.style.pointerEvents = 'none';
      btnProceed.style.opacity = '0.65';
      btnProceed.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.8s linear infinite; vertical-align: middle; margin-right: 4px;">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        <span>Submitting...</span>
      `;
    }
    if (btnCancel) {
      btnCancel.disabled = true;
      btnCancel.style.pointerEvents = 'none';
    }

    this.hideSubmitConfirmModal();
    this.submitQuiz();
  },

  /* ==================== ANTI-CHEATING LOCKDOWN ENGINE ==================== */
  activateAntiCheatingLockdown() {
    this.deactivateAntiCheatingLockdown();

    this._onWindowBlur = () => {
      this.handleSecurityViolation('window_blur', 'Window or Tab focus lost (Alt+Tab or desktop switch)');
    };

    this._onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.handleSecurityViolation('visibility_hidden', 'Application hidden or switched to background');
      }
    };

    this._onContextMenu = (e) => {
      e.preventDefault();
      App.showToast('Right-click context menu is disabled during exam.', 'warning');
      return false;
    };

    this._onCopyCut = (e) => {
      e.preventDefault();
      App.showToast('Copying question content is prohibited.', 'warning');
      return false;
    };

    this._onSelectStart = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return true;
      }
      e.preventDefault();
      return false;
    };

    this._onSecurityKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      if (ctrl && (key === 'u' || key === 'p' || key === 's')) {
        e.preventDefault();
        return false;
      }
      if (ctrl && shift && (key === 'i' || key === 'j' || key === 'c')) {
        e.preventDefault();
        return false;
      }
      if (ctrl && key === 'c') {
        if (!e.target || (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA')) {
          e.preventDefault();
          App.showToast('Copying question content is disabled during exam.', 'warning');
          return false;
        }
      }
    };

    this._onFullscreenChange = () => {
      if (this.mode === 'exam' && !document.fullscreenElement && !document.webkitFullscreenElement) {
        this.showFullscreenLockModal();
      } else {
        this.hideFullscreenLockModal();
      }
    };

    window.addEventListener('blur', this._onWindowBlur);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    document.addEventListener('contextmenu', this._onContextMenu);
    document.addEventListener('copy', this._onCopyCut);
    document.addEventListener('cut', this._onCopyCut);
    document.addEventListener('selectstart', this._onSelectStart);
    window.addEventListener('keydown', this._onSecurityKeyDown);
    document.addEventListener('fullscreenchange', this._onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);
  },

  deactivateAntiCheatingLockdown() {
    document.body.classList.remove('exam-lockdown-active');
    if (this._onWindowBlur) window.removeEventListener('blur', this._onWindowBlur);
    if (this._onVisibilityChange) document.removeEventListener('visibilitychange', this._onVisibilityChange);
    if (this._onContextMenu) document.removeEventListener('contextmenu', this._onContextMenu);
    if (this._onCopyCut) {
      document.removeEventListener('copy', this._onCopyCut);
      document.removeEventListener('cut', this._onCopyCut);
    }
    if (this._onSelectStart) document.removeEventListener('selectstart', this._onSelectStart);
    if (this._onSecurityKeyDown) window.removeEventListener('keydown', this._onSecurityKeyDown);
    if (this._onFullscreenChange) {
      document.removeEventListener('fullscreenchange', this._onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', this._onFullscreenChange);
    }
    this.hideSecurityWarningModal();
    this.hideFullscreenLockModal();
  },

  playSecurityAlertBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch (e) {}
  },

  handleSecurityViolation(type, description) {
    if (this.mode !== 'exam') return;

    // Throttle duplicate events within 1.5s
    const now = Date.now();
    if (this._lastViolationTime && (now - this._lastViolationTime) < 1500) {
      return;
    }
    this._lastViolationTime = now;

    this.violationsCount++;
    const timestamp = new Date().toLocaleTimeString();
    this.violationsLog.push({
      type,
      description,
      timestamp,
      questionIdx: this.currentIndex + 1
    });

    this.playSecurityAlertBeep();
    this.isTimerPaused = true;
    this.showSecurityWarningModal();
  },

  showSecurityWarningModal() {
    const modal = document.getElementById('security-warning-modal');
    if (!modal) return;

    modal.classList.add('active');

    for (let i = 1; i <= 3; i++) {
      const dot = document.getElementById(`strike-dot-${i}`);
      if (dot) {
        dot.className = `strike-pill ${i <= this.violationsCount ? 'active' : ''}`;
      }
    }

    const strikesLeft = Math.max(0, this.maxViolations - this.violationsCount);
    const strikesLeftEl = document.getElementById('security-strikes-left');
    const msgEl = document.getElementById('security-warning-message');
    const resumeBtn = document.getElementById('btn-security-resume');

    if (this.violationsCount >= this.maxViolations) {
      this.isDisqualified = true;
      if (msgEl) msgEl.textContent = 'Maximum Security Violations Reached!';
      if (strikesLeftEl) strikesLeftEl.textContent = '0 warnings remaining. Test terminated.';
      if (resumeBtn) {
        resumeBtn.textContent = 'Submit Terminated Assessment';
        resumeBtn.onclick = () => {
          this.hideSecurityWarningModal();
          this.submitQuiz(true);
        };
      }
    } else {
      if (msgEl) msgEl.textContent = `Warning ${this.violationsCount} of ${this.maxViolations}: Window switch detected!`;
      if (strikesLeftEl) strikesLeftEl.textContent = `${strikesLeft} warning${strikesLeft === 1 ? '' : 's'} remaining`;
      if (resumeBtn) {
        resumeBtn.textContent = 'I Acknowledge & Resume Exam';
        resumeBtn.onclick = () => {
          this.hideSecurityWarningModal();
          this.isTimerPaused = false;
        };
      }
    }
  },

  hideSecurityWarningModal() {
    const modal = document.getElementById('security-warning-modal');
    if (modal) modal.classList.remove('active');
  },

  showFullscreenLockModal() {
    const modal = document.getElementById('fullscreen-lock-modal');
    if (modal) {
      modal.classList.add('active');
      const btn = document.getElementById('btn-reenter-fullscreen');
      if (btn) {
        btn.onclick = () => {
          try {
            const el = document.documentElement;
            if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
          } catch (e) {}
          this.hideFullscreenLockModal();
        };
      }
    }
  },

  hideFullscreenLockModal() {
    const modal = document.getElementById('fullscreen-lock-modal');
    if (modal) modal.classList.remove('active');
  },

  async submitQuiz(forced = false) {
    if (this.hasSubmitted || this._isSubmitting) {
      console.warn('Submission already in progress or completed.');
      return;
    }
    this._isSubmitting = true;

    const btnSubmit = document.getElementById('btn-submit-quiz');
    const btnPalette = document.getElementById('btn-palette-submit-quiz');
    const originalText = btnSubmit ? btnSubmit.innerHTML : '';
    const originalPaletteText = btnPalette ? btnPalette.innerHTML : '';

    const spinnerHtml = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.8s linear infinite; vertical-align: middle; margin-right: 4px;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" />
      </svg>
      <span>Submitting...</span>
    `;

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.style.opacity = '0.65';
      btnSubmit.style.pointerEvents = 'none';
      btnSubmit.innerHTML = spinnerHtml;
    }
    if (btnPalette) {
      btnPalette.disabled = true;
      btnPalette.style.opacity = '0.65';
      btnPalette.style.pointerEvents = 'none';
      btnPalette.innerHTML = spinnerHtml;
    }

    try {
      clearInterval(this.timerInterval);
      this.detachKeyboardEvents();
      this.deactivateAntiCheatingLockdown();

      // Exit Fullscreen Mode
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
      } catch (e) {}
      document.body.classList.remove('fullscreen-test-mode');

      let score = 0;
      const total = this.quiz.questions.length;
      const posMarks = (this.quiz.positive_marks !== undefined && this.quiz.positive_marks !== null) ? parseFloat(this.quiz.positive_marks) : 4.0;
      const negMarks = (this.quiz.negative_marks !== undefined && this.quiz.negative_marks !== null) ? parseFloat(this.quiz.negative_marks) : 1.0;

      let positiveScore = 0;
      let negativePenalty = 0;

      this.quiz.questions.forEach(q => {
        const userVal = this.userAnswers[q.id];

        if (q.question_type === 'integer') {
          if (userVal !== undefined && userVal !== null && String(userVal).trim() !== '') {
            const corrVal = q.correct_numerical_value;
            const tol = parseFloat(q.numerical_tolerance || 0);
            let isCorrect = false;
            try {
              isCorrect = (corrVal !== null && corrVal !== undefined) && Math.abs(parseFloat(userVal) - parseFloat(corrVal)) <= tol;
            } catch (e) {}

            if (isCorrect) {
              score++;
              positiveScore += posMarks;
            } else {
              negativePenalty += 0;
            }
          }
        } else {
          if (userVal !== undefined && userVal !== null) {
            const correctOpt = (q.options || []).find(o => o.is_correct);
            if (correctOpt && correctOpt.id === userVal) {
              score++;
              positiveScore += posMarks;
            } else {
              negativePenalty += negMarks;
            }
          }
        }
      });

      positiveScore = Math.round(positiveScore * 100) / 100;
      negativePenalty = Math.round(negativePenalty * 100) / 100;
      const netMarks = Math.round((positiveScore - negativePenalty) * 100) / 100;
      const maxMarks = Math.round((total * posMarks) * 100) / 100;

      try {
        const qid = parseInt(this.quiz.id, 10);
        if (!isNaN(qid)) {
          const attemptPayload = {
            score: score,
            total_questions: total,
            time_taken_seconds: this.timeTakenSeconds,
            answers: this.userAnswers,
            positive_score: positiveScore,
            negative_penalty: negativePenalty,
            net_marks: netMarks,
            max_marks: maxMarks,
            violations_count: this.violationsCount,
            violations_log: this.violationsLog,
            is_disqualified: this.isDisqualified,
            student_name: this.studentName || 'Anonymous Student',
            student_roll: this.studentRoll || ''
          };

          try {
            await API.recordAttempt(qid, attemptPayload);
          } catch (firstErr) {
            console.warn('Initial attempt submission failed, retrying once...', firstErr);
            await new Promise(r => setTimeout(r, 800));
            await API.recordAttempt(qid, attemptPayload);
          }
        }
      } catch (e) {
        console.error('Failed to save attempt record:', e);
        App.showToast(`Submission notice: Recorded on device (${e.message || 'Server timeout'})`, 'warning');
      }

      this.hasSubmitted = true;
      App.showResults({
        quiz: this.quiz,
        userAnswers: this.userAnswers,
        score: score,
        total: total,
        timeTaken: this.timeTakenSeconds,
        isDrill: this.mode === 'drill',
        originalQuiz: this.originalQuiz || this.quiz,
        positiveScore: positiveScore,
        negativePenalty: negativePenalty,
        netMarks: netMarks,
        maxMarks: maxMarks
      });
    } finally {
      if (this.hasSubmitted) {
        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.style.opacity = '0.5';
          btnSubmit.style.pointerEvents = 'none';
          btnSubmit.innerHTML = '<span>Submitted</span>';
        }
        if (btnPalette) {
          btnPalette.disabled = true;
          btnPalette.style.opacity = '0.5';
          btnPalette.style.pointerEvents = 'none';
          btnPalette.innerHTML = '<span>Submitted</span>';
        }
      } else {
        this._isSubmitting = false;
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.style.opacity = '';
          btnSubmit.style.pointerEvents = '';
          btnSubmit.innerHTML = originalText || '<span>Submit Test</span>';
        }
        if (btnPalette) {
          btnPalette.disabled = false;
          btnPalette.style.opacity = '';
          btnPalette.style.pointerEvents = '';
          btnPalette.innerHTML = originalPaletteText || '<span>Submit Exam</span>';
        }
      }
    }
  },

  attachKeyboardEvents() {
    this.keyHandler = (e) => {
      // Don't intercept if inside an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const key = e.key.toUpperCase();
      const currentQ = this.quiz.questions[this.currentIndex];

      // Option selection by letter (A-D) or number (1-4)
      const alphabet = 'ABCD';
      if (alphabet.includes(key)) {
        const optIdx = alphabet.indexOf(key);
        if (currentQ && currentQ.options[optIdx]) {
          this.selectOption(currentQ.id, currentQ.options[optIdx].id);
        }
      } else if (['1', '2', '3', '4'].includes(key)) {
        const optIdx = parseInt(key) - 1;
        if (currentQ && currentQ.options[optIdx]) {
          this.selectOption(currentQ.id, currentQ.options[optIdx].id);
        }
      } else if (e.key === 'ArrowLeft' || key === 'P') {
        this.prevQuestion();
      } else if (e.key === 'ArrowRight' || key === 'N') {
        this.nextQuestion();
      } else if (key === 'F') {
        this.toggleFlagCurrent();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  },

  detachKeyboardEvents() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  },

  applyZoom() {
    const factor = this.zoomLevels[this.currentZoomIdx];
    const percent = Math.round(factor * 100);
    const panel = document.querySelector('.quiz-panel');
    if (panel) {
      panel.style.setProperty('--exam-zoom', factor);
    }
    const label = document.getElementById('zoom-level-label');
    if (label) label.textContent = `${percent}%`;
  },

  zoomIn() {
    if (this.currentZoomIdx < this.zoomLevels.length - 1) {
      this.currentZoomIdx++;
      this.applyZoom();
    }
  },

  zoomOut() {
    if (this.currentZoomIdx > 0) {
      this.currentZoomIdx--;
      this.applyZoom();
    }
  },

  zoomReset() {
    this.currentZoomIdx = 2; // 100%
    this.applyZoom();
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
