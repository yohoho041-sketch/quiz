/**
 * Main Application Controller for QuizMaster Assessment Platform
 * Enterprise-grade UI, Tab Navigation, and Past Tests History Engine.
 */

const App = {
  currentView: 'dashboard',
  allQuizzes: [],
  allAttempts: [],
  activeCategory: 'All',
  lastCompletedQuiz: null,
  isTeacherMode: false,
  pendingQuizIdForExam: null,

  init() {
    this.isTeacherMode = Boolean(API.getTeacherPin());
    this.bindGlobalEvents();
    this.bindTeacherAndCandidateEvents();
    this.updateTeacherModeUI();
    this.updateStudentNavDisplay();
    this.showDashboard();
    this.refreshHistoryBadge();

    // Check if teacher accesses via URL query (?teacher or ?admin)
    const urlParams = new URLSearchParams(window.location.search);
    if (!this.isTeacherMode && (urlParams.has('teacher') || urlParams.has('admin'))) {
      this.openTeacherLoginModal();
    }
  },

  updateTeacherModeUI() {
    const navPortalTag = document.getElementById('nav-portal-tag');
    const btnNavCreate = document.getElementById('btn-nav-create');
    const teacherBanner = document.getElementById('teacher-mode-banner');
    const btnTeacherToggle = document.getElementById('btn-teacher-toggle');
    const teacherToggleLabel = document.getElementById('teacher-toggle-label');
    const teacherLockIcon = document.getElementById('teacher-lock-icon');
    const historyTabLabel = document.getElementById('history-tab-label');

    if (this.isTeacherMode) {
      if (btnNavCreate) btnNavCreate.style.display = 'inline-flex';
      if (btnTeacherToggle) btnTeacherToggle.style.display = 'inline-flex';
      if (teacherBanner) teacherBanner.classList.remove('active');
      if (teacherToggleLabel) teacherToggleLabel.textContent = 'Exit Teacher Mode';
      if (teacherLockIcon) {
        teacherLockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>';
      }
      if (historyTabLabel) historyTabLabel.textContent = 'Submissions';
    } else {
      if (btnNavCreate) btnNavCreate.style.display = 'none';
      if (btnTeacherToggle) btnTeacherToggle.style.display = 'none'; // Completely hidden for students!
      if (teacherBanner) teacherBanner.classList.remove('active');
      if (historyTabLabel) historyTabLabel.textContent = 'My Attempts';
    }
  },

  bindTeacherAndCandidateEvents() {
    // Teacher toggle button in top nav
    const btnTeacherToggle = document.getElementById('btn-teacher-toggle');
    if (btnTeacherToggle) {
      btnTeacherToggle.addEventListener('click', () => {
        if (this.isTeacherMode) {
          this.exitTeacherMode();
        } else {
          this.openTeacherLoginModal();
        }
      });
    }

    // Teacher logout button in banner
    const btnTeacherLogout = document.getElementById('btn-teacher-logout');
    if (btnTeacherLogout) {
      btnTeacherLogout.addEventListener('click', () => {
        this.exitTeacherMode();
      });
    }

    // Teacher Login Modal handlers
    const teacherModal = document.getElementById('teacher-login-modal');
    const btnTeacherCancel = document.getElementById('btn-teacher-login-cancel');
    const btnTeacherClose = document.getElementById('teacher-login-close');
    const btnTeacherSubmit = document.getElementById('btn-teacher-login-submit');
    const teacherPinInput = document.getElementById('teacher-pin-input');

    if (btnTeacherCancel) btnTeacherCancel.addEventListener('click', () => this.closeTeacherLoginModal());
    if (btnTeacherClose) btnTeacherClose.addEventListener('click', () => this.closeTeacherLoginModal());
    if (btnTeacherSubmit) btnTeacherSubmit.addEventListener('click', () => this.submitTeacherLogin());
    if (teacherPinInput) {
      teacherPinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitTeacherLogin();
        }
      });
    }

    // Student Candidate Entry Modal handlers
    const btnStudentCancel = document.getElementById('btn-student-entry-cancel');
    const btnStudentClose = document.getElementById('student-entry-close');
    const btnStudentStart = document.getElementById('btn-student-entry-start');
    const studentPinInput = document.getElementById('student-input-pin');
    const studentNameInput = document.getElementById('student-input-name');

    if (btnStudentCancel) btnStudentCancel.addEventListener('click', () => this.closeStudentEntryModal());
    if (btnStudentClose) btnStudentClose.addEventListener('click', () => this.closeStudentEntryModal());
    if (btnStudentStart) btnStudentStart.addEventListener('click', () => this.startExamWithCandidateInfo());
    if (studentPinInput) {
      studentPinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (studentNameInput) studentNameInput.focus();
        }
      });
    }
    if (studentNameInput) {
      studentNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.startExamWithCandidateInfo();
        }
      });
    }

    // Global shortcut Ctrl+Shift+T or Alt+T for teacher mode toggle
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') || (e.altKey && e.key.toLowerCase() === 't')) {
        e.preventDefault();
        if (this.isTeacherMode) {
          this.exitTeacherMode();
        } else {
          this.openTeacherLoginModal();
        }
      }
    });

    // Stealth trigger: triple-click on brand logo to open teacher modal
    const brandLogo = document.getElementById('nav-brand');
    if (brandLogo) {
      let clickCount = 0;
      let clickTimer = null;
      brandLogo.addEventListener('click', (e) => {
        clickCount++;
        if (clickCount === 3) {
          clearTimeout(clickTimer);
          clickCount = 0;
          this.openTeacherLoginModal();
        } else {
          clearTimeout(clickTimer);
          clickTimer = setTimeout(() => {
            clickCount = 0;
            this.showDashboard();
          }, 350);
        }
      });
    }
  },

  openTeacherLoginModal() {
    const modal = document.getElementById('teacher-login-modal');
    const input = document.getElementById('teacher-pin-input');
    const errEl = document.getElementById('teacher-pin-error');
    if (errEl) errEl.style.display = 'none';
    if (input) input.value = '';
    if (modal) modal.classList.add('active');
    setTimeout(() => { if (input) input.focus(); }, 100);
  },

  closeTeacherLoginModal() {
    const modal = document.getElementById('teacher-login-modal');
    if (modal) modal.classList.remove('active');
  },

  async submitTeacherLogin() {
    const input = document.getElementById('teacher-pin-input');
    const errEl = document.getElementById('teacher-pin-error');
    const pin = (input ? input.value : '').trim();
    if (!pin) {
      if (errEl) {
        errEl.textContent = 'Please enter teacher PIN';
        errEl.style.display = 'block';
      }
      return;
    }
    try {
      await API.verifyTeacherPin(pin);
      this.enterTeacherMode(pin);
      this.closeTeacherLoginModal();
      this.showToast('Teacher Mode unlocked successfully', 'success');
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Incorrect Teacher PIN';
        errEl.style.display = 'block';
      }
    }
  },

  enterTeacherMode(pin) {
    this.isTeacherMode = true;
    API.setTeacherPin(pin);
    API.invalidateQuizzesCache();
    this.updateTeacherModeUI();
    if (this.currentView === 'dashboard') {
      this.showDashboard(true);
    } else if (this.currentView === 'history') {
      this.showHistory();
    }
  },

  exitTeacherMode() {
    this.isTeacherMode = false;
    API.setTeacherPin('');
    API.invalidateQuizzesCache();
    this.updateTeacherModeUI();
    this.showToast('Switched to Student Portal view', 'info');
    if (this.currentView === 'dashboard') {
      this.showDashboard(true);
    } else if (this.currentView === 'history') {
      this.showHistory();
    }
  },

  getStudentPin() {
    return localStorage.getItem('quiz_student_pin') || '';
  },

  getStudentName() {
    return localStorage.getItem('quiz_student_name') || '';
  },

  getStudentRoll() {
    return localStorage.getItem('quiz_student_roll') || '';
  },

  updateStudentNavDisplay() {
    const label = document.getElementById('nav-student-label');
    const pin = this.getStudentPin();
    const name = this.getStudentName();
    if (label) {
      if (pin && name) {
        label.textContent = `${name.split(' ')[0]} (#${pin})`;
      } else if (pin) {
        label.textContent = `Student #${pin}`;
      } else {
        label.textContent = 'Student Login';
      }
    }
  },

  openStudentLoginModal(quizId = null) {
    this.pendingQuizIdForExam = quizId;
    const modal = document.getElementById('student-entry-modal');
    if (!modal) return;

    const titleEl = document.getElementById('student-modal-quiz-title');
    if (titleEl) {
      if (quizId) {
        const q = this.allQuizzes.find(x => x.id === quizId);
        titleEl.textContent = q ? `${q.title} — Candidate Login` : 'Assessment Candidate Entry';
      } else {
        titleEl.textContent = 'Student Login (6-Digit PIN)';
      }
    }

    const pinInput = document.getElementById('student-input-pin');
    const nameInput = document.getElementById('student-input-name');

    if (pinInput) pinInput.value = this.getStudentPin();
    if (nameInput) nameInput.value = this.getStudentName();

    modal.classList.add('active');
    setTimeout(() => {
      if (pinInput && !pinInput.value) {
        pinInput.focus();
      } else if (nameInput) {
        nameInput.focus();
        if (nameInput.value) nameInput.select();
      }
    }, 100);
  },

  promptCandidateDetails(quizId, mode = 'exam') {
    if (mode !== 'exam') {
      this.startQuiz(quizId, mode);
      return;
    }
    this.openStudentLoginModal(quizId);
  },

  closeStudentEntryModal() {
    const modal = document.getElementById('student-entry-modal');
    if (modal) modal.classList.remove('active');
  },

  startExamWithCandidateInfo() {
    const pinInput = document.getElementById('student-input-pin');
    const nameInput = document.getElementById('student-input-name');

    const pin = (pinInput ? pinInput.value : '').trim();
    const name = (nameInput ? nameInput.value : '').trim();

    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      this.showToast('Please enter a valid 6-digit PIN (e.g. 123456)', 'warning');
      if (pinInput) pinInput.focus();
      return;
    }

    if (!name) {
      this.showToast('Please enter your full name to begin', 'warning');
      if (nameInput) nameInput.focus();
      return;
    }

    localStorage.setItem('quiz_student_pin', pin);
    localStorage.setItem('quiz_student_name', name);
    localStorage.setItem('quiz_student_roll', pin);
    this.updateStudentNavDisplay();
    this.closeStudentEntryModal();
    this.showToast(`Logged in as ${name} (PIN: ${pin})`, 'success');
    this.updateWeakSpotBanner();

    if (this.currentView === 'history') {
      this.showHistory();
    }

    if (this.pendingQuizIdForExam) {
      const qid = this.pendingQuizIdForExam;
      this.pendingQuizIdForExam = null;
      if (qid === 'weak_spot_custom') {
        this.startWeakSpotRevisionTest();
      } else {
        this.startQuiz(qid, 'exam', { name, roll: pin });
      }
    }
  },

  bindGlobalEvents() {
    // Top Segmented Nav Tabs
    document.getElementById('tab-assessments').addEventListener('click', () => {
      this.showDashboard();
    });
    document.getElementById('tab-history').addEventListener('click', () => {
      this.showHistory();
    });

    // Student PIN Login button in top nav
    const btnStudentLogin = document.getElementById('btn-student-pin-login');
    if (btnStudentLogin) {
      btnStudentLogin.addEventListener('click', () => {
        this.openStudentLoginModal(null);
      });
    }

    // 1-Click Adaptive Weak-Spot Revision Test
    const btnWeakSpot = document.getElementById('btn-start-weak-spot-test');
    if (btnWeakSpot) {
      btnWeakSpot.addEventListener('click', () => {
        this.startWeakSpotRevisionTest();
      });
    }

    // Nav Create button
    document.getElementById('btn-nav-create').addEventListener('click', () => {
      this.showBuilder();
    });

    // Back to history button
    document.getElementById('btn-back-to-history').addEventListener('click', () => {
      this.showHistory();
    });

    // Clear all history button
    const btnClearHistory = document.getElementById('btn-clear-history');
    if (btnClearHistory) {
      btnClearHistory.addEventListener('click', async () => {
        if (!this.allAttempts || this.allAttempts.length === 0) {
          this.showToast('No history records to delete', 'info');
          return;
        }
        if (!confirm('Are you sure you want to delete ALL test history? This action cannot be undone.')) {
          return;
        }
        try {
          await API.clearAllAttempts();
          this.showToast('All assessment history cleared', 'success');
          await this.showHistory();
          await this.loadDashboardMetrics();
        } catch (err) {
          this.showToast(`Failed to clear history: ${err.message}`, 'error');
        }
      });
    }

    // Search input with 120ms debounce for buttery-smooth typing
    let searchDebounceTimer = null;
    document.getElementById('search-quizzes').addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        this.renderDashboardCards();
      }, 120);
    });

    // Close Application button
    const btnAppClose = document.getElementById('btn-app-close');
    if (btnAppClose) {
      btnAppClose.addEventListener('click', () => {
        this.closeApplication();
      });
    }

    // Builder Prev Question (Sticky Bar)
    const btnStickyPrev = document.getElementById('btn-builder-sticky-prev');
    if (btnStickyPrev) {
      btnStickyPrev.addEventListener('click', () => {
        QuizBuilder.prevQuestion();
      });
    }

    // Builder Next Question (Sticky Bar)
    const btnStickyNext = document.getElementById('btn-builder-sticky-next');
    if (btnStickyNext) {
      btnStickyNext.addEventListener('click', () => {
        QuizBuilder.nextQuestion();
      });
    }

    // Builder Add Question
    document.getElementById('btn-builder-add-q').addEventListener('click', () => {
      QuizBuilder.addQuestion();
    });

    // Builder Save & Publish Quiz
    const btnSavePublish = document.getElementById('btn-builder-save');
    if (btnSavePublish) {
      btnSavePublish.addEventListener('click', () => {
        QuizBuilder.saveQuiz(true);
      });
    }

    // Builder Save Draft Quiz
    const btnSaveDraft = document.getElementById('btn-builder-save-draft');
    if (btnSaveDraft) {
      btnSaveDraft.addEventListener('click', () => {
        QuizBuilder.saveQuiz(false);
      });
    }

    // Builder Quick Import Bottom Button
    const btnQuickImportBottom = document.getElementById('btn-builder-quick-import-bottom');
    if (btnQuickImportBottom) {
      btnQuickImportBottom.addEventListener('click', () => {
        document.getElementById('quick-import-modal').classList.add('active');
        document.getElementById('quick-import-text').focus();
      });
    }

    // Ctrl+S / Cmd+S shortcut to save quiz in builder
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        const builderView = document.getElementById('view-builder');
        if (builderView && builderView.classList.contains('active')) {
          e.preventDefault();
          QuizBuilder.saveQuiz();
        }
      }
    });

    // Builder Cancel
    document.getElementById('btn-builder-cancel').addEventListener('click', () => {
      this.showDashboard();
    });

    // Builder Export
    document.getElementById('btn-builder-export').addEventListener('click', () => {
      QuizBuilder.exportCurrentQuizJson();
    });

    // Builder Import
    const importInput = document.getElementById('input-import-json');
    document.getElementById('btn-builder-import').addEventListener('click', () => {
      importInput.click();
    });
    importInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        QuizBuilder.importQuizJson(e.target.files[0]);
        e.target.value = '';
      }
    });

    // Builder Marking Scheme Presets
    const btnSchemeJee = document.getElementById('btn-scheme-jee');
    if (btnSchemeJee) {
      btnSchemeJee.addEventListener('click', () => {
        const posInput = document.getElementById('input-quiz-pos-marks');
        const negInput = document.getElementById('input-quiz-neg-marks');
        if (posInput) posInput.value = '4';
        if (negInput) negInput.value = '1';
        this.showToast('JEE Marking Scheme applied (+4 correct, -1 wrong MCQ)', 'info');
      });
    }

    const btnSchemeStd = document.getElementById('btn-scheme-std');
    if (btnSchemeStd) {
      btnSchemeStd.addEventListener('click', () => {
        const posInput = document.getElementById('input-quiz-pos-marks');
        const negInput = document.getElementById('input-quiz-neg-marks');
        if (posInput) posInput.value = '1';
        if (negInput) negInput.value = '0';
        this.showToast('Standard Marking Scheme applied (+1 correct, 0 wrong)', 'info');
      });
    }

    // Builder Quick Text Import Modal
    const btnQuickImport = document.getElementById('btn-builder-quick-import');
    if (btnQuickImport) {
      btnQuickImport.addEventListener('click', () => {
        document.getElementById('quick-import-modal').classList.add('active');
        document.getElementById('quick-import-text').focus();
      });
    }

    const closeQuickImport = () => {
      document.getElementById('quick-import-modal').classList.remove('active');
    };

    const qiCloseBtn = document.getElementById('quick-import-close');
    if (qiCloseBtn) qiCloseBtn.addEventListener('click', closeQuickImport);
    const qiCancelBtn = document.getElementById('btn-quick-import-cancel');
    if (qiCancelBtn) qiCancelBtn.addEventListener('click', closeQuickImport);

    const qiModal = document.getElementById('quick-import-modal');
    if (qiModal) {
      qiModal.addEventListener('click', (e) => {
        if (e.target.id === 'quick-import-modal') closeQuickImport();
      });
    }

    const qiSampleBtn = document.getElementById('btn-quick-import-sample');
    if (qiSampleBtn) {
      qiSampleBtn.addEventListener('click', () => {
        const sampleText = `1. In Linux kernel architecture, what is the role of an epoll instance?
A) Block all non-critical signals
*B) High-performance I/O event notification facility
C) Encrypt network packets before transmission
D) Manage physical RAM allocation pools
Explanation: epoll is scalable to large numbers of file descriptors with O(1) wait complexity.

2. True or False: ACID transactions guarantee immediate cross-datacenter linearizability without latency cost.
A) True
*B) False
Explanation: The CAP theorem and PACELC theorem dictate latency and consistency trade-offs across network partitions.

3. Which data structure provides O(1) amortized insertion and lookup?
A) Red-Black Tree
B) Binary Heap
*C) Hash Table
D) Skip List
Explanation: Hash tables achieve O(1) average/amortized performance with suitable hash distributions.`;
        document.getElementById('quick-import-text').value = sampleText;
      });
    }

    const qiApplyBtn = document.getElementById('btn-quick-import-apply');
    if (qiApplyBtn) {
      qiApplyBtn.addEventListener('click', () => {
        const text = document.getElementById('quick-import-text').value;
        const replace = document.getElementById('quick-import-replace').checked;
        const success = QuizBuilder.applyBulkImport(text, replace);
        if (success) {
          closeQuickImport();
          document.getElementById('quick-import-text').value = '';
        }
      });
    }

    // Player Navigation
    document.getElementById('btn-prev-q').addEventListener('click', () => {
      QuizPlayer.prevQuestion();
    });
    document.getElementById('btn-next-q').addEventListener('click', () => {
      QuizPlayer.nextQuestion();
    });
    document.getElementById('btn-flag-question').addEventListener('click', () => {
      QuizPlayer.toggleFlagCurrent();
    });
    document.getElementById('btn-submit-quiz').addEventListener('click', () => {
      QuizPlayer.confirmSubmit();
    });

    const btnPaletteSubmit = document.getElementById('btn-palette-submit-quiz');
    if (btnPaletteSubmit) {
      btnPaletteSubmit.addEventListener('click', () => {
        QuizPlayer.confirmSubmit();
      });
    }

    const btnSubmitModalClose = document.getElementById('submit-confirm-close');
    if (btnSubmitModalClose) {
      btnSubmitModalClose.addEventListener('click', () => {
        QuizPlayer.hideSubmitConfirmModal();
      });
    }

    const btnSubmitModalCancel = document.getElementById('btn-submit-confirm-cancel');
    if (btnSubmitModalCancel) {
      btnSubmitModalCancel.addEventListener('click', () => {
        QuizPlayer.hideSubmitConfirmModal();
      });
    }

    const btnSubmitModalProceed = document.getElementById('btn-submit-confirm-proceed');
    if (btnSubmitModalProceed) {
      btnSubmitModalProceed.addEventListener('click', () => {
        QuizPlayer.executeSubmitFromModal();
      });
    }

    // Exam Font & Diagram Zoom Controls
    const btnZoomIn = document.getElementById('btn-zoom-in');
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => QuizPlayer.zoomIn());

    const btnZoomOut = document.getElementById('btn-zoom-out');
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => QuizPlayer.zoomOut());

    const btnZoomReset = document.getElementById('btn-zoom-reset');
    if (btnZoomReset) btnZoomReset.addEventListener('click', () => QuizPlayer.zoomReset());
    document.getElementById('btn-player-exit').addEventListener('click', () => {
      if (confirm('Are you sure you want to exit the assessment? Your current progress will not be saved.')) {
        clearInterval(QuizPlayer.timerInterval);
        QuizPlayer.detachKeyboardEvents();
        QuizPlayer.deactivateAntiCheatingLockdown();
        try {
          if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          }
        } catch (e) {}
        document.body.classList.remove('fullscreen-test-mode');
        this.showDashboard();
      }
    });

    // Results Buttons
    document.getElementById('btn-results-retake').addEventListener('click', () => {
      this.startQuiz(this.lastCompletedQuiz.id, 'exam');
    });
    document.getElementById('btn-results-practice').addEventListener('click', () => {
      this.startQuiz(this.lastCompletedQuiz.id, 'practice');
    });
    document.getElementById('btn-results-view-history').addEventListener('click', () => {
      this.showHistory();
    });
    document.getElementById('btn-results-home').addEventListener('click', () => {
      this.showDashboard();
    });

    // Lightbox modal close
    const lbClose = document.getElementById('lightbox-close');
    if (lbClose) lbClose.addEventListener('click', () => this.closeLightbox());
    const lbModal = document.getElementById('lightbox-modal');
    if (lbModal) lbModal.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox-modal') this.closeLightbox();
    });

    // Fullscreen toggle buttons
    const btnFs = document.getElementById('btn-toggle-fullscreen');
    if (btnFs) btnFs.addEventListener('click', () => this.toggleFullscreen());

    const btnPlayerFs = document.getElementById('btn-player-fullscreen');
    if (btnPlayerFs) btnPlayerFs.addEventListener('click', () => this.toggleFullscreen());

    document.addEventListener('fullscreenchange', () => this.updateFullscreenUI());
    document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenUI());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeLightbox();
        const qi = document.getElementById('quick-import-modal');
        if (qi && qi.classList.contains('active')) {
          qi.classList.remove('active');
        }
      }
      if (e.key === 'F11') {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });
  },

  toggleFullscreen() {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const el = document.documentElement;
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  },

  updateFullscreenUI() {
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    const iconEnter = document.getElementById('fs-icon-enter');
    const iconExit = document.getElementById('fs-icon-exit');
    const label = document.getElementById('fs-btn-label');
    if (iconEnter && iconExit && label) {
      iconEnter.style.display = isFs ? 'none' : 'block';
      iconExit.style.display = isFs ? 'block' : 'none';
      label.textContent = isFs ? 'Windowed' : 'Fullscreen';
    }
  },

  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }
    this.updateActiveNavTab(viewName);
  },

  updateActiveNavTab(viewName) {
    const tabAssessments = document.getElementById('tab-assessments');
    const tabHistory = document.getElementById('tab-history');

    tabAssessments.classList.remove('active');
    tabHistory.classList.remove('active');

    if (viewName === 'dashboard') {
      tabAssessments.classList.add('active');
    } else if (viewName === 'history' || viewName === 'attempt-detail') {
      tabHistory.classList.add('active');
    }
  },

  async refreshHistoryBadge() {
    try {
      const attempts = await API.getAllAttempts();
      const badge = document.getElementById('history-count-badge');
      if (badge) {
        badge.textContent = attempts.length || 0;
      }
    } catch (e) {
      // ignore
    }
  },

  async showDashboard(forceRefresh = false) {
    this.switchView('dashboard');
    try {
      this.allQuizzes = await API.getQuizzes(forceRefresh);
      const stats = await API.getStats();
      this.updateStatsRibbon(stats);
      this.renderDashboardCards();
      this.refreshHistoryBadge();
      this.updateWeakSpotBanner();
    } catch (err) {
      this.showToast(`Error loading assessments: ${err.message}`, 'error');
    }
  },

  async getWeakSpotPool() {
    const studentPin = this.getStudentPin();
    if (!this.isTeacherMode && !studentPin) {
      return [];
    }

    // Collect all missed and unattempted questions from past completed tests
    const pool = new Map(); // question_id -> question object

    try {
      const attempts = await API.getAllAttempts();
      if (!attempts || attempts.length === 0) return [];

      for (const att of attempts) {
        // Fetch attempt detail with full quiz questions & student answers
        try {
          const detail = await API.getAttemptDetail(att.attempt_id);
          if (!detail || !detail.quiz || !detail.quiz.questions) continue;

          const userAnswers = detail.answers || {};
          detail.quiz.questions.forEach(q => {
            const userVal = userAnswers[q.id] !== undefined ? userAnswers[q.id] : userAnswers[String(q.id)];
            let isCorrect = false;

            if (q.question_type === 'integer') {
              const hasAnswered = userVal !== undefined && userVal !== null && String(userVal).trim() !== '';
              const corrVal = q.correct_numerical_value;
              const tol = parseFloat(q.numerical_tolerance || 0);
              try {
                isCorrect = hasAnswered && (corrVal !== null && corrVal !== undefined) && Math.abs(parseFloat(userVal) - parseFloat(corrVal)) <= tol;
              } catch (e) {
                isCorrect = false;
              }
            } else {
              const hasAnswered = userVal !== undefined && userVal !== null;
              const correctOpt = (q.options || []).find(o => o.is_correct);
              isCorrect = hasAnswered && correctOpt && userVal === correctOpt.id;
            }

            // If wrong or unattempted, add to weak spot pool
            if (!isCorrect && !pool.has(q.id)) {
              pool.set(q.id, {
                ...q,
                sourceQuizTitle: detail.quiz.title || 'Assignment'
              });
            }
          });
        } catch (e) {
          // ignore single attempt load error
        }
      }
    } catch (e) {
      // ignore
    }

    // Exclude any questions that the student has since mastered (answered correctly in revision)
    try {
      const storageKey = studentPin ? `quiz_mastered_ids_${studentPin}` : 'quiz_mastered_question_ids';
      const masteredIds = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
      for (const qid of masteredIds) {
        pool.delete(qid);
        pool.delete(Number(qid));
        pool.delete(String(qid));
      }
    } catch (e) {}

    return Array.from(pool.values());
  },

  async updateWeakSpotBanner() {
    const banner = document.getElementById('weak-spot-banner');
    const countEl = document.getElementById('weak-spot-count');
    if (!banner) return;

    try {
      const pool = await this.getWeakSpotPool();
      if (pool.length > 0) {
        banner.style.display = 'flex';
        if (countEl) countEl.textContent = `${pool.length} Question${pool.length === 1 ? '' : 's'} in Pool`;
      } else {
        banner.style.display = 'none';
      }
    } catch (e) {
      banner.style.display = 'none';
    }
  },

  async startWeakSpotRevisionTest() {
    const studentPin = this.getStudentPin();
    if (!studentPin) {
      this.showToast('Please enter your 6-digit Student PIN to access your personal revision pool', 'info');
      this.openStudentLoginModal('weak_spot_custom');
      return;
    }

    this.showToast('Assembling targeted revision test...', 'info');
    try {
      const pool = await this.getWeakSpotPool();
      if (!pool || pool.length === 0) {
        this.showToast('No wrong or unattempted questions found! You are all caught up.', 'success');
        return;
      }

      // Shuffle pool using Fisher-Yates
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Select up to 10 questions (if list shorter than 10, take all)
      const selectedQuestions = shuffled.slice(0, 10);

      const customQuiz = {
        id: `weak_spot_${Date.now()}`,
        title: `Targeted Revision Test (${selectedQuestions.length} Questions)`,
        description: `Randomly selected from your past wrong & unattempted questions across all assignments.`,
        category: 'Weak-Spot Revision',
        positive_marks: 4,
        negative_marks: 1,
        time_limit_minutes: selectedQuestions.length * 2, // 2 mins per question
        questions: selectedQuestions
      };

      this.switchView('player');
      QuizPlayer.startQuiz(customQuiz, 'exam', null, {
        name: this.getStudentName() || 'Anonymous Student',
        roll: this.getStudentRoll() || studentPin
      });
      this.showToast(`Starting revision test with ${selectedQuestions.length} questions!`, 'success');
    } catch (err) {
      this.showToast(`Error creating revision test: ${err.message}`, 'error');
    }
  },

  updateStatsRibbon(stats) {
    if (!stats) return;
    document.getElementById('stat-total-quizzes').textContent = stats.total_quizzes || 0;
    document.getElementById('stat-total-questions').textContent = stats.total_questions || 0;
    document.getElementById('stat-total-attempts').textContent = stats.total_attempts || 0;
    document.getElementById('stat-avg-score').textContent = `${stats.average_score || 0}%`;
  },

  renderCategoryChips() {
    const container = document.getElementById('category-chips');
    if (!container) return;
    container.innerHTML = '';
  },

  renderDashboardCards() {
    const grid = document.getElementById('quizzes-grid');
    grid.innerHTML = '';

    const searchTerm = document.getElementById('search-quizzes').value.toLowerCase().trim();

    const filtered = this.allQuizzes.filter(q => {
      const matchesSearch = !searchTerm ||
        q.title.toLowerCase().includes(searchTerm) ||
        (q.category && q.category.toLowerCase().includes(searchTerm)) ||
        (q.description && q.description.toLowerCase().includes(searchTerm));
      return matchesSearch;
    });

    if (this.allQuizzes.length === 0) {
      const createBtnHtml = this.isTeacherMode
        ? `<button class="btn btn-primary" onclick="App.showBuilder()">+ Create Assessment</button>`
        : `<p style="font-size:0.875rem; color:var(--text-muted); margin-top:0.5rem;">Please check back soon or notify your teacher.</p>`;

      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4.5rem 1.5rem; color: var(--text-muted);">
          <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1rem; color: var(--accent-indigo);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.35rem;">No assessments yet</h3>
          <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1.5rem; max-width: 380px; margin-left: auto; margin-right: auto;">
            ${this.isTeacherMode ? 'Get started by authoring a new assessment or importing questions from text or JSON.' : 'No assessments are published at this moment.'}
          </p>
          ${createBtnHtml}
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
          <p style="font-size: 1.05rem; color: var(--text-secondary); margin-bottom: 1rem;">No assessments match "${this.escapeHtml(searchTerm)}"</p>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('search-quizzes').value=''; App.renderDashboardCards();">Clear Search</button>
        </div>
      `;
      return;
    }

    filtered.forEach(q => {
      const card = document.createElement('div');
      card.className = 'quiz-card';

      const timeText = q.time_limit_minutes > 0 ? `${q.time_limit_minutes}m` : 'Untimed';
      const scoreBadge = q.best_score_percent !== null && q.best_score_percent !== undefined
        ? `<span class="badge badge-emerald">Best: ${Math.round(q.best_score_percent)}%</span>`
        : `<span class="badge badge-slate">Unattempted</span>`;

      const isPub = q.is_published !== 0 && q.is_published !== false;
      const pubBadgeHtml = this.isTeacherMode
        ? (isPub
            ? `<span class="badge badge-emerald" style="display:inline-flex;align-items:center;gap:4px;" title="Visible to students"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> Published</span>`
            : `<span class="badge badge-amber" style="display:inline-flex;align-items:center;gap:4px;background:rgba(245,158,11,0.15);color:var(--accent-amber);border:1px solid rgba(245,158,11,0.3);" title="Draft: Hidden from students"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> Draft</span>`)
        : '';

      const pubBtnHtml = this.isTeacherMode
        ? (isPub
            ? `<button class="btn btn-outline btn-sm btn-toggle-publish" title="Unpublish this assessment so students cannot see or attempt it" style="color:var(--accent-amber);border-color:rgba(245,158,11,0.35);">
                 <span>Unpublish</span>
               </button>`
            : `<button class="btn btn-success btn-sm btn-toggle-publish" title="Publish this assessment so students can take it" style="gap:0.35rem;">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                 <span>Publish</span>
               </button>`)
        : '';

      const editBtnHtml = this.isTeacherMode
        ? `<button class="btn btn-outline btn-sm btn-edit-quiz" title="Edit Assessment">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
           </button>`
        : '';
      const delBtnHtml = this.isTeacherMode
        ? `<button class="btn btn-danger btn-sm btn-del-quiz" title="Delete Assessment">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
           </button>`
        : '';
      const practiceBtnHtml = this.isTeacherMode
        ? `<button class="btn btn-secondary btn-sm btn-start-practice" title="Practice mode with instant answer reveal" style="gap: 0.45rem;">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
             <span>Practice</span>
           </button>`
        : '';

      card.innerHTML = `
        <div>
          <div class="quiz-meta">
            <span class="badge badge-indigo">${this.escapeHtml(q.category || 'General')}</span>
            ${pubBadgeHtml}
            ${scoreBadge}
          </div>
          <h2 class="quiz-title">${this.escapeHtml(q.title)}</h2>
          <p class="quiz-desc">${this.escapeHtml(q.description || 'No description provided.')}</p>
        </div>

        <div>
          <div class="quiz-info-row">
            <div class="quiz-info-item">
              <span style="display:inline-flex;align-items:center;gap:5px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <b style="color:var(--text-primary);">${q.question_count || 0}</b> Qs
              </span>
            </div>
            <div class="quiz-info-item">
              <span>·</span>
              <span style="display:inline-flex;align-items:center;gap:5px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <b style="color:var(--text-primary);">${timeText}</b>
              </span>
            </div>
            <div class="quiz-info-item">
              <span>·</span>
              <span style="display:inline-flex;align-items:center;gap:5px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <b style="color:var(--text-primary);">${q.attempt_count || 0}</b> attempts
              </span>
            </div>
          </div>

          <div class="quiz-card-actions">
            <button class="btn btn-primary btn-sm btn-start-exam" style="flex: 2; gap: 0.45rem;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>${this.isTeacherMode ? 'Take Exam' : 'Take Assignment'}</span>
            </button>
            ${practiceBtnHtml}
            ${pubBtnHtml}
            ${editBtnHtml}
            ${delBtnHtml}
          </div>
        </div>
      `;

      card.querySelector('.btn-start-exam').addEventListener('click', () => {
        this.promptCandidateDetails(q.id, 'exam');
      });
      const practiceBtn = card.querySelector('.btn-start-practice');
      if (practiceBtn) {
        practiceBtn.addEventListener('click', () => {
          this.startQuiz(q.id, 'practice');
        });
      }
      const pubToggleBtn = card.querySelector('.btn-toggle-publish');
      if (pubToggleBtn) {
        pubToggleBtn.addEventListener('click', async () => {
          const newStatus = !isPub;
          pubToggleBtn.disabled = true;
          try {
            await API.setQuizPublished(q.id, newStatus);
            this.showToast(newStatus ? `"${q.title}" published! Live for students.` : `"${q.title}" unpublished (saved as draft).`, 'success');
            await this.showDashboard(true);
          } catch (e) {
            this.showToast(`Failed to update publish status: ${e.message}`, 'error');
            pubToggleBtn.disabled = false;
          }
        });
      }
      const editBtn = card.querySelector('.btn-edit-quiz');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          this.editQuiz(q.id);
        });
      }
      const delBtn = card.querySelector('.btn-del-quiz');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          this.deleteQuiz(q.id, q.title);
        });
      }

      grid.appendChild(card);
    });
  },

  /* ==================== TEST HISTORY FEATURE ==================== */
  async showHistory() {
    this.switchView('history');
    const container = document.getElementById('history-list');
    const chartCard = document.getElementById('student-performance-card');
    if (chartCard) chartCard.style.display = 'none';

    container.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">Loading records...</div>';

    // If student mode and not logged in with PIN, prompt to log in
    if (!this.isTeacherMode && !this.getStudentPin()) {
      if (chartCard) chartCard.style.display = 'none';
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1.5rem; color: var(--text-muted);">
          <div style="font-size: 2.25rem; margin-bottom: 0.75rem;">🔒</div>
          <p style="font-size: 1.15rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">Student Authentication Required</p>
          <p style="font-size: 0.875rem; color: var(--text-secondary); max-width: 440px; margin: 0 auto 1.5rem; line-height: 1.5;">
            To ensure complete privacy, your assessment history and revision questions are private to you. Please log in with your 6-digit PIN and name to view your records.
          </p>
          <button class="btn btn-primary" onclick="App.openStudentLoginModal()">Log In with 6-Digit PIN</button>
        </div>
      `;
      const btnClearHistory = document.getElementById('btn-clear-history');
      if (btnClearHistory) btnClearHistory.style.display = 'none';
      return;
    }

    try {
      this.allAttempts = await API.getAllAttempts();
      this.refreshHistoryBadge();

      const btnClearHistory = document.getElementById('btn-clear-history');
      if (btnClearHistory) {
        btnClearHistory.style.display = (this.isTeacherMode && this.allAttempts.length > 0) ? 'inline-flex' : 'none';
      }

      if (this.allAttempts.length === 0) {
        if (chartCard) chartCard.style.display = 'none';
        const studentName = this.getStudentName();
        const pin = this.getStudentPin();
        const greeting = studentName ? `for ${studentName}` : (pin ? `for Student #${pin}` : '');
        container.innerHTML = `
          <div style="text-align: center; padding: 4rem 1.5rem; color: var(--text-muted);">
            <p style="font-size: 1.05rem; color: var(--text-secondary); margin-bottom: 0.5rem;">No test attempts recorded yet ${greeting}</p>
            <p style="font-size: 0.85rem; margin-bottom: 1.25rem;">Complete an assessment in Exam mode to view your personalized performance history.</p>
            <button class="btn btn-primary" onclick="App.showDashboard()">Browse Assignments</button>
          </div>
        `;
        return;
      }

      // TEACHER VIEW: Submissions & Integrity Audit Table
      if (this.isTeacherMode) {
        if (chartCard) chartCard.style.display = 'none';
        let tableHtml = `
          <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.875rem; color:var(--text-secondary);">
              Showing <b>${this.allAttempts.length}</b> student test submissions with integrity &amp; warning audit.
            </div>
          </div>
          <div style="overflow-x:auto; background:var(--bg-surface); border:1px solid var(--border-default); border-radius:var(--radius-md);">
            <table class="submissions-table">
              <thead>
                <tr>
                  <th>Student Candidate</th>
                  <th>Roll / ID</th>
                  <th>Assessment Paper</th>
                  <th>Marks &amp; Score</th>
                  <th>Anti-Cheat Warnings</th>
                  <th>Submitted At</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
        `;

        this.allAttempts.forEach(att => {
          const percent = Math.round(att.score_percent || 0);
          const vCount = att.violations_count || 0;
          const isDisq = Boolean(att.is_disqualified);

          let vBadge = '';
          if (isDisq) {
            vBadge = `<span class="badge-warning-count flagged" title="Disqualified: multiple violations">❌ Disqualified (${vCount} violations)</span>`;
          } else if (vCount > 0) {
            vBadge = `<span class="badge-warning-count flagged" title="Window switches detected">⚠️ ${vCount} Warning${vCount === 1 ? '' : 's'}</span>`;
          } else {
            vBadge = `<span class="badge-warning-count clean">✓ 0 Warnings (Clean)</span>`;
          }

          let dateStr = att.completed_at;
          try {
            const d = new Date(att.completed_at + 'Z');
            dateStr = d.toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
          } catch(e) {}

          const netMarks = att.net_marks !== null && att.net_marks !== undefined ? att.net_marks : att.score;
          const maxMarks = att.max_marks || (att.total_questions * 4);

          tableHtml += `
            <tr data-attempt-id="${att.attempt_id}">
              <td>
                <b style="color:var(--text-primary); font-size:0.9rem;">${this.escapeHtml(att.student_name || 'Anonymous Student')}</b>
              </td>
              <td>
                <code style="color:var(--text-secondary);">${this.escapeHtml(att.student_roll || '—')}</code>
              </td>
              <td>
                <span style="font-weight:500;">${this.escapeHtml(att.quiz_title)}</span>
              </td>
              <td>
                <span style="font-weight:600; color:${netMarks >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">${netMarks > 0 ? '+' : ''}${netMarks} / ${maxMarks}</span>
                <span style="font-size:0.75rem; color:var(--text-muted); margin-left:4px;">(${percent}%)</span>
              </td>
              <td>
                ${vBadge}
              </td>
              <td style="font-size:0.8rem; color:var(--text-muted);">
                ${dateStr}
              </td>
              <td style="text-align:right;">
                <button class="btn btn-outline btn-sm btn-inspect-sub" data-id="${att.attempt_id}" style="margin-right:4px;">Inspect</button>
                <button class="btn btn-outline btn-sm btn-del-sub" data-id="${att.attempt_id}" title="Delete Submission" style="color:var(--accent-rose);">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </td>
            </tr>
          `;
        });

        tableHtml += `</tbody></table></div>`;
        container.innerHTML = tableHtml;

        container.querySelectorAll('.btn-inspect-sub').forEach(btn => {
          btn.addEventListener('click', () => {
            this.inspectAttempt(parseInt(btn.getAttribute('data-id'), 10));
          });
        });

        container.querySelectorAll('.btn-del-sub').forEach(btn => {
          btn.addEventListener('click', async () => {
            const attId = parseInt(btn.getAttribute('data-id'), 10);
            if (confirm('Are you sure you want to delete this student submission record?')) {
              try {
                await API.deleteAttempt(attId);
                this.showToast('Submission record deleted', 'success');
                this.showHistory();
              } catch (err) {
                this.showToast(`Delete failed: ${err.message}`, 'error');
              }
            }
          });
        });

        return;
      }

      // STUDENT VIEW: Candidate's own past attempts
      this.renderPerformanceChart(this.allAttempts);

      container.innerHTML = '';
      this.allAttempts.forEach(att => {
        const row = document.createElement('div');
        row.className = 'history-item-row';

        const percent = Math.round(att.score_percent || 0);
        const isPassed = percent >= 70;
        const statusBadge = isPassed
          ? `<span class="badge badge-emerald">${percent}% — Passed</span>`
          : `<span class="badge badge-rose">${percent}% — Below 70%</span>`;

        let dateStr = att.completed_at;
        try {
          const d = new Date(att.completed_at + 'Z');
          dateStr = d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {}

        const mins = Math.floor((att.time_taken_seconds || 0) / 60);
        const secs = (att.time_taken_seconds || 0) % 60;
        const durationText = `${mins}m ${secs}s`;

        const missedCount = (att.total_questions || 0) - (att.score || 0);
        const drillBtnHtml = missedCount > 0
          ? `<button class="btn btn-secondary btn-sm btn-drill-att" title="Drill ${missedCount} missed questions">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
               <span>Drill (${missedCount})</span>
             </button>`
          : '';

        const isDisqualified = Boolean(att.is_disqualified);
        const vCount = att.violations_count || 0;
        let integrityBadgeHtml = '';
        if (isDisqualified) {
          integrityBadgeHtml = `<span class="badge badge-disqualified" title="Disqualified: Exceeded maximum window switches">❌ Disqualified</span>`;
        } else if (vCount > 0) {
          integrityBadgeHtml = `<span class="badge badge-amber" title="${vCount} window switches detected">⚠️ ${vCount} Warning${vCount === 1 ? '' : 's'}</span>`;
        }

        row.innerHTML = `
          <div class="history-item-main">
            <div class="history-item-title">
              <span>${this.escapeHtml(att.quiz_title)}</span>
              <span class="badge badge-indigo">${this.escapeHtml(att.category || 'General')}</span>
              ${integrityBadgeHtml}
            </div>
            <div class="history-item-meta">
              <span>Candidate: <b>${this.escapeHtml(att.student_name || 'Anonymous Student')}</b></span>
              <span>·</span>
              <span>Completed ${dateStr}</span>
              <span>·</span>
              <span>${att.total_questions} questions</span>
              <span>·</span>
              <span>Duration: ${durationText}</span>
            </div>
          </div>

          <div class="history-item-score">
            ${statusBadge}
            ${(att.net_marks !== null && att.net_marks !== undefined)
              ? `<span style="font-size:0.775rem; font-weight:600; color:${att.net_marks >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'}; margin-top:0.2rem;">Net: ${att.net_marks > 0 ? '+' : ''}${att.net_marks} / ${att.max_marks || (att.total_questions * 4)} Marks</span>`
              : `<span style="font-size:0.775rem; color:var(--text-muted); margin-top:0.25rem;">Score: ${att.score} / ${att.total_questions}</span>`}
          </div>

          <div class="history-item-actions">
            ${drillBtnHtml}
            <button class="btn btn-outline btn-sm btn-inspect-att">Review</button>
            <button class="btn btn-outline btn-sm btn-reattempt-att">Reattempt</button>
          </div>
        `;

        if (missedCount > 0) {
          const drillBtn = row.querySelector('.btn-drill-att');
          if (drillBtn) {
            drillBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              try {
                const detail = await API.getAttemptDetail(att.attempt_id);
                if (detail && detail.quiz) {
                  this.startMissedQuestionsDrill(detail.quiz, detail.answers || {});
                }
              } catch (err) {
                this.showToast(`Error starting drill: ${err.message}`, 'error');
              }
            });
          }
        }

        row.querySelector('.btn-inspect-att').addEventListener('click', (e) => {
          e.stopPropagation();
          this.inspectAttempt(att.attempt_id);
        });

        row.querySelector('.btn-reattempt-att').addEventListener('click', (e) => {
          e.stopPropagation();
          this.promptCandidateDetails(att.quiz_id, 'exam');
        });

        row.addEventListener('click', () => {
          this.inspectAttempt(att.attempt_id);
        });

        container.appendChild(row);
      });
    } catch (err) {
      container.innerHTML = `<div style="padding: 2.5rem; text-align: center; color: var(--accent-rose);">Error loading records: ${err.message}</div>`;
    }
  },

  renderPerformanceChart(attempts) {
    const card = document.getElementById('student-performance-card');
    if (!card || !attempts || attempts.length === 0 || this.isTeacherMode) {
      if (card) card.style.display = 'none';
      return;
    }

    // Chronological order: oldest attempt first (index 0) to newest attempt (index N - 1)
    const chronological = [...attempts].reverse();
    const count = chronological.length;

    // Summary statistics
    const latestScore = Math.round(chronological[count - 1].score_percent || 0);
    const previousScore = count > 1 ? Math.round(chronological[count - 2].score_percent || 0) : null;
    const avgScore = Math.round(chronological.reduce((acc, a) => acc + (a.score_percent || 0), 0) / count);
    const maxScore = Math.round(Math.max(...chronological.map(a => a.score_percent || 0)));

    let trendBadge = '';
    if (previousScore !== null) {
      const diff = latestScore - previousScore;
      if (diff > 0) {
        trendBadge = `<span style="color:var(--accent-emerald); font-weight:700;">↑ +${diff}%</span>`;
      } else if (diff < 0) {
        trendBadge = `<span style="color:var(--accent-rose); font-weight:700;">↓ ${diff}%</span>`;
      } else {
        trendBadge = `<span style="color:var(--text-muted); font-weight:700;">= 0%</span>`;
      }
    }

    // SVG Layout Dimensions
    const W = 800;
    const H = 260;
    const padL = 58;
    const padR = 40;
    const padT = 32;
    const padB = 58;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Y scale: 0% at bottom (padT + plotH), 100% at top (padT)
    const getY = (pct) => {
      const clamped = Math.max(0, Math.min(100, pct));
      return padT + plotH - (clamped / 100) * plotH;
    };

    // X scale: attempt positions
    const getX = (idx) => {
      if (count === 1) return padL + plotW / 2;
      return padL + (idx / (count - 1)) * plotW;
    };

    // Build Y-axis gridlines and labels
    const yTicks = [0, 25, 50, 75, 100];
    let yGridHtml = '';
    yTicks.forEach(val => {
      const y = getY(val);
      const isBase = val === 0;
      yGridHtml += `
        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" 
              stroke="${isBase ? 'var(--border-default)' : 'var(--border-subtle)'}" 
              stroke-width="${isBase ? 1.5 : 1}" 
              stroke-dasharray="${isBase ? 'none' : '3,3'}" />
        <text x="${padL - 10}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="11" font-family="var(--font-mono)">${val}%</text>
      `;
    });

    // 70% Target threshold guide line
    const y70 = getY(70);
    const targetGuideHtml = `
      <line x1="${padL}" y1="${y70}" x2="${W - padR}" y2="${y70}" 
            stroke="var(--accent-emerald)" stroke-width="1.2" stroke-dasharray="4,4" opacity="0.65" />
      <text x="${W - padR}" y="${y70 - 6}" text-anchor="end" fill="var(--accent-emerald)" font-size="10" font-weight="600" opacity="0.85">70% TARGET</text>
    `;

    // Coordinates of all attempt points
    const points = chronological.map((att, i) => {
      const pct = att.score_percent !== null && att.score_percent !== undefined ? att.score_percent : (att.score / (att.total_questions || 1) * 100);
      return {
        att,
        index: i,
        score: Math.round(pct),
        x: Math.round(getX(i) * 10) / 10,
        y: Math.round(getY(pct) * 10) / 10
      };
    });

    // Path Line and Gradient Area
    let linePathD = '';
    let areaPathD = '';
    if (count > 1) {
      linePathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
      const baseY = padT + plotH;
      areaPathD = `M ${points[0].x},${baseY} L ${points.map(p => `${p.x},${p.y}`).join(' L ')} L ${points[points.length - 1].x},${baseY} Z`;
    } else if (count === 1) {
      linePathD = `M ${padL},${points[0].y} L ${W - padR},${points[0].y}`;
    }

    // X-Axis baseline and ticks
    let xTicksHtml = '';
    points.forEach((p, idx) => {
      let dateLabel = 'Att #' + (idx + 1);
      try {
        const d = new Date(p.att.completed_at.replace(' ', 'T') + 'Z');
        dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } catch (e) {
        dateLabel = (p.att.completed_at || '').split(' ')[0] || ('#' + (idx + 1));
      }

      xTicksHtml += `
        <line x1="${p.x}" y1="${padT + plotH}" x2="${p.x}" y2="${padT + plotH + 5}" stroke="var(--border-default)" stroke-width="1.2" />
        <text x="${p.x}" y="${padT + plotH + 18}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-weight="600">Att #${idx + 1}</text>
        <text x="${p.x}" y="${padT + plotH + 32}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${dateLabel}</text>
      `;
    });

    // Data points & interactive hover targets
    let pointsHtml = '';
    points.forEach(p => {
      const isPassed = p.score >= 70;
      const pointColor = isPassed ? 'var(--accent-emerald)' : 'var(--accent-rose)';

      pointsHtml += `
        <g class="chart-point-target" data-idx="${p.index}" tabindex="0">
          <circle cx="${p.x}" cy="${p.y}" r="8" fill="${pointColor}" class="point-halo" opacity="0.2" />
          <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${pointColor}" stroke="var(--bg-canvas)" stroke-width="2" />
          <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" fill="${pointColor}" font-size="10.5" font-weight="700" font-family="var(--font-mono)">${p.score}%</text>
          <circle cx="${p.x}" cy="${p.y}" r="18" fill="transparent" class="point-hitbox" />
        </g>
      `;
    });

    card.innerHTML = `
      <div class="chart-header-row">
        <div class="chart-title-area">
          <div class="chart-icon-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
          <div>
            <h3 class="chart-title-text">Performance Trajectory</h3>
            <p class="chart-subtitle-text">Test score % progression across chronological attempts</p>
          </div>
        </div>

        <div class="chart-stats-pills">
          <div class="chart-pill">
            <span class="chart-pill-key">Latest:</span>
            <span class="chart-pill-val" style="color:${latestScore >= 70 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">${latestScore}%</span>
            ${trendBadge ? `<span style="font-size:0.75rem; margin-left:2px;">${trendBadge}</span>` : ''}
          </div>
          <div class="chart-pill">
            <span class="chart-pill-key">Average:</span>
            <span class="chart-pill-val">${avgScore}%</span>
          </div>
          <div class="chart-pill">
            <span class="chart-pill-key">Highest:</span>
            <span class="chart-pill-val" style="color:var(--accent-emerald);">${maxScore}%</span>
          </div>
          <div class="chart-pill">
            <span class="chart-pill-key">Total Tests:</span>
            <span class="chart-pill-val">${count}</span>
          </div>
        </div>
      </div>

      <div class="chart-svg-container" id="chart-svg-container">
        <div class="chart-tooltip" id="perf-chart-tooltip"></div>
        <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent-emerald)" stop-opacity="0.25" />
              <stop offset="100%" stop-color="var(--accent-emerald)" stop-opacity="0.0" />
            </linearGradient>
          </defs>

          <!-- Y-Axis Title -->
          <text transform="rotate(-90)" x="${-(padT + plotH / 2)}" y="16" fill="var(--text-muted)" font-size="10" font-weight="600" text-anchor="middle" letter-spacing="0.06em">SCORE (%)</text>

          <!-- Grid Lines & Labels -->
          ${yGridHtml}
          ${targetGuideHtml}

          <!-- Area & Line Graph -->
          ${areaPathD ? `<path d="${areaPathD}" fill="url(#perfGradient)" />` : ''}
          ${count > 1 ? `<path d="${linePathD}" fill="none" stroke="var(--accent-emerald)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />` : ''}
          ${count === 1 ? `<path d="${linePathD}" fill="none" stroke="rgba(16, 185, 129, 0.4)" stroke-width="1.5" stroke-dasharray="4,4" />` : ''}

          <!-- X-Axis Baseline & Ticks -->
          <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--border-default)" stroke-width="1.5" />
          ${xTicksHtml}

          <!-- Data Points -->
          ${pointsHtml}
        </svg>
      </div>
    `;

    card.style.display = 'block';

    // Interactive Tooltip Binding
    const svgContainer = card.querySelector('#chart-svg-container');
    const tooltip = card.querySelector('#perf-chart-tooltip');

    card.querySelectorAll('.chart-point-target').forEach(el => {
      const idx = parseInt(el.getAttribute('data-idx'), 10);
      const p = points[idx];
      if (!p) return;

      const showTip = () => {
        let dateStr = p.att.completed_at || '';
        try {
          const d = new Date(p.att.completed_at.replace(' ', 'T') + 'Z');
          dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch(e) {}

        const netMarks = p.att.net_marks !== null && p.att.net_marks !== undefined ? p.att.net_marks : p.att.score;
        const maxMarks = p.att.max_marks || (p.att.total_questions * 4);
        const isPassed = p.score >= 70;

        tooltip.innerHTML = `
          <div class="chart-tooltip-title">${this.escapeHtml(p.att.quiz_title || 'Assessment')}</div>
          <div class="chart-tooltip-meta">
            <span style="font-weight:700; color:${isPassed ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">${p.score}% (${isPassed ? 'Passed' : 'Needs Review'})</span>
            <span>·</span>
            <span>${netMarks > 0 ? '+' : ''}${netMarks} / ${maxMarks} Marks</span>
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">Attempt #${idx + 1} · ${dateStr}</div>
        `;

        const leftPercent = (p.x / W) * 100;
        const topPercent = (p.y / H) * 100;

        tooltip.style.left = `${leftPercent}%`;
        tooltip.style.top = `${topPercent}%`;
        tooltip.style.display = 'block';
        tooltip.style.opacity = '1';
      };

      const hideTip = () => {
        tooltip.style.display = 'none';
        tooltip.style.opacity = '0';
      };

      el.addEventListener('mouseenter', showTip);
      el.addEventListener('focus', showTip);
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('blur', hideTip);
    });
  },

  async inspectAttempt(attemptId) {
    try {
      const data = await API.getAttemptDetail(attemptId);
      if (!data || !data.quiz) {
        this.showToast('Could not load attempt details', 'error');
        return;
      }

      this.switchView('attempt-detail');

      // Populate summary header
      document.getElementById('detail-quiz-title').textContent = data.quiz_title;
      document.getElementById('detail-category').textContent = data.category || 'General';

      let dateStr = data.completed_at;
      try {
        const d = new Date(data.completed_at + 'Z');
        dateStr = d.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        // fallback
      }
      const candInfo = data.student_name ? `Candidate: ${data.student_name}${data.student_roll ? ` (ID: ${data.student_roll})` : ''} · ` : '';
      document.getElementById('detail-timestamp').textContent = `${candInfo}Completed on ${dateStr}`;

      const posMarks = (data.positive_marks !== undefined && data.positive_marks !== null) ? parseFloat(data.positive_marks) : 4.0;
      const negMarks = (data.negative_marks !== undefined && data.negative_marks !== null) ? parseFloat(data.negative_marks) : 1.0;
      const grossEarned = data.positive_score !== null && data.positive_score !== undefined ? data.positive_score : (data.score * posMarks);
      const penaltyMarks = data.negative_penalty !== null && data.negative_penalty !== undefined ? data.negative_penalty : 0;
      const netMarks = data.net_marks !== null && data.net_marks !== undefined ? data.net_marks : (grossEarned - penaltyMarks);
      const maxMarks = data.max_marks !== null && data.max_marks !== undefined ? data.max_marks : (data.total_questions * posMarks);

      const percent = Math.round(data.score_percent || 0);
      const isPassed = percent >= 70;
      const statusBadge = document.getElementById('detail-status-badge');
      statusBadge.textContent = isPassed ? 'Passed (≥ 70%)' : 'Needs Review (< 70%)';
      statusBadge.className = isPassed ? 'badge badge-emerald' : 'badge badge-rose';

      const integrityBadge = document.getElementById('detail-integrity-badge');
      if (integrityBadge) {
        const vCount = data.violations_count || 0;
        const isDisq = Boolean(data.is_disqualified);
        if (isDisq) {
          integrityBadge.textContent = `❌ Disqualified (${vCount} Violations)`;
          integrityBadge.className = 'badge badge-disqualified';
        } else if (vCount > 0) {
          integrityBadge.textContent = `⚠️ Security Flag (${vCount} Window Switch${vCount === 1 ? '' : 'es'})`;
          integrityBadge.className = 'badge badge-amber';
        } else {
          integrityBadge.textContent = '🛡️ Clean Attempt (0 Violations)';
          integrityBadge.className = 'badge badge-emerald';
        }
      }

      const jeePill = document.getElementById('detail-jee-marks-badge');
      if (jeePill) {
        jeePill.style.display = 'inline-flex';
        jeePill.textContent = `Net: ${netMarks > 0 ? '+' : ''}${netMarks} / ${maxMarks} Marks`;
      }

      const netMarksEl = document.getElementById('detail-net-marks');
      if (netMarksEl) {
        netMarksEl.textContent = `${netMarks > 0 ? '+' : ''}${netMarks} / ${maxMarks}`;
        netMarksEl.style.color = netMarks >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)';
      }
      const penaltyEl = document.getElementById('detail-penalty-marks');
      if (penaltyEl) penaltyEl.textContent = `-${penaltyMarks}`;

      document.getElementById('detail-score').textContent = `${data.score} / ${data.total_questions}`;
      document.getElementById('detail-percent').textContent = `${percent}%`;

      const mins = Math.floor((data.time_taken_seconds || 0) / 60);
      const secs = (data.time_taken_seconds || 0) % 60;
      document.getElementById('detail-duration').textContent = `${mins}m ${secs}s`;
      document.getElementById('detail-total-q').textContent = data.total_questions;

      // Reattempt button handler
      const reattemptBtn = document.getElementById('btn-detail-reattempt');
      reattemptBtn.onclick = () => {
        this.startQuiz(data.quiz_id, 'exam');
      };

      const userAnswers = data.answers || {};

      // Drill Missed Questions button handler
      const missedQuestions = data.quiz.questions.filter(q => {
        const userVal = userAnswers[q.id] !== undefined ? userAnswers[q.id] : userAnswers[String(q.id)];
        if (q.question_type === 'integer') {
          if (userVal === undefined || userVal === null || String(userVal).trim() === '') return true;
          const corrVal = q.correct_numerical_value;
          const tol = parseFloat(q.numerical_tolerance || 0);
          try {
            return !(corrVal !== null && corrVal !== undefined && Math.abs(parseFloat(userVal) - parseFloat(corrVal)) <= tol);
          } catch (e) {
            return true;
          }
        } else {
          const correctOpt = (q.options || []).find(o => o.is_correct);
          return !(userVal !== undefined && correctOpt && userVal === correctOpt.id);
        }
      });
      const missedCount = missedQuestions.length;
      const drillBtn = document.getElementById('btn-detail-drill-missed');
      const drillLabel = document.getElementById('detail-drill-label');
      if (drillBtn) {
        if (missedCount > 0) {
          drillBtn.style.display = 'inline-flex';
          if (drillLabel) drillLabel.textContent = `Drill Missed (${missedCount})`;
          drillBtn.onclick = () => {
            this.startMissedQuestionsDrill(data.quiz, userAnswers);
          };
        } else {
          drillBtn.style.display = 'none';
        }
      }

      // Anti-Cheating Integrity Audit Log (Violations breakdown)
      const auditCard = document.getElementById('detail-audit-card');
      const auditList = document.getElementById('detail-audit-list');
      const auditCount = document.getElementById('detail-audit-count');
      let vLogs = [];
      try {
        if (typeof data.violations_log === 'string') {
          vLogs = JSON.parse(data.violations_log || '[]');
        } else if (Array.isArray(data.violations_log)) {
          vLogs = data.violations_log;
        }
      } catch (e) {
        vLogs = [];
      }

      if (auditCard && auditList) {
        if (vLogs && vLogs.length > 0) {
          auditCard.style.display = 'block';
          if (auditCount) auditCount.textContent = `${vLogs.length} Security Incident${vLogs.length === 1 ? '' : 's'}`;
          auditList.innerHTML = '';
          vLogs.forEach((v, idx) => {
            const vRow = document.createElement('div');
            vRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.45rem 0.75rem; background:var(--bg-elevated); border:1px solid var(--border-default); border-radius:var(--radius-sm);';
            vRow.innerHTML = `
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span style="color:var(--accent-rose); font-weight:600;">#${idx + 1}</span>
                <span style="color:var(--text-primary); font-weight:500;">${this.escapeHtml(v.description || v.type || 'Window switch')}</span>
                ${v.questionIdx ? `<span class="badge badge-slate" style="font-size:0.7rem;">Question ${v.questionIdx}</span>` : ''}
              </div>
              <span style="color:var(--text-muted); font-size:0.75rem; font-family:monospace;">${this.escapeHtml(v.timestamp || '')}</span>
            `;
            auditList.appendChild(vRow);
          });
        } else {
          auditCard.style.display = 'none';
        }
      }

      // Render Questions Breakdown
      const questionsContainer = document.getElementById('detail-questions-list');
      questionsContainer.innerHTML = '';

      data.quiz.questions.forEach((q, idx) => {
        const userVal = userAnswers[q.id] !== undefined ? userAnswers[q.id] : userAnswers[String(q.id)];
        const item = this.renderQuestionReviewItem(q, idx, userVal, posMarks, negMarks);
        questionsContainer.appendChild(item);
      });

    } catch (err) {
      this.showToast(`Error inspecting attempt: ${err.message}`, 'error');
    }
  },

  startMissedQuestionsDrill(quiz, userAnswers = {}) {
    if (!quiz || !quiz.questions) return;

    // Filter to only missed questions (either not answered, or incorrect)
    const missedQuestions = quiz.questions.filter(q => {
      const userVal = userAnswers[q.id] !== undefined ? userAnswers[q.id] : userAnswers[String(q.id)];
      if (q.question_type === 'integer') {
        if (userVal === undefined || userVal === null || String(userVal).trim() === '') return true;
        const corrVal = q.correct_numerical_value;
        const tol = parseFloat(q.numerical_tolerance || 0);
        try {
          return !(corrVal !== null && corrVal !== undefined && Math.abs(parseFloat(userVal) - parseFloat(corrVal)) <= tol);
        } catch (e) {
          return true;
        }
      } else {
        const correctOpt = (q.options || []).find(o => o.is_correct);
        return !(userVal !== undefined && correctOpt && userVal === correctOpt.id);
      }
    });

    if (missedQuestions.length === 0) {
      this.showToast('No missed questions! You achieved 100% on this assessment.', 'success');
      return;
    }

    const drillQuiz = {
      id: quiz.id,
      title: `[Drill] ${quiz.title}`,
      description: `Targeted practice for ${missedQuestions.length} missed question${missedQuestions.length > 1 ? 's' : ''}`,
      category: quiz.category || 'Weak-Spot Drill',
      time_limit_minutes: 0,
      questions: JSON.parse(JSON.stringify(missedQuestions))
    };

    this.switchView('player');
    QuizPlayer.startQuiz(drillQuiz, 'drill', quiz);
    this.showToast(`Starting drill: ${missedQuestions.length} missed question${missedQuestions.length > 1 ? 's' : ''}`, 'info');
  },

  async startQuiz(quizId, mode = 'exam', candidateInfo = null) {
    try {
      const quiz = await API.getQuiz(quizId);
      if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        this.showToast('This assessment has no questions yet', 'error');
        return;
      }

      // Check if student has already submitted this test assignment
      const roll = (candidateInfo && candidateInfo.roll) || this.getStudentPin();
      if (mode === 'exam' && roll) {
        try {
          const attempts = await API.getAllAttempts();
          const numQid = parseInt(quizId, 10);
          const prior = attempts.find(a => a.quiz_id === numQid && (a.student_roll || '').trim() === roll.trim());
          if (prior) {
            this.showToast(`You have already completed and submitted this assessment (Attempt #${prior.id}). Each test assignment can only be submitted once.`, 'info');
            this.showHistory();
            return;
          }
        } catch (checkErr) {
          console.warn('Prior attempt verification check error (offline fallback):', checkErr);
        }
      }

      this.switchView('player');
      QuizPlayer.startQuiz(quiz, mode, null, candidateInfo);
    } catch (err) {
      this.showToast(`Error starting assessment: ${err.message}`, 'error');
    }
  },

  async editQuiz(quizId) {
    try {
      const quiz = await API.getQuiz(quizId);
      if (!quiz) return;
      this.switchView('builder');
      QuizBuilder.loadQuizForEditing(quiz);
    } catch (err) {
      this.showToast(`Error loading assessment: ${err.message}`, 'error');
    }
  },

  async deleteQuiz(quizId, title) {
    if (confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      try {
        await API.deleteQuiz(quizId);
        this.showToast('Assessment deleted successfully', 'success');
        this.showDashboard();
      } catch (err) {
        this.showToast(`Delete failed: ${err.message}`, 'error');
      }
    }
  },

  showBuilder() {
    this.switchView('builder');
    QuizBuilder.initNewQuiz();
  },

  showResults(data) {
    this.lastCompletedQuiz = data.quiz;
    this.switchView('results');
    this.refreshHistoryBadge();

    const posMarks = (data.quiz && data.quiz.positive_marks !== undefined && data.quiz.positive_marks !== null) ? parseFloat(data.quiz.positive_marks) : 4.0;
    const negMarks = (data.quiz && data.quiz.negative_marks !== undefined && data.quiz.negative_marks !== null) ? parseFloat(data.quiz.negative_marks) : 1.0;
    const grossEarned = data.positiveScore !== undefined ? data.positiveScore : (data.score * posMarks);
    const penaltyMarks = data.negativePenalty !== undefined ? data.negativePenalty : 0;
    const netMarks = data.netMarks !== undefined ? data.netMarks : (grossEarned - penaltyMarks);
    const maxMarks = data.maxMarks !== undefined ? data.maxMarks : (data.total * posMarks);

    const percent = Math.round((data.score / data.total) * 100);
    document.getElementById('results-percent').textContent = `${netMarks > 0 ? '+' : ''}${netMarks}`;
    const percentLabel = document.getElementById('results-percent-label');
    if (percentLabel) percentLabel.textContent = `Out of ${maxMarks} Max Marks`;

    const statusBadge = document.getElementById('results-status-badge');
    const circle = document.getElementById('results-score-circle');
    const jeePill = document.getElementById('results-jee-marks-pill');
    if (jeePill) {
      jeePill.textContent = `Net: ${netMarks > 0 ? '+' : ''}${netMarks} / ${maxMarks} Marks`;
    }

    if (data.isDrill && data.score === data.total) {
      statusBadge.textContent = 'Weak-Spots Mastered! (100%)';
      statusBadge.className = 'badge badge-emerald';
      circle.style.borderColor = 'var(--accent-emerald)';
      this.showToast('Weak-spots conquered! 100% accuracy on drilled questions.', 'success');
    } else if (percent >= 70) {
      statusBadge.textContent = 'Passed (≥ 70%)';
      statusBadge.className = 'badge badge-emerald';
      circle.style.borderColor = 'var(--accent-emerald)';
    } else {
      statusBadge.textContent = 'Needs Review (< 70%)';
      statusBadge.className = 'badge badge-rose';
      circle.style.borderColor = 'var(--accent-rose)';
    }

    // Automatically remove any question answered correctly in this test from the weak-spot pool
    try {
      const studentPin = this.getStudentPin();
      const storageKey = studentPin ? `quiz_mastered_ids_${studentPin}` : 'quiz_mastered_question_ids';
      const masteredIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
      let masteredSet = new Set(masteredIds);
      (data.quiz.questions || []).forEach(q => {
        const userVal = data.userAnswers[q.id] !== undefined ? data.userAnswers[q.id] : data.userAnswers[String(q.id)];
        let isCorrect = false;
        if (q.question_type === 'integer') {
          const hasAnswered = userVal !== undefined && userVal !== null && String(userVal).trim() !== '';
          const corrVal = q.correct_numerical_value;
          const tol = parseFloat(q.numerical_tolerance || 0);
          try {
            isCorrect = hasAnswered && (corrVal !== null && corrVal !== undefined) && Math.abs(parseFloat(userVal) - parseFloat(corrVal)) <= tol;
          } catch (e) {
            isCorrect = false;
          }
        } else {
          const hasAnswered = userVal !== undefined && userVal !== null;
          const correctOpt = (q.options || []).find(o => o.is_correct);
          isCorrect = hasAnswered && correctOpt && userVal === correctOpt.id;
        }

        if (isCorrect) {
          masteredSet.add(q.id);
        } else {
          // If answered wrong again, keep it in the weak pool (remove from mastered)
          masteredSet.delete(q.id);
        }
      });
      localStorage.setItem(storageKey, JSON.stringify(Array.from(masteredSet)));
    } catch (e) {}

    // Configure Drill Missed button
    const missedQuestions = (data.quiz.questions || []).filter(q => {
      const userVal = data.userAnswers[q.id] !== undefined ? data.userAnswers[q.id] : data.userAnswers[String(q.id)];
      if (q.question_type === 'integer') {
        if (userVal === undefined || userVal === null || String(userVal).trim() === '') return true;
        const corrVal = q.correct_numerical_value;
        const tol = parseFloat(q.numerical_tolerance || 0);
        try {
          return !(corrVal !== null && corrVal !== undefined && Math.abs(parseFloat(userVal) - parseFloat(corrVal)) <= tol);
        } catch (e) {
          return true;
        }
      } else {
        const correctOpt = (q.options || []).find(o => o.is_correct);
        return !(userVal !== undefined && correctOpt && userVal === correctOpt.id);
      }
    });

    const missedCount = missedQuestions.length;
    const drillBtn = document.getElementById('btn-results-drill-missed');
    const drillLabel = document.getElementById('results-drill-label');
    if (drillBtn) {
      if (missedCount > 0) {
        drillBtn.style.display = 'inline-flex';
        if (drillLabel) drillLabel.textContent = `Drill Missed (${missedCount})`;
        drillBtn.onclick = () => {
          this.startMissedQuestionsDrill(data.originalQuiz || data.quiz, data.userAnswers);
        };
      } else {
        drillBtn.style.display = 'none';
      }
    }

    // Summary boxes
    const correctCount = data.score;
    let answeredCount = 0;
    (data.quiz.questions || []).forEach(q => {
      const uVal = data.userAnswers[q.id] !== undefined ? data.userAnswers[q.id] : data.userAnswers[String(q.id)];
      if (uVal !== undefined && uVal !== null && String(uVal).trim() !== '') {
        answeredCount++;
      }
    });
    const incorrectCount = answeredCount - correctCount;
    const skippedCount = data.total - answeredCount;

    const grossEl = document.getElementById('summary-gross-marks');
    if (grossEl) grossEl.textContent = `+${grossEarned}`;
    const penEl = document.getElementById('summary-penalty-marks');
    if (penEl) penEl.textContent = `-${penaltyMarks}`;
    const netEl = document.getElementById('summary-net-marks');
    if (netEl) netEl.textContent = `${netMarks > 0 ? '+' : ''}${netMarks} / ${maxMarks}`;

    document.getElementById('summary-correct').textContent = correctCount;
    document.getElementById('summary-incorrect').textContent = incorrectCount;
    document.getElementById('summary-skipped').textContent = skippedCount;

    const mins = Math.floor(data.timeTaken / 60);
    const secs = data.timeTaken % 60;
    document.getElementById('summary-time').textContent = `${mins}m ${secs}s`;

    // Render Detailed Question Review
    const reviewContainer = document.getElementById('results-review-list');
    reviewContainer.innerHTML = '';

    data.quiz.questions.forEach((q, idx) => {
      const userVal = data.userAnswers[q.id] !== undefined ? data.userAnswers[q.id] : data.userAnswers[String(q.id)];
      const item = this.renderQuestionReviewItem(q, idx, userVal, posMarks, negMarks);
      reviewContainer.appendChild(item);
    });
  },

  renderQuestionReviewItem(q, idx, userVal, posMarks, negMarks) {
    const isInteger = q.question_type === 'integer';
    let isCorrect = false;
    let hasAnswered = false;
    let marksBadgeHtml = '';

    if (isInteger) {
      hasAnswered = userVal !== undefined && userVal !== null && String(userVal).trim() !== '';
      const corrVal = q.correct_numerical_value;
      const tol = parseFloat(q.numerical_tolerance || 0);
      try {
        isCorrect = hasAnswered && (corrVal !== null && corrVal !== undefined) && Math.abs(parseFloat(userVal) - parseFloat(corrVal)) <= tol;
      } catch (e) {}

      if (isCorrect) {
        marksBadgeHtml = `<span class="badge badge-emerald" style="font-size:0.75rem;">+${posMarks} Marks</span>`;
      } else if (hasAnswered) {
        // STRICT JEE RULE: Zero negative penalty for numerical / integer questions!
        marksBadgeHtml = `<span class="badge badge-slate" style="font-size:0.75rem;">0 Marks (No Penalty)</span>`;
      } else {
        marksBadgeHtml = `<span class="badge badge-slate" style="font-size:0.75rem;">0 Marks (Unattempted)</span>`;
      }
    } else {
      hasAnswered = userVal !== undefined && userVal !== null;
      const correctOpt = (q.options || []).find(o => o.is_correct);
      isCorrect = hasAnswered && correctOpt && userVal === correctOpt.id;

      if (isCorrect) {
        marksBadgeHtml = `<span class="badge badge-emerald" style="font-size:0.75rem;">+${posMarks} Marks</span>`;
      } else if (hasAnswered) {
        marksBadgeHtml = `<span class="badge badge-rose" style="font-size:0.75rem;">-${negMarks} Penalty</span>`;
      } else {
        marksBadgeHtml = `<span class="badge badge-slate" style="font-size:0.75rem;">0 Marks (Unattempted)</span>`;
      }
    }

    const item = document.createElement('div');
    item.className = `review-item ${isCorrect ? 'is-correct-item' : (hasAnswered ? 'is-incorrect-item' : 'is-neutral-item')}`;

    let imageHtml = '';
    if (q.image_url) {
      imageHtml = `
        <div class="review-image-box" onclick="App.openLightbox('${q.image_url}')" title="Click to enlarge diagram">
          <img src="${q.image_url}" alt="Question Diagram" />
        </div>
      `;
    }

    let answerContentHtml = '';
    if (isInteger) {
      const corrVal = q.correct_numerical_value;
      const tol = parseFloat(q.numerical_tolerance || 0);
      answerContentHtml = `
        <div style="background:var(--bg-surface-elevated); padding:0.85rem 1rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle); margin-top:0.6rem; display:flex; flex-direction:column; gap:0.4rem;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.85rem; color:var(--text-secondary);">Your Input:</span>
            <span style="font-family:var(--font-mono); font-weight:600; color:${hasAnswered ? (isCorrect ? 'var(--accent-emerald)' : 'var(--accent-rose)') : 'var(--text-muted)'};">
              ${hasAnswered ? this.escapeHtml(String(userVal)) : 'Not Attempted'}
            </span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.85rem; color:var(--text-secondary);">Correct Value:</span>
            <span style="font-family:var(--font-mono); font-weight:600; color:var(--accent-emerald);">
              ${corrVal !== null && corrVal !== undefined ? corrVal : 'N/A'}${tol > 0 ? ` (±${tol})` : ''}
            </span>
          </div>
        </div>
      `;
    } else {
      let optionsHtml = '';
      (q.options || []).forEach((opt) => {
        let optClass = 'opt-neutral';
        let label = '';
        if (opt.is_correct) {
          optClass = 'opt-correct';
          label = '✓ Correct Answer';
        } else if (hasAnswered && userVal === opt.id) {
          optClass = 'opt-wrong-choice';
          label = '✗ Your Choice';
        }

        const hasImg = Boolean(opt.image_url && opt.image_url.trim());
        const hasText = Boolean(opt.option_text && opt.option_text.trim());
        let optInner = '';
        if (hasImg) {
          optInner += `
            <div class="review-opt-img-box" onclick="App.openLightbox('${opt.image_url}')" title="Click to enlarge diagram">
              <img src="${opt.image_url}" alt="Option Diagram" />
            </div>
          `;
        }
        if (hasText || !hasImg) {
          optInner += `<span>${this.formatMathText(opt.option_text || '')}</span>`;
        }

        optionsHtml += `
          <div class="review-opt ${optClass}">
            <div style="display:flex; flex-direction:column; gap:0.4rem; flex:1;">
              ${optInner}
            </div>
            ${label ? `<small style="font-weight:600; margin-left:0.75rem; flex-shrink:0;">${label}</small>` : ''}
          </div>
        `;
      });
      answerContentHtml = `<div class="review-options">${optionsHtml}</div>`;
    }

    const statusLabel = isCorrect ? '✓ Correct' : (hasAnswered ? '✗ Incorrect' : '○ Unattempted');
    const statusColor = isCorrect ? 'var(--accent-emerald)' : (hasAnswered ? 'var(--accent-rose)' : 'var(--text-dim)');

    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
        <div class="review-q-num" style="color: ${statusColor};">
          Question ${idx + 1} (${isInteger ? 'Section B · Numerical' : 'Section A · MCQ'}) — ${statusLabel}
        </div>
        ${marksBadgeHtml}
      </div>
      <div class="review-q-text">${this.formatMathText(q.question_text)}</div>
      ${imageHtml}
      ${answerContentHtml}
      ${q.explanation ? `
        <div class="explanation-box" style="margin-top: 0.75rem;">
          <div class="explanation-title">Explanation</div>
          <div class="explanation-text">${this.formatMathText(q.explanation)}</div>
        </div>
      ` : ''}
    `;

    return item;
  },

  openLightbox(src) {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    img.src = src;
    modal.classList.add('active');
  },

  closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    modal.classList.remove('active');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  formatMathText(str) {
    if (!str) return '';
    if (typeof str !== 'string') str = String(str);

    // If KaTeX is not loaded yet or in non-browser context, use fallback
    if (typeof katex === 'undefined') {
      return this._fallbackFormatMath(str);
    }

    try {
      let text = str;

      // 0. Normalize accidental escaped entities and double-backslashes before commands
      text = text.replace(/&amp;/g, '&');
      text = text.replace(/\\([a-zA-Z])/g, (m, c) => '\\' + c);
      // If there are literal double backslashes before letters (e.g. \\begin, \\frac, \\ce)
      text = text.replace(/\\\\([a-zA-Z])/g, '\\$1');
      // Normalize quadruple backslashes to double backslashes for matrix row breaks
      while (text.indexOf('\\\\\\\\') !== -1) {
        text = text.replace(/\\\\\\\\/g, '\\\\');
      }

      const ktxBlocks = [];
      const storeBlock = (html) => {
        const id = '@@KTXBLOCK' + ktxBlocks.length + 'Z@@';
        ktxBlocks.push({ id, html });
        return id;
      };

      // 1. Process explicit display math: $$...$$ or \[...\]
      text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
        try {
          return storeBlock(katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }));
        } catch (e) {
          return storeBlock(`<span class="katex-error">${this.escapeHtml(math)}</span>`);
        }
      });
      text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
        try {
          return storeBlock(katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }));
        } catch (e) {
          return storeBlock(`<span class="katex-error">${this.escapeHtml(math)}</span>`);
        }
      });

      // 2. Process explicit inline math: $...$ or \(...\)
      text = text.replace(/(^|[^\\])\$([^\$]+)\$/g, (match, prefix, math) => {
        try {
          return prefix + storeBlock(katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }));
        } catch (e) {
          return prefix + storeBlock(`<span class="katex-error">${this.escapeHtml(math)}</span>`);
        }
      });
      text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
        try {
          return storeBlock(katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }));
        } catch (e) {
          return storeBlock(`<span class="katex-error">${this.escapeHtml(math)}</span>`);
        }
      });

      // 3. Process raw LaTeX environments without delimiters: determinants, matrices, cases, aligned
      const envRegex = /\\begin\{(vmatrix|Vmatrix|matrix|pmatrix|bmatrix|Bmatrix|cases|aligned|align|array)\}[\s\S]*?\\end\{\1\}/g;
      text = text.replace(envRegex, (match) => {
        try {
          return storeBlock(katex.renderToString(match.trim(), { displayMode: false, throwOnError: false }));
        } catch (e) {
          return storeBlock(`<span class="katex-error">${this.escapeHtml(match)}</span>`);
        }
      });

      // 4. Process raw chemical equations: \ce{...} or \pu{...} without delimiters
      const chemRegex = /\\(ce|pu)\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
      text = text.replace(chemRegex, (match) => {
        try {
          return storeBlock(katex.renderToString(match.trim(), { displayMode: false, throwOnError: false }));
        } catch (e) {
          return storeBlock(`<span class="katex-error">${this.escapeHtml(match)}</span>`);
        }
      });

      // 5. If the entire string is a standalone LaTeX formula (e.g. \frac{1}{\sqrt{2}} or \vec{F}=m\vec{a})
      const isStandaloneLatex = /^\s*\\([a-zA-Z]+|\^|_)/.test(text) && ktxBlocks.length === 0;
      if (isStandaloneLatex) {
        try {
          return katex.renderToString(text.trim(), { displayMode: false, throwOnError: false });
        } catch (e) {
          // Fall through to inline replacement
        }
      }

      // 6. Process common standalone TeX commands in mixed text: \frac, \sqrt, \vec, \hat, greek letters
      const inlineSymbolsRegex = /\\(frac\{[^{}]+\}\{[^{}]+\}|sqrt\{[^{}]+\}|vec\{[a-zA-Z0-9]\}+|hat\{[a-zA-Z0-9]\}+|alpha|beta|gamma|theta|pi|lambda|mu|omega|Delta|Omega|degree|pm|approx|neq|le|ge|infty|times|div|int)/g;
      text = text.replace(inlineSymbolsRegex, (match) => {
        try {
          return storeBlock(katex.renderToString(match, { displayMode: false, throwOnError: false }));
        } catch (e) {
          return match;
        }
      });

      // 7. For non-KaTeX text segments, escape HTML and apply subtle plain-text formatting (1st, 2nd, x^2)
      let result = this._formatPlainTextMath(text);

      // 8. Restore protected KaTeX blocks
      for (let i = 0; i < ktxBlocks.length; i++) {
        result = result.split(ktxBlocks[i].id).join(ktxBlocks[i].html);
      }

      return result;

    } catch (outerErr) {
      console.warn('LaTeX parse error:', outerErr);
      return this._fallbackFormatMath(str);
    }
  },

  _formatPlainTextMath(rawText) {
    if (!rawText) return '';
    let text = this.escapeHtml(rawText);

    // Simple superscripts & ordinals in plain text
    text = text.replace(/([a-zA-Z0-9\)])\^\{([^{}]+)\}/g, '$1<sup>$2</sup>');
    text = text.replace(/([a-zA-Z0-9\)])\^([a-zA-Z0-9\+\-]+)/g, '$1<sup>$2</sup>');
    text = text.replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1<sup>$2</sup>');
    text = text.replace(/\b([nNkK])\-?th\b/g, '$1<sup>th</sup>');

    // Simple subscripts in plain text
    text = text.replace(/([a-zA-Z0-9\)])\_\{([^{}]+)\}/g, '$1<sub>$2</sub>');
    text = text.replace(/([a-zA-Z0-9\)])\_([a-zA-Z0-9]+)/g, '$1<sub>$2</sub>');

    return text;
  },

  _fallbackFormatMath(str) {
    if (!str) return '';
    let text = this.escapeHtml(str);

    text = text.replace(/\\hat\{i\}/g, '<span class="math-vector">î</span>')
               .replace(/\\hat\{j\}/g, '<span class="math-vector">ĵ</span>')
               .replace(/\\hat\{k\}/g, '<span class="math-vector">k̂</span>')
               .replace(/\\vec\{([a-zA-Z])\}/g, '<span class="math-vector">$1&#8407;</span>');

    text = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');
    text = text.replace(/\\sqrt\{([^{}]+)\}/g, '&radic;<span class="math-sqrt">$1</span>');
    text = text.replace(/\\text\{([^{}]+)\}/g, '$1');

    text = text.replace(/([a-zA-Z0-9\)])\^\{([^{}]+)\}/g, '$1<sup>$2</sup>');
    text = text.replace(/([a-zA-Z0-9\)])\^([a-zA-Z0-9\+\-]+)/g, '$1<sup>$2</sup>');
    text = text.replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1<sup>$2</sup>');
    text = text.replace(/\b([nNkK])\-?th\b/g, '$1<sup>th</sup>');
    text = text.replace(/([a-zA-Z0-9\)])\_\{([^{}]+)\}/g, '$1<sub>$2</sub>');
    text = text.replace(/([a-zA-Z0-9\)])\_([a-zA-Z0-9]+)/g, '$1<sub>$2</sub>');

    const mathMap = {
      '\\\\alpha': '&alpha;', '\\\\beta': '&beta;', '\\\\gamma': '&gamma;',
      '\\\\theta': '&theta;', '\\\\lambda': '&lambda;', '\\\\mu': '&mu;',
      '\\\\pi': '&pi;', '\\\\omega': '&omega;', '\\\\Delta': '&Delta;',
      '\\\\Omega': '&Omega;', '\\\\pm': '&plusmn;', '\\\\times': '&times;',
      '\\\\div': '&divide;', '\\\\approx': '&asymp;', '\\\\neq': '&ne;',
      '\\\\le': '&le;', '\\\\ge': '&ge;', '\\\\infty': '&infin;',
      '\\\\int': '&int;', '\\\\degree': '&deg;'
    };
    for (const [pattern, rep] of Object.entries(mathMap)) {
      text = text.replace(new RegExp(pattern, 'g'), rep);
    }

    text = text.replace(/\$\$([\s\S]*?)\$\$/g, '<span class="math-display">$1</span>');
    text = text.replace(/\$([^\$]+)\$/g, '<span class="math-inline">$1</span>');

    return text;
  },

  closeApplication() {
    // 1. Native WebKit message handler for direct Libadwaita window exit
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.closeApp) {
        window.webkit.messageHandlers.closeApp.postMessage('quit');
        return;
      }
    } catch (e) {
      console.warn('WebKit messageHandler unavailable:', e);
    }

    // 2. HTTP shutdown signal to offline server
    try {
      fetch('/api/app/quit', { method: 'POST' }).catch(() => {});
      fetch('/api/app/quit', { method: 'GET' }).catch(() => {});
    } catch (e) {}

    // 3. Browser window.close()
    try {
      window.close();
    } catch (e) {}

    // 4. Elegant termination screen if browser security sandbox blocks tab closure
    setTimeout(() => {
      document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0c0d0f; color:#a1a1aa; font-family:system-ui,-apple-system,sans-serif; user-select:none;">
          <div style="width:44px; height:44px; border-radius:8px; background:#1a1b20; border:1px solid #2a2c35; display:flex; align-items:center; justify-content:center; color:#e4e4e7; margin-bottom:1.25rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
          <h2 style="font-size:1.15rem; font-weight:600; color:#ffffff; margin-bottom:0.4rem; letter-spacing:-0.01em;">Session Terminated</h2>
          <p style="font-size:0.875rem; color:#71717a;">QuizMaster has shut down. You may safely close this window.</p>
        </div>
      `;
    }, 150);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
