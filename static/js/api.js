/**
 * API client for the Offline Quiz Application.
 * Communicates with the local Python HTTP server.
 */

const API = {
  _teacherPin: '',

  getTeacherPin() {
    return sessionStorage.getItem('quiz_teacher_pin') || this._teacherPin || '';
  },

  setTeacherPin(pin) {
    this._teacherPin = pin || '';
    if (pin) {
      sessionStorage.setItem('quiz_teacher_pin', pin);
    } else {
      sessionStorage.removeItem('quiz_teacher_pin');
    }
  },

  getStudentPin() {
    return localStorage.getItem('quiz_student_pin') || '';
  },

  getHeaders(extra = {}) {
    const headers = { ...extra };
    const pin = this.getTeacherPin();
    if (pin) {
      headers['X-Teacher-PIN'] = pin;
    }
    const studentPin = this.getStudentPin();
    if (studentPin) {
      headers['X-Student-PIN'] = studentPin;
    }
    return headers;
  },

  async verifyTeacherPin(pin) {
    const res = await fetch('/api/teacher/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      this.setTeacherPin(pin);
      return true;
    }
    throw new Error(data.error || 'Incorrect Teacher PIN');
  },

  async getQuizzes() {
    const res = await fetch('/api/quizzes');
    if (!res.ok) throw new Error('Failed to fetch quizzes');
    const data = await res.json();
    return data.quizzes || [];
  },

  async getQuiz(id) {
    const res = await fetch(`/api/quizzes/${id}`);
    if (!res.ok) throw new Error('Quiz not found');
    const data = await res.json();
    return data.quiz;
  },

  async createQuiz(quizData) {
    const key = 'create_' + JSON.stringify(quizData);
    if (this._inFlight && this._inFlight.has(key)) {
      return this._inFlight.get(key);
    }
    if (!this._inFlight) this._inFlight = new Map();

    const promise = (async () => {
      try {
        const res = await fetch('/api/quizzes', {
          method: 'POST',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(quizData)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create quiz');
        }
        return await res.json();
      } finally {
        setTimeout(() => {
          if (this._inFlight) this._inFlight.delete(key);
        }, 2000);
      }
    })();

    this._inFlight.set(key, promise);
    return promise;
  },

  async updateQuiz(id, quizData) {
    const key = `update_${id}_` + JSON.stringify(quizData);
    if (this._inFlight && this._inFlight.has(key)) {
      return this._inFlight.get(key);
    }
    if (!this._inFlight) this._inFlight = new Map();

    const promise = (async () => {
      try {
        const res = await fetch(`/api/quizzes/${id}`, {
          method: 'PUT',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(quizData)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update quiz');
        }
        return await res.json();
      } finally {
        setTimeout(() => {
          if (this._inFlight) this._inFlight.delete(key);
        }, 2000);
      }
    })();

    this._inFlight.set(key, promise);
    return promise;
  },

  async deleteQuiz(id) {
    const res = await fetch(`/api/quizzes/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete quiz');
    }
    return await res.json();
  },

  async uploadImage(file) {
    // Standard multipart/form-data upload
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData
    });

    if (!res.ok) {
      // Fallback to base64 if multipart encountered any issue
      return await API.uploadImageBase64(file);
    }
    const data = await res.json();
    return data.url;
  },

  async uploadImageBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '.png';
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: this.getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ data: reader.result, extension: ext })
          });
          const data = await res.json();
          if (data.url) resolve(data.url);
          else reject(new Error(data.error || 'Upload failed'));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async recordAttempt(quizId, attemptData) {
    const key = `attempt_${quizId}_${attemptData.student_roll || ''}_${JSON.stringify(attemptData.answers || {})}`;
    if (this._inFlight && this._inFlight.has(key)) {
      return this._inFlight.get(key);
    }
    if (!this._inFlight) this._inFlight = new Map();

    const promise = (async () => {
      try {
        const res = await fetch(`/api/quizzes/${quizId}/attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attemptData)
        });
        if (!res.ok) throw new Error('Failed to save attempt');
        return await res.json();
      } finally {
        setTimeout(() => {
          if (this._inFlight) this._inFlight.delete(key);
        }, 3000);
      }
    })();

    this._inFlight.set(key, promise);
    return promise;
  },

  async getAttempts(quizId) {
    const res = await fetch(`/api/quizzes/${quizId}/attempts`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.attempts || [];
  },

  async getAllAttempts() {
    const res = await fetch('/api/attempts', {
      headers: this.getHeaders()
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.attempts || [];
  },

  async getAttemptDetail(attemptId) {
    const res = await fetch(`/api/attempts/${attemptId}`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Attempt details not found');
    const data = await res.json();
    return data.attempt;
  },

  async getStats() {
    const res = await fetch('/api/stats');
    if (!res.ok) return null;
    const data = await res.json();
    return data.stats;
  },

  async clearAllAttempts() {
    const res = await fetch('/api/attempts', {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to clear history');
    return await res.json();
  },

  async deleteAttempt(attemptId) {
    const res = await fetch(`/api/attempts/${attemptId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete attempt');
    return await res.json();
  }
};
